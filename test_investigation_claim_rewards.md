# Test Investigation: test_claim_rewards

## Test Status
**FAILING** - Blocked by inability to stake tokens

## Test Purpose
This test validates that users can successfully claim accumulated staking rewards.

## Failure Analysis

### Dependency Chain
1. Need primary tokens to stake ❌ (blocked by swap issue)
2. Need to stake tokens ❌ (blocked by no tokens)
3. Need time to pass for rewards ❌ (can't reach this step)
4. Need to claim rewards ❌ (can't test)

This test cannot run because it depends on successful staking.

## Claim Rewards Implementation

### Core Function (src/icp_swap/src/update.rs)
```rust
pub async fn claim_rewards() -> Result<u64, String> {
    let caller = ic_cdk::caller();
    
    // Calculate pending rewards
    let pending = calculate_pending_rewards(caller)?;
    
    if pending == 0 {
        return Err("No rewards to claim".to_string());
    }
    
    // Transfer ICP rewards to user
    let transfer_args = TransferArg {
        to: caller.into(),
        amount: Nat::from(pending),
        memo: None,
        fee: None,
        from_subaccount: None,
        created_at_time: None,
    };
    
    icp_ledger_transfer(transfer_args).await?;
    
    // Update last claim time
    STAKERS.with(|stakers| {
        if let Some(staker) = stakers.borrow_mut().get_mut(&caller) {
            staker.last_update_time = ic_cdk::api::time();
        }
    });
    
    Ok(pending)
}
```

### Reward Calculation
```rust
fn calculate_pending_rewards(user: Principal) -> Result<u64, String> {
    STAKERS.with(|stakers| {
        let stakers = stakers.borrow();
        let staker = stakers.get(&user).ok_or("Not staking")?;
        
        let time_elapsed = ic_cdk::api::time() - staker.last_update_time;
        let distributions_missed = time_elapsed / (DISTRIBUTION_INTERVAL * 1_000_000_000);
        
        // Calculate share of each distribution
        let reward_per_distribution = calculate_user_share(staker.amount);
        
        Ok(distributions_missed * reward_per_distribution)
    })
}
```

## Potential Issues When Unblocked

### Issue 1: Reward Calculation Precision
- Integer division might lose precision
- Small stakers might get 0 rewards due to rounding

### Issue 2: Distribution Timing
- Must ensure distributions actually happened
- Pending rewards depend on global distribution events

### Issue 3: ICP Transfer Failures
- Insufficient ICP in reward pool
- Transfer fees not accounted for

## Test Scenario
When working:
```rust
1. User stakes 1000 tokens
2. Wait 2 hours (2 distributions)
3. Pool has 10,000 ICP
4. Each distribution = 100 ICP (1%)
5. User owns 10% of staked tokens
6. User should receive: 2 * 100 * 0.1 = 20 ICP
```

## Recommended Fixes

### Fix 1: Unblock Dependencies
Fix swap mechanism first (see previous investigations)

### Fix 2: Add Isolated Reward Test
```rust
#[test]
fn test_reward_calculation_logic() {
    // Test calculation without actual staking
    // Verify math is correct
    // Test edge cases
}
```

### Fix 3: Mock Time Progression
```rust
// Helper for testing
fn advance_time_and_distribute(hours: u64) {
    for _ in 0..hours {
        pic.advance_time(Duration::from_secs(3600));
        trigger_distribution();
    }
}
```

## Impact When Working
- Users can realize staking gains
- Incentivizes long-term holding
- Creates positive feedback loop

## Priority
**HIGH** - Core feature, but blocked by staking

## Test Verification Checklist
- [ ] Fix token minting/swap
- [ ] Enable staking
- [ ] Verify distribution occurs
- [ ] Test reward accumulation
- [ ] Test successful claims
- [ ] Verify ICP transfers
- [ ] Check state updates