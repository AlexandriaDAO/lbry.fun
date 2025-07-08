# LBRY_FUN Canister Change Log

## Overview
This file tracks all changes made to the lbry_fun canister, which is the main canister that spawns and tracks new token launches.

## Risk Levels
- **LOW**: Safe conversions (comments, documentation, analysis tools)
- **MEDIUM**: Bounded changes (calculations, preview functions)
- **HIGH**: Core logic modifications (token creation, reward calculations)

## Change Log

### 3X Multiplier Removal (2025-01-08)

| Change ID | File | Risk | Description | Details | Test Status |
|-----------|------|------|-------------|---------|-------------|
| LBRY-001 | src/tokenomics_simple.rs | HIGH | Removed legacy 3x multiplier from calculate_primary_minted | The 3x multiplier was creating a circular dependency preventing initialRewardPerBurnUnit from having any effect. Changed lines 38-46 to remove .saturating_mul(3) | Completed |
| LBRY-002 | src/update.rs | HIGH | Removed division by 3 in token creation | Removed the division by 3 when extracting reward rates from tokenomics schedule. Changed lines 85-95 to remove step3 calculation | Completed |
| LBRY-003 | src/update.rs | LOW | Updated comments to remove 3x references | Updated comments at lines 78-80 to remove references to "× 3" in the tokenomics formula | Completed |
| LBRY-004 | src/preview_canister.rs | MEDIUM | Removed division by 3 in preview calculations | Removed .and_then(|r| r.checked_div(3)) at line 85 to align preview with actual tokenomics | Completed |

**Justification**: The 3x multiplier created a circular dependency where:
1. Preview calculation multiplied by 3
2. Token creation divided by 3 to extract "base rate"
3. Actual minting multiplied by 3 again

This meant the `initialRewardPerBurnUnit` parameter had no effect on the tokenomics graphs. Removing this multiplier:
- Makes the parameter functional
- Simplifies the system
- Aligns preview calculations with actual minting
- Removes hidden multipliers that confused users

**Security Impact**: These changes only affect emission rate calculations. No security implications as they simplify calculations and reduce potential for manipulation.

**Related Changes**: 
- Tokenomics canister changes documented in src/tokenomics/TOKENOMICS_CHANGE_LOG.md (TOK-032, TOK-033)
- Test assertions updated in tests/tests/unit/test_tokenomics_simple.rs
- Analysis tool updated in analyze_threshold_pattern.rs (line 32)

### Halving Rate Fix (2025-01-08)

| Change ID | File | Risk | Description | Details | Test Status |
|-----------|------|------|-------------|---------|-------------|
| LBRY-005 | src/update.rs | HIGH | Fixed double halving issue in tokenomics schedule processing | Removed the else branch (lines 106-125) that was incorrectly applying additional halving to epochs. All mining epochs have burning data from the schedule generator, so this branch should never execute. Replaced with error handling. | Pending |
| LBRY-006 | src/update.rs | LOW | Removed unused variable | Removed `is_first_mining_epoch` variable (line 69) as it's no longer needed after removing the problematic else branch | Pending |

**Issue**: When configured with 85% halving step, actual execution showed rates like 58% retention instead.

**Root Cause**: The tokenomics schedule generator already applies halving correctly. The removed else branch was applying halving AGAIN to certain epochs, causing double halving (85% × ~68% ≈ 58%).

**Solution**: 
- Removed the else branch that applies halving to epochs without burning data
- Added error handling to catch invalid tokenomics schedules
- All halving is now correctly applied only once in the schedule generation

**Security Impact**: No security implications. This fix ensures the configured halving rate is applied correctly without double application.

**Related Documentation**: 
- Investigation details in TOKENOMICS_DISCREPANCY_INVESTIGATION.md

## Implementation Notes
- All changes must preserve E8S precision handling
- Changes should align with the overall dual token system mechanics
- Test coverage should include edge cases for reward calculations