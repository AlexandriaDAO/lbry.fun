# Test Investigation: test_distribution_edge_cases

## Test Status
**FAILING** - Blocked by staking setup issues

## Test Purpose
This test validates that reward distribution works correctly in edge cases:
- 0 stakers (all rewards to protocol)
- 1 staker (gets all staking rewards)
- Many stakers (proportional distribution)
- Stakers joining/leaving mid-distribution

## Failure Analysis

### Root Cause
Cannot set up test scenarios because:
1. Cannot obtain tokens to stake (swap broken)
2. Cannot create multiple stakers
3. Cannot test distribution without stakers

## Edge Cases to Test

### Case 1: Zero Stakers
```rust
// Expected behavior:
// - 1% of pool distributed
// - 49.5% to LBRY buyback
// - 49.5% to liquidity provision
// - 0% to stakers (none exist)
```

### Case 2: Single Staker
```rust
// Expected behavior:
// - 1% of pool distributed
// - 49.5% to single staker
// - 49.5% split between buyback/liquidity
```

### Case 3: Staker Joins Mid-Period
```rust
// Scenario:
// - Hour 0: Alice stakes 1000
// - Hour 0.5: Bob stakes 1000
// - Hour 1: Distribution occurs
// 
// Question: Does Bob get rewards for full hour or half?
// Current implementation: Bob gets full hour (unfair to Alice)
```

### Case 4: Uneven Stakes
```rust
// Scenario:
// - Alice: 1 token (0.0001%)
// - Bob: 999,999 tokens (99.9999%)
// 
// Issue: Alice might get 0 due to rounding
```

## Implementation Issues Found

### Issue 1: Reward Calculation Rounding
```rust
// Current calculation might lose precision
let user_share = (staker.amount * distribution_amount) / total_staked;
// If user_share < 1, rounds to 0
```

### Issue 2: Time-Weighted Rewards Missing
```rust
// Current: All stakers get equal time weight
// Should be: Rewards proportional to time staked
let time_staked = current_time - staker.stake_time;
let time_weight = time_staked / distribution_period;
```

### Issue 3: Gas Optimization
```rust
// Distributing to 10,000 stakers = 10,000 transfers
// Should batch or use claim model instead
```

## Recommended Design Changes

### Fix 1: Time-Weighted Staking
```rust
struct StakeRecord {
    amount: u128,
    start_time: u64,
    // Track "stake-seconds" for fair distribution
    accumulated_stake_time: u128,
}

fn calculate_reward_share(staker: &StakeRecord, period_start: u64, period_end: u64) -> u128 {
    let time_in_period = min(period_end, current_time) - max(period_start, staker.start_time);
    let stake_seconds = staker.amount * time_in_period;
    
    stake_seconds * total_distribution / total_stake_seconds
}
```

### Fix 2: Minimum Reward Threshold
```rust
const MIN_CLAIMABLE_REWARD: u64 = 10_000; // 0.0001 ICP

if calculated_reward < MIN_CLAIMABLE_REWARD {
    // Accumulate for next period instead of losing to rounding
    staker.pending_dust += calculated_reward;
} else {
    staker.claimable_rewards += calculated_reward;
}
```

### Fix 3: Snapshot-Based Distribution
```rust
// Take snapshot at distribution time
struct DistributionSnapshot {
    timestamp: u64,
    total_staked: u128,
    staker_shares: HashMap<Principal, u128>,
    distribution_amount: u64,
}

// Users claim based on snapshots
fn claim_from_snapshots(user: Principal) -> u64 {
    let mut total_rewards = 0;
    for snapshot in unclaimed_snapshots(user) {
        total_rewards += snapshot.calculate_user_share(user);
    }
    total_rewards
}
```

## Test Implementation When Fixed

```rust
#[test]
fn test_distribution_edge_cases() {
    // Setup scenarios
    let scenarios = vec![
        (vec![], "No stakers"),
        (vec![1_000_000], "Single staker"),
        (vec![1, 999_999], "Uneven stakes"),
        (vec![100; 10_000], "Many small stakers"),
    ];
    
    for (stakes, description) in scenarios {
        // Run distribution
        // Verify each staker gets correct amount
        // Verify no tokens lost to rounding
        // Verify total distributed = expected
    }
}
```

## Priority
**MEDIUM** - Important for fairness but not blocking basic functionality

## Security Implications
1. **Rounding attacks**: Attacker stakes minimum amounts to steal rounding errors
2. **Stake timing attacks**: Join right before distribution, leave right after
3. **Sybil attacks**: Create many accounts to game minimum rewards

## Business Impact
- Unfair distribution = user complaints
- Lost rewards to rounding = broken trust
- Complex edge cases = audit findings