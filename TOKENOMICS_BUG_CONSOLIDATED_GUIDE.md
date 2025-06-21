# Tokenomics Bug - Consolidated Guide for Next Agent

## Current Status: PARTIALLY FIXED BUT NEEDS VERIFICATION

### What We've Done
1. **Identified the root cause**: Parameter scaling mismatch between frontend and backend
2. **Applied a fix**: Modified the reward calculation formula in `simulation.rs`
3. **Created tests**: Built comprehensive tests to validate the fix
4. **Need verification**: Backend has been rebuilt but needs deployment and validation

## The Problem

### Root Cause
The frontend sends all tokenomics parameters in E8S units (multiplied by 100,000,000), but the backend formula was designed for natural units. This caused:

- **18.6 billion tokens** minted in first epoch (instead of 200,000)
- **Only 1 epoch** generated (instead of 3-15+ epochs)
- **Massive overminting** (142-176% of max supply)

### Original Buggy Formula
```rust
// simulation.rs line 181 (BEFORE)
let reward_e8s = primary_per_threshold * in_slot_burn * 10000;
let reward = reward_e8s / E8S;
```

This produced astronomical numbers because:
- `primary_per_threshold` = 200,000,000,000 (2000 * E8S)
- `in_slot_burn` = 100,000,000,000,000 (1M * E8S)
- Result = 200 BILLION tokens in first epoch

## The Fix Applied

### Fixed Formula
```rust
// simulation.rs line 181 (AFTER)
let reward_e8s = (primary_per_threshold * in_slot_burn) / (E8S * 10000);
let reward = reward_e8s;
```

This correctly handles E8S units:
- (E8S * E8S) / (E8S * 10000) = E8S / 10000
- Keeps everything in E8S for proper comparison with `max_primary_supply`

## Expected Results After Fix

### Quick Launch Preset (1M max supply)
```
Epoch    Cumulative Secondary Burned    Cumulative Primary Minted    Primary Minted In Epoch    Supply Minted (%)
TGE      0                             100.0000                     100.0000                   0.01%
Epoch 1  1,000,000                     200,100.0000                 200,000.0000               20.01%
Epoch 2  3,000,000                     480,100.0000                 280,000.0000               48.01%
Epoch 3  7,000,000                     872,100.0000                 392,000.0000               87.21%
Epoch 4  15,000,000                    1,000,000.0000               127,900.0000               100.00%
```
- **4 epochs** (not 1)
- **100% supply utilization** (not 185% overminting)

## Files Modified

### Backend Fix
- `/src/lbry_fun/src/simulation.rs` - Fixed reward calculation formula
- Lines 181-185: Changed reward calculation
- Line 209: Fixed partial burn calculation

### Test Files Created
- `/tests/tests/unit/test_exact_backend_output.rs` - Shows exact table output
- `/tests/tests/unit/test_graph_data_interpretation.rs` - Comprehensive preset validation
- `/tests/tests/unit/test_actual_backend_response.rs` - Mirrors frontend behavior
- Multiple other debug tests to trace the issue

## Next Steps for New Agent

### 1. IMMEDIATE: Deploy and Verify Fix
```bash
# Deploy the fix
candid-extractor target/wasm32-unknown-unknown/release/lbry_fun.wasm > src/lbry_fun/lbry_fun.did
dfx deploy lbry_fun

# Test with frontend "Copy Backend Table Data" button
# Should show 4 epochs for Quick Launch, not 1
```

### 2. Run Validation Tests
```bash
# This test calls the backend exactly like the frontend does
cd tests && cargo test test_all_preset_graphs -- --nocapture

# Expected output:
# Quick Launch: 4 epochs, 100.00% supply  
# Balanced: 8-12 epochs, 100.00% supply
# Extended Distribution: 15+ epochs, 100.00% supply
```

### 3. Create Methodology for Future Testing
The key insight is to **always test what the user actually sees**:

1. **Call the exact backend method** (`preview_tokenomics`) with exact frontend parameters
2. **Format output exactly like frontend table** 
3. **Compare against expected behavior**, not theoretical calculations
4. **Write assertions that match real-world expectations**

### 4. Validation Criteria
- [ ] Quick Launch: 3-7 epochs (currently shows 1)
- [ ] Balanced: 8-12 epochs  
- [ ] Extended Distribution: 15+ epochs
- [ ] All presets: ≤100.5% supply utilization (currently 142-176%)
- [ ] Reasonable token amounts (not billions)

## Key Technical Details

### Parameter Flow
1. **Frontend sends**: `"200000000000"` (2000 * E8S as string)
2. **Backend receives**: `200000000000u128` (in E8S)
3. **Formula calculates**: Treats as E8S, divides appropriately
4. **Comparison**: Against `max_primary_supply` (also in E8S)

### The Critical Fix
The issue wasn't the formula logic, but **unit consistency**. Both `total_minted` and `max_primary_supply` needed to be in the same units (E8S) for the loop condition to work correctly.

## Files to Reference

### Implementation Files
- `src/lbry_fun/src/simulation.rs` - Main fix location
- `src/lbry_fun_frontend/src/features/token/components/TokenomicsGraphsBackend.tsx` - Frontend table logic

### Documentation Files  
- `tokenomics_bug_master_plan.md` - Original investigation
- `tokenomics_fix_summary.md` - Fix details
- `tokenomics_real_issue_analysis.md` - Root cause analysis

### Test Files
- `tests/tests/unit/test_graph_data_interpretation.rs` - **USE THIS** for validation
- `tests/tests/unit/test_exact_backend_output.rs` - Shows raw backend data

## Critical Security Note: Additional Burn Unit Vulnerability

**SEPARATE ISSUE**: A related security vulnerability exists where `initial_secondary_burn = 1` allows the entire 21M token supply to be minted for only $1,050. This is different from the main overminting bug and requires separate fixes in validation logic.

**Location**: `/src/tokenomics/src/script.rs:81-84`  
**Required Fix**: Minimum validation of `initial_secondary_burn >= 1_000_000`

See `tests/prompts/master_test_plan.md` for complete security implementation details.

## Success Definition

The fix is working when:
1. **Frontend "Copy Backend Table Data" shows multiple epochs** (not 1)
2. **No epoch mints billions of tokens** 
3. **Supply utilization ≤ 100%** for all presets
4. **Extended Distribution has 15+ epochs** as advertised

If still showing 1 epoch with billions of tokens, the fix needs refinement.

---

*This guide consolidates all investigation, fix attempts, and testing methodology from the previous conversation. Start here for context, then run the validation tests to confirm the fix works.*