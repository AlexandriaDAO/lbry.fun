# Tokenomics Graph Consolidation

## Overview
This document explains the consolidation of tokenomics graph components that was completed on 2025-06-23.

## Problem Statement
We had duplicate code displaying tokenomics graphs in two different places:
1. **Pool Creation**: Used `TokenomicsGraphsBackend` with user-entered values
2. **Swap Tab**: Used `TokenomicsGraphsBackend` but calculated `initialRewardPerBurnUnit` differently

This caused graphs to display different results for the same token, creating confusion.

## Root Causes
1. **Incorrect Calculation**: The swap tab was calculating `initialRewardPerBurnUnit` as a ratio of first mint reward divided by initial burn, which doesn't match what the backend expects
2. **Missing Data**: The tokenomics canister's `Configs` struct doesn't include `initial_reward_per_burn_unit`, so the swap tab tried to derive it
3. **Duplicate Code**: Both views used the same component but passed different values

## Solution Implemented

### 1. Created Unified Component
Created `UnifiedTokenomicsGraphs.tsx` that:
- Accepts the same parameters for both creation and display views
- Handles E8S conversions consistently
- Supports optional `deployedSchedule` parameter for deployed tokens
- Uses the exact same graph rendering logic for both views

### 2. Fixed Data Source
For deployed tokens in the swap tab:
- Retrieve `initial_reward_per_burn_unit` from the first element of `primary_mint_per_threshold` array
- This matches exactly what was used during token creation
- No ratio calculations needed

### 3. Deprecated Old Component
`TokenomicsGraphsBackend.tsx` now re-exports `UnifiedTokenomicsGraphs` for backwards compatibility.

## Code Changes

### UnifiedTokenomicsGraphs Component
```typescript
interface UnifiedTokenomicsGraphsProps {
  primaryMaxSupply: string;           // Natural number
  tgeAllocation: string;              // Natural number
  initialSecondaryBurn: string;       // Natural number
  halvingStep: string;                // Percentage (e.g., "70")
  initialRewardPerBurnUnit: string;   // Natural number
  deployedSchedule?: {                // Optional for deployed tokens
    primary_mint_per_threshold: string[];
    secondary_burn_per_threshold: string[];
  } | null;
}
```

### TokenomicsTab Fix
```typescript
// OLD: Incorrect ratio calculation
const ratio = firstMintNatural / initialBurnNatural;

// NEW: Direct value from schedule
const firstRewardE8s = BigInt(tokenomicsSchedule.primary_mint_per_threshold[0]);
initialRewardPerBurnUnit = (firstRewardE8s / E8S).toString();
```

## Benefits
1. **Consistency**: Both views now show identical graphs for the same token
2. **Maintainability**: Single source of truth for tokenomics graph logic
3. **Correctness**: No more calculation discrepancies
4. **Simplicity**: Cleaner code structure with less duplication

## Migration Guide
If you're using `TokenomicsGraphsBackend` in other parts of the code:
1. Import `UnifiedTokenomicsGraphs` instead
2. Pass the same props - the interface is compatible
3. For deployed tokens, optionally pass `deployedSchedule` prop

## Testing Recommendations
1. Compare graphs between pool creation preview and deployed token view
2. Verify that `initialRewardPerBurnUnit` matches between both views
3. Test with various parameter combinations to ensure consistency
4. Validate against actual minting behavior on-chain

## Related Documentation
- `tokenomics_bug_master_plan.md` - Details about the backend tokenomics bug
- `tokenomics_explained.md` - How tokenomics works in the system
- `CLAUDE.md` - E8S conversion guidelines