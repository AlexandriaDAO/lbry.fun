use candid::Principal;
use ic_cdk::heartbeat;

use crate::{
    deployment::*,
    deployment_updates::{transfer_icp_to_account, stop_and_delete_canister},
};

// Structured error format constants for frontend parsing
const ERROR_INSUFFICIENT_ICP: &str = "INSUFFICIENT_ICP";
const ERROR_INSUFFICIENT_CYCLES: &str = "INSUFFICIENT_CYCLES";
const ERROR_TRANSFER_FAILED: &str = "TRANSFER_FAILED";

#[heartbeat]
async fn cleanup_worker() {
    // Process failed deployments
    let failed_deployments = DEPLOYMENTS.with(|deployments| {
        deployments.borrow()
            .iter()
            .filter(|(_, d)| matches!(d.status, DeploymentStatus::Failed))
            .take(3) // Process up to 3 per heartbeat
            .map(|(id, d)| (id, d.clone()))
            .collect::<Vec<_>>()
    });
    
    for (deployment_id, deployment) in failed_deployments {
        // Check if we should skip due to backoff
        if deployment.cleanup_attempts >= 3 {
            let now = ic_cdk::api::time();
            let time_since_last = now.saturating_sub(deployment.last_activity);
            
            // Calculate backoff period based on attempts
            let backoff_multiplier = 2_u64.pow((deployment.cleanup_attempts - 3).min(4) as u32);
            let backoff_nanos = backoff_multiplier * 3_600_000_000_000; // hours to nanoseconds
            
            if time_since_last < backoff_nanos {
                // Still in backoff period, skip this deployment
                continue;
            }
        }
        
        // Atomically transition to Cleaning status
        let proceed = atomic_update_deployment(deployment_id, |d| {
            if matches!(d.status, DeploymentStatus::Failed) {
                d.status = DeploymentStatus::Cleaning;
                Ok(())
            } else {
                Err("Status changed".to_string())
            }
        }).is_ok();
        
        if !proceed {
            continue;
        }
        
        // Attempt cleanup
        match cleanup_deployment_with_progress(&deployment).await {
            Ok(_) => {
                // Remove deployment record
                DEPLOYMENTS.with(|deployments| {
                    deployments.borrow_mut().remove(&deployment_id);
                });
                
                ic_cdk::println!("Successfully cleaned deployment {}", deployment_id);
            }
            Err(e) => {
                // Update retry count and status
                let _should_retry = atomic_update_deployment(deployment_id, |d| {
                    d.cleanup_attempts += 1;
                    d.last_error = Some(e.clone());
                    d.last_activity = ic_cdk::api::time(); // Update for backoff calculation
                    
                    // Never give up - use exponential backoff instead
                    // After 3 attempts: 2h, 4h, 8h, 16h, then cap at 16h
                    if d.cleanup_attempts >= 3 {
                        let backoff_multiplier = 2_u64.pow((d.cleanup_attempts - 3).min(4) as u32);
                        let backoff_hours = backoff_multiplier; // 2, 4, 8, 16, 16...
                        
                        ic_cdk::println!(
                            "Deployment {} cleanup attempt {} failed: {}. Will retry in {} hours.",
                            deployment_id, d.cleanup_attempts, e, backoff_hours
                        );
                        
                        // Stay in Failed state so heartbeat will retry after backoff
                        d.status = DeploymentStatus::Failed;
                    } else {
                        // First 3 attempts: immediate retry on next heartbeat
                        d.status = DeploymentStatus::Failed;
                    }
                    Ok(())
                }).is_ok();
            }
        }
    }
}

/// Cleanup with progress tracking
async fn cleanup_deployment_with_progress(deployment: &Deployment) -> Result<(), String> {
    let mut errors = vec![];
    
    // Calculate refund amount (payment minus platform fee)
    // Platform fee: 1 ICP (100_000_000 e8s) to cover cycle costs and prevent abuse
    const PLATFORM_FEE: u64 = 100_000_000; // 1 ICP
    let refund_amount = deployment.payment_amount.saturating_sub(PLATFORM_FEE);
    
    // Delete only canisters not already deleted
    let canisters_to_delete: Vec<Principal> = deployment.created_canisters
        .iter()
        .filter(|c| !deployment.deleted_canisters.contains(c))
        .cloned()
        .collect();
    
    for canister_id in canisters_to_delete {
        match stop_and_delete_canister(canister_id).await {
            Ok(_) => {
                // Record deletion
                atomic_update_deployment(deployment.id, |d| {
                    d.deleted_canisters.push(canister_id);
                    Ok(())
                })?;
            }
            Err(e) => {
                // Check for specific error types
                if e.contains("out of cycles") || e.contains("insufficient cycles") {
                    // Return immediately with structured error for cycles issue
                    return Err(ERROR_INSUFFICIENT_CYCLES.to_string());
                } else if !e.contains("not found") && !e.contains("already deleted") {
                    errors.push(format!("Delete canister {}: {}", canister_id, e));
                }
            }
        }
    }
    
    // Attempt refund only if all canisters are handled
    let all_deleted = DEPLOYMENTS.with(|deployments| {
        deployments.borrow()
            .get(&deployment.id)
            .map(|d| d.created_canisters.len() == d.deleted_canisters.len())
            .unwrap_or(false)
    });
    
    if all_deleted {
        // NEW: Check if token record was created but deployment failed
        if let Some(token_id) = deployment.token_id {
            crate::storage::TOKENS.with(|tokens| {
                let mut tokens_mut = tokens.borrow_mut();
                if let Some(token) = tokens_mut.get(&token_id) {
                    // Only remove if it's in failed state
                    if matches!(token.status, crate::storage::TokenStatus::Failed { .. }) {
                        tokens_mut.remove(&token_id);
                        ic_cdk::println!("[CLEANUP] Removed failed token record {}", token_id);
                    }
                }
            });
        }
        
        // Check ICP balance before attempting refund
        const ICP_TRANSFER_FEE: u64 = 10_000; // 0.0001 ICP
        let required_balance = refund_amount + ICP_TRANSFER_FEE;
        
        match crate::utlis::get_self_icp_balance(ic_cdk::id()).await {
            Ok(balance) if balance >= required_balance => {
                // Sufficient balance, attempt refund
                match transfer_icp_to_account(deployment.user, refund_amount).await {
                    Ok(_) => {
                        ic_cdk::println!("Refunded {} ICP to {}", 
                            refund_amount as f64 / 100_000_000.0, 
                            deployment.user
                        );
                    }
                    Err(e) => {
                        // Check if it's an insufficient funds error from the transfer itself
                        if e.contains("InsufficientFunds") {
                            // The balance check passed but transfer still failed - possibly a race condition
                            // Re-check the balance and return structured error
                            let current_balance = crate::utlis::get_self_icp_balance(ic_cdk::id())
                                .await
                                .unwrap_or(0);
                            return Err(format!("{}:{}:{}", ERROR_INSUFFICIENT_ICP, required_balance, current_balance));
                        }
                        // Return structured error for other transfer failures
                        return Err(format!("{}:{}", ERROR_TRANSFER_FAILED, e));
                    }
                }
            }
            Ok(balance) => {
                // Insufficient ICP - return structured error
                return Err(format!("{}:{}:{}", ERROR_INSUFFICIENT_ICP, required_balance, balance));
            }
            Err(e) => {
                errors.push(format!("Failed to check ICP balance: {}", e));
            }
        }
    }
    
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}


