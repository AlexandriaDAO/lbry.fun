# Frontend Field Upgrade Plan

## Overview
The frontend is using outdated fields (`pool_created_at`, `pool_creation_failed`) that no longer exist in the backend. The backend has been upgraded and now provides a simpler `status` field and we're already calculating `isLive` from it. This presents an opportunity for major code simplification.

## Current Issues

### 1. Non-existent Fields Being Used
- **`pool_created_at`** - Used in 4 places:
  - `src/lbry_fun_frontend/src/features/token/thunk/getLiveTokens.thunk.ts:37`
  - `src/lbry_fun_frontend/src/features/token/thunk/getUpcommingTokens.thunk.ts:38`
  - `src/lbry_fun_frontend/src/features/swap/hooks/useAccessState.ts:25`
  - `src/lbry_fun_frontend/src/features/swap/hooks/useAccessState.ts:49`

- **`pool_creation_failed`** - Used in 3 places:
  - `src/lbry_fun_frontend/src/features/token/thunk/getLiveTokens.thunk.ts:38`
  - `src/lbry_fun_frontend/src/features/token/thunk/getUpcommingTokens.thunk.ts:39`
  - `src/lbry_fun_frontend/src/features/swap/hooks/useAccessState.ts:31`

### 2. Redundant Status Calculation
- `useAccessState` hook manually recalculates token status
- `calculateTokenStatus` and `parseTokenTimings` utilities are unnecessary
- Should simply use the `isLive` field already provided

### 3. Inconsistent Approaches
- **Correctly using `isLive`**:
  - `src/lbry_fun_frontend/src/features/swap/components/ConsolidatedTerminal.tsx:133`
  - `src/lbry_fun_frontend/src/features/token/components/terminal/TerminalPoolCard.tsx:187-188`
- **Incorrectly recalculating status**:
  - `src/lbry_fun_frontend/src/features/swap/hooks/useAccessState.ts`
  - Components using `useAccessState` for access control

## Implementation Plan

### Phase 1: Update Type Definitions

1. **Update TokenRecordStringified type** 
   - **File**: `src/lbry_fun_frontend/src/features/token/thunk/getTokenPools.thunk.ts:82-106`
   - Remove references to `pool_created_at` and `pool_creation_failed`
   - Ensure `status` and `isLive` fields are properly typed
   - Add any missing fields from the actual backend TokenRecord

2. **Remove outdated field references**
   - **File**: `src/lbry_fun_frontend/src/features/token/thunk/getLiveTokens.thunk.ts`
     - Line 37: Remove `pool_created_at: record.pool_created_at.toString(),`
     - Line 38: Remove `pool_creation_failed: record.pool_creation_failed,`
   - **File**: `src/lbry_fun_frontend/src/features/token/thunk/getUpcommingTokens.thunk.ts`
     - Line 38: Remove `pool_created_at: record.pool_created_at.toString(),`
     - Line 39: Remove `pool_creation_failed: record.pool_creation_failed,`

### Phase 2: Simplify Access Control

3. **Refactor useAccessState hook**
   - **File**: `src/lbry_fun_frontend/src/features/swap/hooks/useAccessState.ts`
   - **Current problematic code** (lines 14-36):
     ```typescript
     // Remove this entire calculation
     const isTokenLive = useMemo(() => {
       // Uses non-existent pool_created_at field
     }, [swap.activeSwapPool]);
     ```
   - **Replace with**:
     ```typescript
     const isTokenLive = swap.activeSwapPool?.[1]?.isLive || false;
     ```
   - Remove imports: `calculateTokenStatus`, `calculateCountdown`, `parseTokenTimings`
   - Simplify countdown logic if still needed using `launched_at` and `launch_delay_seconds`

4. **Update or remove tokenStatus utilities**
   - **File**: `src/lbry_fun_frontend/src/utils/tokenStatus.ts`
   - **Options**:
     - Delete entire file if countdown not needed
     - Or keep only `formatCountdown` function (lines 66-79)
   - **Remove functions**:
     - `calculateTokenStatus` (lines 17-34) - uses non-existent `poolCreatedAt`
     - `parseTokenTimings` (lines 88-102) - parses non-existent fields
     - `calculateCountdown` (lines 43-59) - if not needed

### Phase 3: Clean Up Dependencies

5. **Update all imports**
   - **Files to update**:
     - `src/lbry_fun_frontend/src/features/swap/hooks/useAccessState.ts`
       - Remove: `import { calculateTokenStatus, calculateCountdown, parseTokenTimings } from '@/utils/tokenStatus';`
   - Any other files importing removed utilities

6. **Verify all access control**
   - **Components using `useAccessState` (4 total)**:
     - `src/lbry_fun_frontend/src/features/swap/components/SwapContent.tsx:35`
     - `src/lbry_fun_frontend/src/features/swap/components/BurnContent.tsx:34`
     - `src/lbry_fun_frontend/src/features/swap/components/StakeContent.tsx:31`
     - `src/lbry_fun_frontend/src/features/swap/components/SwapPageWrapper.tsx:10`
   - **Other components to verify**:
     - `src/lbry_fun_frontend/src/features/swap/components/terminals/TradingTerminal.tsx`
     - `src/lbry_fun_frontend/src/features/swap/components/AccessGuard.tsx` (has duplicate `formatCountdown` function)

### Phase 4: Consolidation Opportunities

7. **Standardize status display**
   - All components should use `isLive` consistently
   - Create a single source of truth for token status
   - **Update these components to use `isLive` directly**:
     - Any component currently using `useAccessState` for status determination

8. **Simplify data flow**
   - Remove redundant calculations
   - Rely on backend-provided status information
   - **Consider creating a simple utility** if needed:
     ```typescript
     // If we need to keep some status utilities
     export const getTokenStatus = (token: TokenRecordStringified) => ({
       isLive: token.isLive,
       statusText: token.isLive ? 'Live' : 'Pending',
       // Add other derived values if needed
     });
     ```

## Benefits of This Upgrade

1. **Code Simplification**
   - Remove ~100+ lines of unnecessary calculation logic
   - Eliminate complex status determination code

2. **Better Performance**
   - No redundant calculations on every render
   - Direct field access instead of complex computations

3. **Improved Reliability**
   - Single source of truth (backend status)
   - No risk of frontend/backend status mismatch

4. **Easier Maintenance**
   - Less code to maintain
   - Clearer data flow

## Testing Checklist

- [ ] Trading terminal shows correct status for live tokens
- [ ] Trading terminal shows "awaiting_launch" only for pending tokens
- [ ] Countdown timer works correctly (if still needed)
- [ ] All token lists (live, upcoming) display correct status
- [ ] No console errors about missing fields
- [ ] Access control properly gates features based on token status

## Additional Notes on Code Duplication

- **AccessGuard** has its own `formatCountdown` function (lines 48-50) that duplicates the one in `tokenStatus.ts`
- Consider consolidating countdown formatting into a single utility if countdown functionality is kept

## Estimated Impact

- **Lines of code removed**: ~150-200
- **Files simplified**: 6-8
- **Complexity reduction**: Significant
- **Risk**: Low (mostly removing code, not adding)

## Verification Summary

We've confirmed all instances by:
1. Searching for all references to `pool_created_at` and `pool_creation_failed` (7 total occurrences)
2. Finding all components using `useAccessState` (4 components)
3. Checking all imports of `tokenStatus` utilities (only 1 import)
4. Verifying no other manual status calculations exist
5. Confirming the type definition doesn't include the outdated fields

## Next Steps

1. Review this plan and get approval
2. Create a working branch
3. Implement changes in phases
4. Test thoroughly
5. Deploy to test environment
6. Merge to main

## Notes

- The backend provides `status` as a variant type and we're already correctly deriving `isLive` from it
- Some components (ConsolidatedTerminal) are already doing this correctly
- This is primarily a cleanup/simplification task, not adding new functionality

## Backend TokenRecord Structure (for reference)

From `src/declarations/lbry_fun/lbry_fun.did.js`, the actual TokenRecord has these fields:
```javascript
const TokenRecord = IDL.Record({
  'id': IDL.Nat64,
  'status': TokenStatus,
  'secondary_token_symbol': IDL.Text,
  'secondary_token_id': IDL.Principal,
  'primary_token_name': IDL.Text,
  'tokenomics_canister_id': IDL.Principal,
  'secondary_token_name': IDL.Text,
  'primary_token_symbol': IDL.Text,
  'launch_delay_seconds': IDL.Nat64,
  'launched_at': IDL.Nat64,
  'icp_swap_canister_id': IDL.Principal,
  'halving_step': IDL.Nat64,
  'primary_token_max_supply': IDL.Nat64,
  'initial_reward_per_burn_unit': IDL.Nat64,
  'initial_primary_mint': IDL.Nat64,
  'threshold_multiplier': IDL.Float64,
  'primary_token_id': IDL.Principal,
  'caller': IDL.Principal,
  'distribution_interval_seconds': IDL.Nat64,
  'created_time': IDL.Nat64,
  'initial_secondary_burn': IDL.Nat64,
  'logs_canister_id': IDL.Principal,
});
```

Note: No `pool_created_at` or `pool_creation_failed` fields exist!

## Implementation Review

### Changes Made

1. **Phase 1: Fixed Field Usage**
   - Removed references to non-existent `pool_created_at` and `pool_creation_failed` fields
   - Added missing fields `threshold_multiplier` and `distribution_interval_seconds` to token mappings
   - Fixed typo: `get_upcomming()` → `get_upcoming()`
   - Build successfully compiles without type errors

2. **Phase 2: Simplified Access Control**
   - Refactored `useAccessState` hook to use `isLive` field directly
   - Removed complex status calculation logic (~50 lines)
   - Simplified countdown calculation using `launched_at` and `launch_delay_seconds`
   - Added automatic countdown updates with 1-second interval

3. **Phase 3: Cleaned Up Utilities**
   - Removed unnecessary functions from `tokenStatus.ts`:
     - `calculateTokenStatus` (used non-existent fields)
     - `calculateCountdown` (redundant with hook logic)
     - `parseTokenTimings` (parsed non-existent fields)
   - Kept only `formatCountdown` utility function
   - Imported `formatCountdown` in `AccessGuard.tsx` to avoid duplication

### Benefits Achieved

1. **Code Reduction**: Removed ~150 lines of unnecessary code
2. **Performance**: Eliminated redundant calculations on every render
3. **Reliability**: Single source of truth for token status (backend `isLive` field)
4. **Maintainability**: Simpler, clearer code structure

### Verification

- ✅ TypeScript compilation passes
- ✅ Frontend build completes successfully
- ✅ All imports are correctly updated
- ✅ No references to removed fields remain

### Additional Fixes Applied

1. **Enhanced Error Handling**
   - Added try-catch wrapper for BigInt conversions
   - Fallback to `created_time` if `launched_at` is '0' or undefined
   - Validation for reasonable timestamp values (not negative or > 1 year in future)
   - Console warnings for invalid data

2. **Defensive Programming**
   - Null/undefined checking before BigInt conversion
   - Proper handling of edge cases where timestamps might be missing
   - Clear error states when data is invalid

3. **Documentation**
   - Created MIGRATION_NOTES.md for developers
   - Documented breaking changes and deprecated patterns
   - Provided migration examples

4. **Identified Issues**
   - Found spelling inconsistency: frontend uses "upcomming" while backend uses "upcoming"
   - Note: This affects multiple files and should be addressed in a future update