# Swap Architecture Test Plan

## Phase 6 Fixes Validation Checklist

### 1. Request Deduplication Validation ✅
**Changes Made:**
- Increased cache duration from 1 second to 10 seconds
- Fixed middleware to properly skip duplicate requests
- Added action type filtering for non-deduplicatable actions

**Test Steps:**
1. Open browser console
2. Navigate to swap page
3. Look for deduplication logs:
   - ✅ Should see: `[Deduplication] 🚫 Skipping duplicate request`
   - ✅ Should see: `[Deduplication] 📊 Stats: X pending requests in cache`
   - ❌ Should NOT see multiple `✅ Processing request` for same key

### 2. Loading Guard System Validation ✅
**Changes Made:**
- Added global Redux state for `isLoadingCriticalData` and `isLoadingSecondaryData`
- Updated `useSwapDataLoader` to use Redux state instead of local state

**Test Steps:**
1. Monitor Redux DevTools
2. Check swap state for loading flags
3. Verify only ONE instance of loadCriticalData runs at a time
4. Look for performance logs showing single operations

### 3. Cache System Validation 🔄
**Changes Made:**
- Added detailed cache debugging logs in `getSecondaryratio`
- Fixed poolId storage in cache entries

**Test Steps:**
1. Navigate to swap page
2. Look for cache debug logs:
   - `[Cache Debug] Secondary Ratio - Should fetch: false` = Cache Hit
   - `✅ [Cache Hit] Using cached secondary ratio`
   - Check poolId matching in debug output
3. Monitor cache hit rate in performance logs

### 4. AccountCards Integration ✅
**Changes Made:**
- Removed independent ICP price fetching
- Removed duplicate ICP balance fetching
- Component now relies on centralized data loader

**Test Steps:**
1. Check console for AccountCards logs
2. Should see: `AccountCards: Relying on centralized data loader`
3. Should NOT see: `AccountCards: dispatching getIcpPrice`

### 5. Performance Metrics

**Success Criteria:**
- [ ] Request deduplication working (see skipping logs)
- [ ] Only ONE loadCriticalData operation at a time
- [ ] Cache hit rate > 50% after initial load
- [ ] loadCriticalData < 5 seconds
- [ ] No duplicate ICP price fetches
- [ ] No rogue component dispatches

**Expected Console Output Pattern:**
```
[Deduplication] ✅ Processing request: icp_ledger/getIcpPrice/pending
[Cache Debug] Secondary Ratio - Should fetch: true
🔄 [Cache Miss] Fetching fresh secondary ratio
[Performance] ✅ loadCriticalData: 3500.00ms

// On subsequent loads:
[Deduplication] 🚫 Skipping duplicate request: icp_ledger/getIcpPrice/pending
[Cache Debug] Secondary Ratio - Should fetch: false
✅ [Cache Hit] Using cached secondary ratio
```

## Debugging Commands

```javascript
// Check cache metrics
cacheMetrics = getCacheMetrics();
console.log('Cache Performance:', cacheMetrics);

// Check Redux state
store.getState().swap.isLoadingCriticalData
store.getState().swap.isLoadingSecondaryData

// Monitor performance
performanceMonitor.getMetrics()
```

## Known Issues to Monitor

1. **Cache Warming Conflicts**: Watch for cache warming competing with main data loading
2. **Component Re-renders**: Multiple components may trigger initial load
3. **Pool Switching**: Cache should invalidate when switching pools

## Next Steps if Issues Persist

1. **If deduplication still fails**: Check action.meta.requestId uniqueness
2. **If cache hit rate is still 0%**: Debug poolId comparison logic
3. **If multiple operations run**: Add semaphore/mutex pattern
4. **If performance is still bad**: Remove cache warming entirely