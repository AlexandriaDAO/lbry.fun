# Frontend Preview vs Backend Execution Discrepancy Fix

## Problem Summary

The frontend tokenomics preview graphs show dramatically different costs than actual backend execution when using non-default parameters:

- **99% halving step**: Frontend projects $169B total cost, backend actual $231M (734x discrepancy)
- **50% halving step**: Frontend projects $40K total cost, backend actual $61K (1.5x discrepancy)
- **Default parameters**: Work with perfect precision (need to identify what these are)

The discrepancy increases exponentially with higher halving percentages (closer to 100%).

## Test Data

### Test 1: Extreme Parameters (99% halving)
```javascript
{
  "parameters": {
    "primaryMaxSupply": "100000000000",
    "tgeAllocation": "0",
    "initialSecondaryBurn": "1000000",
    "halvingStep": "99",
    "initialRewardPerBurnUnit": "0.001"
  }
}
```

Frontend projected:
- 27 epochs to reach 100% supply
- Total cost: $169,967,397,031.85
- At 5.5B tokens: ~$10.2M cost (epoch 12)

Bot1 actual results:
- 3 epochs reached
- Only 5.547% of supply minted (5.5B tokens)
- Total cost: $231,111,111
- At 5.5B tokens: $231M cost (epoch 3)

### Test 2: Moderate Parameters (50% halving)
```javascript
{
  "parameters": {
    "primaryMaxSupply": "100000000000",
    "tgeAllocation": "0",
    "initialSecondaryBurn": "1000000",
    "halvingStep": "50",
    "initialRewardPerBurnUnit": "0.001"
  }
}
```

Frontend projected:
- 4 epochs
- Total minted: 7,500 tokens
- Total cost: $40,000

Bot1 actual results:
- 5 epochs
- Total minted: 6,334 tokens (84% of projected)
- Total cost: $61,110 (153% of projected)

## Key Files to Investigate

### Backend (Source of Truth)
1. `/src/lbry_fun/src/tokenomics_simple.rs` - Preview simulation logic
   - `SECONDARY_TOKEN_USD_COST: f64 = 0.005` (effective cost after 50% ICP return)
   - `preview_tokenomics_from_frontend()` function
   - `generate_tokenomics_schedule()` function

2. `/src/tokenomics/src/lib.rs` - Actual tokenomics implementation
   - How epochs are tracked (threshold-based)
   - Actual mint calculations

3. `/src/icp_swap/src/burn.rs` - Burn implementation
   - How burn_secondary works
   - 50% ICP return mechanism

### Frontend (Needs Fixing)
1. `/src/lbry_fun_frontend/src/features/token/thunk/previewTokenomicsSchedule.thunk.ts`
   - Calls backend preview function
   - Handles parameter conversion

2. `/src/lbry_fun_frontend/src/features/token/components/UnifiedTokenomicsGraphsV2.tsx`
   - Displays the preview graphs
   - Processes the tokenomics schedule data

## Investigation Tasks

### 1. Find Default Parameters
- Locate the default parameters that "work with perfect precision"
- Test these parameters with bot1 to confirm they match frontend preview
- Understand what makes these parameters special

### 2. Trace Cost Calculations
- Backend uses `SECONDARY_TOKEN_USD_COST = 0.005` (accounts for 50% ICP return)
- Check if frontend is using $0.01 instead (not accounting for 50% return)
- Verify ICP price assumptions (backend might use $10, frontend might use different)

### 3. Analyze Burn Patterns
- Bot1 was tested with exponentially increasing burns (10x each loop)
- Frontend simulation assumes: same burn for epochs 1-2, then 2x each epoch
- Real users might follow different patterns

## Hypotheses to Test

1. **Cost Basis Mismatch**: Frontend might use $0.01 per secondary token while backend uses $0.005
2. **ICP Price Assumption**: Different ICP price assumptions between frontend and backend
3. **Burn Pattern Assumptions**: Frontend assumes specific burn patterns that don't match reality
4. **Rounding/Precision**: Integer math in backend vs floating point in frontend preview

## Fix Requirements

1. **Frontend must match backend** - Never change backend to match frontend
2. **Default parameters must continue working perfectly**
3. **Solution must work for all parameter combinations**

## Proposed Solution Approach

1. **Phase 1: Diagnosis**
   - Create test harness that runs same parameters through frontend preview and bot1
   - Log all intermediate calculations
   - Identify exact divergence point

2. **Phase 2: Fix Frontend**
   - Update cost calculations to match backend exactly
   - Ensure burn pattern assumptions are realistic
   - Handle precision/rounding the same as backend

3. **Phase 3: Validation**
   - Test with default, moderate, and extreme parameters
   - Ensure frontend preview matches backend execution within 1%
   - Add automated tests to prevent regression

## Success Metrics

- Frontend preview matches backend execution within 1% for all parameters
- Default parameters continue to work with perfect precision
- Clear documentation of the fix and calculation methodology
- Automated tests prevent future divergence