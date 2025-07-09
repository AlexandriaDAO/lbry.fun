use std::time::Duration;

use crate::{
    storage::*,
    types::*,
    utils::*,
    validation::*,
};

pub async fn execute_loops_impl(pool_id: u64, icp_amount: u64, number_of_loops: u32) -> Result<String, String> {
    ic_cdk::println!("[BOT1] Starting execute_loops for pool {} with {} ICP per loop, {} loops", 
        pool_id, icp_amount, number_of_loops);
    
    // Validate inputs
    if icp_amount == 0 {
        return Err("ICP amount must be greater than 0".to_string());
    }
    if number_of_loops == 0 {
        return Err("Number of loops must be greater than 0".to_string());
    }
    
    // Validate pool and execution parameters
    validate_execution_params(pool_id, icp_amount, number_of_loops).await?;
    
    // Get token info from lbry_fun canister
    let lbry_fun = get_lbry_fun_principal();
    let token_record = get_token_record(lbry_fun, pool_id).await
        .map_err(|e| format!("Failed to get token record: {}", e))?;
    
    // Cache token info
    let token_info = TokenInfo {
        primary_token_id: token_record.primary_token_id.to_string(),
        secondary_token_id: token_record.secondary_token_id.to_string(),
        icp_swap_canister_id: token_record.icp_swap_canister_id.to_string(),
        tokenomics_canister_id: token_record.tokenomics_canister_id.to_string(),
    };
    cache_token_info(pool_id, token_info.clone());
    
    // Get current state
    let mut cumulative_state = get_cumulative_state(pool_id);
    let bot_principal = ic_cdk::id();
    let bot_account = Account {
        owner: bot_principal,
        subaccount: None,
    };
    
    // Execute loops
    let mut successful_loops = 0;
    for loop_num in 1..=number_of_loops {
        match execute_single_loop(
            loop_num,
            pool_id,
            icp_amount,
            &token_record,
            &bot_account,
            &mut cumulative_state,
        ).await {
            Ok(_) => {
                successful_loops += 1;
                // Wait 2 seconds between loops to ensure clean separation
                if loop_num < number_of_loops {
                    ic_cdk_timers::set_timer(Duration::from_secs(2), || {});
                }
            }
            Err(e) => {
                return Err(format!("Loop {} failed: {}", loop_num, e));
            }
        }
    }
    
    Ok(format!("Successfully executed {} loops for pool {}", successful_loops, pool_id))
}

async fn execute_single_loop(
    loop_number: u32,
    pool_id: u64,
    icp_amount: u64,
    token_record: &TokenRecord,
    bot_account: &Account,
    cumulative_state: &mut CumulativeState,
) -> Result<(), String> {
    ic_cdk::println!("[BOT1] Loop {}: Starting execution for pool {}", loop_number, pool_id);
    let icp_ledger = get_icp_ledger_principal();
    
    // 1. Check ICP balance
    let icp_balance = icrc1_balance_of(icp_ledger, bot_account.clone()).await?;
    let required_amount = icp_amount + 20_000; // Add fees
    ic_cdk::println!("[BOT1] Loop {}: ICP balance: {} e8s, Required: {} e8s", 
        loop_number, icp_balance, required_amount);
    if icp_balance < required_amount {
        return Err(format!("Insufficient ICP. Required: {}, Available: {}", required_amount, icp_balance));
    }
    
    // 2. Approve ICP to icp_swap canister
    ic_cdk::println!("[BOT1] Loop {}: Approving {} ICP to icp_swap", loop_number, icp_amount + 10_000);
    icrc2_approve(icp_ledger, token_record.icp_swap_canister_id, icp_amount + 10_000).await
        .map_err(|e| format!("Failed to approve ICP: {}", e))?;
    
    // 3. Get initial balances
    let initial_secondary = icrc1_balance_of(token_record.secondary_token_id, bot_account.clone()).await?;
    let initial_primary = icrc1_balance_of(token_record.primary_token_id, bot_account.clone()).await?;
    
    // 4. Swap ICP for secondary tokens
    ic_cdk::println!("[BOT1] Loop {}: Swapping {} ICP for secondary tokens", loop_number, icp_amount);
    swap_icp(token_record.icp_swap_canister_id, icp_amount).await
        .map_err(|e| format!("Swap failed: {}", e))?;
    
    // 5. Get secondary balance after swap
    let secondary_balance = icrc1_balance_of(token_record.secondary_token_id, bot_account.clone()).await?;
    let secondary_received = secondary_balance.saturating_sub(initial_secondary);
    ic_cdk::println!("[BOT1] Loop {}: Received {} secondary tokens (e8s)", loop_number, secondary_received);
    
    if secondary_received == 0 {
        return Err("No secondary tokens received from swap".to_string());
    }
    
    // 6. Approve ALL secondary tokens to icp_swap
    icrc2_approve(token_record.secondary_token_id, token_record.icp_swap_canister_id, secondary_balance).await
        .map_err(|e| format!("Failed to approve secondary tokens: {}", e))?;
    
    // 7. Convert to natural units for burn (icp_swap expects natural units)
    // Account for the transfer fee that will be deducted
    let available_for_burn = secondary_balance.saturating_sub(SECONDARY_TOKEN_FEE);
    let burn_amount_natural = available_for_burn / E8S;
    
    ic_cdk::println!("[BOT1] Loop {}: Secondary balance: {} e8s, available after fee: {} e8s, burn amount: {} natural units", 
        loop_number, secondary_balance, available_for_burn, burn_amount_natural);
    
    if burn_amount_natural == 0 {
        return Err("Secondary balance too small to burn".to_string());
    }
    
    // 8. Burn secondary for primary
    ic_cdk::println!("[BOT1] Loop {}: Burning {} secondary tokens (natural units)", loop_number, burn_amount_natural);
    burn_secondary(token_record.icp_swap_canister_id, burn_amount_natural).await
        .map_err(|e| format!("Burn failed: {}", e))?;
    
    // 9. Get final balances
    let _final_secondary = icrc1_balance_of(token_record.secondary_token_id, bot_account.clone()).await?;
    let final_primary = icrc1_balance_of(token_record.primary_token_id, bot_account.clone()).await?;
    let primary_received = final_primary.saturating_sub(initial_primary);
    ic_cdk::println!("[BOT1] Loop {}: Received {} primary tokens (e8s)", loop_number, primary_received);
    
    // 10. Query total supplies
    let secondary_total_supply = icrc1_total_supply(token_record.secondary_token_id).await?;
    let primary_total_supply = icrc1_total_supply(token_record.primary_token_id).await?;
    
    // 11. Calculate metrics
    let secondary_burned = available_for_burn; // Already in E8S
    let secondary_dust = secondary_balance.saturating_sub(available_for_burn).saturating_sub(SECONDARY_TOKEN_FEE); // Remainder after burn and fee
    
    let actual_mint_rate = if secondary_burned > 0 {
        primary_received as f64 / secondary_burned as f64
    } else {
        0.0
    };
    
    let cost_per_primary = if primary_received > 0 {
        (icp_amount as f64 * EFFECTIVE_SECONDARY_COST) / primary_received as f64
    } else {
        0.0
    };
    
    // 12. Update cumulative state
    cumulative_state.total_icp_spent += icp_amount;
    cumulative_state.total_secondary_burned += secondary_burned;
    cumulative_state.total_primary_minted += primary_received;
    cumulative_state.total_dust += secondary_dust;
    
    // 13. Create and store snapshot
    let snapshot = LoopSnapshot {
        loop_number,
        icp_spent: icp_amount,
        secondary_received,
        secondary_burned,
        primary_received,
        secondary_total_supply,
        primary_total_supply,
        cumulative_icp_spent: cumulative_state.total_icp_spent,
        cumulative_secondary_burned: cumulative_state.total_secondary_burned,
        cumulative_primary_minted: cumulative_state.total_primary_minted,
        actual_mint_rate,
        cost_per_primary,
        secondary_dust,
    };
    
    add_snapshot(pool_id, snapshot);
    update_cumulative_state(pool_id, icp_amount, secondary_burned, primary_received, secondary_dust);
    
    ic_cdk::println!("[BOT1] Loop {} completed: ICP={}, Secondary burned={}, Primary minted={}, Dust={}", 
        loop_number, icp_amount, secondary_burned, primary_received, secondary_dust);
    
    Ok(())
}