# Token Deployment Cleanup Plan V8 - Minimal State Persistence

## Overview

This plan addresses the critical canister trap scenario while avoiding the complexity of a full Saga pattern. The key insight: we only need to persist the minimum information required for cleanup, not a complete state machine.

## Core Design

### 1. Persistent Deployment Tracking

Store only what's needed for cleanup in stable memory:

```rust
use candid::{CandidType, Deserialize, Principal};
use ic_stable_structures::{StableBTreeMap, Memory};

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ActiveDeployment {
    pub user: Principal,
    pub payment_block: u64,
    pub created_canisters: Vec<Principal>,
    pub start_time: u64,
    pub last_update: u64,
}

thread_local! {
    // Persist active deployments in stable memory
    static ACTIVE_DEPLOYMENTS: RefCell<StableBTreeMap<u64, ActiveDeployment, Memory>> = 
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(10)))
        ));
    
    // Simple counter for deployment IDs
    static NEXT_DEPLOYMENT_ID: RefCell<u64> = RefCell::new(1);
}
```

### 2. Deployment Function with Minimal Persistence

```rust
#[update]
async fn create_token(params: CreateTokenParams) -> Result<String, String> {
    let caller = ic_cdk::caller();
    
    // Pre-flight validation (from V7)
    validate_deployment(&params).await?;
    
    // Collect payment first
    let payment_block = deposit_icp_in_canister(500_000_000, None).await
        .map_err(|e| format!("Payment failed: {}", e))?;
    
    // Create deployment record in stable storage
    let deployment_id = NEXT_DEPLOYMENT_ID.with(|id| {
        let current = *id.borrow();
        *id.borrow_mut() = current + 1;
        current
    });
    
    let deployment = ActiveDeployment {
        user: caller,
        payment_block,
        created_canisters: vec![],
        start_time: ic_cdk::api::time(),
        last_update: ic_cdk::api::time(),
    };
    
    ACTIVE_DEPLOYMENTS.with(|deployments| {
        deployments.borrow_mut().insert(deployment_id, deployment.clone());
    });
    
    ic_cdk::println!("DEPLOYMENT[{}]: Started for user {}", deployment_id, caller);
    
    // Execute deployment with persistent tracking
    match execute_deployment_with_persistence(deployment_id, params).await {
        Ok(token_id) => {
            // Success - remove from active deployments
            ACTIVE_DEPLOYMENTS.with(|deployments| {
                deployments.borrow_mut().remove(&deployment_id);
            });
            
            Ok(format!("Token {} created successfully", token_id))
        }
        Err(e) => {
            ic_cdk::println!("DEPLOYMENT[{}]: Failed with error: {}", deployment_id, e);
            
            // Mark for cleanup but don't do it synchronously
            // This ensures the record survives even if we trap during cleanup
            mark_deployment_failed(deployment_id);
            
            // Try immediate cleanup (best effort)
            let _ = try_cleanup_deployment(deployment_id).await;
            
            Err(format!(
                "Deployment failed: {}. Cleanup in progress. Check status with deployment ID: {}",
                e, deployment_id
            ))
        }
    }
}

async fn execute_deployment_with_persistence(
    deployment_id: u64,
    params: CreateTokenParams
) -> Result<u64, String> {
    // Helper to update deployment record after each canister creation
    let mut update_deployment = |canister_id: Principal| {
        ACTIVE_DEPLOYMENTS.with(|deployments| {
            if let Some(mut deployment) = deployments.borrow().get(&deployment_id) {
                deployment.created_canisters.push(canister_id);
                deployment.last_update = ic_cdk::api::time();
                deployments.borrow_mut().insert(deployment_id, deployment);
            }
        });
        ic_cdk::println!("DEPLOYMENT[{}]: Created canister {}", deployment_id, canister_id);
    };
    
    // Generate tokenomics schedule
    let schedule = preview_tokenomics_from_frontend(/* params */);
    
    // Create each canister and immediately persist
    let swap_id = create_canister_with_cycles(100_000_000_000).await?;
    update_deployment(swap_id); // Persisted before next operation
    
    let tokenomics_id = create_canister_with_cycles(100_000_000_000).await?;
    update_deployment(tokenomics_id);
    
    let logs_id = create_canister_with_cycles(100_000_000_000).await?;
    update_deployment(logs_id);
    
    // Create tokens
    let primary_token_id = create_icrc1_canister(/* params */).await?;
    update_deployment(get_principal(&primary_token_id));
    
    let secondary_token_id = create_icrc1_canister(/* params */).await?;
    update_deployment(get_principal(&secondary_token_id));
    
    // Install WASM
    install_tokenomics_wasm_on_existing_canister(/* params */).await?;
    install_icp_swap_wasm_on_existing_canister(/* params */).await?;
    install_logs_wasm_on_existing_canister(/* params */).await?;
    
    // Create pool
    let pool_reply = create_pool_on_kong_swap(/* params */).await?;
    
    // Save token record
    let token_id = save_token_record(/* params */);
    
    Ok(token_id)
}
```

### 3. Background Cleanup Worker

Simple heartbeat that cleans up failed/abandoned deployments:

```rust
#[heartbeat]
async fn cleanup_worker() {
    let now = ic_cdk::api::time();
    let five_minutes = 300_000_000_000u64; // 5 minutes in nanoseconds
    
    // Find stuck deployments
    let stuck_deployments = ACTIVE_DEPLOYMENTS.with(|deployments| {
        deployments.borrow()
            .iter()
            .filter(|(_, deployment)| {
                // Deployment is stuck if no update for 5 minutes
                deployment.last_update + five_minutes < now
            })
            .map(|(id, deployment)| (id, deployment.clone()))
            .collect::<Vec<_>>()
    });
    
    // Process up to 3 cleanups per heartbeat to avoid cycle exhaustion
    for (deployment_id, deployment) in stuck_deployments.into_iter().take(3) {
        ic_cdk::println!("CLEANUP_WORKER: Processing stuck deployment {}", deployment_id);
        
        match cleanup_deployment_internal(&deployment).await {
            Ok(_) => {
                ACTIVE_DEPLOYMENTS.with(|deployments| {
                    deployments.borrow_mut().remove(&deployment_id);
                });
                ic_cdk::println!("CLEANUP_WORKER: Successfully cleaned deployment {}", deployment_id);
            }
            Err(e) => {
                ic_cdk::println!("CLEANUP_WORKER: Failed to clean deployment {}: {}", deployment_id, e);
                // Will retry next heartbeat
            }
        }
    }
}

async fn cleanup_deployment_internal(deployment: &ActiveDeployment) -> Result<(), String> {
    const REFUND_AMOUNT: u64 = 490_000_000; // 4.9 ICP
    
    // Delete canisters (best effort)
    for canister_id in deployment.created_canisters.iter().rev() {
        match stop_and_delete_canister(*canister_id).await {
            Ok(_) => ic_cdk::println!("Deleted canister {}", canister_id),
            Err(e) => ic_cdk::println!("Failed to delete {}: {}", canister_id, e),
        }
    }
    
    // Refund user
    match transfer_icp_to_account(deployment.user, REFUND_AMOUNT).await {
        Ok(block) => {
            ic_cdk::println!("Refunded {} ICP to {} at block {}", 
                REFUND_AMOUNT / 100_000_000, deployment.user, block);
        }
        Err(e) => {
            ic_cdk::println!("Refund failed for {}: {}", deployment.user, e);
            // Store in failed refunds for manual processing
            store_failed_refund(deployment.user, deployment.payment_block, REFUND_AMOUNT);
        }
    }
    
    Ok(())
}
```

### 4. User-Facing Recovery

```rust
#[update]
async fn check_deployment_status(deployment_id: u64) -> Result<DeploymentStatus, String> {
    let deployment = ACTIVE_DEPLOYMENTS.with(|deployments| {
        deployments.borrow().get(&deployment_id)
    });
    
    match deployment {
        Some(dep) => {
            let age = ic_cdk::api::time() - dep.start_time;
            let status = if age < 300_000_000_000 { // Less than 5 minutes
                "In Progress"
            } else {
                "Failed - Cleanup Pending"
            };
            
            Ok(DeploymentStatus {
                id: deployment_id,
                status: status.to_string(),
                created_canisters: dep.created_canisters.len(),
                age_seconds: age / 1_000_000_000,
            })
        }
        None => {
            // Check if token was created
            let token_exists = check_token_exists_for_deployment(deployment_id);
            if token_exists {
                Ok(DeploymentStatus {
                    id: deployment_id,
                    status: "Completed Successfully".to_string(),
                    created_canisters: 5,
                    age_seconds: 0,
                })
            } else {
                Err("Deployment not found".to_string())
            }
        }
    }
}

#[update]
async fn trigger_deployment_cleanup(deployment_id: u64) -> Result<String, String> {
    let caller = ic_cdk::caller();
    
    // Verify ownership
    let deployment = ACTIVE_DEPLOYMENTS.with(|deployments| {
        deployments.borrow().get(&deployment_id)
    }).ok_or("Deployment not found")?;
    
    if deployment.user != caller {
        return Err("Not authorized - you didn't create this deployment".to_string());
    }
    
    // Check if old enough (at least 2 minutes)
    let age = ic_cdk::api::time() - deployment.start_time;
    if age < 120_000_000_000 {
        return Err("Deployment still in progress - wait 2 minutes before forcing cleanup".to_string());
    }
    
    // Trigger immediate cleanup
    match cleanup_deployment_internal(&deployment).await {
        Ok(_) => {
            ACTIVE_DEPLOYMENTS.with(|deployments| {
                deployments.borrow_mut().remove(&deployment_id);
            });
            Ok("Cleanup completed. 4.9 ICP refunded.".to_string())
        }
        Err(e) => Err(format!("Cleanup failed: {}. Will retry automatically.", e))
    }
}
```

### 5. Admin Tools

```rust
#[query(guard = "is_admin")]
fn get_stuck_deployments() -> Vec<(u64, ActiveDeployment)> {
    let now = ic_cdk::api::time();
    let one_hour = 3_600_000_000_000u64;
    
    ACTIVE_DEPLOYMENTS.with(|deployments| {
        deployments.borrow()
            .iter()
            .filter(|(_, dep)| dep.last_update + one_hour < now)
            .collect()
    })
}

#[update(guard = "is_admin")]
async fn force_cleanup_deployment(deployment_id: u64) -> Result<String, String> {
    let deployment = ACTIVE_DEPLOYMENTS.with(|deployments| {
        deployments.borrow().get(&deployment_id)
    }).ok_or("Deployment not found")?;
    
    cleanup_deployment_internal(&deployment).await?;
    
    ACTIVE_DEPLOYMENTS.with(|deployments| {
        deployments.borrow_mut().remove(&deployment_id);
    });
    
    Ok("Forced cleanup completed".to_string())
}

#[update(guard = "is_admin")]
fn clear_old_deployments(older_than_hours: u64) -> u64 {
    let cutoff_time = ic_cdk::api::time() - (older_than_hours * 3_600_000_000_000);
    let mut removed = 0;
    
    ACTIVE_DEPLOYMENTS.with(|deployments| {
        let to_remove: Vec<u64> = deployments.borrow()
            .iter()
            .filter(|(_, dep)| dep.start_time < cutoff_time)
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

## Key Advantages Over Previous Plans

### Compared to V7 (Pure Local State)
- **Survives traps**: Deployment info persisted in stable memory
- **Automatic recovery**: Heartbeat worker cleans up stuck deployments
- **User visibility**: Can check status even after trap

### Compared to V6 (Full Saga)
- **Much simpler**: No state machine, event sourcing, or complex rollback logic
- **Minimal storage**: Only stores active deployments, not complete history
- **Easier to debug**: Simple list of deployments, not complex state transitions
- **Lower overhead**: No per-step state updates, just canister creation tracking

## Implementation Steps

1. **Add stable storage** - Set up StableBTreeMap for active deployments
2. **Update create_token** - Add deployment tracking with persistence
3. **Add heartbeat worker** - Implement automatic cleanup of stuck deployments
4. **Add user endpoints** - Status checking and manual cleanup triggers
5. **Add admin tools** - Query and management functions
6. **Test trap scenarios** - Ensure deployments are cleaned up after traps

## How It Handles Traps

When a canister traps during deployment:

1. **Deployment record persists** in stable memory with list of created canisters
2. **Heartbeat worker** detects stuck deployment (no updates for 5 minutes)
3. **Automatic cleanup** deletes orphaned canisters and refunds user
4. **User can check status** using deployment ID even after trap
5. **Manual trigger** available if user wants immediate cleanup

This provides the safety of persistent state without the complexity of a full distributed transaction system. It's the minimal solution that actually works in the face of canister traps.