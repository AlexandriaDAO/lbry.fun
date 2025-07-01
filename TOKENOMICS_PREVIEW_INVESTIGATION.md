# Tokenomics Preview Investigation - Persistent Display Issue

## Problem Summary
The tokenomics preview graph is displaying incorrect values despite multiple attempts to fix the frontend-backend alignment. The core issue appears to be inconsistent handling of token units between frontend input, backend processing, and display formatting.

## Current Symptoms
With default values (primary_max_supply: 21000000, initial_secondary_burn: 21000, initial_reward_per_burn_unit: 5):

1. **Secondary Burned Values** - Showing E8S format in display:
   - Epoch 1: Shows "2,100,000,000,000" instead of "21,000"
   - This is 100,000,000x too large (E8S multiplier)

2. **Primary Minted Values** - Appear correct:
   - Epoch 1: Shows "105,000" (which is 21,000 × 5, as expected)

3. **Max Supply Hit Too Early**:
   - Reaches 100% minted by Epoch 16 instead of continuing

## What We Want
- Frontend: Users enter whole numbers (1 token = 1 token)
- Display: Show whole numbers (21,000 not 2,100,000,000,000)
- Backend: Handle conversions to match deployed canister expectations

## Key Files to Investigate

### Backend Files
1. `/src/lbry_fun/src/tokenomics_simple.rs`
   - Contains `preview_tokenomics_from_frontend` function
   - Handles conversion from frontend values to backend calculations

2. `/src/lbry_fun/src/simulation_new.rs`
   - Contains `preview_tokenomics` function
   - Converts tokenomics schedule to GraphData format

3. `/src/tokenomics/src/storage.rs`
   - Contains hardcoded SECONDARY_THRESHOLDS and PRIMARY_PER_THRESHOLD
   - Shows expected formats: natural units for secondary, 4-decimal for primary

### Frontend Files
1. `/src/lbry_fun_frontend/src/features/token/components/UnifiedTokenomicsGraphs.tsx`
   - Handles parameter conversion before sending to backend
   - Displays the graph data

2. `/src/lbry_fun_frontend/src/features/token/components/TokenomicsTableFromPreview.tsx`
   - Formats and displays the tokenomics table
   - May need to convert E8S values back to natural for display

## Investigation Steps

1. **Trace the Data Flow**:
   - Check what values the frontend sends to backend
   - Verify what the backend returns
   - See how the display component formats the values

2. **Check Display Formatting**:
   - The secondary burned values might be returned as E8S from backend
   - The display component might not be converting them back to natural units
   - Look for missing `TokenConversionService.e8sToNatural()` calls

3. **Verify Backend Calculations**:
   - Ensure the preview function matches the deployed tokenomics canister logic
   - Check if E8S conversions are happening in the right places

4. **Test Specific Scenarios**:
   - Log values at each step of the pipeline
   - Compare preview output with actual deployed token behavior

## Previous Fix Attempts

1. **Attempt 1**: Changed frontend to send 0.00021 instead of 21000
   - Result: Made the problem worse
   - Reverted

2. **Attempt 2**: Fixed backend conversions in `tokenomics_simple.rs`
   - Added proper E8S conversions for natural unit inputs
   - Secondary burn still showing as E8S in display

## Hypothesis
The backend is correctly calculating values but returning secondary_burned as E8S. The display component needs to convert these E8S values back to natural units for user-friendly display.

## Recommended Approach

1. **Add Logging**:
   ```typescript
   // In UnifiedTokenomicsGraphs.tsx
   console.log('Sending to backend:', {
     initial_secondary_burn,
     initial_reward_per_burn_unit
   });
   
   // After receiving response
   console.log('Received from backend:', graphData);
   ```

2. **Check Display Formatting**:
   - Find where `cumulative_secondary_burned` is displayed
   - Ensure it's converted from E8S to natural units

3. **Verify Consistency**:
   - All display values should use the same unit format
   - If backend returns E8S, convert for display
   - If backend returns natural units, display as-is

## Success Criteria
- Epoch 1 should show: "21,000 secondary burned → 105,000 primary minted"
- Values should be human-readable whole numbers
- Preview should match actual deployed token behavior

## Solution Found (2025-06-30)

### Root Cause
The backend returns `cumulative_supply_data_x` (secondary burned values) in E8S format, but the frontend was not converting them back to natural units for display.

### Fix Applied
In `UnifiedTokenomicsGraphs.tsx`:
1. Line 47: Added E8S conversion for x-axis data: `Number(v) / E8S`
2. Line 343: Added E8S conversion for table data: `Number(...) / E8S`

### Summary
- Backend correctly processes values in E8S internally
- Backend returns secondary burned values as E8S
- Frontend now converts E8S back to natural units for display
- This ensures users see "21,000" instead of "2,100,000,000,000"