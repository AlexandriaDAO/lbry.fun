# Halving Rate Fix

## Problem
The halving step (e.g., 85% retention) is not being correctly applied when generating the rewards array. The issue is in `src/lbry_fun/src/update.rs` where it incorrectly applies halvings to epochs that have no burn data.

## Root Cause
The tokenomics schedule already contains the correct reward rates with halvings properly applied. However, the token creation code:
1. Correctly extracts rates from epochs with burn data
2. **Incorrectly** applies additional halvings to epochs without burn data

This causes the rewards array to have incorrect halving patterns that don't match the configured halving step.

## Code Fix

**File**: `src/lbry_fun/src/update.rs`
**Lines**: 106-125

**Current problematic code**:
```rust
} else {
    // For epochs with no burning data, calculate reward
    if is_first_mining_epoch {
        // First mining epoch - use initial reward rate
        let reward_4decimal = (initial_reward_per_burn_unit * 10_000) / E8S;
        primary_rewards.push((reward_4decimal as u64).max(100));
        is_first_mining_epoch = false;
    } else {
        // Subsequent epochs - apply halving
        let prev_reward = primary_rewards.last().copied().unwrap_or(50_000);
        let new_reward = ((prev_reward * halving_step as u64) / 100).max(100);
        primary_rewards.push(new_reward);
    }
}
```

**Fixed code**:
```rust
} else {
    // For epochs with no burning data, use the same reward as the previous epoch
    // The tokenomics schedule already has halvings applied correctly
    if is_first_mining_epoch {
        // First mining epoch - use initial reward rate
        let reward_4decimal = (initial_reward_per_burn_unit * 10_000) / E8S;
        primary_rewards.push((reward_4decimal as u64).max(100));
        is_first_mining_epoch = false;
    } else {
        // Keep the same reward rate as previous epoch
        // Halvings are already reflected in the epochs that have burn data
        let prev_reward = primary_rewards.last().copied().unwrap_or(100);
        primary_rewards.push(prev_reward);
    }
}
```

## Why This Fix Works

The tokenomics schedule generation already applies halvings at the correct thresholds. For example:
- Epochs 1-2: Same reward rate (e.g., 5 tokens per burn)
- Epoch 3: Halved rate (e.g., 2.5 tokens per burn)
- Epochs 4-5: Same as epoch 3
- Epoch 6: Halved again (e.g., 1.25 tokens per burn)

By keeping the same reward rate for epochs without burn data, we preserve the halving pattern from the original schedule.

## Testing
After this fix:
1. Generate a token with 85% halving step
2. Query the tokenomics canister for threshold details
3. Verify that rewards decrease by exactly 15% at each halving point
4. Run bot tests to confirm the actual rates match the configured halving step