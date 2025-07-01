# Tokenomics Frontend-Backend Alignment Plan

## Overview

This plan addresses the critical mismatch between frontend and backend tokenomics calculations. The goal is to ensure that the frontend preview graphs accurately represent what will happen when tokens are deployed, before making the tokenomics and icp_swap canisters configurable.

## Current State Analysis

### Backend (Tokenomics Canister) - Hardcoded Values

**File: `/src/tokenomics/src/storage.rs`**

```rust
// Lines 16-35: Secondary thresholds in NATURAL UNITS (not E8S)
pub const SECONDARY_THRESHOLDS: [u64; 18] = [
    21_000,         // 21,000 tokens
    42_000,         // 42,000 tokens
    84_000,         // 84,000 tokens
    // ... continues doubling each epoch
];

// Lines 38-58: Primary rewards in 4-DECIMAL FORMAT
pub const PRIMARY_PER_THRESHOLD: [u64; 18] = [
    50_000, // 5.0000 tokens per burn unit
    25_000, // 2.5000 tokens per burn unit
    12_500, // 1.2500 tokens per burn unit
    // ... continues halving
];
```

**File: `/src/tokenomics/src/update.rs`**
```rust
// Line 122: Conversion from 4-decimal to E8S
slot_mint = slot_mint.checked_mul(10000).ok_or_else(|| { ... })?;
```

### Frontend - Current Implementation

**File: `/src/lbry_fun_frontend/src/features/token/components/terminal/TerminalCreateToken.tsx`**

```typescript
// Lines 71-78: Current defaults
const [form, setForm] = useState<TokenFormValues>({
    // ...
    initial_secondary_burn: '21000',  // PROBLEM: This becomes 2,100,000,000,000 E8S!
    initial_reward_per_burn_unit: '5', // This becomes 500,000,000 E8S
    // ...
});
```

**File: `/src/lbry_fun_frontend/src/features/token/components/UnifiedTokenomicsGraphs.tsx`**

```typescript
// Lines 167-172: E8S conversion
const initial_secondary_burn = BigInt(initialSecondaryBurn || '0') * E8S_MULTIPLIER;
const initial_reward_per_burn_unit = BigInt(Math.floor(parseFloat(initialRewardPerBurnUnit || '0') * Number(E8S_MULTIPLIER)));
```

## The Core Problem

The frontend multiplies user input by E8S (100,000,000), but the backend expects:
- Secondary burn thresholds in **natural units**
- Primary rewards in **4-decimal format** (then multiplies by 10,000 internally)

This causes a 100,000,000x discrepancy in secondary burn values!

## Solution Strategy

### Phase 1: Test Current Backend Behavior (Before Making Changes)

1. **Create Test Scenarios**
   - Deploy tokens with specific parameters
   - Document actual minting behavior
   - Compare with frontend preview

2. **Verify Our Fix**
   - Test that our E8S to 4-decimal conversion in `tokenomics_simple.rs` works correctly
   - Ensure preview matches actual deployed behavior

### Phase 2: Align Frontend with Backend Expectations

#### Option A: Change Frontend to Match Backend (Recommended for Testing)

**Changes needed:**

1. **Update Default Values** in `TerminalCreateToken.tsx`:
```typescript
// Change from:
initial_secondary_burn: '21000',

// To:
initial_secondary_burn: '0.00021',  // 21,000 / 100,000,000 = 0.00021
```

2. **Update Validation** to handle decimal values:
```typescript
// In validation logic, ensure decimal values are accepted
const burnValue = parseFloat(form.initial_secondary_burn);
if (isNaN(burnValue) || burnValue <= 0) {
    // Handle error
}
```

3. **Update UI Labels** to clarify units:
```typescript
// Add helper text or tooltips
"Initial Secondary Burn (in tokens, e.g., 0.00021 for 21,000 base units)"
```

#### Option B: Keep Frontend Natural, Add Backend Conversion

**Alternative approach:**

1. **Add conversion in preview** (`lbry_fun/src/tokenomics_simple.rs`):
```rust
// Already implemented in our fix!
let reward_rate_4decimal = reward_rate_e8s / 10_000;
```

2. **Document the conversion** clearly in code comments

### Phase 3: Testing Protocol

1. **Test Case 1: Default Values**
   - Frontend: initial_secondary_burn = 0.00021, reward = 5
   - Expected: First epoch burns 21,000 secondary, mints 105,000 primary
   - Verify: Graph shows correct progression

2. **Test Case 2: Custom Values**
   - Try different combinations
   - Ensure preview matches deployed behavior

3. **Test Case 3: Edge Cases**
   - Very small values
   - Very large values
   - Ensure no overflows or unexpected behavior

### Phase 4: Make Canisters Configurable

Once we verify the calculations are correct:

1. **Update Tokenomics Canister**
   - Replace hardcoded arrays with configurable parameters
   - Maintain backward compatibility

2. **Update ICP Swap Canister**
   - Accept configuration parameters
   - Ensure proper validation

## Implementation Steps

### Step 1: Fix Frontend Defaults (Immediate)

**File: `/src/lbry_fun_frontend/src/features/token/components/terminal/TerminalCreateToken.tsx`**

```typescript
// Line 73: Update default
initial_secondary_burn: '0.00021',  // Represents 21,000 base units
```

### Step 2: Update Validation and Display

**File: `/src/lbry_fun_frontend/src/features/token/components/UnifiedTokenomicsGraphs.tsx`**

```typescript
// Lines 124-130: Update validation to handle new scale
const initialBurn = parseFloat(initialSecondaryBurn);
const actualBurnBaseUnits = initialBurn * E8S;  // Convert to base units for validation
```

### Step 3: Add Documentation

**File: `/src/lbry_fun_frontend/src/features/token/components/TooltipIcon.tsx`**

Add tooltips explaining:
- Secondary burn values are in token units (not base units)
- How the conversion works
- Examples of typical values

### Step 4: Test and Verify

1. Run the frontend with new defaults
2. Check that the preview graph shows:
   - Epoch 1: 21,000 secondary burned, 105,000 primary minted
   - Proper halving progression
   - Correct cost calculations

3. Deploy a test token and verify actual behavior matches preview

## Success Criteria

1. **Preview Accuracy**: Frontend preview graphs match actual deployed token behavior
2. **User Understanding**: Clear documentation and UI labels prevent confusion
3. **Calculation Correctness**: All E8S conversions work properly
4. **Backend Compatibility**: No changes needed to deployed canisters (yet)

## Future Considerations

Once alignment is verified:

1. **Configurable Tokenomics**: Replace hardcoded arrays with init parameters
2. **Migration Path**: Ensure existing tokens continue to work
3. **Enhanced Validation**: Add backend validation for parameter ranges
4. **User Experience**: Consider if users should input natural units or decimals

## Notes on Current Backend Implementation

The backend's use of 4-decimal format is intentional and efficient:
- Stores human-readable values (50_000 = 5.0 tokens)
- Multiplies by 10,000 during calculation for E8S compatibility
- Keeps storage compact

This design should be preserved when making the system configurable.

## Review: Changes Made (2025-06-30)

### Problem Fixed
The tokenomics preview was showing 0 primary tokens minted after TGE because of inconsistent parameter formats.

### Solution Implemented
Established a clear standard: **Frontend always uses whole numbers, backend converts as needed**.

### Specific Changes

1. **Frontend** (`UnifiedTokenomicsGraphs.tsx`):
   - Removed 4-decimal conversion for `initial_reward_per_burn_unit`
   - Keep `initial_secondary_burn` and `initial_reward_per_burn_unit` as natural units
   - Only convert `primary_max_supply` and `tge_allocation` to E8S

2. **Backend** (`tokenomics_simple.rs`):
   - Updated `preview_tokenomics_from_frontend` to convert natural units to E8S
   - `initial_reward_rate_e8s = primary_per_threshold * E8S`
   - `initial_burn_e8s = initial_secondary_burn * E8S`

3. **Documentation**:
   - Updated `CLAUDE.md` with new "Tokenomics Parameter Standards" section
   - Created `TOKENOMICS_PARAMETER_STANDARD.md` for detailed documentation

### Result
With default values, the preview should now correctly show:
- Epoch 1: Burn 21,000 secondary → Mint 105,000 primary
- Proper halving progression through subsequent epochs
- No more "100% minted at TGE" issue