# Token Deployment Cleanup Mechanism Plan (Revised)

## Problem Statement
When token deployment fails in the lbry_fun canister, partially created canisters are left orphaned with no cleanup mechanism. Users lose their 5 ICP payment with no recovery option.

## Revised Solution (Incorporating Agent Feedback)

### 1. Simplified Error Handling with DeploymentFailure

Instead of complex state tracking, use a simple error structure:

```rust
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct DeploymentFailure {
    pub error: DeploymentError,
    pub created_canisters: Vec<Principal>,
    pub timestamp: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum DeploymentError {
    CanisterCreation(String),
    WasmInstall { canister_id: Principal, err: String },
    KongSwapIntegration(String),
    IcpTransfer(String),
    TokenInitialization(String),
}
```

### 2. Refactored create_token Function

Split into internal logic and public wrapper:

```rust
async fn create_token_internal(
    params: CreateTokenParams,
    payment_principal: Principal,
) -> Result<TokenRecord, DeploymentFailure> {
    let mut created_canisters = vec![];
    
    // Create swap canister
    let swap_canister = create_a_canister()
        .await
        .map_err(|e| DeploymentFailure {
            error: DeploymentError::CanisterCreation(e),
            created_canisters: created_canisters.clone(),
            timestamp: time(),
        })?;
    created_canisters.push(swap_canister);
    
    // Create tokenomics canister
    let tokenomics_canister = create_a_canister()
        .await
        .map_err(|e| DeploymentFailure {
            error: DeploymentError::CanisterCreation(e),
            created_canisters: created_canisters.clone(),
            timestamp: time(),
        })?;
    created_canisters.push(tokenomics_canister);
    
    // Continue with remaining canisters...
    // Each step updates created_canisters before potentially failing
    
    Ok(final_token_record)
}

#[update]
async fn create_token(params: CreateTokenParams) -> Result<TokenRecord, String> {
    // Fixed deployment fee: 0.1 ICP non-refundable, 4.9 ICP refundable
    const DEPLOYMENT_FEE: u64 = 10_000_000; // 0.1 ICP
    const REFUNDABLE_AMOUNT: u64 = 490_000_000; // 4.9 ICP
    
    // Collect payment
    let payment_result = deposit_icp(500_000_000).await?; // 5 ICP
    
    // Store refundable amount info for cleanup
    let payment_principal = caller();
    
    match create_token_internal(params, payment_principal).await {
        Ok(record) => {
            // Save successful deployment
            save_token_record(record.clone());
            Ok(record)
        }
        Err(failure) => {
            // Trigger cleanup with timer
            trigger_cleanup_with_delay(failure.clone(), payment_principal, REFUNDABLE_AMOUNT).await;
            Err(format!("Deployment failed: {:?}. Cleanup scheduled, refund will be processed.", failure.error))
        }
    }
}
```

### 3. Efficient Timer-Based Cleanup

Use `ic_cdk_timers` instead of heartbeat:

```rust
async fn trigger_cleanup_with_delay(
    failure: DeploymentFailure,
    user: Principal,
    refund_amount: u64,
) {
    // Set a 5-minute timer to allow any pending operations to complete
    let timer_id = ic_cdk_timers::set_timer(
        Duration::from_secs(300),
        move || {
            ic_cdk::spawn(async move {
                cleanup_and_refund(failure, user, refund_amount).await;
            });
        }
    );
    
    // Store timer_id in case we need to cancel (e.g., manual cleanup)
    store_cleanup_timer(user, timer_id);
}

async fn cleanup_and_refund(
    failure: DeploymentFailure,
    user: Principal,
    refund_amount: u64,
) -> Result<(), String> {
    // Stop and delete all canisters
    for canister_id in failure.created_canisters.iter() {
        match stop_canister(*canister_id).await {
            Ok(_) => {},
            Err(e) => ic_cdk::println!("Failed to stop canister {}: {}", canister_id, e),
        }
        
        match delete_canister(*canister_id).await {
            Ok(_) => {},
            Err(e) => ic_cdk::println!("Failed to delete canister {}: {}", canister_id, e),
        }
    }
    
    // Refund user (fixed amount, no complex calculation)
    match transfer_icp(user, refund_amount).await {
        Ok(_) => ic_cdk::println!("Refunded {} to {}", refund_amount, user),
        Err(e) => {
            ic_cdk::println!("Refund failed: {}", e);
            // Store failed refund for manual processing
            store_failed_refund(user, refund_amount);
        }
    }
    
    Ok(())
}
```

### 4. Manual Cleanup Option

Simple endpoint for immediate cleanup:

```rust
#[update]
async fn cleanup_my_failed_deployment() -> Result<String, String> {
    let caller = caller();
    
    // Check if caller has a pending cleanup timer
    if let Some(timer_id) = get_cleanup_timer(caller) {
        // Cancel the timer and execute cleanup immediately
        ic_cdk_timers::clear_timer(timer_id);
        
        if let Some((failure, refund_amount)) = get_pending_cleanup(caller) {
            cleanup_and_refund(failure, caller, refund_amount).await?;
            Ok("Cleanup completed and refund processed".to_string())
        } else {
            Err("No pending cleanup found".to_string())
        }
    } else {
        Err("No failed deployment found for your account".to_string())
    }
}
```

### 5. Storage Updates

Add minimal storage for cleanup tracking:

```rust
// In storage.rs
thread_local! {
    // Map user principal to (timer_id, failure_info, refund_amount)
    static PENDING_CLEANUPS: RefCell<HashMap<Principal, (TimerId, DeploymentFailure, u64)>> = RefCell::new(HashMap::new());
    
    // Track failed refunds for manual processing
    static FAILED_REFUNDS: RefCell<StableBTreeMap<Principal, u64, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(FAILED_REFUNDS_MEM_ID))
        )
    );
}
```

## Benefits of Revised Approach

1. **Simpler Code**: No complex state machine, just Result types and error propagation
2. **Transparent Fees**: Fixed 0.1 ICP deployment fee, easy to understand
3. **Efficient Cleanup**: Timer-based cleanup only runs when needed
4. **Better Error Types**: Enum-based errors for better debugging
5. **Idiomatic Rust**: Uses ? operator and Result types naturally

## Implementation Steps

1. Add DeploymentError and DeploymentFailure types to storage.rs
2. Add PENDING_CLEANUPS and FAILED_REFUNDS storage
3. Refactor create_token into internal function and wrapper
4. Implement cleanup_and_refund function
5. Add timer-based cleanup trigger
6. Add manual cleanup endpoint
7. Update tests to verify cleanup

## Testing Strategy

1. Test deployment failure at each stage
2. Verify cleanup removes all canisters
3. Verify fixed refund amount is correct
4. Test timer-based cleanup after delay
5. Test manual cleanup cancels timer
6. Test failed refund tracking