use candid::Principal;
use ic_cdk::heartbeat;

use crate::{
    deployment::*,
    deployment_updates::{transfer_icp_to_account, stop_and_delete_canister},
};

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
                    
                    if d.cleanup_attempts >= 3 {
                        // Leave in Cleaning state for admin intervention
                        ic_cdk::println!(
                            "Deployment {} cleanup failed 3 times: {}. Needs admin.",
                            deployment_id, e
                        );
                    } else {
                        // Reset to Failed for retry
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
                // Log but continue - canister might already be deleted
                if !e.contains("not found") && !e.contains("already deleted") {
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
        
        match transfer_icp_to_account(deployment.user, refund_amount).await {
            Ok(_) => {
                ic_cdk::println!("Refunded {} ICP to {}", 
                    refund_amount as f64 / 100_000_000.0, 
                    deployment.user
                );
            }
            Err(e) => {
                errors.push(format!("Refund failed: {}", e));
                
                // Log the failed refund for monitoring
                ic_cdk::println!("Failed to refund {} to {}: {}", refund_amount, deployment.user, e);
            }
        }
    }
    
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}


