# Kongswap LP Implementation - Practical Changes

## Task: Change LP provision from 50% every 4 hours to 2% (1%+1%) every hour

### Current Implementation
- `provide_liquidity_from_treasury()` in `update.rs:956`
- Uses 50% of treasury when balance > 1 ICP
- Runs every 4 hours via separate timer
- Has 0.5% slippage protection

### Required Changes

#### 1. Integrate with hourly distribution timer
**File**: `src/icp_swap/src/update.rs`

- [ ] Add to end of `distribute_reward()` function (~line 1100):
```rust
// After existing distribution logic, add:
if LP_TREASURY.with(|cell| *cell.borrow().get()) >= MIN_ICP_FOR_PROVISION_E8S {
    provide_liquidity_from_treasury().await;
}
```

- [ ] Remove the separate 4-hour timer:
  - Delete `schedule_liquidity_provision()` function (lines 1024-1031)
  - Delete `LIQUIDITY_PROVISION_INTERVAL_NS` constant (line 1022)

**File**: `src/icp_swap/src/script.rs`
- [ ] Remove liquidity provision timer from `setup_timers()`:
  - Delete line 184: `ic_cdk_timers::set_timer(std::time::Duration::from_secs(10), schedule_liquidity_provision);`

#### 2. Change from 50% to 2% deployment
**File**: `src/icp_swap/src/update.rs` in `provide_liquidity_from_treasury()`

- [ ] Change deployment percentage (line 965):
```rust
// Old: let deploy_percent = 50;
let deploy_percent = 2; // 1% buyback + 1% LP
```

#### 3. Handle zero liquidity case
**File**: `src/icp_swap/src/update.rs` in `provide_liquidity_from_treasury()`

- [ ] Add zero liquidity check before buyback (insert after line 974):
```rust
// Check if pool has liquidity
let pool_reserves = get_pool_reserves().await; // Need to implement this
if pool_reserves.icp_reserve < 100_000_000 { // Less than 1 ICP
    // Skip buyback, use all 2% to mint and add initial liquidity
    let tokens_to_mint = mint_tokens_with_icp(icp_to_deploy).await?;
    let lp_result = add_liquidity_to_kong(
        primary_token_symbol,
        tokens_to_mint,
        Nat::from(icp_to_deploy),
    ).await?;
    // ... handle result and return
}
```

#### 4. Remove slippage protection for buybacks
**File**: `src/icp_swap/src/dex_integration.rs`

- [ ] Create new function for no-slippage swaps:
```rust
pub async fn execute_swap_on_dex_no_slippage(
    pay_symbol: String, 
    pay_amount: Nat, 
    receive_symbol: String
) -> Result<Nat, String> {
    let kong_principal = Principal::from_text(KONG_BACKEND_CANISTER_ID).unwrap();
    let icp_canister_id = get_config().icp_ledger_id;
    icrc2_approve(icp_canister_id, kong_principal, pay_amount.clone()).await?;

    let swap_args = SwapArgs {
        pay_token: pay_symbol,
        pay_amount: pay_amount.clone(),
        pay_tx_id: None,
        receive_token: receive_symbol,
        receive_amount: None, // No minimum
        receive_address: None,
        max_slippage: Some(100.0), // Accept any price
        referred_by: None,
    };
    
    let result: Result<(SwapReply,), _> = ic_cdk::call(kong_principal, "swap", (swap_args,)).await;
    // ... rest same as original
}
```

- [ ] Update `provide_liquidity_from_treasury()` to use new function:
```rust
// Line 976, change to:
let primary_tokens_bought_nat = execute_swap_on_dex_no_slippage(
    "ICP".to_string(),
    Nat::from(icp_for_buyback),
    primary_token_symbol.clone(),
).await.map_err(|e| ...)?;
```

#### 5. Add helper functions
**File**: `src/icp_swap/src/dex_integration.rs` or new file

- [ ] Add pool query function:
```rust
pub async fn get_pool_reserves() -> Result<PoolReserves, String> {
    // Query kongswap for current pool state
    // Return struct with icp_reserve and token_reserve
}
```

- [ ] Add token minting function (if not exists):
```rust
pub async fn mint_tokens_with_icp(icp_amount: u64) -> Result<Nat, String> {
    // Convert ICP to secondary tokens
    // Burn secondary for primary tokens
    // Return primary token amount
}
```

### Testing Checklist

- [ ] Test with zero liquidity pool
- [ ] Test with existing liquidity pool  
- [ ] Verify 2% calculation is correct
- [ ] Verify hourly execution
- [ ] Check no tokens get stuck
- [ ] Monitor first 24 hours after deployment

### Why These Changes

1. **Hourly instead of 4-hour**: Aligns with existing distribution timer, simpler code
2. **2% instead of 50%**: Prevents massive price impact, gradual liquidity building
3. **No slippage protection**: Small trades will arbitrage back quickly
4. **Zero liquidity handling**: Pools start empty, need bootstrap mechanism

Total lines changed: ~50
New functions: 3
Deleted functions: 1