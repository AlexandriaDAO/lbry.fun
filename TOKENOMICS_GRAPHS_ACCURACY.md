# Tokenomics Graphs Accuracy Analysis

## Summary of Issues Found

Conversion Issue (❌ STILL BROKEN)
- **Issue**: Frontend sends `initial_reward_per_burn_unit: '5'` as natural units
- **Current Flow**: Frontend '5' → Backend expects E8S → Interprets as 0.00000005 tokens
- **Should Be**: Frontend '5' → Convert to E8S (500,000,000) → Backend
- **Impact**: This would cause drastically reduced minting if not for other compensating factors

## Current Results Analysis

The latest projection shows:
- Total Primary Minted: 1,633,800 tokens (should be ~1,948,800)
- Total Secondary Burned: 1,376,235,000 tokens (correct)
- Total USD Valuation: $6,881,175 (correct at $0.005/secondary)

### Why Still Not Matching?

Looking at the results, the projection is ~315,000 tokens short of expected. This is suspicious because:
- 315,000 was the original TGE allocation we removed
- The math suggests the initial_reward_per_burn_unit parameter issue is affecting calculations

## Key Learnings

1. **E8S Conversions Are Critical**: The backend expects E8S for token amounts but natural units for some parameters. Mixing these up causes major discrepancies.

2. **Distribution Model Changes**: When changing from multi-party to single-party distribution, the total emission must be preserved by maintaining multipliers.

3. **Effective vs Actual Costs**: For tokenomics projections, use the effective cost ($0.005) not the actual mint cost ($0.01) since users get 50% back.

4. **Parameter Validation**: The frontend and backend must agree on whether parameters are in E8S or natural units.

## Next Steps

1. Fix the `initial_reward_per_burn_unit` conversion in the frontend thunk or backend expectation
2. Verify all 17 thresholds are being used (not just 16)
3. Add comprehensive tests to validate projection accuracy

## References
- Original hardcoded thresholds: src/tokenomics/src/storage.rs lines 16-35
- Original reward rates: src/tokenomics/src/storage.rs lines 38-58
- Frontend form defaults: src/lbry_fun_frontend/.../TerminalCreateToken.tsx line 72
- Backend simulation: src/lbry_fun/src/tokenomics_simple.rs