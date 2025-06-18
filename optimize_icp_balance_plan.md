# ICP Balance Optimization Plan

## Current State Analysis

### ICP Balance State Management
1. **Redux Slice**: `icpLedgerSlice.ts` manages ICP balance state
   - Stores: `accountBalance`, `accountBalanceUSD`, `icpPrice`, `icpPriceTimestamp`
   - Has thunk: `getIcpBal` that fetches balance from the ledger

2. **Balance Fetching Locations**:
   - **Create Token Page**: `UserICPBalance` component fetches on mount when authenticated
   - **Swap Page**: `useSwapDataLoader` hook fetches ICP balance as part of critical data loading
   - Both make separate API calls even though they're fetching the same data

3. **Request Deduplication**:
   - `requestDeduplicationMiddleware.ts` exists with 10-second cache
   - Already deduplicates balance requests by principal
   - Should prevent duplicate calls within 10 seconds

## Issues Identified

1. **Multiple Components Fetching Same Data**: UserICPBalance and useSwapDataLoader both dispatch `getIcpBal` independently
2. **No Cross-Component State Sharing**: Each component triggers its own fetch instead of checking if data already exists
3. **Unnecessary Re-fetches**: When navigating between pages, balance is re-fetched even if recently loaded

## Optimization Strategy

### 1. Create a Centralized ICP Balance Hook
- Create `useIcpLedgerBalance` hook that:
  - Checks if balance exists and is fresh (< 30 seconds old)
  - Only fetches if data is stale or missing
  - Returns balance, loading state, and refresh function

### 2. Implement Smart Caching
- Use `icpPriceTimestamp` field to track data freshness
- Add similar timestamp for balance data
- Only fetch if data is older than threshold (30 seconds)

### 3. Update Components
- Replace direct `getIcpBal` dispatches with the new hook
- Ensure components share the same Redux state
- Remove redundant fetching logic

### 4. Enhance Middleware
- Ensure deduplication middleware properly handles ICP balance requests
- Consider increasing cache duration for balance requests (30 seconds instead of 10)

## Implementation Tasks

- [ ] Create `useIcpLedgerBalance` hook in `/features/icp-ledger/hooks/`
- [ ] Add `accountBalanceTimestamp` to icpLedgerSlice state
- [ ] Update `getIcpBal` fulfilled case to set timestamp
- [ ] Refactor `UserICPBalance` component to use new hook
- [ ] Update `useSwapDataLoader` to use new hook
- [ ] Test that balance is fetched only once when navigating between pages
- [ ] Verify deduplication middleware is working correctly

## Expected Benefits

1. **Reduced API Calls**: Balance fetched only when stale, not on every component mount
2. **Better Performance**: Faster page loads by reusing cached data
3. **Improved UX**: No loading states when data is already available
4. **Consistent State**: All components share the same balance data

## Review Section
*To be completed after implementation*