# ICP Discrepancy Investigation - Quick Start Guide

## The Problem

**Symptom**: +0.14 ICP surplus (actual ledger balance exceeds expected internal accounting balance)
**Pattern**: Accumulates slowly over time during distributions
**Status**: System is functioning correctly, reconciliation flags it when > 0.01 ICP

## Most Likely Cause (Hypothesis #1)

**Integer Division Rounding in distribute_reward()**

Location: `src/icp_swap/src/update.rs`, lines 887-1010

The function distributes 1% of the reward pool every interval:
- `total_distribution = reward_pool / 100` (integer division loses fractional E8S)
- `alex_portion = total_distribution / 100` (more rounding)
- Per-staker distribution involves SCALING_FACTOR divisions (more rounding)
- We track the SUM of actual distributions, not the theoretical amount

**If rounding causes**: `sum(actual_distributions) < theoretical_lp_portion`
**Then**: The untracked difference accumulates in the ledger as surplus

## Quick Diagnostic Commands

```bash
# 1. Check current discrepancy
dfx canister call <icp_swap_canister_id> get_reconciliation_status

# 2. Check distribution count
dfx canister call <icp_swap_canister_id> get_distribution_interval

# 3. Calculate if it's rounding
# If 0.14 ICP = 14,000,000 E8S
# And N distributions have occurred
# Then: 14,000,000 / N = E8S lost per distribution

# Example: If 14,000 distributions have occurred
# 14,000,000 / 14,000 = 1,000 E8S lost per distribution
# This would indicate systematic rounding loss
```

## Investigation Priority Order

1. **Rounding in distribute_reward()** [Start Here]
   - Test: Multiple distributions with various staker counts
   - Check: `lp_portion - total_distributed` per distribution
   - File: `src/icp_swap/src/update.rs` lines 940-966

2. **Transfer Fee Accounting**
   - Test: Verify every `send_icp()` call properly tracks fees
   - Check: Are fees included in internal accounting?
   - Files: All functions calling `send_icp()`

3. **Burn Refund Calculation**
   - Test: Verify 50% ICP refund calculation
   - Check: Lines 262-283 complex division
   - File: `src/icp_swap/src/update.rs`

## Key Files to Examine

1. **`src/icp_swap/src/update.rs`**:
   - Line 887-1010: `distribute_reward()` - Distribution logic
   - Line 121-226: `swap()` - ICP entry
   - Line 229-480: `burn_secondary()` - ICP exit
   - Line 1252-1383: `claim_icp_reward()` - ICP exit

2. **`src/icp_swap/src/queries.rs`**:
   - Line 196-277: `get_reconciliation_status()` - Detection

3. **`src/icp_swap/src/storage.rs`**:
   - State variables and accounting structures

## Quick Test to Run

```bash
# Create a test that simulates many distributions
cd tests
cargo test test_distribution_rounding_accumulation -- --nocapture

# If test doesn't exist, create it using the template in
# ICP_DISCREPANCY_INVESTIGATION_PLAN.md Phase 2.2
```

## Simple Python Simulation

```python
def estimate_rounding_dust(pool_e8s, num_distributions, num_stakers):
    """Estimate E8S lost to rounding over many distributions"""
    dust = 0
    
    for _ in range(num_distributions):
        distribution = pool_e8s // 100  # 1% distribution
        alex = distribution // 100      # 1% of distribution
        lp = distribution - alex        # 99% for stakers
        
        # Simulate per-staker rounding loss
        per_staker = lp // num_stakers
        actual_distributed = per_staker * num_stakers
        
        dust += lp - actual_distributed
        pool_e8s -= distribution
    
    return dust

# Example: Does this explain 0.14 ICP (14,000,000 E8S)?
result = estimate_rounding_dust(
    pool_e8s=500_000_000_000,  # 5000 ICP pool
    num_distributions=1000,     # 1000 distributions
    num_stakers=7               # 7 stakers
)

print(f"Accumulated dust: {result} E8S ({result/100_000_000} ICP)")
# If this ≈ 14,000,000 E8S, we found the cause!
```

## What to Look For

**In Code**:
- Lines with `/ 100` or `/ SCALING_FACTOR` (rounding points)
- Differences between theoretical calculations and actual sums
- `saturating_add`/`saturating_sub` (could hide issues)

**In Logs**:
- Distribution events
- Amounts distributed vs amounts tracked
- Growth pattern of discrepancy over time

## Red Flags

1. If `lp_portion - sum(icp_reward)` > 0 in distribute_reward
2. If transfer fees are NOT included in REWARD_POOL deductions
3. If archived balance doesn't include refund transfer fees
4. If any saturating operations are silently capping values

## Next Steps

1. Run the Python simulation above with actual numbers
2. Add instrumentation to `distribute_reward()` to log dust
3. Create a controlled test with 100+ distributions
4. Compare discrepancy growth rate to rounding prediction

## Full Documentation

See `ICP_DISCREPANCY_INVESTIGATION_PLAN.md` for complete details.

---

**TL;DR**: The 0.14 ICP surplus is most likely from tiny rounding losses (< 100 E8S) per distribution that accumulate over thousands of distributions. This is expected behavior in integer arithmetic but should be documented and potentially tracked explicitly.
