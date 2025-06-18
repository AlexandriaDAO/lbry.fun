# Distribution Logic Analysis & Fix Proposal

## Current Behavior

The current implementation distributes **100% of the available ICP balance** every hour, not 1% as intended.

### Code Flow Analysis

In `src/icp_swap/src/update.rs`, the `distribute_reward` function does:

```rust
// Step 1: Get total available balance
total_icp_available = fetch_canister_icp_balance()

// Step 2: Subtract unclaimed rewards
total_icp_allocated = total_icp_available - unclaimed_icps

// Step 3: Apply STAKING_REWARD_PERCENTAGE (this is a no-op!)
total_icp_allocated = total_icp_allocated * 10000 / 10000  // No change!

// Step 4: Split the allocation
alexandria_fee_share = total_icp_allocated / 100         // 1% of total
lp_treasury_share = total_icp_allocated * 495 / 1000     // 49.5% of total
staker_share = remainder                                  // 49.5% of total
```

### The Problem

1. **STAKING_REWARD_PERCENTAGE is misleading**: Despite being set to 10000 (100% in basis points), it doesn't control what percentage of the pool is distributed. The multiplication and division cancel out.

2. **Wrong calculation order**: The code distributes ALL available ICP, then splits it according to percentages. It should first take 1% of the pool, THEN split that 1%.

3. **Test expectations vs reality**: 
   - Tests expect: 1% of pool distributed per hour
   - Reality: 100% of available balance distributed per hour

## Evidence

From the test output:
- Pool: ~10,000 ICP
- Expected distribution: ~100 ICP (1%)
- Actual distribution: ~1 ICP (0.01%)

But wait - this suggests the opposite problem! Let me reconsider...

Actually, the issue might be that the "available balance" is not the same as the "total pool". The available balance might already be restricted to 1% somehow, or there might be another limitation.

## Revised Analysis

Looking at the failed test output more carefully:
- Pool before: 1,000,000,000,000 e8s (10,000 ICP)
- Pool after: 999,899,990,000 e8s
- Distributed: 100,010,000 e8s (1 ICP)

This is distributing 0.01% of the pool, not 1% or 100%.

### Possible Root Causes

1. **The available balance might be limited elsewhere** - Perhaps `fetch_canister_icp_balance()` returns only a portion of the actual balance?

2. **There's a distribution limit we're not seeing** - Maybe there's a cap on how much can be distributed per interval?

3. **The STAKING_REWARD_PERCENTAGE should actually be 100 (not 10000)** to represent 1% in basis points

## Recommended Fix

### Option 1: Fix STAKING_REWARD_PERCENTAGE (Simple but might break other things)

```rust
pub const STAKING_REWARD_PERCENTAGE: u64 = 100; // 1% in basis points
```

This would make the calculation:
- total_icp_allocated = total_icp_allocated * 100 / 10000 = total_icp_allocated * 0.01

### Option 2: Add explicit distribution percentage (Clearer intent)

```rust
pub const DISTRIBUTION_PERCENTAGE: u64 = 100; // 1% in basis points

// In distribute_reward:
let pool_balance = fetch_canister_icp_balance().await?;
let distribution_amount = pool_balance * DISTRIBUTION_PERCENTAGE / 10000;

// Then split distribution_amount according to the percentages
alexandria_fee_share = distribution_amount / 100;         // 1% of 1%
lp_treasury_share = distribution_amount * 495 / 1000;     // 49.5% of 1%
staker_share = remainder;                                 // 49.5% of 1%
```

### Option 3: Rename and clarify the existing constant

The current STAKING_REWARD_PERCENTAGE might actually be intended to mean "what percentage of the distribution goes to stakers" (49.5%), not "what percentage of the pool to distribute" (1%).

In this case, we need a separate constant for the distribution percentage.

## Questions to Resolve

1. What does `fetch_canister_icp_balance()` actually return? The full balance or a restricted amount?
2. Is there another mechanism limiting the distribution amount?
3. What was the original intent of STAKING_REWARD_PERCENTAGE?
4. Are there other tests that rely on the current behavior?

## Recommendation

Based on the evidence, I believe **Option 2** is the best approach:
1. Add a new `DISTRIBUTION_PERCENTAGE` constant set to 100 (1% in basis points)
2. Calculate 1% of the total pool first
3. Then split that 1% according to the current percentages
4. This makes the intent clear and doesn't break existing logic

The current code appears to be distributing much less than intended (0.01% instead of 1%), which explains why the tests are failing.