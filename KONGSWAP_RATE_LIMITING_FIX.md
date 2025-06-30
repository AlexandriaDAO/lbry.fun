# KongSwap Rate Limiting Issue - Root Cause Analysis & Fix

## Summary of Investigation

After extensive debugging, we discovered that KongSwap's rate limiting (ban after 10 consecutive errors) was triggered by **insufficient ICRC2 allowance errors**. The root cause is a **discrepancy between the LP_TREASURY accounting and actual canister ICP balance**.

## The Problem

### Error Pattern
```
allowance = 495,000,000 e8s (4.95 ICP) → growing to → 4,879,881,614 e8s (48.79 ICP)
```

But the actual canister balance was only **0.00176 ICP**.

### Root Cause
1. **LP_TREASURY** (`/src/icp_swap/src/storage.rs:144-146`) is an accounting counter, not a balance tracker
2. During distribution (`distribute_reward()`), 49.5% of available ICP is allocated to LP_TREASURY via `add_to_lp_treasury()`
3. This allocation is just incrementing a number - **no ICP actually moves**
4. When `provide_liquidity_from_treasury()` runs, it calculates based on LP_TREASURY value, not actual balance

### Why Allowances Accumulate
- KongSwap's error shows the **current allowance** when transfer fails
- Each failed attempt leaves the approval in place
- Since `expected_allowance: None` in `icrc2_approve()`, it should replace, not add
- But the growing allowances suggest either cumulative approvals or the canister had much higher balance previously

## Code Flow Analysis

### 1. Distribution Flow (`/src/icp_swap/src/update.rs:1186-1400`)
```rust
distribute_reward() {
    // Gets actual canister balance
    total_icp_available = fetch_canister_icp_balance() // Line 1196
    
    // Calculates distribution (1% of available)
    total_icp_allocated = total_icp_available * 0.01 // Simplified
    
    // Splits allocation
    lp_treasury_share = total_icp_allocated * 0.495
    
    // PROBLEM: Just increments counter, doesn't check if ICP exists
    add_to_lp_treasury(lp_treasury_share) // Line 1370
}
```

### 2. Liquidity Provision Flow (`/src/icp_swap/src/update.rs:1003-1183`)
```rust
provide_liquidity_from_treasury() {
    // PROBLEM: Uses LP_TREASURY counter, not actual balance
    treasury_balance = LP_TREASURY.get() // Line 1004
    
    if treasury_balance < MIN_ICP_FOR_PROVISION_E8S {
        return; // This check passes because LP_TREASURY is high
    }
    
    // Calculates 2% of treasury counter (not actual balance!)
    icp_to_deploy = treasury_balance * 0.02 // Line 1021
    icp_for_buyback = icp_to_deploy / 2 // Line 1072
    
    // Tries to swap with ICP that doesn't exist
    execute_swap_on_dex_no_slippage(...) // Line 1082
}
```

### 3. The Approval Problem (`/src/icp_swap/src/dex_integration.rs:183-187`)
```rust
// Approves based on calculated amount from LP_TREASURY
icrc2_approve(icp_canister_id, kong_principal, pay_amount).await?;
```

## The Fix

### 1. Add Balance Validation (`/src/icp_swap/src/update.rs`)

```rust
async fn provide_liquidity_from_treasury() {
    let treasury_balance = LP_TREASURY.with(|cell| *cell.borrow().get());
    
    if treasury_balance < MIN_ICP_FOR_PROVISION_E8S {
        return;
    }
    
    // NEW: Get actual canister balance
    let actual_balance = match fetch_canister_icp_balance().await {
        Ok(balance) => balance,
        Err(_) => return, // Skip if we can't check balance
    };
    
    // NEW: Use minimum of treasury accounting and actual balance
    let usable_balance = treasury_balance.min(actual_balance);
    
    // NEW: Skip if actual balance is too low
    if usable_balance < MIN_ICP_FOR_PROVISION_E8S {
        ic_cdk::println!("LP Treasury shows {} but actual balance is only {}. Skipping.", 
                         treasury_balance, actual_balance);
        return;
    }
    
    let deploy_percent = 2;
    let icp_to_deploy = (usable_balance * deploy_percent) / 100;
    
    // Continue with corrected amount...
}
```

### 2. Add Reconciliation Function (`/src/icp_swap/src/update.rs`)

```rust
#[update(guard = "not_anon")]
pub async fn reconcile_lp_treasury() -> Result<String, ExecutionError> {
    let caller = ic_cdk::caller();
    
    // Only allow admin/owner to reconcile
    if !is_admin(caller) {
        return Err(ExecutionError::Unauthorized("Only admin can reconcile treasury".to_string()));
    }
    
    let treasury_balance = LP_TREASURY.with(|cell| *cell.borrow().get());
    let actual_balance = fetch_canister_icp_balance().await?;
    
    if treasury_balance > actual_balance {
        // Reset LP_TREASURY to match reality
        LP_TREASURY.with(|cell| {
            cell.borrow_mut().set(actual_balance)
                .map_err(|_| ExecutionError::StateError("Failed to update treasury".to_string()))
        })?;
        
        Ok(format!("Reconciled LP_TREASURY from {} to actual balance {}", 
                   treasury_balance, actual_balance))
    } else {
        Ok(format!("LP_TREASURY ({}) already <= actual balance ({})", 
                   treasury_balance, actual_balance))
    }
}
```

### 3. Add Pre-Swap Validation (`/src/icp_swap/src/dex_integration.rs`)

```rust
pub async fn execute_swap_on_dex_no_slippage(
    pay_symbol: String, 
    pay_amount: Nat, 
    receive_symbol: String
) -> Result<Nat, String> {
    let kong_principal = Principal::from_text(KONG_BACKEND_CANISTER_ID).unwrap();
    let icp_canister_id = get_config().icp_ledger_id;
    
    // NEW: Log the swap attempt
    ic_cdk::println!("Attempting swap: {} {} -> {}", pay_amount, pay_symbol, receive_symbol);
    
    // NEW: Check current allowance before approving
    let current_allowance = match icrc2_allowance(
        icp_canister_id, 
        ic_cdk::api::id(), 
        kong_principal
    ).await {
        Ok(allowance) => allowance.allowance,
        Err(_) => Nat::from(0u64),
    };
    
    if current_allowance > Nat::from(0u64) {
        ic_cdk::println!("WARNING: Existing allowance of {} found", current_allowance);
    }
    
    // Approve with logging
    ic_cdk::println!("Approving {} for KongSwap", pay_amount);
    icrc2_approve(icp_canister_id, kong_principal, pay_amount.clone()).await?;
    
    // Continue with swap...
}
```

### 4. Add Ban Detection (`/src/icp_swap/src/storage.rs`)

```rust
// Add to storage
pub const KONGSWAP_BAN_EXPIRY_MEM_ID: MemoryId = MemoryId::new(17);

pub static KONGSWAP_BAN_EXPIRY: RefCell<StableCell<u64, Memory>> = RefCell::new(
    StableCell::init(MEMORY_MANAGER.with(|m| m.borrow().get(KONGSWAP_BAN_EXPIRY_MEM_ID)), 0).unwrap()
);
```

Then in `dex_integration.rs`:
```rust
// Check if we're banned before attempting swap
let current_time = ic_cdk::api::time();
let ban_expiry = KONGSWAP_BAN_EXPIRY.with(|cell| *cell.borrow().get());

if current_time < ban_expiry {
    let minutes_left = (ban_expiry - current_time) / 60_000_000_000;
    return Err(format!("KongSwap ban active for {} more minutes", minutes_left));
}

// If swap fails with ban error, parse and store expiry
match result {
    Err(e) if e.contains("banned for") => {
        // Parse "banned for X minutes" and set expiry
        if let Some(minutes) = parse_ban_duration(&e) {
            let ban_expiry = current_time + (minutes * 60_000_000_000);
            KONGSWAP_BAN_EXPIRY.with(|cell| {
                let _ = cell.borrow_mut().set(ban_expiry);
            });
        }
        Err(e)
    }
    other => other
}
```

## Implementation Priority

1. **URGENT**: Implement balance validation (Fix #1) - This prevents the errors
2. **HIGH**: Add reconciliation function (Fix #2) - This fixes existing discrepancies  
3. **MEDIUM**: Add pre-swap validation (Fix #3) - This helps debugging
4. **LOW**: Add ban detection (Fix #4) - This improves efficiency

## Testing

1. Deploy with Fix #1 to prevent new errors
2. Run `reconcile_lp_treasury()` to fix existing discrepancy
3. Monitor logs to ensure swaps only attempt with available balance
4. Verify no more "insufficient allowance" errors

## Key Insight

The core issue is that **LP_TREASURY tracks allocated ICP, not available ICP**. When the canister receives ICP from minting/burning, it gets distributed (1% per hour), and 49.5% is allocated to LP_TREASURY. But if stakers claim their rewards or other operations use ICP, the actual balance drops while LP_TREASURY remains high.

This accounting discrepancy caused the system to attempt swaps with ICP it didn't have, leading to repeated failures and eventual bans.