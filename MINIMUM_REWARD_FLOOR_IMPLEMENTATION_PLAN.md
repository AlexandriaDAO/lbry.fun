# Minimum Reward Floor Implementation Plan - 1,000,000 E8S (0.01 tokens)

## Executive Summary

We will implement a minimum reward floor of **1,000,000 E8S (0.01 tokens)** to:
1. Fix the 734x frontend/backend discrepancy
2. Prevent precision loss from integer division
3. Ensure minimum $500K market cap potential for launched tokens
4. Prevent tokenomics breakdown when rewards hit zero

## Why This Can't Be Bypassed

### The Enforcement Mechanism

The tokenomics canister is **immutable after initialization**. Here's the flow:

1. **Token Creation** (`create_token` in update.rs)
   - Generates rewards array with enforced minimums
   - Passes array to tokenomics canister during initialization
   
2. **Tokenomics Initialization** (`init` in tokenomics/lib.rs)
   - Receives and stores the rewards array
   - Array becomes permanent - no update functions exist
   
3. **Minting Operations** (`mint_primary` in tokenomics/update.rs)
   - Uses the stored rewards array
   - Cannot modify rewards, only read them

**Key Point**: Since the tokenomics canister has no functions to update the rewards array after initialization, enforcing the minimum during array generation guarantees it for the token's lifetime.

## Economic Rationale

### The Math at 0.01 Token Floor
- Minimum reward: 0.01 tokens per secondary burned
- Effective cost per secondary: $0.005 (after 50% ICP return)
- Cost to mint 1 primary: 100 × $0.005 = **$0.50**
- With 1M minimum supply: **$500,000 minimum market cap**

### Why Not Lower?
- At 0.0001 (original proposal): Only $5,000 market cap
- At 0.001: Only $50,000 market cap
- At 0.01: Meaningful $500,000 floor for serious projects

## Technical Implementation

### Number Format Conversions
```
1,000,000 E8S = 0.01 tokens = 100 in 4-decimal format
```

### 1. Frontend Preview Update

**File: `src/lbry_fun/src/tokenomics_simple.rs`**
```rust
// Line 65 - Update the minimum
const MIN_REWARD_RATE_E8S: u128 = 1_000_000;  // 0.01 tokens
```

### 2. Token Creation Enforcement

**File: `src/lbry_fun/src/update.rs`**
```rust
// Line 109 - Enforce when calculating from schedule
primary_rewards.push(reward_4decimal.max(100));  // 100 = 0.01 tokens

// Line 126 - Enforce when applying halving
let new_reward = ((prev_reward * halving_step as u64) / 100).max(100);
primary_rewards.push(new_reward);

// After line 140 - Validate no values slipped through
for (i, reward) in primary_rewards.iter().enumerate() {
    if *reward < 100 {
        return Err(format!("Invalid reward at index {}: {} is below minimum of 100 (0.01 tokens)", i, reward));
    }
}
```

**File: `src/lbry_fun/src/preview_canister.rs`**
```rust
// Line 90 - Match the enforcement
primary_rewards.push(reward_4decimal.max(100));

// Line 96 - Match the enforcement
primary_rewards.push(new_reward.max(100));
```

### 3. Clear Error Messages

When parameters would create sub-minimum rewards:
```
"Token creation failed: Your parameters would result in rewards below the 0.01 token minimum. 
Consider using a higher initial reward rate or lower halving percentage."
```

## Precision Benefits

With 100 as minimum (0.01 tokens):
- 100 × 99 / 100 = 99 ✓ (precise)
- 100 × 70 / 100 = 70 ✓ (precise)
- 100 × 50 / 100 = 50 ✓ (precise)

Compare to 1 as minimum (0.0001 tokens):
- 1 × 99 / 100 = 0 ✗ (total loss!)
- 1 × 70 / 100 = 0 ✗ (total loss!)
- 1 × 50 / 100 = 0 ✗ (total loss!)

## Testing Requirements

### Critical Test Cases

1. **Attempt to Create with Low Rewards**
   - Try: initial_rate = 0.001, halving = 50%
   - Expected: Creation fails with clear error
   
2. **Edge Case at Minimum**
   - Try: initial_rate = 0.01, halving = 99%
   - Expected: All rewards stay at 100 (0.01)
   
3. **Normal Parameters**
   - Try: initial_rate = 2000, halving = 70%
   - Expected: Normal progression until hitting floor

4. **Verify Immutability**
   - After token creation, verify no way to modify rewards
   - Check tokenomics canister has no update_rewards function

## Why This Approach is Secure

1. **Single Point of Enforcement**: Only need to enforce during token creation
2. **No Runtime Overhead**: No checks needed during minting
3. **Cannot Be Bypassed**: Tokenomics canister has no backdoors
4. **Fail-Safe**: Validation ensures no zeros slip through

## Implementation Steps

1. Update MIN_REWARD_RATE_E8S to 1_000_000
2. Add .max(100) to all reward calculations
3. Add validation loop to ensure no sub-100 values
4. Test with extreme parameters
5. Verify frontend preview matches actual execution
6. Document in TOKENOMICS_CHANGE_LOG.md

## Summary

By enforcing a 100 (0.01 token) minimum in the rewards array during token creation, we:
- Guarantee it can't be bypassed (tokenomics canister is immutable)
- Ensure precision in calculations
- Create meaningful minimum valuations
- Fix the frontend/backend discrepancy
- Prevent system breakdown from zero rewards

The enforcement happens once at token creation and lasts forever, making it both secure and efficient.