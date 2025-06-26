# Frontend Thunk Consolidation Plan

## Problem Statement
The swap feature currently has **26 individual thunk files** spread across 4 directories. This extreme modularization creates several issues:
- Difficult to find related operations
- Excessive import statements throughout the codebase
- ~600 lines of unnecessary boilerplate (imports/exports)
- Cognitive overhead when working with related operations

## Current Structure (26 files)
```
src/features/swap/thunks/
├── burnSecondary.ts
├── claimReward.ts
├── fetchTransactionHistory.thunk.ts
├── getAllStakesInfo.ts
├── getArchivedBal.ts
├── getAverageApy.ts
├── getCanisterArchivedBal.ts
├── getSecondaryratio.ts
├── getStakedInfo.ts
├── getStakersCount.ts
├── redeemArchivedBalance.ts
├── stakePrimary.ts
├── swapSecondary.ts
├── transferICPFromUserWallet.ts
├── unstake.ts
├── insights/
│   └── getAllLogs.thunk.ts
├── primaryIcrc/
│   ├── getAccountPrimaryBalance.ts
│   ├── getPrimaryFee.ts
│   ├── getPrimaryPrice.ts
│   └── transferPrimary.ts
├── secondaryIcrc/
│   ├── getSecondaryBalance.ts
│   ├── getSecondaryFee.ts
│   └── transferSecondary.ts
└── tokenomics/
    ├── getPrimaryMintRate.ts
    ├── getTokenomicsInfo.ts
    └── getTotalPrimarySupply.ts
```

## Proposed Structure (4 files)
```
src/features/swap/thunks/
├── stakingThunks.ts      // All staking-related operations
├── tradingThunks.ts      // All swap/burn/transfer operations
├── balanceThunks.ts      // All balance and fee queries
└── analyticsThunks.ts    // History, logs, and tokenomics data
```

## Detailed Consolidation Plan

### 1. stakingThunks.ts
Consolidate all staking operations into a single file with named exports:
```typescript
// Combines 7 files into 1
export { stakePrimary } from './stakePrimary';
export { unstake } from './unstake';
export { claimReward } from './claimReward';
export { getStakedInfo } from './getStakedInfo';
export { getAllStakesInfo } from './getAllStakesInfo';
export { getStakersCount } from './getStakersCount';
export { getAverageApy } from './getAverageApy';

// Or better: export as a namespace
export const stakingThunks = {
  stakePrimary,
  unstake,
  claimReward,
  getStakedInfo,
  getAllStakesInfo,
  getStakersCount,
  getAverageApy
};
```

### 2. tradingThunks.ts
Consolidate all trading operations:
```typescript
// Combines 8 files into 1
export const tradingThunks = {
  // Core trading
  swapSecondary,
  burnSecondary,
  
  // Transfers
  transferPrimary,
  transferSecondary,
  transferICPFromUserWallet,
  
  // Ratios and conversions
  getSecondaryRatio
};
```

### 3. balanceThunks.ts
Consolidate all balance queries and redemptions:
```typescript
// Combines 8 files into 1
export const balanceThunks = {
  // Primary token
  getPrimaryBalance: getAccountPrimaryBalance,
  getPrimaryFee,
  getPrimaryPrice,
  
  // Secondary token
  getSecondaryBalance,
  getSecondaryFee,
  
  // Archived balances
  getArchivedBalance: getArchivedBal,
  getCanisterArchivedBalance: getCanisterArchivedBal,
  redeemArchivedBalance
};
```

### 4. analyticsThunks.ts
Consolidate analytics and tokenomics:
```typescript
// Combines 5 files into 1
export const analyticsThunks = {
  // Transaction history
  fetchTransactionHistory,
  
  // Logs and insights
  getAllLogs,
  
  // Tokenomics
  getPrimaryMintRate,
  getTokenomicsInfo,
  getTotalPrimarySupply
};
```

## Implementation Steps

### Step 1: Create New Consolidated Files
1. Create the 4 new thunk files in `/thunks/`
2. Copy the content from individual files into appropriate sections
3. Ensure all imports at the top of each consolidated file
4. Export using the namespace pattern for better organization

### Step 2: Update Import Statements
Search and replace all imports throughout the codebase:

**Before:**
```typescript
import { stakePrimary } from '../thunks/stakePrimary';
import { unstake } from '../thunks/unstake';
import { claimReward } from '../thunks/claimReward';
```

**After:**
```typescript
import { stakingThunks } from '../thunks/stakingThunks';
// Use: stakingThunks.stakePrimary, stakingThunks.unstake, etc.
```

### Step 3: Delete Old Files
Once all imports are updated and tests pass:
1. Delete all 26 individual thunk files
2. Remove empty subdirectories (insights/, primaryIcrc/, secondaryIcrc/, tokenomics/)

### Step 4: Update Redux Slice Imports
Update the slice files to use the new consolidated imports:
- `swapSlice.ts`
- `primarySlice.ts`
- `tokenomicsSlice.ts` (fix typo while here)

## Expected Benefits

### Quantitative Impact
- **File Reduction**: 26 files → 4 files (85% reduction)
- **Line Reduction**: ~1000 lines → ~400 lines (60% reduction)
- **Import Statements**: Reduce by ~80% across consuming files
- **Directory Depth**: Remove 4 subdirectories

### Qualitative Impact
- **Discoverability**: Related operations grouped logically
- **Maintainability**: Single place to add new related thunks
- **Code Navigation**: Find all staking ops in stakingThunks.ts
- **Reduced Cognitive Load**: 4 concepts instead of 26
- **Faster Builds**: Fewer modules to process

## Testing Checklist
- [ ] All thunks still export with same names
- [ ] No circular dependencies introduced
- [ ] All components using thunks still compile
- [ ] Redux DevTools shows correct action names
- [ ] No runtime errors in app functionality
- [ ] Type definitions remain intact

## Notes for Implementation
- This is a pure refactoring - no logic changes
- Use namespace exports for better IntelliSense
- Consider adding JSDoc comments to group related functions
- This can be done incrementally (one consolidated file at a time)
- Run tests after each consolidation step