# Token Deployment Cleanup Plan V7 - Prevention & Simple Recovery

## Overview

This plan solves the deployment failure problem through three principles:
1. **Prevent failures** through validation and proper resource management
2. **Track locally** with immediate cleanup on failure  
3. **Simple recovery** for rare edge cases

## Solution Architecture

### 1. Pre-flight Validation System

Prevent failures before they happen by validating all prerequisites:

```rust
#[derive(Debug)]
struct ValidationResult {
    user_balance: u64,
    available_cycles: u128,
    kongswap_healthy: bool,
    estimated_cycles_needed: u128,
}

async fn validate_deployment(params: &CreateTokenParams) -> Result<ValidationResult, String> {
    // Validate token parameters
    if params.primary_token_name.is_empty() || params.primary_token_symbol.is_empty() {
        return Err("Token name and symbol are required".to_string());
    }
    
    if params.primary_token_name.len() > 50 || params.primary_token_symbol.len() > 10 {
        return Err("Token name/symbol too long".to_string());
    }
    
    // Check user ICP balance
    let user_balance = get_account_balance(caller()).await
        .map_err(|e| format!("Failed to check balance: {}", e))?;
    
    if user_balance < 500_000_000 {
        return Err(format!("Insufficient ICP balance. Required: 5 ICP, Available: {}", 
            user_balance as f64 / 100_000_000.0));
    }
    
    // Check canister cycles
    let available_cycles = ic_cdk::api::canister_balance128();
    let estimated_cycles = calculate_deployment_cycles();
    
    if available_cycles < estimated_cycles * 2 { // 2x safety margin
        return Err(format!("Insufficient cycles. Required: {}, Available: {}", 
            estimated_cycles * 2, available_cycles));
    }
    
    // Verify KongSwap is operational
    let kongswap_healthy = check_kongswap_health().await
        .unwrap_or(false);
    
    if !kongswap_healthy {
        return Err("KongSwap service is currently unavailable".to_string());
    }
    
    Ok(ValidationResult {
        user_balance,
        available_cycles,
        kongswap_healthy,
        estimated_cycles_needed: estimated_cycles,
    })
}

fn calculate_deployment_cycles() -> u128 {
    const CANISTER_CREATION: u128 = 100_000_000_000; // 0.1T cycles per canister
    const WASM_INSTALLATION: u128 = 200_000_000_000; // 0.2T cycles per install
    const TOKEN_OPERATIONS: u128 = 50_000_000_000;   // 0.05T for transfers
    const SAFETY_BUFFER: u128 = 500_000_000_000;     // 0.5T buffer
    
    let total_canisters = 5;
    let total_wasm_installs = 3;
    
    (CANISTER_CREATION * total_canisters) + 
    (WASM_INSTALLATION * total_wasm_installs) + 
    TOKEN_OPERATIONS + 
    SAFETY_BUFFER
}

async fn check_kongswap_health() -> Result<bool, String> {
    // Simple health check - can we reach KongSwap?
    match ic_cdk::call::<(), (String,)>(
        KONG_SWAP,
        "get_version",
        ()
    ).await {
        Ok((version,)) => {
            ic_cdk::println!("KongSwap version: {}", version);
            Ok(true)
        }
        Err((code, msg)) => {
            ic_cdk::println!("KongSwap health check failed: ({:?}) {}", code, msg);
            Ok(false)
        }
    }
}
```

### 2. Local Deployment Tracking

Track deployment progress locally without complex state machines:

```rust
#[derive(Debug, Clone)]
struct DeploymentContext {
    deployment_id: String,
    created_canisters: Vec<Principal>,
    payment_block: u64,
    start_time: u64,
    caller: Principal,
}

impl DeploymentContext {
    fn new(caller: Principal) -> Self {
        Self {
            deployment_id: format!("{}-{}", caller, ic_cdk::api::time()),
            created_canisters: vec![],
            payment_block: 0,
            start_time: ic_cdk::api::time(),
            caller,
        }
    }
    
    fn add_canister(&mut self, canister_id: Principal) {
        self.created_canisters.push(canister_id);
        // Log for recovery purposes
        ic_cdk::println!("DEPLOYMENT[{}]: Created canister {}", self.deployment_id, canister_id);
    }
}
```

### 3. Main Deployment Function with Immediate Cleanup

```rust
#[update]
async fn create_token(params: CreateTokenParams) -> Result<String, String> {
    let caller = ic_cdk::caller();
    
    // Step 1: Pre-flight validation
    let validation = validate_deployment(&params).await?;
    ic_cdk::println!("Deployment validated. Cycles available: {}", validation.available_cycles);
    
    // Step 2: Initialize deployment context
    let mut ctx = DeploymentContext::new(caller);
    ic_cdk::println!("DEPLOYMENT[{}]: Starting deployment for {}", ctx.deployment_id, caller);
    
    // Step 3: Collect payment
    match deposit_icp_in_canister(500_000_000, None).await {
        Ok(block) => {
            ctx.payment_block = block;
            ic_cdk::println!("DEPLOYMENT[{}]: Payment received at block {}", ctx.deployment_id, block);
        }
        Err(e) => {
            return Err(format!("Payment collection failed: {}", e));
        }
    }
    
    // Step 4: Execute deployment with immediate cleanup on failure
    match execute_deployment(&mut ctx, params).await {
        Ok(token_id) => {
            ic_cdk::println!("DEPLOYMENT[{}]: Success! Token ID: {}", ctx.deployment_id, token_id);
            Ok(format!("Token {} created successfully with pool", token_id))
        }
        Err(e) => {
            ic_cdk::println!("DEPLOYMENT[{}]: Failed with error: {}", ctx.deployment_id, e);
            
            // Immediate cleanup
            let cleanup_result = cleanup_failed_deployment(&ctx).await;
            
            Err(format!(
                "Deployment failed: {}. Cleanup: {}. 4.9 ICP refunded.",
                e, cleanup_result
            ))
        }
    }
}

async fn execute_deployment(
    ctx: &mut DeploymentContext,
    params: CreateTokenParams
) -> Result<u64, String> {
    // Generate tokenomics schedule
    let schedule = preview_tokenomics_from_frontend(
        params.initial_token_supply,
        params.cliff_amount,
        params.cliff_duration,
        params.total_vesting_duration,
        params.unlock_frequency,
        params.tokenomics_tokens,
        params.vesting_schedule,
        params.max_buy_per_address,
        params.halvings,
    );
    
    // Create management canisters
    let swap_id = create_canister_with_cycles(100_000_000_000).await
        .map_err(|e| format!("Failed to create swap canister: {}", e))?;
    ctx.add_canister(swap_id);
    
    let tokenomics_id = create_canister_with_cycles(100_000_000_000).await
        .map_err(|e| format!("Failed to create tokenomics canister: {}", e))?;
    ctx.add_canister(tokenomics_id);
    
    let logs_id = create_canister_with_cycles(100_000_000_000).await
        .map_err(|e| format!("Failed to create logs canister: {}", e))?;
    ctx.add_canister(logs_id);
    
    // Create token canisters
    let primary_token_id = create_icrc1_canister(
        &params.primary_token_name,
        &params.primary_token_symbol,
        params.primary_decimals,
        params.logo.clone(),
    ).await.map_err(|e| format!("Failed to create primary token: {}", e))?;
    ctx.add_canister(get_principal(&primary_token_id));
    
    let secondary_token_id = create_icrc1_canister(
        &params.secondary_token_name,
        &params.secondary_token_symbol,
        params.secondary_decimals,
        params.logo.clone(),
    ).await.map_err(|e| format!("Failed to create secondary token: {}", e))?;
    ctx.add_canister(get_principal(&secondary_token_id));
    
    // Install WASM on management canisters
    install_tokenomics_wasm_on_existing_canister(
        tokenomics_id,
        &schedule,
        params.tokenomics_tokens,
        primary_token_id.clone(),
        swap_id,
        logs_id,
    ).await.map_err(|e| format!("Failed to install tokenomics WASM: {}", e))?;
    
    install_icp_swap_wasm_on_existing_canister(
        swap_id,
        &secondary_token_id,
        params.secondary_token_details.clone(),
        &primary_token_id,
        ic_cdk::id(),
        tokenomics_id,
        logs_id,
    ).await.map_err(|e| format!("Failed to install swap WASM: {}", e))?;
    
    install_logs_wasm_on_existing_canister(
        logs_id,
        &primary_token_id,
        &secondary_token_id,
        swap_id,
        tokenomics_id,
    ).await.map_err(|e| format!("Failed to install logs WASM: {}", e))?;
    
    // Transfer initial liquidity and create pool
    let primary_transfer_block = transfer_initial_primary_liquidity(
        &primary_token_id,
        &nat_to_string(primary_liquidity_e8s_per_halving_schedule(&schedule)),
        &KONG_SWAP.to_string(),
    ).await.map_err(|e| format!("Failed to transfer primary tokens: {}", e))?;
    
    let icp_amount = Nat::from(nat_to_string(icp_e8s_for_liquidity(&schedule)));
    let icp_transfer_block = transfer_icp_for_liquidity_addition(&icp_amount).await
        .map_err(|e| format!("Failed to transfer ICP: {}", e))?;
    
    // Create pool on KongSwap
    let pool_reply = create_pool_on_kong_swap(
        primary_token_id.clone(),
        primary_transfer_block,
        icp_transfer_block,
    ).await.map_err(|e| format!("Failed to create pool: {}", e))?;
    
    // Save token record
    let token_record = TokenRecord {
        id: 0, // Will be set when inserting
        primary_canister_id: primary_token_id.clone(),
        secondary_canister_id: secondary_token_id,
        swap_canister_id: swap_id.to_string(),
        tokenomics_canister_id: tokenomics_id.to_string(),
        logs_canister_id: logs_id.to_string(),
        deployer: ctx.caller.to_string(),
        primary_token_name: params.primary_token_name,
        primary_token_symbol: params.primary_token_symbol,
        primary_decimals: params.primary_decimals,
        secondary_token_name: params.secondary_token_name,
        secondary_token_symbol: params.secondary_token_symbol,
        secondary_decimals: params.secondary_decimals,
        logo: params.logo,
        created_at: ic_cdk::api::time(),
        primary_init_liquidity: nat_to_string(primary_liquidity_e8s_per_halving_schedule(&schedule)),
        icp_init_liquidity: nat_to_string(icp_e8s_for_liquidity(&schedule)),
        total_secondary_sold: Nat::from(0u64),
        pool_id: Some(pool_reply.pool_id),
        pool_created_at: ic_cdk::api::time(),
        pool_creation_failed: false,
    };
    
    let token_id = TOKENS.with(|tokens| {
        let mut tokens = tokens.borrow_mut();
        let id = tokens.len() as u64 + 1;
        let mut record = token_record;
        record.id = id;
        tokens.insert(id, record);
        id
    });
    
    Ok(token_id)
}
```

### 4. Cleanup Function

```rust
async fn cleanup_failed_deployment(ctx: &DeploymentContext) -> String {
    const REFUND_AMOUNT: u64 = 490_000_000; // 4.9 ICP (0.1 ICP deployment fee)
    let mut cleanup_results = vec![];
    
    ic_cdk::println!("DEPLOYMENT[{}]: Starting cleanup of {} canisters", 
        ctx.deployment_id, ctx.created_canisters.len());
    
    // Delete canisters in reverse order (best effort)
    for canister_id in ctx.created_canisters.iter().rev() {
        match stop_and_delete_canister(*canister_id).await {
            Ok(_) => {
                cleanup_results.push(format!("Deleted {}", canister_id));
                ic_cdk::println!("DEPLOYMENT[{}]: Deleted canister {}", ctx.deployment_id, canister_id);
            }
            Err(e) => {
                cleanup_results.push(format!("Failed to delete {}: {}", canister_id, e));
                ic_cdk::println!("DEPLOYMENT[{}]: Failed to delete {}: {}", ctx.deployment_id, canister_id, e);
            }
        }
    }
    
    // Refund user (best effort)
    match transfer_icp_to_account(ctx.caller, REFUND_AMOUNT).await {
        Ok(block) => {
            cleanup_results.push(format!("Refunded 4.9 ICP at block {}", block));
            ic_cdk::println!("DEPLOYMENT[{}]: Refunded {} ICP to {} at block {}", 
                ctx.deployment_id, REFUND_AMOUNT as f64 / 100_000_000.0, ctx.caller, block);
        }
        Err(e) => {
            cleanup_results.push(format!("Refund failed: {}", e));
            ic_cdk::println!("DEPLOYMENT[{}]: REFUND FAILED: {} - User {} should contact support", 
                ctx.deployment_id, e, ctx.caller);
            
            // Store failed refund for manual processing
            FAILED_REFUNDS.with(|refunds| {
                refunds.borrow_mut().insert(ctx.caller, (ctx.payment_block, REFUND_AMOUNT));
            });
        }
    }
    
    cleanup_results.join(", ")
}

async fn stop_and_delete_canister(canister_id: Principal) -> Result<(), String> {
    use ic_cdk::api::management_canister::main::{stop_canister, delete_canister, CanisterIdRecord};
    
    // Stop canister first
    stop_canister(CanisterIdRecord { canister_id })
        .await
        .map_err(|(code, msg)| format!("Stop failed ({}): {}", code as u8, msg))?;
    
    // Then delete
    delete_canister(CanisterIdRecord { canister_id })
        .await
        .map_err(|(code, msg)| format!("Delete failed ({}): {}", code as u8, msg))?;
    
    Ok(())
}

async fn transfer_icp_to_account(to: Principal, amount: u64) -> Result<u64, String> {
    use icrc_ledger_types::icrc1::transfer::{TransferArg, BlockIndex};
    use icrc_ledger_types::icrc1::account::Account;
    
    let args = TransferArg {
        to: Account { owner: to, subaccount: None },
        amount: Nat::from(amount),
        fee: None,
        memo: None,
        from_subaccount: None,
        created_at_time: None,
    };
    
    let (result,): (Result<BlockIndex, _>,) = ic_cdk::call(
        Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap(), // ICP ledger
        "icrc1_transfer",
        (args,)
    ).await.map_err(|e| format!("Transfer call failed: {:?}", e))?;
    
    result.map(|block| block.0.to_u64_digits()[0])
        .map_err(|e| format!("Transfer failed: {:?}", e))
}
```

### 5. Recovery Mechanism for Edge Cases

```rust
thread_local! {
    // Track failed refunds for manual recovery
    static FAILED_REFUNDS: RefCell<HashMap<Principal, (u64, u64)>> = RefCell::new(HashMap::new());
}

#[update]
async fn check_my_deployment(payment_block: u64) -> Result<String, String> {
    let caller = ic_cdk::caller();
    
    // Verify payment
    let payment = verify_payment_block(payment_block, caller).await?;
    
    // Check if already refunded
    if payment.refunded {
        return Ok("This payment has already been refunded".to_string());
    }
    
    // Check if deployment succeeded
    let token_exists = TOKENS.with(|tokens| {
        tokens.borrow().values().any(|t| t.deployer == caller.to_string() && t.created_at > payment.timestamp)
    });
    
    if token_exists {
        return Ok("Deployment succeeded - token was created".to_string());
    }
    
    // Check for failed refund
    let failed_refund = FAILED_REFUNDS.with(|refunds| {
        refunds.borrow().get(&caller).cloned()
    });
    
    if let Some((block, amount)) = failed_refund {
        if block == payment_block {
            // Retry refund
            match transfer_icp_to_account(caller, amount).await {
                Ok(new_block) => {
                    FAILED_REFUNDS.with(|refunds| refunds.borrow_mut().remove(&caller));
                    Ok(format!("Refund processed successfully at block {}", new_block))
                }
                Err(e) => Err(format!("Refund retry failed: {}. Please contact admin.", e))
            }
        } else {
            Ok("Different payment block - please verify correct block number".to_string())
        }
    } else {
        Ok("No failed deployment found for this payment. If you believe this is an error, please contact admin.".to_string())
    }
}

#[query(guard = "is_admin")]
fn get_failed_refunds() -> Vec<(Principal, u64, u64)> {
    FAILED_REFUNDS.with(|refunds| {
        refunds.borrow()
            .iter()
            .map(|(principal, (block, amount))| (*principal, *block, *amount))
            .collect()
    })
}

#[update(guard = "is_admin")]
async fn process_failed_refund(user: Principal) -> Result<String, String> {
    let refund_info = FAILED_REFUNDS.with(|refunds| {
        refunds.borrow().get(&user).cloned()
    }).ok_or("No failed refund found for user")?;
    
    match transfer_icp_to_account(user, refund_info.1).await {
        Ok(block) => {
            FAILED_REFUNDS.with(|refunds| refunds.borrow_mut().remove(&user));
            Ok(format!("Refund processed at block {}", block))
        }
        Err(e) => Err(format!("Refund failed: {}", e))
    }
}
```

### 6. Integration with cleanup.rs

Add these utility functions to `src/cleanup.rs`:

```rust
use ic_cdk::api::management_canister::main::{
    create_canister, install_code, stop_canister, delete_canister,
    CanisterSettings, CanisterIdRecord, InstallCodeArgument, CanisterInstallMode
};

pub async fn create_canister_with_cycles(cycles: u128) -> Result<Principal, String> {
    let settings = CanisterSettings {
        controllers: Some(vec![ic_cdk::id()]),
        compute_allocation: None,
        memory_allocation: None,
        freezing_threshold: None,
    };
    
    let (canister_id,) = create_canister(
        CreateCanisterArgument {
            settings: Some(settings),
        },
        cycles,
    )
    .await
    .map_err(|(code, msg)| format!("Create canister failed ({}): {}", code as u8, msg))?;
    
    Ok(canister_id.canister_id)
}

pub async fn verify_payment_block(block: u64, expected_from: Principal) -> Result<PaymentInfo, String> {
    // Query ICP ledger for block details
    let (block_info,): (GetBlocksResponse,) = ic_cdk::call(
        Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap(),
        "get_blocks",
        (GetBlocksArgs {
            start: block,
            length: 1,
        },)
    ).await.map_err(|e| format!("Failed to query block: {:?}", e))?;
    
    // Verify payment details
    // ... implementation details
    
    Ok(PaymentInfo {
        from: expected_from,
        amount: 500_000_000,
        timestamp: ic_cdk::api::time(),
        refunded: false,
    })
}
```

## Implementation Steps

1. **Add validation module** - Implement `validate_deployment` and helper functions
2. **Update create_token** - Replace existing function with new version including validation
3. **Add cleanup utilities** - Implement `stop_and_delete_canister` and `transfer_icp_to_account`
4. **Add recovery endpoints** - Implement `check_my_deployment` for users
5. **Update cleanup.rs** - Add utility functions for canister management
6. **Add admin tools** - Implement admin query and update functions
7. **Test thoroughly** - Test each failure scenario and recovery path

## Benefits

1. **Simplicity** - No complex state machines or background processes
2. **Reliability** - Pre-flight checks prevent most failures
3. **Transparency** - Clear logging for debugging and recovery
4. **User-friendly** - Immediate feedback and simple recovery options
5. **Maintainable** - Linear flow, easy to understand and modify
6. **Efficient** - Minimal overhead, no persistent state for deployments

## Testing Strategy

1. **Validation tests** - Ensure all validation catches bad inputs
2. **Failure simulation** - Test failures at each deployment stage
3. **Cleanup verification** - Confirm all canisters are deleted
4. **Refund testing** - Verify refunds process correctly
5. **Recovery testing** - Test user recovery endpoints
6. **Load testing** - Ensure system handles concurrent deployments

This plan provides a robust solution that prevents failures where possible and handles them gracefully when they occur, all while maintaining code simplicity and clarity.