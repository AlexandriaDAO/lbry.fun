use candid::Principal;
use ic_cdk::{heartbeat, update, query};

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
    
    // Calculate refund amount (payment minus transfer fee)
    let refund_amount = deployment.payment_amount.saturating_sub(10_000);
    
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
        match transfer_icp_to_account(deployment.user, refund_amount).await {
            Ok(_) => {
                ic_cdk::println!("Refunded {} ICP to {}", 
                    refund_amount as f64 / 100_000_000.0, 
                    deployment.user
                );
            }
            Err(e) => {
                errors.push(format!("Refund failed: {}", e));
                
                // Store for manual processing
                FAILED_REFUNDS.with(|refunds| {
                    refunds.borrow_mut().insert(
                        deployment.user,
                        FailedRefund {
                            user: deployment.user,
                            amount: refund_amount,
                            payment_block: deployment.payment_block,
                            deployment_id: deployment.id,
                            failed_at: ic_cdk::api::time(),
                            error: e,
                        }
                    );
                });
            }
        }
    }
    
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

/// Get deployments that need manual intervention
#[query(guard = "is_admin")]
fn get_stuck_deployments() -> Vec<StuckDeploymentInfo> {
    DEPLOYMENTS.with(|deployments| {
        deployments.borrow()
            .iter()
            .filter(|(_, d)| {
                // Failed with max retries or stuck in Cleaning
                (matches!(d.status, DeploymentStatus::Failed) && d.cleanup_attempts >= 3) ||
                (matches!(d.status, DeploymentStatus::Cleaning) && d.cleanup_attempts >= 3)
            })
            .map(|(id, d)| StuckDeploymentInfo {
                id,
                user: d.user,
                status: format!("{:?}", d.status),
                created_at: d.created_at,
                cleanup_attempts: d.cleanup_attempts,
                last_error: d.last_error.clone(),
                created_canisters: d.created_canisters.clone(),
                deleted_canisters: d.deleted_canisters.clone(),
                payment_amount: d.payment_amount,
            })
            .collect()
    })
}

/// Force cleanup of a specific deployment
#[update(guard = "is_admin")]
async fn admin_force_cleanup(deployment_id: u64, options: AdminCleanupOptions) -> Result<String, String> {
    let deployment = DEPLOYMENTS.with(|deployments| {
        deployments.borrow().get(&deployment_id)
    }).ok_or("Deployment not found")?;
    
    let mut results = vec![];
    
    // Force delete canisters if requested
    if options.force_delete_canisters {
        for canister in &deployment.created_canisters {
            if deployment.deleted_canisters.contains(canister) {
                continue;
            }
            
            match stop_and_delete_canister(*canister).await {
                Ok(_) => results.push(format!("Deleted canister {}", canister)),
                Err(e) => results.push(format!("Failed to delete {}: {}", canister, e)),
            }
        }
    }
    
    // Force refund if requested
    if options.force_refund {
        let refund_amount = deployment.payment_amount.saturating_sub(10_000);
        match transfer_icp_to_account(deployment.user, refund_amount).await {
            Ok(_) => results.push(format!("Refunded {} ICP", refund_amount as f64 / 100_000_000.0)),
            Err(e) => results.push(format!("Refund failed: {}", e)),
        }
    }
    
    // Remove deployment record if requested
    if options.remove_record {
        DEPLOYMENTS.with(|deployments| {
            deployments.borrow_mut().remove(&deployment_id);
        });
        results.push("Removed deployment record".to_string());
    }
    
    Ok(results.join("\n"))
}

/// Retry failed refunds
#[update(guard = "is_admin")]
async fn admin_retry_failed_refunds() -> Result<Vec<String>, String> {
    let failed_refunds = FAILED_REFUNDS.with(|refunds| {
        refunds.borrow()
            .iter()
            .map(|(_, r)| r.clone())
            .collect::<Vec<_>>()
    });
    
    let mut results = vec![];
    
    for refund in failed_refunds {
        match transfer_icp_to_account(refund.user, refund.amount).await {
            Ok(_) => {
                FAILED_REFUNDS.with(|refunds| {
                    refunds.borrow_mut().remove(&refund.user);
                });
                results.push(format!(
                    "Successfully refunded {} ICP to {}",
                    refund.amount as f64 / 100_000_000.0,
                    refund.user
                ));
            }
            Err(e) => {
                results.push(format!(
                    "Failed to refund {} ICP to {}: {}",
                    refund.amount as f64 / 100_000_000.0,
                    refund.user,
                    e
                ));
            }
        }
    }
    
    Ok(results)
}

/// Check if caller is admin
fn is_admin() -> Result<(), String> {
    // You should replace this with your actual admin check logic
    // For now, let's use a placeholder
    let caller = ic_cdk::caller();
    let admin_principal = Principal::from_text("admin-principal-here").unwrap_or(Principal::anonymous());
    
    if caller == admin_principal {
        Ok(())
    } else {
        Err("Not authorized".to_string())
    }
}

/// Migrate V9 deployments to V10 format
#[update(guard = "is_admin")]
fn migrate_v9_deployments() -> String {
    let mut migrated = 0;
    
    // Add version field and other V10 fields to existing deployments
    DEPLOYMENTS.with(|deployments| {
        let mut deps = deployments.borrow_mut();
        let ids: Vec<u64> = deps.iter().map(|(id, _)| id).collect();
        
        for id in ids {
            if let Some(mut deployment) = deps.get(&id) {
                deployment.version = 0;
                deployment.last_activity = deployment.created_at;
                deployment.deleted_canisters = vec![];
                deployment.payment_amount = 500_000_000; // Standard 5 ICP
                deps.insert(id, deployment);
                migrated += 1;
            }
        }
    });
    
    format!("Migrated {} deployments to V10 format", migrated)
}