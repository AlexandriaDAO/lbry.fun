# Token Deployment - Atomic All-or-Nothing Approach

## Core Principle
Either EVERYTHING succeeds (including pool creation) or NOTHING exists. No partial states.

## Revised create_token Flow

```rust
#[update]
async fn create_token(params: CreateTokenParams) -> Result<String, String> {
    let caller = ic_cdk::caller();
    let mut created_canisters: Vec<Principal> = vec![];
    
    // Step 1: Collect payment
    deposit_icp_in_canister(500_000_000, None).await?;
    
    // Step 2: Try complete deployment
    match deploy_token_with_pool(&mut created_canisters, params).await {
        Ok(token_id) => {
            Ok(format!("Token {} created successfully with liquidity pool.", token_id))
        }
        Err(e) => {
            // ANY failure = full cleanup
            cleanup_and_refund(created_canisters, caller).await;
            Err(format!("Deployment failed: {}. All resources cleaned up, 4.9 ICP refunded.", e))
        }
    }
}

async fn deploy_token_with_pool(
    created_canisters: &mut Vec<Principal>,
    params: CreateTokenParams
) -> Result<u64, String> {
    // Create all canisters
    let swap_id = create_canister().await?;
    created_canisters.push(swap_id);
    
    let tokenomics_id = create_canister().await?;
    created_canisters.push(tokenomics_id);
    
    // ... create all 5 canisters ...
    
    // Install WASM on all
    install_all_wasm().await?;
    
    // Transfer initial liquidity to Kong
    let primary_transfer = transfer_to_kong(primary_token_id, E8S).await?;
    let icp_transfer = transfer_icp_to_kong(E8S).await?;
    
    // Create pool - if this fails, everything fails
    let pool_reply = create_pool_on_kong_swap(
        primary_token_id,
        primary_transfer,
        icp_transfer
    ).await?;
    
    // Only NOW save the token record
    let token_record = TokenRecord {
        pool_id: Some(pool_reply.pool_id),
        pool_created_at: ic_cdk::api::time(),
        // ... rest of fields
    };
    
    let token_id = TOKENS.with(|tokens| {
        let mut tokens = tokens.borrow_mut();
        let id = tokens.len() as u64 + 1;
        tokens.insert(id, token_record);
        id
    });
    
    Ok(token_id)
}
```

## Handling KongSwap Failures

Instead of retry mechanism, ensure pool creation rarely fails:

1. **Pre-flight Checks**:
```rust
async fn verify_kongswap_ready() -> Result<(), String> {
    // Check KongSwap is responsive
    // Verify we have controller access
    // Check pool doesn't already exist
}
```

2. **Robust Pool Creation**:
```rust
async fn create_pool_with_retries(params) -> Result<PoolReply, String> {
    for attempt in 0..3 {
        match create_pool_internal(params).await {
            Ok(reply) => return Ok(reply),
            Err(e) if is_transient_error(&e) && attempt < 2 => {
                // Brief delay before retry
                ic_cdk_timers::set_timer(Duration::from_secs(2), || {});
                continue;
            }
            Err(e) => return Err(e),
        }
    }
    unreachable!()
}
```

## Manual Intervention (Admin Only)

For the rare case where deployment is truly stuck:

```rust
#[update(guard = "is_admin")]
async fn manual_deployment_recovery(
    stuck_deployment_id: u64,
    action: RecoveryAction
) -> Result<String, String> {
    match action {
        RecoveryAction::ForceCleanup => {
            // Admin-triggered cleanup of stuck resources
        }
        RecoveryAction::ForceComplete => {
            // Admin manually completes pool creation
        }
    }
}
```

## Benefits

1. **True Atomicity**: Users see only two states - nothing or complete success
2. **No Confusion**: No "retry_pool_creation" or partial states
3. **Cleaner Code**: One path, one outcome
4. **Better UX**: Clear success/failure, no follow-up actions needed

## Implementation Changes

1. Remove `pool_creation_failed` field from TokenRecord
2. Remove `retry_pool_creation` function entirely  
3. Make pool creation part of atomic deployment
4. Add pre-flight checks for KongSwap
5. Add internal retries for transient failures
6. Admin-only manual recovery for edge cases

This approach treats pool creation as a critical part of token deployment, not an optional add-on.