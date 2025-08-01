# Atomic Deployment Design - Two States Only

## Core Principle
Either the token is fully deployed and live, or it doesn't exist at all. No in-between.

## The Two States

```rust
pub enum TokenState {
    Live,     // Token exists, trading enabled
    NotExist  // Token doesn't exist (never tried or fully rolled back)
}
```

## Atomic Deployment Flow

```rust
#[update]
pub async fn create_token_atomic(params: CreateTokenParams) -> Result<u64, String> {
    // Take payment
    let payment_result = deposit_icp_in_canister(500_000_000u64, None).await;
    
    let payment_block = match payment_result {
        Ok(block) => block,
        Err(e) => return Err(format!("Payment failed: {}", e))
    };
    
    // Track what we create for rollback
    let mut created_resources = CreatedResources::new();
    
    // Try to create everything
    match create_token_resources(&params, &mut created_resources).await {
        Ok(token_id) => {
            // Success - save to permanent storage
            TOKENS.with(|tokens| {
                tokens.borrow_mut().insert(token_id, TokenRecord {
                    id: token_id,
                    status: TokenStatus::Live { pool_id: token_id.to_string() },
                    // ... other fields
                });
            });
            Ok(token_id)
        }
        Err(e) => {
            // Failure - rollback EVERYTHING immediately
            rollback_everything(created_resources, payment_block).await;
            Err(format!("Token creation failed: {}. Payment refunded.", e))
        }
    }
}

async fn create_token_resources(
    params: &CreateTokenParams,
    tracker: &mut CreatedResources
) -> Result<u64, String> {
    // Create each resource with immediate rollback on failure
    
    // 1. Swap canister
    let swap_canister = create_canister_with_rollback(SWAP_CYCLES, tracker).await?;
    
    // 2. Tokenomics canister
    let tokenomics_canister = create_canister_with_rollback(TOKENOMICS_CYCLES, tracker).await?;
    
    // 3. Logs canister
    let logs_canister = create_canister_with_rollback(LOGS_CYCLES, tracker).await?;
    
    // 4. Primary token
    let primary_token = create_token_with_rollback(
        params.primary_token_params(), 
        tracker
    ).await?;
    
    // 5. Secondary token
    let secondary_token = create_token_with_rollback(
        params.secondary_token_params(),
        tracker
    ).await?;
    
    // 6. Install all WASMs
    install_all_wasms(swap_canister, tokenomics_canister, logs_canister).await
        .map_err(|e| {
            // Installation failed - resources will be rolled back by caller
            format!("WASM installation failed: {}", e)
        })?;
    
    // 7. Create pool (critical final step)
    let token_id = create_pool_atomic(primary_token, secondary_token).await
        .map_err(|e| {
            // Pool creation failed - resources will be rolled back by caller
            format!("Pool creation failed: {}", e)
        })?;
    
    // Everything succeeded
    Ok(token_id)
}

async fn rollback_everything(resources: CreatedResources, payment_block: BlockIndex) {
    // Delete canisters in parallel
    let deletions = resources.canisters.iter().map(|c| {
        stop_and_delete_canister(*c)
    });
    futures::join_all(deletions).await;
    
    // Refund payment (minus platform fee)
    let refund_amount = 400_000_000u64; // 4 ICP (5 ICP - 1 ICP fee)
    let _ = transfer_icp_to_account(ic_cdk::caller(), refund_amount).await;
    
    // No deployment record saved - it never existed
}
```

## What This Eliminates

### 1. No Deployment Table Needed
```rust
// DELETE THIS ENTIRE STRUCTURE
pub struct Deployment {
    pub id: u64,
    pub status: DeploymentStatus,
    pub created_canisters: Vec<Principal>,
    pub deleted_canisters: Vec<Principal>,
    pub cleanup_attempts: u8,
    // ... etc
}

// DELETE THIS TOO
pub static DEPLOYMENTS: RefCell<StableBTreeMap<u64, Deployment, Memory>>
```

### 2. No Cleanup Workers
```rust
// DELETE cleanup_worker heartbeat function
// DELETE cleanup_deployment_with_progress
// DELETE admin_force_cleanup
// DELETE all recovery mechanisms
```

### 3. No Complex States
```rust
// DELETE DeploymentStatus enum
// DELETE all status tracking
// DELETE all state transitions
```

## User Experience

### Success Case
```
User: "Create token"
System: "Creating your token..." (30-60 seconds)
System: "Success! Token #123 is live"
```

### Failure Case
```
User: "Create token"
System: "Creating your token..." (fails at any point)
System: "Creation failed: Pool creation error. 4 ICP refunded."
```

That's it. No other states.

## Backend Simplification

### Before: ~1000 lines across 4 files
- deployment.rs (300 lines)
- deployment_updates.rs (300 lines) 
- deployment_cleanup.rs (300 lines)
- deployment_execution.rs (200 lines)

### After: ~200 lines in update.rs
```rust
// Just the create_token_atomic function and helpers
// No deployment tracking
// No cleanup logic
// No recovery mechanisms
```

## Frontend Simplification

### Before: Complex State Management
```typescript
interface DeploymentState {
  deployments: Record<string, DeploymentRecord>;
  activeDeploymentId: string | null;
  isLoading: boolean;
}

// Polling, recovery, status checking, etc.
```

### After: Simple Token Check
```typescript
interface TokenState {
  isCreating: boolean;
  error?: string;
}

// Just check if token exists in get_all_tokens()
```

## What About History?

If users want to see their tokens:
```rust
#[query]
pub fn get_my_tokens() -> Vec<TokenRecord> {
    TOKENS.with(|tokens| {
        tokens.borrow()
            .iter()
            .filter(|(_, t)| t.caller == ic_cdk::caller())
            .map(|(_, t)| t.clone())
            .collect()
    })
}
```

Only successful tokens exist. Failed attempts leave no trace.

## Rollback Robustness

```rust
struct CreatedResources {
    canisters: Vec<Principal>,
    transfers: Vec<BlockIndex>,
}

impl Drop for CreatedResources {
    fn drop(&mut self) {
        // Even if we panic, attempt cleanup
        if !self.canisters.is_empty() {
            ic_cdk::spawn(async move {
                for canister in &self.canisters {
                    let _ = delete_canister(*canister).await;
                }
            });
        }
    }
}
```

## Benefits

1. **Zero tech debt** - Failed deployments leave no trace
2. **No user confusion** - Token either exists or doesn't
3. **No maintenance** - No cleanup workers, no stuck states
4. **Minimal storage** - Only successful tokens stored
5. **Simple frontend** - Just show existing tokens
6. **Fast recovery** - Instant refund on failure

## Migration

1. Stop accepting new deployments via old system
2. Run final cleanup on existing deployments
3. Delete all deployment-related code
4. Deploy new atomic system
5. Delete deployment tables from stable memory

## Complexity Comparison

### Current System
- 4 deployment states
- 3 phase process
- Manual recovery needed
- Cleanup workers
- Partial state tracking
- Failed refund handling
- Admin intervention required

### New System
- 0 deployment states (tokens exist or don't)
- 1 atomic operation
- Automatic rollback
- No cleanup needed
- No state tracking
- Refunds always succeed inline
- No admin functions needed

This is how it should have been built from the start.