# Tokenomics Decimal Format Conversion Fix

## Overview

The tokenomics canister uses a 4-decimal format for reward rates by design, while lbry_fun passes values in E8S format. This document describes how to fix lbry_fun's preview calculations to accurately match what the tokenomics canister will produce.

## Understanding the Design

### Tokenomics Canister (Correct Design)
The tokenomics canister stores reward rates with 4 decimal precision:
```rust
// In storage.rs
pub const PRIMARY_PER_THRESHOLD: [u64; 18] = [
    50_000, // 5.0000 tokens per burn unit
    25_000, // 2.5000 tokens per burn unit
    12_500, // 1.2500 tokens per burn unit
    // ...
];
```

During minting, it multiplies by 10,000 to convert to E8S:
```rust
// In update.rs, line 122
slot_mint = slot_mint.checked_mul(10000).ok_or_else(|| { ... })?;
```

This design choice keeps the stored values human-readable while producing E8S results.

### lbry_fun Current Implementation (Needs Fixing)
lbry_fun passes `initial_reward_per_burn_unit` in E8S format (e.g., `500_000_000` for 5 tokens) but the preview calculations don't account for the tokenomics canister's 4-decimal system.

## The Solution: E8S to 4-Decimal Conversion

### Implementation in lbry_fun

Update the `calculate_primary_minted` function in `tokenomics_simple.rs`:

```rust
fn calculate_primary_minted(secondary_burned_e8s: u128, reward_rate_e8s: u128) -> u128 {
    // Convert the E8S reward rate to 4-decimal format
    let reward_rate_4decimal = reward_rate_e8s / 10_000;
    
    // Apply the tokenomics formula: rate × amount × 10,000
    // Note: secondary_burned_e8s needs to be in natural units for this calculation
    let secondary_burned_natural = secondary_burned_e8s / E8S;
    
    reward_rate_4decimal
        .saturating_mul(secondary_burned_natural)
        .saturating_mul(10_000)
}
```

### Why This Works

1. **Input**: `reward_rate_e8s = 500_000_000` (5 tokens in E8S)
2. **Convert**: `reward_rate_4decimal = 500_000_000 / 10_000 = 50_000`
3. **Calculate**: `50_000 × secondary_burned × 10_000`
4. **Result**: Matches exactly what tokenomics canister produces

## Frontend Impact

### No Breaking Changes
- Frontend continues to pass values in E8S format
- Frontend continues to receive values in E8S format
- All conversions happen internally in lbry_fun's preview calculations

### Display Considerations
The frontend should continue using `TokenConversionService` for all display conversions:
```typescript
// User input → Backend (stays the same)
const rewardRateE8s = TokenConversionService.naturalToE8s(userInput);

// Backend → Display (stays the same)
const displayValue = TokenConversionService.e8sToNatural(backendValue);
```

## Testing Strategy

1. Create a test token with `initial_reward_per_burn_unit = 500_000_000` (5 tokens)
2. Preview should show:
   - First epoch: 5 tokens per secondary burned
   - Matches the hardcoded `PRIMARY_PER_THRESHOLD[0] = 50_000`
3. Deploy and verify actual minting matches preview

## Future Considerations

When making tokenomics configurable:

### Option A: Keep 4-Decimal Format
- Tokenomics continues using 4-decimal internally
- lbry_fun continues converting E8S → 4-decimal
- No changes needed to this conversion logic

### Option B: Switch to E8S Throughout
- Update tokenomics to accept E8S directly
- Remove the 10,000 multiplier from tokenomics
- Remove the `/10_000` conversion from lbry_fun
- More consistent but requires careful migration

## Code Changes Required

1. **Update `tokenomics_simple.rs`**: 
   - Modify `calculate_primary_minted` function as shown above
   - Ensure all preview calculations use this function

2. **Update documentation**:
   - Add notes about the 4-decimal conversion to CLAUDE.md
   - Document the conversion in code comments

3. **Add tests**:
   - Test that E8S inputs produce correct 4-decimal calculations
   - Test edge cases (very large/small values)

## Summary

This fix acknowledges and respects the tokenomics canister's design choice to use 4-decimal format internally. By converting E8S to 4-decimal in lbry_fun's preview calculations, we ensure accurate predictions while maintaining a consistent E8S interface for the frontend.