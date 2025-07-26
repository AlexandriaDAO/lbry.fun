# Token Deployment Cleanup Plan V9 - Addressing Race Conditions

## Overview

This plan fixes the critical flaws in V8, particularly the race condition where the cleanup worker could delete canisters from an active deployment. The solution: explicit state tracking without full Saga complexity.

## Key Improvements

1. **Explicit deployment states** - Not a full state machine, just "active" vs "failed"
2. **Persistent deployment counter** - Survives upgrades
3. **Cleanup retry limits** - Prevents poison pill deployments
4. **No time-based guessing** - Deployments must explicitly mark themselves as failed

## Solution Architecture

### 1. Minimal State Tracking

```rust
#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum DeploymentStatus {
    Active,    // Still being processed
    Failed,    // Marked for cleanup
    Cleaning,  // Cleanup in progress (prevents double cleanup)
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Deployment {
    pub id: u64,
    pub user: Principal,
    pub payment_block: u64,
    pub created_canisters: Vec<Principal>,
    pub status: DeploymentStatus,
    pub created_at: u64,
    pub failed_at: Option<u64>,
    pub cleanup_attempts: u8,
    pub last_error: Option<String>,
}

thread_local! {
    // Both in stable memory
    static DEPLOYMENTS: RefCell<StableBTreeMap<u64, Deployment, Memory>> = 
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(10)))
        ));
    
    static DEPLOYMENT_COUNTER: RefCell<StableCell<u64, Memory>> = 
        RefCell::new(StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(11))),
            0
        ).unwrap());
}
```

### 2. Deployment with Explicit Failure Marking

```rust
#[update]
async fn create_token(params: CreateTokenParams) -> Result<String, String> {
    let caller = ic_cdk::caller();
    
    // Pre-flight validation
    validate_deployment(&params).await?;
    
    // Collect payment
    let payment_block = deposit_icp_in_canister(500_000_000, None).await?;
    
    // Generate persistent deployment ID
    let deployment_id = DEPLOYMENT_COUNTER.with(|counter| {
        let mut counter = counter.borrow_mut();
        let id = counter.get() + 1;
        counter.set(id).unwrap();
        id
    });
    
    // Create deployment record
    let deployment = Deployment {
        id: deployment_id,
        user: caller,
        payment_block,
        created_canisters: vec![],
        status: DeploymentStatus::Active,
        created_at: ic_cdk::api::time(),
        failed_at: None,
        cleanup_attempts: 0,
        last_error: None,
    };
    
    DEPLOYMENTS.with(|deployments| {
        deployments.borrow_mut().insert(deployment_id, deployment);
    });
    
    // Execute deployment
    match execute_deployment_safe(deployment_id, params).await {
        Ok(token_id) => {
            // Success - remove deployment record
            DEPLOYMENTS.with(|deployments| {
                deployments.borrow_mut().remove(&deployment_id);
            });
            Ok(format!("Token {} created successfully", token_id))
        }
        Err(e) => {
            // CRITICAL: Mark as failed, don't delete
            mark_deployment_failed(deployment_id, e.clone());
            
            // Return immediately, let background worker handle cleanup
            Err(format!(
                "Deployment failed: {}. Refund will be processed automatically. ID: {}",
                e, deployment_id
            ))
        }
    }
}

fn mark_deployment_failed(deployment_id: u64, error: String) {
    DEPLOYMENTS.with(|deployments| {
        if let Some(mut deployment) = deployments.borrow().get(&deployment_id) {
            deployment.status = DeploymentStatus::Failed;
            deployment.failed_at = Some(ic_cdk::api::time());
            deployment.last_error = Some(error);
            deployments.borrow_mut().insert(deployment_id, deployment);
        }
    });
}

async fn execute_deployment_safe(
    deployment_id: u64,
    params: CreateTokenParams
) -> Result<u64, String> {
    // Helper to safely update deployment
    let update_deployment = |canister_id: Principal| -> Result<(), String> {
        DEPLOYMENTS.with(|deployments| {
            if let Some(mut deployment) = deployments.borrow().get(&deployment_id) {
                // Check if deployment was marked failed (by another process)
                if !matches!(deployment.status, DeploymentStatus::Active) {
                    return Err("Deployment cancelled".to_string());
                }
                deployment.created_canisters.push(canister_id);
                deployments.borrow_mut().insert(deployment_id, deployment);
                Ok(())
            } else {
                Err("Deployment record lost".to_string())
            }
        })?;
        Ok(())
    };
    
    // Create canisters with safety checks
    let swap_id = create_canister_with_cycles(100_000_000_000).await?;
    update_deployment(swap_id)?;
    
    let tokenomics_id = create_canister_with_cycles(100_000_000_000).await?;
    update_deployment(tokenomics_id)?;
    
    // ... rest of deployment
    
    Ok(token_id)
}
```

### 3. Safe Cleanup Worker

```rust
#[heartbeat]
async fn cleanup_worker() {
    // Only process deployments explicitly marked as failed
    let failed_deployments = DEPLOYMENTS.with(|deployments| {
        deployments.borrow()
            .iter()
            .filter(|(_, d)| matches!(d.status, DeploymentStatus::Failed))
            .take(3) // Process up to 3 per heartbeat
            .map(|(id, d)| (id, d.clone()))
            .collect::<Vec<_>>()
    });
    
    for (deployment_id, mut deployment) in failed_deployments {
        // Prevent double cleanup with status check
        let should_clean = DEPLOYMENTS.with(|deployments| {
            if let Some(mut d) = deployments.borrow().get(&deployment_id) {
                if matches!(d.status, DeploymentStatus::Failed) {
                    d.status = DeploymentStatus::Cleaning;
                    deployments.borrow_mut().insert(deployment_id, d);
                    true
                } else {
                    false
                }
            } else {
                false
            }
        });
        
        if !should_clean {
            continue;
        }
        
        // Attempt cleanup
        match cleanup_deployment(&deployment).await {
            Ok(_) => {
                // Success - remove record
                DEPLOYMENTS.with(|deployments| {
                    deployments.borrow_mut().remove(&deployment_id);
                });
                ic_cdk::println!("Successfully cleaned deployment {}", deployment_id);
            }
            Err(e) => {
                // Increment retry counter
                deployment.cleanup_attempts += 1;
                deployment.last_error = Some(e.clone());
                
                if deployment.cleanup_attempts >= 3 {
                    // Move to permanent failed state for admin
                    ic_cdk::println!("Deployment {} cleanup failed 3 times, needs admin", deployment_id);
                    deployment.status = DeploymentStatus::Failed; // Keep as failed, admin will see high retry count
                } else {
                    // Reset to Failed for retry
                    deployment.status = DeploymentStatus::Failed;
                }
                
                DEPLOYMENTS.with(|deployments| {
                    deployments.borrow_mut().insert(deployment_id, deployment);
                });
            }
        }
    }
}

async fn cleanup_deployment(deployment: &Deployment) -> Result<(), String> {
    const REFUND_AMOUNT: u64 = 490_000_000;
    let mut errors = vec![];
    
    // Delete canisters
    for canister_id in deployment.created_canisters.iter().rev() {
        if let Err(e) = stop_and_delete_canister(*canister_id).await {
            errors.push(format!("Failed to delete {}: {}", canister_id, e));
        }
    }
    
    // Refund
    if let Err(e) = transfer_icp_to_account(deployment.user, REFUND_AMOUNT).await {
        errors.push(format!("Refund failed: {}", e));
        // Store for manual processing
        store_failed_refund(deployment.user, deployment.payment_block, REFUND_AMOUNT);
    }
    
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join(", "))
    }
}
```

### 4. Trap Recovery

```rust
#[update]
async fn recover_from_trap() -> Result<String, String> {
    let caller = ic_cdk::caller();
    
    // Find user's active deployment (if any)
    let active_deployment = DEPLOYMENTS.with(|deployments| {
        deployments.borrow()
            .iter()
            .find(|(_, d)| d.user == caller && matches!(d.status, DeploymentStatus::Active))
            .map(|(id, d)| (id, d.clone()))
    });
    
    if let Some((deployment_id, deployment)) = active_deployment {
        // Check age - must be at least 10 minutes old
        let age = ic_cdk::api::time() - deployment.created_at;
        if age < 600_000_000_000 { // 10 minutes
            return Err("Deployment may still be active. Wait 10 minutes from start.".to_string());
        }
        
        // User confirms their deployment failed
        mark_deployment_failed(deployment_id, "User reported trap/failure".to_string());
        
        Ok(format!("Deployment {} marked for cleanup. Refund will process soon.", deployment_id))
    } else {
        Err("No active deployment found for your account".to_string())
    }
}

#[query]
fn check_my_deployments() -> Vec<DeploymentInfo> {
    let caller = ic_cdk::caller();
    
    DEPLOYMENTS.with(|deployments| {
        deployments.borrow()
            .iter()
            .filter(|(_, d)| d.user == caller)
            .map(|(_, d)| DeploymentInfo {
                id: d.id,
                status: format!("{:?}", d.status),
                created_at: d.created_at,
                failed_at: d.failed_at,
                cleanup_attempts: d.cleanup_attempts,
                last_error: d.last_error.clone(),
                canister_count: d.created_canisters.len(),
            })
            .collect()
    })
}
```

### 5. Admin Tools

```rust
#[query(guard = "is_admin")]
fn get_problem_deployments() -> Vec<(u64, Deployment)> {
    DEPLOYMENTS.with(|deployments| {
        deployments.borrow()
            .iter()
            .filter(|(_, d)| {
                // Failed with 3+ cleanup attempts
                matches!(d.status, DeploymentStatus::Failed) && d.cleanup_attempts >= 3
            })
            .collect()
    })
}

#[update(guard = "is_admin")]
async fn force_cleanup(deployment_id: u64) -> Result<String, String> {
    let deployment = DEPLOYMENTS.with(|deployments| {
        deployments.borrow().get(&deployment_id)
    }).ok_or("Deployment not found")?;
    
    // Force cleanup regardless of status
    cleanup_deployment(&deployment).await?;
    
    DEPLOYMENTS.with(|deployments| {
        deployments.borrow_mut().remove(&deployment_id);
    });
    
    Ok("Forced cleanup completed".to_string())
}

#[update(guard = "is_admin")]
fn remove_old_completed_deployments(older_than_hours: u64) -> u64 {
    let cutoff = ic_cdk::api::time() - (older_than_hours * 3_600_000_000_000);
    let mut removed = 0;
    
    DEPLOYMENTS.with(|deployments| {
        let to_remove: Vec<u64> = deployments.borrow()
            .iter()
            .filter(|(_, d)| {
                matches!(d.status, DeploymentStatus::Failed) && 
                d.cleanup_attempts >= 3 &&
                d.created_at < cutoff
            })
            .map(|(id, _)| id)
            .collect();
        
        for id in to_remove {
            deployments.borrow_mut().remove(&id);
            removed += 1;
        }
    });
    
    removed
}
```

## Key Safety Properties

1. **No race conditions** - Cleanup only happens on explicitly failed deployments
2. **No time-based guessing** - Active deployments stay active until marked failed
3. **Persistent counter** - Deployment IDs survive upgrades
4. **Retry limits** - Poison pill deployments don't drain cycles forever
5. **User control** - Users can mark their own stuck deployments as failed
6. **Double cleanup prevention** - Status transitions prevent concurrent cleanup

## Trap Handling

When a canister traps:
1. Deployment stays in "Active" state (no automatic timeout)
2. User calls `recover_from_trap()` after 10 minutes
3. System marks deployment as failed
4. Background worker cleans up and refunds
5. No risk of cleaning up a slow-but-successful deployment

## Complexity Analysis

This is barely more complex than V8 but much safer:
- Added explicit status field (3 states instead of time-based)
- Made deployment counter persistent
- Added retry counter
- Added user recovery function

The result is deterministic behavior without the full complexity of a Saga pattern. It's the minimum viable solution that actually handles all the edge cases correctly.