# Tokenomics Change Log

## 2025-07-07: Minimum Reward Floor Implementation

### Summary
Implemented a minimum reward floor of **1,000,000 E8S (0.01 tokens)** to address the 734x frontend/backend discrepancy and prevent precision loss from integer division.

### Changes Made

1. **Updated MIN_REWARD_RATE_E8S constant**
   - File: `src/lbry_fun/src/tokenomics_simple.rs`
   - Changed from 10,000 (0.0001 tokens) to 1,000,000 (0.01 tokens)

2. **Enforced minimum in token creation**
   - File: `src/lbry_fun/src/update.rs`
   - Added `.max(100)` to all reward calculations (100 = 0.01 tokens in 4-decimal format)
   - Added validation loop to ensure no values below 100 slip through

3. **Updated preview canister to match**
   - File: `src/lbry_fun/src/preview_canister.rs`
   - Applied same `.max(100)` enforcement to ensure preview matches actual execution

### Benefits

1. **Fixes Frontend/Backend Discrepancy**: No more 734x errors from precision loss
2. **Ensures Minimum Market Cap**: $500,000 minimum valuation for launched tokens
3. **Prevents System Breakdown**: Tokenomics won't fail when rewards hit zero
4. **Better Precision**: With 100 as minimum, halving calculations remain precise

### Security

The enforcement is applied during token creation and cannot be bypassed since the tokenomics canister is immutable after initialization. There are no update functions to modify the rewards array post-deployment.