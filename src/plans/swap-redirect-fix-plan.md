# Swap Page Redirect Fix Plan

## Problem
After staking tokens, users are redirected from /swap/stake to the main page (/), with console errors showing "No active swap pool found". This happens because:

1. The `usePoolInitializer` hook redirects to home when there's no `id` query parameter in the URL
2. After staking, something causes the URL to lose its `id` parameter
3. The redirect happens before the data can be refetched

## Root Cause
The tab navigation in `swapMain.tsx` relies on `idFromUrl` from the current search params. If anything causes a navigation without preserving the query parameter, the pool initializer immediately redirects to home.

## Solution
We need to make the system more resilient by:
1. Preserving the active pool ID when we already have an active swap pool
2. Only redirecting to home if we truly don't have a pool (not just missing URL param)
3. Ensuring tab navigation always preserves the pool ID

## Implementation Steps

### TODO:
- [x] Modify `usePoolInitializer` to check for existing activeSwapPool before redirecting
- [x] Update tab navigation to use activeSwapPool ID when URL param is missing
- [x] Add URL parameter recovery when activeSwapPool exists but URL is missing ID
- [ ] Test the fix with stake operations

## Code Changes Needed

### 1. Update `usePoolInitializer.ts` ✅
- Before redirecting to home, check if `activeSwapPool` exists
- If it does, update the URL with the pool ID instead of redirecting
- Only redirect if both URL param AND activeSwapPool are missing

### 2. Update `swapMain.tsx` ✅
- Use `activeSwapPool[0]` as fallback when `idFromUrl` is null
- Ensure all tab navigations preserve the pool ID

### 3. Consider adding a URL sync effect ✅
- When activeSwapPool exists but URL is missing the ID, update the URL
- This prevents the redirect trigger in usePoolInitializer

## Review

### Changes Made:
1. **usePoolInitializer.ts**: Modified the redirect logic to preserve the pool when URL parameter is missing
   - If no URL ID but activeSwapPool exists, update URL instead of redirecting
   - Only redirect to home if both are missing

2. **swapMain.tsx**: Made tab navigation more resilient
   - Added `poolId` variable that uses activeSwapPool as fallback
   - Updated all navigation calls to use poolId instead of idFromUrl
   - This ensures pool ID is preserved even if URL loses the parameter

### How This Fixes the Issue:
- When staking completes and causes a navigation without the ID parameter, the system will now:
  1. Check if activeSwapPool still exists in Redux state
  2. If yes, restore the ID to the URL instead of redirecting
  3. Tab navigations will always use the pool ID from either URL or Redux state
- This prevents the "No active swap pool found" error and unwanted redirects