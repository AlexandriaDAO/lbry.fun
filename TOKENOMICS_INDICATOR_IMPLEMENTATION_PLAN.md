# Tokenomics Graph "We Are Here" Indicator Implementation Plan

## Review (Completed 2025-06-27)

All phases of the implementation have been successfully completed:

1. **Fixed unit conversion issue** - The main bug was that `totalSecondaryBurned` returns raw units (not E8S) from the backend, but we were dividing by E8S. This has been corrected in `UnifiedTokenomicsGraphs.tsx`.

2. **Circulating supply** - Already working correctly with fallback to `totalPrimaryMinted`.

3. **Removed redundant data fetching** - The `TokenomicsTab.tsx` was fetching tokenomics data that was already being fetched in `usePoolInitializer.ts`. This duplicate fetch has been removed.

4. **Cleaned up debug logs** - All console.log statements added during debugging have been removed from:
   - `tokenomicsThunks.ts`
   - `UnifiedTokenomicsGraphs.tsx`

5. **Non-serializable state** - The tokenomics schedule is already properly serialized to strings.

The "we are here" indicators should now display correctly on all four tokenomics graphs with the proper values.

## Overview

This document provides a complete implementation plan for fixing and enhancing the "we are here" indicators on the tokenomics graphs. The main issues identified are:

1. **Incorrect unit conversion**: The backend returns `totalSecondaryBurned` in raw units (not E8S), but we're dividing by E8S
2. **Missing circulating supply indicators**: The cost_to_mint and minting_valuation graphs need circulating supply markers
3. **Inefficient data fetching**: We need to optimize when and how we fetch the current state data

## Current State Analysis

### Debug Log Findings

From the console logs, we discovered:
- `totalBurnedResult: 1000n` - This is 1000 tokens in raw units, NOT 10^8 units
- `totalPrimaryMinted: "500099990000"` - This IS in E8S units (5000.9999 tokens)
- `currentThresholdIndex: 0` - This indicates TGE (Token Generation Event), not epoch 1
- The circulating supply fetch is failing (returns undefined)

### Root Cause

The main issue is inconsistent unit handling between different backend methods:
- `get_total_secondary_burn()` returns raw token units
- `fetch_total_minted_primary()` returns E8S units

## Implementation Plan

### Phase 1: Fix Unit Conversion Issues

**File**: `/src/lbry_fun_frontend/src/features/token/components/UnifiedTokenomicsGraphs.tsx`

1. Update the currentPositions calculation to handle different units correctly:

```typescript
// Around line 190-210
const currentPositions = useMemo(() => {
  if (!currentState) return null;
  
  // IMPORTANT: totalSecondaryBurned is in raw units, NOT E8S
  const totalBurned = Number(currentState.totalSecondaryBurned); // No division by E8S!
  
  // totalPrimaryMinted IS in E8S units
  const totalMinted = Number(currentState.totalPrimaryMinted) / E8S;
  
  const currentEpoch = currentState.currentThresholdIndex;
  
  // Use circulating supply if available, otherwise fall back to total minted
  const circulatingSupply = currentState.circulatingSupply 
    ? Number(currentState.circulatingSupply) / E8S 
    : totalMinted;
  
  return {
    burnedPosition: totalBurned,
    burnedLabel: `▼ ${totalBurned.toLocaleString()} burned`,
    mintedPosition: totalMinted,
    mintedLabel: `▼ ${totalMinted.toLocaleString()} minted`,
    circulatingPosition: circulatingSupply,
    circulatingLabel: `▼ ${circulatingSupply.toLocaleString()} circulating`,
    epochPosition: currentEpoch,
    epochLabel: currentEpoch > 0 ? `▼ Epoch ${currentEpoch}` : '▼ TGE'
  };
}, [currentState]);
```

### Phase 2: Fix Circulating Supply Fetching

**File**: `/src/lbry_fun_frontend/src/features/swap/thunks/tokenomicsThunks.ts`

The circulating supply fetch is failing because we're trying to get the primary token actor. We need to ensure this works properly:

1. Verify the import path is correct
2. Add better error handling
3. Consider if we actually need circulating supply or if total minted is sufficient

For now, using `totalPrimaryMinted` as the circulating supply is acceptable since it represents all minted tokens.

### Phase 3: Optimize Data Fetching

**File**: `/src/lbry_fun_frontend/src/features/swap/components/TokenomicsTab.tsx`

Remove the redundant useEffect that fetches on every render. The data is already being fetched in `usePoolInitializer.ts` when the pool is set:

```typescript
// Remove lines 20-39 (the useEffect that fetches current state)
// The data is already fetched in usePoolInitializer.ts
```

### Phase 4: Clean Up Debug Logs

Remove all debug console.log statements added during troubleshooting from:
- `/src/lbry_fun_frontend/src/features/swap/components/TokenomicsTab.tsx`
- `/src/lbry_fun_frontend/src/features/swap/thunks/tokenomicsThunks.ts`
- `/src/lbry_fun_frontend/src/features/token/components/UnifiedTokenomicsGraphs.tsx`

### Phase 5: Fix Non-Serializable State Warning

**File**: `/src/lbry_fun_frontend/src/features/swap/thunks/tokenomicsThunks.ts`

The `fetchTokenomicsSchedule` thunk needs to properly serialize the BigUint64Array:

```typescript
// Around line 27-30
return {
  primary_mint_per_threshold: schedule.primary_mint_per_threshold.map(val => val.toString()),
  secondary_burn_per_threshold: schedule.secondary_burn_thresholds.map(val => val.toString())
};
```

## Summary of Changes

1. **Fix unit conversion** - Don't divide `totalSecondaryBurned` by E8S as it's already in raw units
2. **Use existing data** - Use `totalPrimaryMinted` as circulating supply instead of making an extra call
3. **Remove redundant fetching** - Data is already fetched in `usePoolInitializer.ts`
4. **Clean up debug logs** - Remove all console.log statements added during debugging
5. **Fix serialization warnings** - Ensure BigUint64Array is converted to strings

## Expected Results

After implementation:
- The first graph will show the correct burned amount (e.g., "▼ 1,000 burned")
- The second graph will show the correct epoch (e.g., "▼ TGE" for index 0)
- The cost_to_mint graph will show circulating supply (e.g., "▼ 5,000 circulating")
- The minting_valuation graph will also show circulating supply
- No more Redux serialization warnings
- No redundant API calls

## Testing

1. Navigate to the tokenomics tab
2. Verify all four graphs show the green "we are here" indicators
3. Verify the values match the actual blockchain state
4. Check console for any remaining errors or warnings
5. Verify no duplicate API calls are made

## Notes

- The backend inconsistency (raw units vs E8S) should ideally be fixed at the backend level for consistency
- Consider adding unit tests to verify the conversion logic
- Document the unit expectations for each backend method in the codebase