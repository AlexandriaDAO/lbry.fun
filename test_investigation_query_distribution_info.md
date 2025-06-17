# Test Investigation: test_query_distribution_info

## Test Status
**FAILING** - Distribution interval returns 0 instead of 3600

## Test Purpose
This test validates that users can query accurate information about the distribution system, including percentages, intervals, and pool status.

## Failure Analysis

### Root Cause
The `get_distribution_info` query returns incorrect values:

```rust
// Test expects:
distribution_info.distribution_interval = 3600 (1 hour in seconds)

// Actually returns:
distribution_info.distribution_interval = 0
```

### Investigation Results
Looking at the implementation:

```rust
#[query]
pub fn get_distribution_info() -> DistributionInfo {
    DistributionInfo {
        distribution_interval: DISTRIBUTION_INTERVAL.with(|i| *i.borrow()),
        last_distribution_time: LAST_DISTRIBUTION_TIME.with(|t| *t.borrow()),
        total_staked: STAKING_POOL.with(|p| p.borrow().total_staked),
        staking_reward_percentage: STAKING_REWARD_PERCENTAGE,
        // ...
    }
}
```

The `DISTRIBUTION_INTERVAL` is not being initialized properly.

## Core Issue: Initialization

### Where It Should Be Set
```rust
// In src/icp_swap/src/lifecycle.rs or init
pub fn init(init_data: InitData) {
    // This is missing:
    DISTRIBUTION_INTERVAL.with(|i| *i.borrow_mut() = 3600); // 1 hour
    
    // Start the timer
    start_distribution_timer();
}
```

### Current State
The `DISTRIBUTION_INTERVAL` is declared but never initialized:
```rust
thread_local! {
    static DISTRIBUTION_INTERVAL: RefCell<u64> = RefCell::new(0); // Defaults to 0!
}
```

## Impact Analysis

### User Impact
- **Cannot see distribution schedule** - Users don't know when rewards come
- **Cannot calculate APY** - Missing critical investment information  
- **No transparency** - Black box system reduces trust

### System Impact
- Timer won't start (0 interval)
- No automatic distributions
- Manual distribution only mode

## Additional Query Issues

### Issue 1: Incomplete Information
The query might be missing important fields:
```rust
struct DistributionInfo {
    // Current fields...
    
    // Should also include:
    next_distribution_time: u64,
    pending_distribution_amount: u64,
    total_distributed_lifetime: u64,
    current_pool_balance: u64,
    buyback_address: String,
    liquidity_pool_address: String,
}
```

### Issue 2: Percentage Display
The test also validates percentage calculations:
```rust
// Expecting "0.01%" for LBRY buyback (currently correct)
// But should show "49.5%" for staking rewards
```

## Recommended Fixes

### Fix 1: Initialize Distribution Interval
```rust
// In init function
pub fn init(init_args: InitArgs) {
    // Set distribution interval
    DISTRIBUTION_INTERVAL.with(|i| *i.borrow_mut() = init_args.distribution_interval.unwrap_or(3600));
    
    // Initialize other values
    LAST_DISTRIBUTION_TIME.with(|t| *t.borrow_mut() = ic_cdk::api::time());
    
    // Start timer
    if DISTRIBUTION_INTERVAL.with(|i| *i.borrow()) > 0 {
        start_distribution_timer();
    }
}
```

### Fix 2: Add Configuration Query
```rust
#[query]
pub fn get_configuration() -> SystemConfig {
    SystemConfig {
        distribution_interval: DISTRIBUTION_INTERVAL.with(|i| *i.borrow()),
        staking_percentage: STAKING_REWARD_PERCENTAGE,
        buyback_percentage: LBRY_BUYBACK_PERCENTAGE,
        liquidity_percentage: LIQUIDITY_PERCENTAGE,
        min_stake_amount: MIN_STAKE_AMOUNT,
        min_distribution_amount: MIN_DISTRIBUTION_AMOUNT,
    }
}
```

### Fix 3: Add Runtime Status Query
```rust
#[query]
pub fn get_distribution_status() -> DistributionStatus {
    let now = ic_cdk::api::time();
    let last = LAST_DISTRIBUTION_TIME.with(|t| *t.borrow());
    let interval = DISTRIBUTION_INTERVAL.with(|i| *i.borrow());
    
    DistributionStatus {
        is_active: interval > 0,
        last_distribution: last,
        next_distribution: last + (interval * 1_000_000_000), // Convert to nanos
        time_until_next: (last + interval * 1_000_000_000).saturating_sub(now),
        distributions_completed: TOTAL_DISTRIBUTIONS.with(|d| *d.borrow()),
    }
}
```

## Test Fix Verification
After fixing initialization:
```rust
let info = get_distribution_info();
assert_eq!(info.distribution_interval, 3600);
assert!(info.last_distribution_time > 0);
assert_eq!(info.staking_reward_percentage, 100); // 1%
```

## Priority
**HIGH** - Users need this information to make informed decisions

## Additional Recommendations
1. Add init parameters validation
2. Log all configuration values at startup
3. Add admin function to update interval
4. Consider making interval configurable per token
5. Add events for configuration changes