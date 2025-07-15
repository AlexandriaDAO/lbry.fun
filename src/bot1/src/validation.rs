use candid::{CandidType, Deserialize};
use ic_cdk;
use crate::types::{TokenRecord, Account};
use crate::utils::{get_token_record, get_secondary_fun_principal, icrc1_balance_of, get_icp_ledger_principal};

#[derive(Debug, CandidType, Deserialize)]
pub struct PoolValidation {
    pub pool_exists: bool,
    pub is_live: bool,
    pub launch_time: u64,
    pub canisters_accessible: bool,
    pub bot_icp_balance: u64,
    pub estimated_cost_per_loop: u64,
    pub token_record: Option<TokenRecord>,
}

pub async fn validate_pool_ready(pool_id: u64, icp_per_loop: u64) -> Result<PoolValidation, String> {
    ic_cdk::println!("[BOT1] Starting pool validation for pool_id: {}", pool_id);
    
    // Get token record from secondary_fun
    let secondary_fun = get_secondary_fun_principal();
    ic_cdk::println!("[BOT1] Using secondary_fun canister: {}", secondary_fun.to_text());
    
    let token_record = match get_token_record(secondary_fun, pool_id).await {
        Ok(record) => {
            ic_cdk::println!("[BOT1] Found pool {} with primary token: {}", pool_id, record.primary_token_symbol);
            record
        },
        Err(e) => {
            ic_cdk::println!("[BOT1] Pool {} not found: {}", pool_id, e);
            return Ok(PoolValidation {
                pool_exists: false,
                is_live: false,
                launch_time: 0,
                canisters_accessible: false,
                bot_icp_balance: 0,
                estimated_cost_per_loop: 0,
                token_record: None,
            });
        }
    };
    
    // Check if pool creation failed
    if token_record.pool_creation_failed {
        ic_cdk::println!("[BOT1] Pool {} creation failed", pool_id);
        return Err(format!("Pool {} creation failed and cannot be used", pool_id));
    }
    
    // Calculate when the pool will be live
    // pool_created_at is in nanoseconds, launch_delay_seconds is in seconds
    let launch_time_nanos = token_record.pool_created_at + (token_record.launch_delay_seconds * 1_000_000_000);
    let current_time_nanos = ic_cdk::api::time();
    let is_live = current_time_nanos >= launch_time_nanos;
    
    // Convert to seconds for display
    let launch_time = launch_time_nanos / 1_000_000_000;
    let current_time = current_time_nanos / 1_000_000_000;
    
    if !is_live {
        let time_until_live = launch_time - current_time;
        ic_cdk::println!("[BOT1] Pool {} is not live yet. Time until live: {} seconds", pool_id, time_until_live);
        ic_cdk::println!("[BOT1] Debug: current_time_nanos={}, launch_time_nanos={}, pool_created_at={}, launch_delay_seconds={}", 
            current_time_nanos, launch_time_nanos, token_record.pool_created_at, token_record.launch_delay_seconds);
    } else {
        ic_cdk::println!("[BOT1] Pool {} is live", pool_id);
    }
    
    // Check bot's ICP balance
    let bot_account = Account {
        owner: ic_cdk::id(),
        subaccount: None,
    };
    
    let bot_icp_balance = match icrc1_balance_of(get_icp_ledger_principal(), bot_account.clone()).await {
        Ok(balance) => {
            ic_cdk::println!("[BOT1] Bot ICP balance: {} e8s", balance);
            balance
        },
        Err(e) => {
            ic_cdk::println!("[BOT1] Failed to get bot ICP balance: {}", e);
            return Err(format!("Failed to get bot ICP balance: {}", e));
        }
    };
    
    // Verify canisters are accessible by checking if we can get balance from primary token
    let canisters_accessible = match icrc1_balance_of(token_record.primary_token_id, bot_account.clone()).await {
        Ok(_) => {
            ic_cdk::println!("[BOT1] Canisters are accessible");
            true
        },
        Err(e) => {
            ic_cdk::println!("[BOT1] Failed to access primary token canister: {}", e);
            false
        }
    };
    
    // Calculate estimated cost per loop (ICP amount + fees)
    let estimated_cost_per_loop = icp_per_loop + 20_000; // Add 20k e8s for fees
    
    Ok(PoolValidation {
        pool_exists: true,
        is_live,
        launch_time,
        canisters_accessible,
        bot_icp_balance,
        estimated_cost_per_loop,
        token_record: Some(token_record),
    })
}

pub async fn validate_execution_params(
    pool_id: u64,
    icp_per_loop: u64,
    loops: u32,
) -> Result<(), String> {
    let validation = validate_pool_ready(pool_id, icp_per_loop).await?;
    
    if !validation.pool_exists {
        return Err(format!("Pool {} does not exist", pool_id));
    }
    
    if !validation.is_live {
        let current_time_seconds = ic_cdk::api::time() / 1_000_000_000;
        let time_until_live = validation.launch_time.saturating_sub(current_time_seconds);
        return Err(format!(
            "Pool {} is not live yet. Time until live: {} seconds", 
            pool_id, 
            time_until_live
        ));
    }
    
    if !validation.canisters_accessible {
        return Err(format!("Cannot access canisters for pool {}", pool_id));
    }
    
    let total_cost = validation.estimated_cost_per_loop * loops as u64;
    if validation.bot_icp_balance < total_cost {
        return Err(format!(
            "Insufficient ICP balance. Need {} e8s for {} loops, but only have {} e8s",
            total_cost,
            loops,
            validation.bot_icp_balance
        ));
    }
    
    ic_cdk::println!("[BOT1] Validation passed. Ready to execute {} loops for pool {}", loops, pool_id);
    Ok(())
}