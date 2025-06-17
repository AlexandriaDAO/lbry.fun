# Test Investigation: test_token_deployment_flow

## Test Status
**FAILING** - Cannot complete token deployment flow

## Test Purpose
This test validates the complete end-to-end token launch process from a user's perspective.

## Failure Analysis

### Root Cause
The test fails because the swap function returns 0 secondary tokens when trying to exchange ICP:

```rust
// Test attempts to swap 100 ICP for secondary tokens
let swap_result = pic.update_call(
    icp_swap_id,
    principal,
    "swap",
    encode_one(SwapParams {
        amount: 100 * 100_000_000,  // 100 ICP in e8s
        min_amount_out: None,
    })
).unwrap();

// Result: 0 secondary tokens returned
```

### Investigation Findings

1. **Tokenomics Schedule**: The schedule is properly initialized with thresholds:
   ```
   thresholds: [0, 2100000000000000, 4200000000000000, ...]
   rates: [21000000000000, 10500000000000, 5250000000000, ...]
   ```

2. **ICP Price Issue**: The swap calculation likely fails because:
   - ICP price might be 0 or not set
   - The XRC canister might not be properly configured
   - Price fetching might be failing silently

3. **Token Initialization**: Both primary and secondary tokens are created, but the swap mechanism doesn't work.

## Core Application Code Analysis

### Location: `src/icp_swap/src/update.rs`
```rust
pub async fn swap(params: SwapParams) -> Result<u128, String> {
    // Gets ICP price from XRC
    let icp_price = match xrc::get_icp_price().await {
        Ok(price) => price,
        Err(e) => return Err(format!("Failed to get ICP price: {}", e)),
    };
    
    // Calculates secondary tokens based on ICP price
    let secondary_amount = (params.amount as u128 * icp_price as u128) / PRICE_PER_MINT;
    
    // If icp_price is 0, secondary_amount will be 0
}
```

## Impact
- **User Experience**: Users cannot create new tokens at all
- **Platform Viability**: The core functionality is completely broken
- **Business Risk**: Platform is unusable for its primary purpose

## Recommended Fixes

### Option 1: Mock XRC for Testing (Immediate Fix)
```rust
// In test setup, configure XRC to return a fixed price
pic.update_call(
    xrc_id,
    Principal::anonymous(),
    "set_test_price",
    encode_one(1000000000u64)  // $10 ICP price
);
```

### Option 2: Fix XRC Integration (Proper Fix)
1. Ensure XRC canister is properly deployed with test data
2. Add error handling for zero prices
3. Add fallback price mechanism for testing

### Option 3: Bypass Price Check in Tests
```rust
// Add test-only method to set fixed conversion rate
#[cfg(test)]
pub fn set_test_conversion_rate(rate: u128) {
    TEST_CONVERSION_RATE.with(|r| *r.borrow_mut() = rate);
}
```

## Test Fix Priority
**CRITICAL** - This blocks all other token-related tests

## Verification Steps
1. Check XRC canister logs for price fetch attempts
2. Verify PRICE_PER_MINT constant is set correctly
3. Test swap function with hardcoded price to isolate issue
4. Add logging to track price calculation flow