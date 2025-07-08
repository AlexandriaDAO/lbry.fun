# 3X Multiplier Removal Plan

## Executive Summary

The 3x multiplier in the tokenomics calculations is a legacy artifact from older code where minted tokens were distributed to three different destinations. This multiplier creates a circular dependency that prevents the `initialRewardPerBurnUnit` parameter from having any effect on the tokenomics graphs. This document outlines all code changes required to remove this multiplier while maintaining system integrity and minimizing changes to audited canisters.

## Critical Safety Notice

⚠️ **IMPORTANT**: The `tokenomics` and `icp_swap` canisters have been audited. Any changes to these canisters must:
1. Be absolutely minimal
2. Be thoroughly documented in their respective CHANGELOG files
3. Preserve all security guarantees
4. Not introduce new vulnerabilities

## Current Problem

The 3x multiplier creates a circular dependency:
1. Preview calculation multiplies by 3
2. Token creation divides by 3 to extract "base rate"
3. Actual minting multiplies by 3 again

This means regardless of `initialRewardPerBurnUnit` value, the effective rate remains the same.

## Required Code Changes

### 1. Preview Calculation (Non-Audited Code) ✅ Safe to Modify

**File**: `src/lbry_fun/src/tokenomics_simple.rs`
**Line**: 45
**Current Code**:
```rust
fn calculate_primary_minted(secondary_burned_e8s: u128, reward_rate_e8s: u128) -> u128 {
    // Apply tokenomics formula: (rate × amount × 3)
    // The 3x multiplier matches the whitepaper expectations
    // Work in E8S to preserve precision
    secondary_burned_e8s
        .saturating_mul(reward_rate_e8s)
        .saturating_div(E8S)  // Normalize after multiplication
        .saturating_mul(3)    // 3x multiplier
}
```

**Change To**:
```rust
fn calculate_primary_minted(secondary_burned_e8s: u128, reward_rate_e8s: u128) -> u128 {
    // Apply tokenomics formula: (rate × amount)
    // Work in E8S to preserve precision
    secondary_burned_e8s
        .saturating_mul(reward_rate_e8s)
        .saturating_div(E8S)  // Normalize after multiplication
}
```

**Reason**: Remove the artificial 3x multiplier from preview calculations.

### 2. Token Creation Schedule Extraction (Non-Audited Code) ✅ Safe to Modify

**File**: `src/lbry_fun/src/update.rs`
**Lines**: 105-106
**Current Code**:
```rust
let step3 = step2.saturating_div(3);
let reward_4decimal = step3.max(100);  // Minimum 0.01 tokens
```

**Change To**:
```rust
let reward_4decimal = step2.max(100);  // Minimum 0.01 tokens
```

**Reason**: Stop dividing by 3 when extracting reward rates from the tokenomics schedule.

### 3. Tokenomics Canister (⚠️ AUDITED - MINIMAL CHANGE REQUIRED)

**File**: `src/tokenomics/src/update.rs`
**Lines**: 419-432
**Current Code**:
```rust
// SIMPLIFIED DISTRIBUTION: 100% to burner (no NFT splitting)
// Multiply by 3 to maintain original emission schedule (was split 3 ways, now all to burner)
let primary_to_mint = phase_mint_primary
    .checked_mul(3)
    .ok_or_else(|| {
        ExecutionError::new_with_log(
            actual_caller,
            "mint_primary",
            ExecutionError::MultiplicationOverflow {
                operation: "phase_mint_primary * 3".to_string(),
                details: "Overflow during 3x multiplication for emission schedule".to_string(),
            }
        )
    })?
    .min(remaining_primary);
```

**Change To**:
```rust
// Direct emission without legacy multiplier
let primary_to_mint = phase_mint_primary.min(remaining_primary);
```

**Additional Logging Update**:
**Lines**: 435-439
**Current Code**:
```rust
register_info_log(actual_caller, "mint_primary", &format!(
    "mint_primary calculation: phase_mint_primary={}, after 3x={}, remaining_primary={}, final primary_to_mint={}",
    phase_mint_primary,
    phase_mint_primary.saturating_mul(3),
    remaining_primary,
```

**Change To**:
```rust
register_info_log(actual_caller, "mint_primary", &format!(
    "mint_primary calculation: phase_mint_primary={}, remaining_primary={}, final primary_to_mint={}",
    phase_mint_primary,
    remaining_primary,
```

**Changelog Entry for tokenomics/TOKENOMICS_CHANGE_LOG.md**:
```markdown
## [Version X.X.X] - 2025-01-08

### Changed
- Removed legacy 3x multiplier from mint_primary function (line 419)
- The multiplier was a carryover from older code where tokens were distributed to three destinations
- This change aligns the actual minting with the preview calculations
- No security implications as this only affects the emission rate calculation
```

### 4. Test Updates (Non-Audited Code) ✅ Safe to Modify

#### File: `tests/tests/unit/test_tokenomics_simple.rs`

**Line 43**: Change assertion
```rust
// Old: assert_eq!(schedule.epochs[1].primary_minted_this_epoch_e8s, 30 * E8S);
// New:
assert_eq!(schedule.epochs[1].primary_minted_this_epoch_e8s, 10 * E8S);
```

**Lines 45-47**: Update cost calculation
```rust
// Old: let expected_cost = (10.0 * 0.005) / 30.0;
// New:
let expected_cost = (10.0 * 0.005) / 10.0;  // $0.005 per primary token
```

**Line 58**: Update expected calculation
```rust
// Old: let expected = 21_000 * 5 * 3 * E8S; // 315,000 tokens
// New:
let expected = 21_000 * 5 * E8S; // 105,000 tokens
```

**Line 63**: Update assertion message
```rust
// Old: assert_eq!(result, expected, "5 tokens × 21k burns × 3 = 315k tokens");
// New:
assert_eq!(result, expected, "5 tokens × 21k burns = 105k tokens");
```

**Line 68**: Update expected2 calculation
```rust
// Old: let expected2 = 157_500 * E8S; // 21k × 2.5 × 3
// New:
let expected2 = 52_500 * E8S; // 21k × 2.5
```

#### Additional Test Files Requiring Updates:

**File**: `tests/tests/unit/test_simple_fix_verification.rs`
- Update all assertions expecting 3x multiplied values
- Remove comments mentioning "3 tokens" or "3x"

**File**: `tests/tests/unit/test_tokenomics_validation.rs`
- Update expected token minting amounts
- Adjust validation logic for new direct calculation

### 5. Comments and Documentation Updates

**File**: `src/lbry_fun/src/preview_canister.rs`
**Line**: 44
**Current**:
```rust
// The formula includes a 3x multiplier as per tokenomics design
```
**Change To**:
```rust
// Direct calculation without legacy multiplier
```

**File**: `src/tokenomics/src/update.rs`
**Lines**: 403-411 (comments about 3x multiplier)
**Action**: Remove or update comments referencing the 3x multiplier

## Implementation Strategy

Since this project is not yet live, we can make clean changes without backward compatibility concerns:

1. **Deploy Order**:
   - Update all canisters simultaneously
   - No need to maintain compatibility with existing tokens

2. **Testing**:
   - Update all test expectations to match new values
   - Verify graphs properly reflect different initial values
   - Ensure consistent behavior across all components

## Expected Impact

After implementing these changes:

1. **Graph Behavior**:
   - Setting `initialRewardPerBurnUnit` = 1 will show 1 token minted per token burned
   - Setting `initialRewardPerBurnUnit` = 20 will show 20 tokens minted per token burned
   - The graphs will accurately reflect the parameter value

2. **Actual Minting**:
   - Will match the preview graphs exactly
   - Direct 1:1 relationship between parameter and output

3. **System Simplification**:
   - No hidden multipliers or circular logic
   - What you set is what you get

## Debug Logging Updates

**File**: `src/lbry_fun/src/update.rs`
**Line 105**: Remove debug log for step3
```rust
// Remove: ic_cdk::println!("  step3 (step2 / 3) = {:?}", step3);
```

## Verification Checklist

- [ ] Preview graphs change when `initialRewardPerBurnUnit` changes
- [ ] Actual minting matches preview calculations
- [ ] No overflow or underflow errors
- [ ] All tests pass with updated assertions
- [ ] Debug logs updated to reflect removal of step3

## Security Considerations

1. **No New Attack Vectors**: Removing the multiplier simplifies the calculation and reduces potential for manipulation
2. **Predictable Behavior**: Makes the tokenomics more transparent and easier to verify
3. **Audit Trail**: All changes are documented with clear rationale

## Additional Changes Found and Implemented

After the initial plan was created, two additional references to the 3x multiplier were found and fixed:

1. **src/lbry_fun/src/preview_canister.rs (line 85)**: Removed division by 3 in preview calculations
2. **analyze_threshold_pattern.rs (line 32)**: Removed multiplication by 3 in analysis tool

## Summary

This change removes an unnecessary complexity that was preventing proper configuration of tokenomics parameters. By eliminating the 3x multiplier:
1. The `initialRewardPerBurnUnit` parameter will actually affect the tokenomics graphs
2. The system becomes simpler and more predictable
3. There's no change to the fundamental security model

The changes to audited canisters are minimal and well-documented, preserving the security guarantees while fixing the configuration issue.

## Changelog Documentation

All changes have been documented in the appropriate changelog files:
- **src/tokenomics/TOKENOMICS_CHANGE_LOG.md**: Documents TOK-032 and TOK-033 for the audited canister changes
- **src/lbry_fun/LBRY_FUN_CHANGE_LOG.md**: Documents LBRY-001 through LBRY-004 for the main canister changes