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

/// Validate deployment parameters
async fn validate_deployment_params(params: &CreateTokenParams) -> Result<(), String> {
    // Validate token names and symbols
    if params.primary_token_name.is_empty() || params.primary_token_symbol.is_empty() {
        return Err("Primary token name and symbol cannot be empty".to_string());
    }
    
    if params.secondary_token_name.is_empty() || params.secondary_token_symbol.is_empty() {
        return Err("Secondary token name and symbol cannot be empty".to_string());
    }
    
    // Validate numeric parameters
    if params.primary_max_supply == 0 {
        return Err("Primary max supply must be greater than 0".to_string());
    }
    
    if params.initial_reward_per_burn_unit < 10_000 { // Minimum 0.0001 tokens in E8S
        return Err("Initial reward per burn unit too low".to_string());
    }
    
    if params.halving_step == 0 || params.halving_step >= 100 {
        return Err("Halving step must be between 1 and 99".to_string());
    }
    
    if params.distribution_interval_seconds < 60 {
        return Err("Distribution interval must be at least 60 seconds".to_string());
    }
    
    Ok(())
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