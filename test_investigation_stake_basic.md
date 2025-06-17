# Test Investigation: test_stake_basic

## Test Status
**FAILING** - Cannot mint primary tokens to test staking

## Test Purpose
This test validates the basic staking functionality - users should be able to stake primary tokens and have them tracked correctly.

## Failure Analysis

### Root Cause Chain
1. **Cannot swap ICP for secondary tokens** (swap returns 0)
2. **Cannot burn secondary tokens for primary tokens** (no secondary tokens to burn)
3. **Cannot stake primary tokens** (no primary tokens to stake)

This is a cascade failure starting from the swap mechanism.

### Immediate Failure Point
```rust
// Test attempts to get primary tokens via:
// 1. Swap ICP -> Secondary tokens
let secondary_amount = pic.update_call(
    icp_swap_id,
    user,
    "swap",
    encode_one(SwapParams { amount: 100 * E8S, min_amount_out: None })
)?;
// Returns: 0 (FAILURE POINT)

// 2. Burn Secondary -> Primary tokens  
// Cannot proceed because secondary_amount is 0
```

## Staking Implementation Analysis

### Staking Function (src/icp_swap/src/update.rs)
```rust
pub async fn stake(amount: Nat) -> Result<(), String> {
    let caller = ic_cdk::caller();
    
    // 1. Transfer tokens from user to this canister
    let transfer_result = primary_token_transfer_from(
        caller,
        ic_cdk::id(),
        amount.clone()
    ).await?;
    
    // 2. Update staking records
    STAKING_POOL.with(|pool| {
        let mut pool = pool.borrow_mut();
        pool.total_staked = pool.total_staked.saturating_add(amount_to_u128(&amount)?);
        
        let mut stakers = STAKERS.borrow_mut();
        let staker = stakers.entry(caller).or_default();
        staker.amount = staker.amount.saturating_add(amount_to_u128(&amount)?);
        staker.last_update_time = ic_cdk::api::time();
    });
    
    Ok(())
}
```

The staking implementation looks correct, but it's never reached due to upstream failures.

## Impact Analysis

### User Impact
- **Cannot test core feature** - Staking is fundamental to the platform
- **Blocks all staking tests** - claim_rewards, unstake_with_rewards all fail
- **No confidence in platform** - If basic staking doesn't work, nothing works

### Development Impact
- Cannot validate staking logic
- Cannot test reward distribution to stakers
- Cannot verify unstaking flows
- Blocks 50% of test suite

## Recommended Fixes

### Fix 1: Mock Token Minting for Tests
```rust
// Add test helper to directly mint tokens
#[cfg(test)]
pub async fn mint_test_tokens(user: Principal, amount: u128) -> Result<(), String> {
    // Directly mint primary tokens to user for testing
    primary_token_mint(user, Nat::from(amount)).await
}
```

### Fix 2: Fix Root Cause (Swap Function)
See `test_investigation_token_deployment.md` for swap fix details.

### Fix 3: Add Direct Staking Test
```rust
// Test staking in isolation with pre-minted tokens
#[test]
fn test_stake_with_preminted_tokens() {
    // 1. Mint tokens directly to user
    // 2. Test stake function
    // 3. Verify staking state
}
```

## Workaround for Testing
Until swap is fixed, modify test setup to:
1. Deploy with initial token allocation to test users
2. Or add admin mint function for testing only
3. Or mock the token canister responses

## Test Dependencies
This test blocks:
- `test_claim_rewards`
- `test_unstake_with_rewards`
- `test_distribution_edge_cases`
- Any test requiring staked tokens

## Priority
**HIGH** - Blocks critical functionality testing

## Verification Steps
1. First fix swap mechanism (see token_deployment investigation)
2. Verify tokens can be obtained
3. Test staking with real tokens
4. Verify staking state updates correctly
5. Check event emissions