# Test: Initial Reward Rate Conversion

## Issue
The frontend shows 5.457 tokens per secondary token, but the tokenomics canister was receiving incorrect values in its rewards array.

## Root Cause
The create_token function was trying to reverse-engineer the reward rate from the tokenomics schedule's minted/burned amounts, which introduced precision errors. The correct approach is to directly convert the initial_reward_per_burn_unit parameter.

## Fix
Changed the rewards array generation to:
1. Take the initial_reward_per_burn_unit in E8S format (e.g., 545,700,000 for 5.457 tokens)
2. Convert to 4-decimal format by dividing by 10,000 (result: 54,570)
3. Apply halving logic to generate the full rewards array

## Verification
Given:
- Frontend input: 5.457 tokens per burn unit
- Frontend converts to E8S: 5.457 × 100,000,000 = 545,700,000
- Backend receives: 545,700,000 E8S

Expected conversion:
- 545,700,000 / 10,000 = 54,570 (4-decimal format)
- This represents 5.457 tokens (54,570 / 10,000 = 5.457)

The tokenomics canister will then:
- Multiply reward (54,570) × secondary burned × 10,000 to get E8S
- Example: 54,570 × 1 × 10,000 = 545,700,000 E8S = 5.457 tokens

## Summary
The fix ensures that the initial reward rate is correctly converted from E8S to the 4-decimal format expected by the tokenomics canister, maintaining the exact precision shown in the frontend.