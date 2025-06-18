# Distribution Logic Comparison: Core vs Fork

## The Key Difference

### Core Canister (Working Correctly - 1% distribution)
```rust
// In utils.rs
pub const STAKING_REWARD_PERCENTAGE: u64 = 100; // 1%

// In distribute_reward()
total_icp_allocated = total_icp_allocated * 100 / 10000 = total_icp_allocated * 0.01
```

### Your Fork (Broken - 100% distribution)
```rust
// In utils.rs  
pub const STAKING_REWARD_PERCENTAGE: u64 = 10000; // Says "1%" but actually 100%!

// In distribute_reward()
total_icp_allocated = total_icp_allocated * 10000 / 10000 = total_icp_allocated * 1.0
```

## The Problem

Your fork has `STAKING_REWARD_PERCENTAGE = 10000` with a misleading comment saying it's 1%. But in basis points:
- 100 = 1%
- 10000 = 100%

When the code does:
```rust
total_icp_allocated = total_icp_allocated * STAKING_REWARD_PERCENTAGE / 10000
```

Your version: `total_icp_allocated * 10000 / 10000 = total_icp_allocated` (no change - distributes 100%)
Core version: `total_icp_allocated * 100 / 10000 = total_icp_allocated * 0.01` (distributes 1%)

## Additional Differences

### 1. No Fee Split in Core
The core canister distributes 100% to stakers, while your fork splits:
- 1% to LBRY buyback
- 49.5% to LP Treasury  
- 49.5% to stakers

### 2. Token Names
- Core: ALEX tokens (staking ALEX for ICP rewards)
- Fork: Primary tokens (staking primary for ICP rewards)

### 3. No Secondary Token Burning in Core
Core only has swap (ICP → LBRY) and burn (LBRY → ALEX), not the dual token system.

## The Fix

Change line 12 in `src/icp_swap/src/utils.rs`:
```rust
// From:
pub const STAKING_REWARD_PERCENTAGE: u64 = 10000; // 1% (in basis points, 10000 = 100%)

// To:
pub const STAKING_REWARD_PERCENTAGE: u64 = 100; // 1% (in basis points, 100 = 1%)
```

This will make your fork distribute 1% of the pool per hour, matching the core canister's behavior.