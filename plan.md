# Fix PR 10 Issues - Implementation Plan

## Investigation Summary

PR 10 correctly removed static IcpSwap and Tokenomics providers (they're per-pool canisters). However, this exposed a timing issue where components try to use the LbryFun actor before it's fully initialized. The error messages are misleading - there's no "chunk 197" and the actor initialization isn't failing, it's just not ready yet.

## Changes Needed

### 1. Fix useTokenomicsData.ts timing issue
- [ ] Update the hook to properly handle when lbryFunActor is null/undefined
- [ ] Skip fetching when actor isn't ready instead of showing error
- [ ] The useEffect already checks for lbryFunActor, but needs better handling

**File**: `/home/theseus/alexandria/lbryfun/src/lbry_fun_frontend/src/features/token/hooks/useTokenomicsData.ts`

**Changes**:
- Line 45-48: The error "Actor not available" is too aggressive - should just wait
- Update to return early without setting error when actor is null
- Let the loading state persist until actor is ready

### 2. Fix previewTokenomicsSchedule.thunk.ts error message
- [ ] Update misleading error message at line 33
- [ ] Change from "Failed to initialize" to "Actor not yet available"

**File**: `/home/theseus/alexandria/lbryfun/src/lbry_fun_frontend/src/features/token/thunk/previewTokenomicsSchedule.thunk.ts`

**Changes**:
- Line 33: Change error message to be more accurate about the timing issue

### 3. Verify TokenomicsTab.tsx handles loading properly
- [ ] Check that TokenomicsTab properly shows loading state when lbryFunActor is null
- [ ] Line 22 already checks for lbryFunActor - verify this works correctly

**File**: `/home/theseus/alexandria/lbryfun/src/lbry_fun_frontend/src/features/swap/components/TokenomicsTab.tsx`

**Changes**:
- Verify the existing null check at line 22 is sufficient
- May need to add explicit actor availability check

### 4. Verify TerminalCreateToken.tsx handles initialization
- [ ] Check that create token form waits for actor before showing errors

**File**: `/home/theseus/alexandria/lbryfun/src/lbry_fun_frontend/src/features/token/components/terminal/TerminalCreateToken.tsx`

**Changes**:
- Line 54 uses useLbryFun - verify it handles null actor gracefully
- Form submission already checks for lbryFunActor at line 307

## Testing Plan

After implementing fixes:
1. Test creating a new token - should not show "Failed to initialize" error immediately
2. Test clicking tokenomics tab - should show loading state, not chunk error
3. Verify both pages wait gracefully for actor initialization
4. Confirm no regression in actual functionality

## Architecture Notes

- PR 10's removal of static IcpSwap/Tokenomics providers was CORRECT
- These canisters are spawned per-pool, not global
- The canisterActorFactory.ts already handles dynamic actor creation
- This fix maintains the correct architecture while fixing timing issues

## Implementation Approach

Make minimal surgical changes:
1. Remove aggressive error handling when actor is null
2. Update error messages to be more accurate
3. Let existing loading states work naturally
4. Don't add complex new loading boundaries

Keep it simple - the architecture is correct, just need better handling of initialization timing.
