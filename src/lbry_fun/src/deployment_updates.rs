use candid::{Nat, Principal};
use ic_cdk::{
    api::management_canister::main::{
        stop_canister, delete_canister, CanisterIdRecord,
    },
    update, query,
};
use icrc_ledger_types::{
    icrc1::account::Account,
    icrc1::transfer::{TransferArg, TransferError, BlockIndex},
};
use num_traits::ToPrimitive;

use crate::{
    get_principal, ICP_CANISTER_ID, ICP_TRANSFER_FEE,
    deployment::*,
    deposit_icp_in_canister,
    execute_deployment_safe,
};

/// Phase 1: Create deployment and return ID immediately
#[update]
pub async fn initiate_token_deployment(params: CreateTokenParams) -> Result<u64, String> {
    let caller = ic_cdk::caller();
    
    // Check for existing active deployment
    if let Some(existing_id) = get_active_deployment_for_user(caller) {
        return Err(format!(
            "You have an active deployment (ID: {}). Use execute_token_deployment({}) to continue or recover_stuck_deployment() to cancel.",
            existing_id, existing_id
        ));
    }
    
    // Validate parameters before taking payment
    validate_deployment_params(&params).await?;
    
    // Take payment (5 ICP)
    let payment_amount = 500_000_000u64;
    let payment_block_nat = deposit_icp_in_canister(payment_amount, None).await
        .map_err(|e| format!("Payment failed: {}", e))?;
    
    // Convert BlockIndex (Nat) to u64 safely
    let payment_block = payment_block_nat.0.to_u64()
        .ok_or_else(|| "Payment block index too large to fit in u64".to_string())?;
    
    // Generate deployment ID
    let deployment_id = DEPLOYMENT_COUNTER.with(|counter| {
        let mut counter = counter.borrow_mut();
        let id = counter.get() + 1;
        counter.set(id).unwrap();
        id
    });
    
    // Create deployment record
    let now = ic_cdk::api::time();
    let deployment = Deployment {
        id: deployment_id,
        version: 0,
        user: caller,
        payment_block,
        payment_amount,
        params: params.clone(),
        status: DeploymentStatus::Active,
        created_at: now,
        last_activity: now,
        failed_at: None,
        created_canisters: vec![],
        deleted_canisters: vec![],
        cleanup_attempts: 0,
        last_error: None,
        token_id: None,
    };
    
    // Store deployment and update user index
    DEPLOYMENTS.with(|deployments| {
        deployments.borrow_mut().insert(deployment_id, deployment);
    });
    
    USER_ACTIVE_DEPLOYMENTS.with(|index| {
        index.borrow_mut().insert(caller, deployment_id);
    });
    
    // Return ID immediately - user has reference even if they disconnect
    Ok(deployment_id)
}

/// Phase 2: Execute the deployment with the given ID
#[update]
pub async fn execute_token_deployment(deployment_id: u64) -> Result<TokenDeploymentResult, String> {
    let caller = ic_cdk::caller();
    
    // Verify ownership and status
    let deployment = DEPLOYMENTS.with(|deployments| {
        deployments.borrow().get(&deployment_id)
    }).ok_or("Deployment not found")?;
    
    if deployment.user != caller {
        return Err("You don't own this deployment".to_string());
    }
    
    match deployment.status {
        DeploymentStatus::Active => {
            // Continue with deployment
        }
        DeploymentStatus::Completed => {
            return Ok(TokenDeploymentResult {
                token_id: deployment.token_id.unwrap(),
                message: "Deployment already completed".to_string(),
            });
        }
        DeploymentStatus::Failed | DeploymentStatus::Cleaning => {
            return Err(format!("Deployment is in {} state", 
                match deployment.status {
                    DeploymentStatus::Failed => "failed",
                    DeploymentStatus::Cleaning => "cleaning",
                    _ => unreachable!()
                }
            ));
        }
    }
    
    // Execute deployment
    match execute_deployment_safe(deployment_id).await {
        Ok(token_id) => {
            // Mark as completed
            atomic_update_deployment(deployment_id, |d| {
                d.status = DeploymentStatus::Completed;
                d.token_id = Some(token_id);
                Ok(())
            })?;
            
            // Remove from active index
            USER_ACTIVE_DEPLOYMENTS.with(|index| {
                index.borrow_mut().remove(&caller);
            });
            
            Ok(TokenDeploymentResult {
                token_id,
                message: format!("Token {} created successfully", token_id),
            })
        }
        Err(e) => {
            // Mark as failed
            mark_deployment_failed(deployment_id, e.clone());
            
            Err(format!(
                "Deployment failed: {}. Your payment is safe. Refund will be processed automatically within 5 minutes.",
                e
            ))
        }
    }
}

/// Allow users to recover stuck deployments based on activity
#[update]
pub async fn recover_stuck_deployment() -> Result<String, String> {
    let caller = ic_cdk::caller();
    
    // Find user's active deployment
    let deployment_id = get_active_deployment_for_user(caller)
        .ok_or("No active deployment found")?;
    
    let deployment = DEPLOYMENTS.with(|deployments| {
        deployments.borrow().get(&deployment_id)
    }).ok_or("Deployment record not found")?;
    
    // Check inactivity period
    let now = ic_cdk::api::time();
    let inactive_duration = now - deployment.last_activity;
    
    // 5 minutes = 300 seconds = 300_000_000_000 nanoseconds
    const INACTIVITY_THRESHOLD: u64 = 300_000_000_000;
    
    if inactive_duration < INACTIVITY_THRESHOLD {
        let remaining_seconds = (INACTIVITY_THRESHOLD - inactive_duration) / 1_000_000_000;
        return Err(format!(
            "Deployment still potentially active. Last activity was {} seconds ago. Please wait {} more seconds.",
            inactive_duration / 1_000_000_000,
            remaining_seconds
        ));
    }
    
    // User confirms deployment is stuck
    mark_deployment_failed(
        deployment_id, 
        format!("User initiated recovery after {} seconds of inactivity", 
            inactive_duration / 1_000_000_000)
    );
    
    Ok(format!(
        "Deployment {} marked for cleanup. Refund of {} ICP will be processed within 5 minutes.",
        deployment_id,
        (deployment.payment_amount - 100_000_000) as f64 / 100_000_000.0 // Minus 1 ICP platform fee
    ))
}

/// Query deployment status and history
#[query]
pub fn get_my_deployments() -> Vec<DeploymentInfo> {
    let caller = ic_cdk::caller();
    
    DEPLOYMENTS.with(|deployments| {
        let mut user_deployments: Vec<DeploymentInfo> = deployments.borrow()
            .iter()
            .filter(|(_, d)| d.user == caller)
            .map(|(_, d)| DeploymentInfo {
                id: d.id,
                status: format!("{:?}", d.status),
                created_at: d.created_at,
                last_activity: d.last_activity,
                failed_at: d.failed_at,
                token_id: d.token_id,
                canister_count: d.created_canisters.len(),
                cleanup_progress: if d.created_canisters.is_empty() { 
                    100 
                } else { 
                    (d.deleted_canisters.len() * 100 / d.created_canisters.len()) as u8 
                },
                last_error: d.last_error.clone(),
            })
            .collect();
        
        // Sort by creation time, newest first
        user_deployments.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        user_deployments
    })
}

/// Validate deployment parameters to match frontend constraints
async fn validate_deployment_params(params: &CreateTokenParams) -> Result<(), String> {
    // Constants - note that token amounts come in already as E8S from frontend
    const E8S: u64 = 100_000_000;
    
    // Symbol validation (2-10 characters, alphanumeric only)
    if params.primary_token_symbol.len() < 2 || params.primary_token_symbol.len() > 10 {
        return Err("Primary token symbol must be 2-10 characters".to_string());
    }
    if !params.primary_token_symbol.chars().all(|c| c.is_alphanumeric()) {
        return Err("Primary token symbol must contain only letters and numbers".to_string());
    }
    
    if params.secondary_token_symbol.len() < 2 || params.secondary_token_symbol.len() > 10 {
        return Err("Secondary token symbol must be 2-10 characters".to_string());
    }
    if !params.secondary_token_symbol.chars().all(|c| c.is_alphanumeric()) {
        return Err("Secondary token symbol must contain only letters and numbers".to_string());
    }
    
    // Name validation (max 100 characters)
    if params.primary_token_name.is_empty() {
        return Err("Primary token name cannot be empty".to_string());
    }
    if params.primary_token_name.len() > 100 {
        return Err(format!("Primary token name too long ({}/100 characters)", params.primary_token_name.len()));
    }
    
    if params.secondary_token_name.is_empty() {
        return Err("Secondary token name cannot be empty".to_string());
    }
    if params.secondary_token_name.len() > 100 {
        return Err(format!("Secondary token name too long ({}/100 characters)", params.secondary_token_name.len()));
    }
    
    // Description validation (max 500 characters)
    if params.primary_token_description.is_empty() {
        return Err("Primary token description cannot be empty".to_string());
    }
    if params.primary_token_description.len() > 500 {
        return Err(format!("Primary token description too long ({}/500 characters)", params.primary_token_description.len()));
    }
    
    if params.secondary_token_description.is_empty() {
        return Err("Secondary token description cannot be empty".to_string());
    }
    if params.secondary_token_description.len() > 500 {
        return Err(format!("Secondary token description too long ({}/500 characters)", params.secondary_token_description.len()));
    }
    
    // Logo validation (must be base64 SVG, max 100KB)
    if params.primary_logo.is_empty() {
        return Err("Primary token logo is required".to_string());
    }
    if params.secondary_logo.is_empty() {
        return Err("Secondary token logo is required".to_string());
    }
    
    // Validate logo size (base64 is ~4/3 of original size)
    const MAX_LOGO_SIZE: usize = 100 * 1024; // 100KB
    if params.primary_logo.len() > MAX_LOGO_SIZE * 4 / 3 {
        return Err("Primary token logo exceeds 100KB limit".to_string());
    }
    if params.secondary_logo.len() > MAX_LOGO_SIZE * 4 / 3 {
        return Err("Secondary token logo exceeds 100KB limit".to_string());
    }
    
    // Validate base64 format
    if !is_valid_base64(&params.primary_logo) {
        return Err("Primary token logo must be valid base64".to_string());
    }
    if !is_valid_base64(&params.secondary_logo) {
        return Err("Secondary token logo must be valid base64".to_string());
    }
    
    // Primary max supply validation (already in E8S from frontend)
    // Frontend range: 1,000,000 to 100,000,000,000 tokens
    const MIN_HARD_CAP_E8S: u64 = 1_000_000 * E8S;
    const MAX_HARD_CAP_E8S: u64 = 100_000_000_000 * E8S;
    
    if params.primary_max_supply < MIN_HARD_CAP_E8S {
        return Err(format!("Primary max supply must be at least {} tokens", 1_000_000));
    }
    if params.primary_max_supply > MAX_HARD_CAP_E8S {
        return Err(format!("Primary max supply cannot exceed {} tokens", 100_000_000_000u64));
    }
    
    // Initial primary mint validation (TGE allocation) - already in E8S
    if params.initial_primary_mint > params.primary_max_supply {
        return Err("Initial primary mint cannot exceed max supply".to_string());
    }
    
    // Initial reward per burn unit validation (already in E8S from frontend)
    // Frontend range: 0.01 to 20 tokens
    const MIN_INITIAL_REWARD_E8S: u64 = E8S / 100; // 0.01 tokens
    const MAX_INITIAL_REWARD_E8S: u64 = 20 * E8S; // 20 tokens
    
    if params.initial_reward_per_burn_unit < MIN_INITIAL_REWARD_E8S {
        return Err("Initial reward per burn unit must be at least 0.01 tokens".to_string());
    }
    if params.initial_reward_per_burn_unit > MAX_INITIAL_REWARD_E8S {
        return Err("Initial reward per burn unit cannot exceed 20 tokens".to_string());
    }
    
    // Initial secondary burn validation (already in E8S from frontend)
    // Frontend range: 1,000,000 to 100,000,000 tokens
    const MIN_SECONDARY_BURN_E8S: u64 = 1_000_000 * E8S;
    const MAX_SECONDARY_BURN_E8S: u64 = 100_000_000 * E8S;
    
    if params.initial_secondary_burn < MIN_SECONDARY_BURN_E8S {
        return Err(format!("Initial secondary burn must be at least {} tokens", 1_000_000));
    }
    if params.initial_secondary_burn > MAX_SECONDARY_BURN_E8S {
        return Err(format!("Initial secondary burn cannot exceed {} tokens", 100_000_000));
    }
    
    // Halving step validation (sent as plain percentage: 25-99)
    if params.halving_step < 25 || params.halving_step > 99 {
        return Err("Halving step must be between 25 and 99%".to_string());
    }
    
    // Threshold multiplier validation (sent as float: 1.0-10.0)
    if params.threshold_multiplier < 1.0 || params.threshold_multiplier > 10.0 {
        return Err("Threshold multiplier must be between 1.0 and 10.0".to_string());
    }
    
    // Launch delay validation (sent as seconds: 1 second to 30 days)
    const MIN_LAUNCH_DELAY: u64 = 1;
    const MAX_LAUNCH_DELAY: u64 = 2_592_000; // 30 days in seconds
    
    if params.launch_delay_seconds < MIN_LAUNCH_DELAY {
        return Err("Launch delay must be at least 1 second".to_string());
    }
    if params.launch_delay_seconds > MAX_LAUNCH_DELAY {
        return Err("Launch delay cannot exceed 30 days".to_string());
    }
    
    // Distribution interval validation (sent as seconds, min 60)
    if params.distribution_interval_seconds < 60 {
        return Err("Distribution interval must be at least 60 seconds".to_string());
    }
    
    Ok(())
}

// Helper function to validate base64 string
fn is_valid_base64(s: &str) -> bool {
    // Basic validation - proper base64 should only contain these characters
    s.chars().all(|c| {
        c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '='
    }) && !s.is_empty()
}

// Helper to transfer ICP to a user account
pub async fn transfer_icp_to_account(to: Principal, amount: u64) -> Result<BlockIndex, String> {
    let transfer_args = TransferArg {
        to: Account {
            owner: to,
            subaccount: None,
        },
        amount: amount.into(),
        fee: Some(Nat::from(ICP_TRANSFER_FEE)),
        memo: None,
        created_at_time: None,
        from_subaccount: None,
    };

    let (result,): (Result<BlockIndex, TransferError>,) = ic_cdk::call(
        get_principal(ICP_CANISTER_ID),
        "icrc1_transfer",
        (transfer_args,),
    )
    .await
    .map_err(|e| format!("Failed to call transfer: {:?}", e))?;
    
    result.map_err(|e| format!("Transfer failed: {:?}", e))
}

// Helper to stop and delete a canister
pub async fn stop_and_delete_canister(canister_id: Principal) -> Result<(), String> {
    // First stop the canister
    stop_canister(CanisterIdRecord { canister_id })
        .await
        .map_err(|(code, msg)| format!("Failed to stop canister: {:?} - {}", code, msg))?;
    
    // Then delete it
    delete_canister(CanisterIdRecord { canister_id })
        .await
        .map_err(|(code, msg)| format!("Failed to delete canister: {:?} - {}", code, msg))?;
    
    Ok(())
}