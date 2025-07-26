use candid::Principal;

use crate::{
    get_principal, create_a_canister, create_icrc1_canister, install_tokenomics_wasm_on_existing_canister,
    install_icp_swap_wasm_on_existing_canister, install_logs_wasm_on_existing_canister,
    add_token_to_kong_swap, transfer_tokens_to_kong, create_pool_on_kong_swap,
    AddTokenResponse, E8S, ICP_CANISTER_ID, INTITAL_PRIMARY_MINT, TOKENS, TokenRecord,
    tokenomics_simple::preview_tokenomics_from_frontend,
    deployment::*,
};

const CANISTER_INITIAL_CYCLES_TOKEN_CANISTER: u128 = 2_000_000_000_000u128;
const CANISTER_INITIAL_CYCLES_SWAP_CANISTER: u128 = 2_000_000_000_000u128;
const CANISTER_INITIAL_CYCLES_TOKENOMICS_CANISTER: u128 = 2_000_000_000_000u128;
const CANISTER_INITIAL_CYCLES_LOGS_CANISTER: u128 = 2_000_000_000_000u128;

pub async fn execute_deployment_safe(deployment_id: u64) -> Result<u64, String> {
    // Get deployment params
    let params = DEPLOYMENTS.with(|deployments| {
        deployments.borrow()
            .get(&deployment_id)
            .map(|d| d.params.clone())
    }).ok_or("Deployment not found")?;
    
    // Helper to record created canisters
    let record_canister = |canister_id: Principal| -> Result<(), String> {
        atomic_update_deployment(deployment_id, |d| {
            // Check if still active
            if !matches!(d.status, DeploymentStatus::Active) {
                return Err("Deployment no longer active".to_string());
            }
            d.created_canisters.push(canister_id);
            Ok(())
        })
    };
    
    ic_cdk::println!("[DEPLOYMENT] Generating tokenomics schedule...");
    // Generate the full tokenomics schedule
    let schedule = preview_tokenomics_from_frontend(
        params.initial_reward_per_burn_unit,
        params.primary_max_supply,
        params.initial_secondary_burn,
        params.halving_step,
        params.initial_primary_mint,
        params.threshold_multiplier,
    );
    
    // Extract arrays from the generated schedule
    let mut secondary_thresholds = Vec::new();
    let mut primary_rewards = Vec::new();
    
    // Convert initial reward rate from E8S to 4-decimal format
    let initial_reward_4decimal = (params.initial_reward_per_burn_unit / 10_000).max(100);
    
    // Generate rewards array using the same halving logic as tokenomics_simple
    let mut current_reward = initial_reward_4decimal;
    let min_reward_4decimal = 100u64;
    
    // Always skip epoch 0 as it's only for TGE and has no mining rewards
    let start_index = 1;
    
    for (_i, epoch) in schedule.epochs.iter().enumerate().skip(start_index) {
        // Convert cumulative burned from E8S to natural units
        let threshold_natural = (epoch.cumulative_secondary_burned_e8s / E8S as u128) as u64;
        secondary_thresholds.push(threshold_natural);
        
        // Add the current reward rate (already in 4-decimal format)
        primary_rewards.push(current_reward);
        
        // Apply halving for next epoch
        let new_reward = current_reward
            .saturating_mul(params.halving_step)
            .saturating_div(100);
        
        // Don't go below minimum
        current_reward = new_reward.max(min_reward_4decimal);
    }
    
    // Validate the arrays
    if secondary_thresholds.is_empty() || primary_rewards.is_empty() {
        return Err("Failed to generate tokenomics schedule arrays".to_string());
    }
    
    ic_cdk::println!("[DEPLOYMENT] Creating canisters...");
    
    // Create swap canister
    let swap_canister_id = create_a_canister(CANISTER_INITIAL_CYCLES_SWAP_CANISTER).await?;
    record_canister(swap_canister_id)?;
    ic_cdk::println!("[DEPLOYMENT] Swap canister created: {}", swap_canister_id);
    
    // Create tokenomics canister
    let tokenomics_canister_id = create_a_canister(CANISTER_INITIAL_CYCLES_TOKENOMICS_CANISTER).await?;
    record_canister(tokenomics_canister_id)?;
    ic_cdk::println!("[DEPLOYMENT] Tokenomics canister created: {}", tokenomics_canister_id);
    
    // Create logs canister
    let logs_canister_id = create_a_canister(CANISTER_INITIAL_CYCLES_LOGS_CANISTER).await?;
    record_canister(logs_canister_id)?;
    ic_cdk::println!("[DEPLOYMENT] Logs canister created: {}", logs_canister_id);
    
    // Create primary token canister
    let primary_token_id = match create_icrc1_canister(
        params.primary_token_symbol.clone(),
        params.primary_token_name.clone(),
        params.primary_token_description.clone(),
        tokenomics_canister_id,
        tokenomics_canister_id,
        INTITAL_PRIMARY_MINT,
        params.primary_logo.clone(),
        CANISTER_INITIAL_CYCLES_TOKEN_CANISTER,
    )
    .await
    {
        Ok(canister_id) => {
            let principal = get_principal(&canister_id);
            record_canister(principal)?;
            ic_cdk::println!("[DEPLOYMENT] Primary token created: {}", canister_id);
            canister_id
        }
        Err(e) => return Err(e.to_string()),
    };
    
    // Create secondary token canister
    let secondary_token_id = match create_icrc1_canister(
        params.secondary_token_symbol.clone(),
        params.secondary_token_name.clone(),
        params.secondary_token_description.clone(),
        swap_canister_id,
        swap_canister_id,
        0,
        params.secondary_logo.clone(),
        CANISTER_INITIAL_CYCLES_TOKEN_CANISTER,
    )
    .await
    {
        Ok(canister_id) => {
            let principal = get_principal(&canister_id);
            record_canister(principal)?;
            ic_cdk::println!("[DEPLOYMENT] Secondary token created: {}", canister_id);
            canister_id
        }
        Err(e) => return Err(e.to_string()),
    };
    
    // Install and initialize canisters
    ic_cdk::println!("[DEPLOYMENT] Installing tokenomics wasm...");
    install_tokenomics_wasm_on_existing_canister(
        tokenomics_canister_id,
        Some(get_principal(&primary_token_id)),
        Some(get_principal(&secondary_token_id)),
        Some(swap_canister_id),
        params.primary_max_supply.into(),
        params.initial_primary_mint,
        params.initial_secondary_burn,
        params.halving_step,
        params.initial_reward_per_burn_unit,
        secondary_thresholds.clone(),
        primary_rewards.clone(),
    )
    .await?;
    
    ic_cdk::println!("[DEPLOYMENT] Installing swap wasm...");
    install_icp_swap_wasm_on_existing_canister(
        swap_canister_id,
        Some(get_principal(&primary_token_id)),
        Some(get_principal(&secondary_token_id)),
        Some(tokenomics_canister_id),
        params.distribution_interval_seconds,
        params.launch_delay_seconds,
    )
    .await?;
    
    ic_cdk::println!("[DEPLOYMENT] Installing logs wasm...");
    install_logs_wasm_on_existing_canister(
        logs_canister_id,
        get_principal(&primary_token_id),
        get_principal(&secondary_token_id),
        swap_canister_id,
        tokenomics_canister_id,
    )
    .await?;
    
    // Add token to KongSwap
    ic_cdk::println!("[DEPLOYMENT] Adding primary token to KongSwap...");
    match add_token_to_kong_swap(get_principal(&primary_token_id)).await {
        AddTokenResponse::Ok(_token_detail) => {
            ic_cdk::println!("[DEPLOYMENT] Primary token added to KongSwap successfully");
        },
        AddTokenResponse::Err(e) => {
            return Err(format!("Failed to add token to swap: {}", e));
        }
    };
    
    // Transfer tokens for pool creation
    ic_cdk::println!("[DEPLOYMENT] Transferring tokens to Kong for pool creation...");
    
    let primary_transfer_result = transfer_tokens_to_kong(
        get_principal(&primary_token_id),
        E8S.into(),
    )
    .await?;
    
    let icp_transfer_result = transfer_tokens_to_kong(
        get_principal(ICP_CANISTER_ID),
        (10_000_000 as u64).into(),
    )
    .await?;
    
    let caller = DEPLOYMENTS.with(|deployments| {
        deployments.borrow().get(&deployment_id).map(|d| d.user)
    }).ok_or("Deployment not found")?;
    
    // Create token record
    let mut token_record = TokenRecord {
        id: 0, // Will be set when inserting
        primary_token_id: get_principal(&primary_token_id),
        primary_token_name: params.primary_token_name.clone(),
        primary_token_symbol: params.primary_token_symbol.clone(),
        primary_token_max_supply: params.primary_max_supply,
        secondary_token_id: get_principal(&secondary_token_id),
        secondary_token_name: params.secondary_token_name.clone(),
        secondary_token_symbol: params.secondary_token_symbol.clone(),
        icp_swap_canister_id: swap_canister_id,
        tokenomics_canister_id,
        logs_canister_id,
        initial_primary_mint: params.initial_primary_mint,
        initial_secondary_burn: params.initial_secondary_burn,
        halving_step: params.halving_step,
        threshold_multiplier: params.threshold_multiplier,
        initial_reward_per_burn_unit: params.initial_reward_per_burn_unit,
        distribution_interval_seconds: params.distribution_interval_seconds,
        launch_delay_seconds: params.launch_delay_seconds,
        caller,
        created_time: ic_cdk::api::time(),
        pool_creation_failed: false,
        pool_created_at: 0,
    };
    
    // Attempt to create pool on KongSwap
    ic_cdk::println!("[DEPLOYMENT] Creating liquidity pool on KongSwap...");
    match create_pool_on_kong_swap(
        get_principal(&primary_token_id), 
        primary_transfer_result,
        icp_transfer_result
    ).await {
        Ok(reply) => {
            ic_cdk::println!("[DEPLOYMENT] Pool creation success: Pool ID: {}", reply.pool_id);
            token_record.pool_created_at = ic_cdk::api::time();
            token_record.pool_creation_failed = false;
        },
        Err(e) => {
            ic_cdk::println!("[DEPLOYMENT] Pool creation failed: {}", e);
            token_record.pool_creation_failed = true;
            // Continue with token creation even if pool fails
        }
    }
    
    // Save the token record
    let token_id = TOKENS.with(|tokens| {
        let mut tokens = tokens.borrow_mut();
        let token_id = tokens.len() as u64 + 1;
        token_record.id = token_id;
        tokens.insert(token_id, token_record.clone());
        token_id
    });
    
    Ok(token_id)
}