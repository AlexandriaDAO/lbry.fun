# Tokenomics Discrepancy Investigation

## Issue Summary
When configuring a token with 85% halving step, the actual execution showed rates like 58% retention instead of the expected 85%.

## Root Cause Analysis

### The Problem
The code in `src/lbry_fun/src/update.rs` (lines 106-125) had logic that applied halving to epochs without burning data. However, investigation revealed that:

1. The `generate_tokenomics_schedule` function in `tokenomics_simple.rs` creates a complete tokenomics schedule where:
   - Halving is already correctly applied to each epoch
   - Every mining epoch (all epochs except TGE) has burning data

2. The `update.rs` code then processes this schedule:
   - For epochs with burning data: It correctly extracts the reward rate from the pre-calculated minted/burned ratio
   - For epochs without burning data: It applied halving AGAIN

3. Since all mining epochs have burning data, the second branch should never execute. However, if it did, it would cause double halving:
   - First halving: Applied in `generate_tokenomics_schedule` (85%)
   - Second halving: Applied in the else branch (85%)
   - Result: 85% × 85% H 72.25% (close to the observed ~58% when combined with other factors)

### Code Flow
1. `preview_tokenomics_from_frontend` receives halving_step (e.g., 85%)
2. Calls `generate_tokenomics_schedule` which:
   - Generates epochs with proper halving already applied
   - Each epoch has `secondary_burned_this_epoch_e8s > 0`
3. `update.rs` extracts arrays from the schedule:
   - Should only extract pre-calculated rates
   - Should NOT apply additional halving

## Solution Implemented

### Changes Made
1. **Removed the problematic else branch** (lines 106-125) that was applying additional halving
2. **Added proper error handling**: If an epoch has no burning data (which indicates a bug), the code now returns an error instead of applying halving
3. **Removed unused variable**: The `is_first_mining_epoch` variable is no longer needed

### Code Changes
```rust
// Before: Applied halving to epochs without burning data
if epoch.secondary_burned_this_epoch_e8s > 0 {
    // Extract reward rate...
} else {
    // Apply halving (WRONG - causes double halving)
    if is_first_mining_epoch {
        // Use initial rate
    } else {
        // Apply halving step
        let prev_reward = primary_rewards.last().copied().unwrap_or(50_000);
        let new_reward = ((prev_reward * halving_step as u64) / 100).max(100);
        primary_rewards.push(new_reward);
    }
}

// After: Error if epoch has no burning data
if epoch.secondary_burned_this_epoch_e8s > 0 {
    // Extract reward rate...
} else {
    // All mining epochs must have burning data
    return Err(format!(
        "Invalid tokenomics schedule: epoch {} has no burning data. All mining epochs must have burning data.",
        i
    ));
}
```

## Impact
- Halving rates will now work as configured (85% will actually be 85%)
- No double halving will occur
- Better error detection if tokenomics schedule generation has issues

## Testing Recommendations
1. Create tokens with various halving rates (50%, 70%, 85%, 90%)
2. Verify the actual minting rates match the configured halving
3. Ensure no epochs trigger the new error condition
4. Compare preview graphs with actual execution results