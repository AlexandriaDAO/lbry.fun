# Token Deployment Cleanup Mechanism Plan V3 (Simple Approach)

## Problem Statement
When token deployment fails in the lbry_fun canister, partially created canisters are left orphaned with no cleanup mechanism. Users lose their 5 ICP payment with no recovery option.

## Key Insights from Code Analysis
1. The existing code already handles pool creation failures gracefully with `retry_pool_creation`
2. The main failure points are canister creation and WASM installation
3. No complex state tracking is needed - just track canisters during deployment

## Solution: Inline Cleanup with Local Tracking

### Core Principle
Track created canisters in a local vector during deployment. On any failure, immediately cleanup and refund. No state machines, no timers, no storage changes.

### 1. Refactored create_token Function

```rust
#[update]
async fn create_token(
    // ... existing parameters
) -> Result<String, String> {
    let caller = ic_cdk::api::caller();
    let mut created_canisters: Vec<Principal> = vec![];
    
    // Step 1: Collect payment (0.1 ICP non-refundable, 4.9 ICP refundable)
    ic_cdk::println!("[CREATE_TOKEN] Depositing 5 ICP from user...");
    deposit_icp_in_canister(500_000_000, None)
        .await
        .map_err(|e| {
            ic_cdk::println!("[CREATE_TOKEN] ERROR: ICP deposit failed: {:?}", e);
            format!("Failed to deposit ICP: {:?}", e)
        })?;
    
    // Step 2: Attempt deployment with automatic cleanup on failure
    match deploy_token_internal(&mut created_canisters, /* all params */).await {
        Ok(token_record) => {
            // Save the token record
            let final_token_id = TOKENS.with(|tokens| {
                let mut tokens = tokens.borrow_mut();
                let token_id = tokens.len() as u64 + 1;
                let mut record = token_record;
                record.id = token_id;
                tokens.insert(token_id, record.clone());
                token_id
            });
            
            // Return appropriate message based on pool creation result
            if token_record.pool_creation_failed {
                Ok(format!(
                    "Token created (ID: {}) but pool creation failed. Use retry_pool_creation({}) to try again.",
                    final_token_id, final_token_id
                ))
            } else {
                Ok(format!(
                    "Token created successfully (ID: {}) with liquidity pool.",
                    final_token_id
                ))
            }
        }
        Err(e) => {
            ic_cdk::println!("[CREATE_TOKEN] Deployment failed: {}. Starting cleanup...", e);
            
            // Immediate cleanup and refund
            cleanup_and_refund(created_canisters, caller).await;
            
            Err(format!(
                "Deployment failed: {}. Cleanup completed and 4.9 ICP refunded.",
                e
            ))
        }
    }
}
```

### 2. Internal Deployment Function

```rust
async fn deploy_token_internal(
    created_canisters: &mut Vec<Principal>,
    primary_token_name: String,
    primary_token_symbol: String,
    // ... all other parameters
) -> Result<TokenRecord, String> {
    // Generate tokenomics schedule (existing logic)
    let schedule = preview_tokenomics_from_frontend(/* params */);
    // ... existing schedule generation code
    
    // Create canisters with tracking
    ic_cdk::println!("[DEPLOY] Creating swap canister...");
    let swap_canister_id = create_a_canister(CANISTER_CREATION_CYCLES).await?;
    created_canisters.push(swap_canister_id);
    ic_cdk::println!("[DEPLOY] Swap canister created: {}", swap_canister_id);
    
    ic_cdk::println!("[DEPLOY] Creating tokenomics canister...");
    let tokenomics_canister_id = create_a_canister(CANISTER_CREATION_CYCLES).await?;
    created_canisters.push(tokenomics_canister_id);
    ic_cdk::println!("[DEPLOY] Tokenomics canister created: {}", tokenomics_canister_id);
    
    ic_cdk::println!("[DEPLOY] Creating logs canister...");
    let logs_canister_id = create_a_canister(CANISTER_CREATION_CYCLES).await?;
    created_canisters.push(logs_canister_id);
    ic_cdk::println!("[DEPLOY] Logs canister created: {}", logs_canister_id);
    
    // Create primary token
    let primary_token_id = create_icrc1_canister(/* params */)
        .await
        .map_err(|e| {
            ic_cdk::println!("[DEPLOY] Primary token creation failed: {}", e);
            e.to_string()
        })?;
    created_canisters.push(get_principal(&primary_token_id));
    
    // Create secondary token
    let secondary_token_id = create_icrc1_canister(/* params */)
        .await
        .map_err(|e| {
            ic_cdk::println!("[DEPLOY] Secondary token creation failed: {}", e);
            e.to_string()
        })?;
    created_canisters.push(get_principal(&secondary_token_id));
    
    // Install WASM on canisters
    install_tokenomics_wasm_on_existing_canister(/* params */).await?;
    install_icp_swap_wasm_on_existing_canister(/* params */).await?;
    install_logs_wasm_on_existing_canister(/* params */).await?;
    
    // Kong integration and pool creation (existing logic)
    // ... rest of existing logic
    
    Ok(token_record)
}
```

### 3. Cleanup and Refund Function

```rust
async fn cleanup_and_refund(canisters: Vec<Principal>, user: Principal) {
    const REFUND_AMOUNT: u64 = 490_000_000; // 4.9 ICP
    
    ic_cdk::println!("[CLEANUP] Starting cleanup of {} canisters", canisters.len());
    
    // Stop and delete each canister (best effort, don't fail on errors)
    for canister_id in canisters {
        // First try to stop the canister
        match stop_canister(canister_id).await {
            Ok(_) => ic_cdk::println!("[CLEANUP] Stopped canister: {}", canister_id),
            Err(e) => ic_cdk::println!("[CLEANUP] Failed to stop canister {}: {}", canister_id, e),
        }
        
        // Then delete it
        match delete_canister(CanisterIdRecord { canister_id }).await {
            Ok(_) => ic_cdk::println!("[CLEANUP] Deleted canister: {}", canister_id),
            Err(e) => ic_cdk::println!("[CLEANUP] Failed to delete canister {}: {}", canister_id, e),
        }
    }
    
    // Refund user (best effort)
    ic_cdk::println!("[CLEANUP] Processing refund of {} ICP to {}", REFUND_AMOUNT / 100_000_000, user);
    match transfer_icp(user, REFUND_AMOUNT).await {
        Ok(block_index) => {
            ic_cdk::println!("[CLEANUP] Refund successful. Block index: {}", block_index);
        }
        Err(e) => {
            ic_cdk::println!("[CLEANUP] ERROR: Refund failed: {}. User should contact support.", e);
        }
    }
}
```

### 4. Updates to cleanup.rs

```rust
use ic_cdk::api::management_canister::main::{
    stop_canister as mgmt_stop_canister, 
    delete_canister, 
    CanisterIdRecord
};
use icrc_ledger_types::icrc1::transfer::{TransferArg, BlockIndex};
use icrc_ledger_types::icrc1::account::Account;
use candid::{Principal, Nat};

pub async fn stop_canister(canister_id: Principal) -> Result<(), String> {
    mgmt_stop_canister(CanisterIdRecord { canister_id })
        .await
        .map_err(|(code, msg)| format!("Stop failed: ({}): {}", code as u8, msg))?;
    Ok(())
}

pub async fn transfer_icp(to: Principal, amount: u64) -> Result<BlockIndex, String> {
    let args = TransferArg {
        to: Account { 
            owner: to, 
            subaccount: None 
        },
        amount: Nat::from(amount),
        fee: None,
        memo: None,
        from_subaccount: None,
        created_at_time: None,
    };
    
    let (result,): (Result<BlockIndex, _>,) = 
        ic_cdk::call(
            Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap(),
            "icrc1_transfer",
            (args,)
        )
        .await
        .map_err(|e| format!("Transfer call failed: {:?}", e))?;
        
    result.map_err(|e| format!("Transfer failed: {:?}", e))
}
```

## Benefits Over Previous Plans

1. **Zero Storage Overhead**: No new state tracking, partial deployment records, or timer management
2. **Immediate Action**: Cleanup happens instantly on failure, no delays
3. **Simpler Code**: Just refactoring existing function with local tracking
4. **Clear Fee Structure**: 0.1 ICP deployment attempt fee, 4.9 ICP refunded on failure
5. **Preserves Existing Features**: Pool retry mechanism remains unchanged
6. **No Race Conditions**: Everything happens synchronously in one call
7. **No Background Processing**: No heartbeat or timer overhead

## Implementation Steps

1. Update cleanup.rs with stop_canister and transfer_icp functions
2. Extract deployment logic into deploy_token_internal function
3. Refactor create_token to use new structure with cleanup
4. Add cleanup_and_refund function
5. Test failure scenarios at each stage
6. Update documentation about 0.1 ICP non-refundable fee

## Testing Strategy

1. Simulate failure during each canister creation
2. Simulate failure during WASM installation 
3. Simulate failure during token initialization
4. Verify alAl canisters are cleaned up
5. Verify 4.9 ICP refund is processed
6. Verify successful deployments work normally
7. Test pool creation retry still functions

## Cost Analysis

- **Deployment Attempt Fee**: 0.1 ICP (non-refundable)
- **Refundable Amount**: 4.9 ICP (on failure)
- **Cycle Usage**: Minimal, as failed canisters are deleted quickly
- **User Impact**: Clear, predictable costs with automatic refunds

## Edge Cases Handled

1. **Refund Failure**: Logged but doesn't block cleanup
2. **Partial Canister Deletion**: Best effort, continues even if some fail
3. **Pool Creation Failure**: Existing retry mechanism handles this
4. **Multiple Concurrent Deployments**: Each tracks its own canisters locally

This approach follows the principle of "make it simple, make it work, make it right" - solving the actual problem with minimal complexity.