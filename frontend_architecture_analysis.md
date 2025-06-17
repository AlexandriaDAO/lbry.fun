# Frontend Architecture Analysis - Data Fetching Issues

## Executive Summary

The frontend has several architectural issues centered around race conditions between component mounting and activeSwapPool initialization, inconsistent data fetching patterns, and components attempting to fetch data before required state is available.

## Core Issues Identified

### 1. Race Condition: Component Mounting vs activeSwapPool Initialization

**Problem**: Components attempt to fetch data immediately on mount, but `activeSwapPool` is set asynchronously based on URL parameters and token pool data.

**Affected Components**:
- `BalancePage.tsx` - Tries to fetch balances on mount regardless of activeSwapPool state
- `balanceContent.tsx` - Same issue
- `burnContent.tsx` - Fetches data on mount but needs activeSwapPool for calculations

**Root Cause**: In `swapMain.tsx`, the flow is:
1. Component mounts
2. Child components mount and try to fetch data
3. `useEffect` runs to fetch token pools
4. `activeSwapPool` gets set after pools are loaded
5. But data fetching already failed with "No active swap pool found"

### 2. Inconsistent Data Fetching Guard Patterns

**Problem**: Different thunks handle missing `activeSwapPool` inconsistently:

**Examples**:
```typescript
// getSecondaryratio.ts - Returns "0" instead of throwing
if (!state.swap.activeSwapPool) {
  return "0"; // Silently fails
}

// getAccountPrimaryBalance.ts - Throws error 
if (!state.swap.activeSwapPool) {
  throw new Error("No active swap pool found"); // Hard fails
}
```

### 3. Balance Tab Not Fetching Data by Default

**Issue**: `BalancePage.tsx` and `balanceContent.tsx` both fetch balance data on mount, but:
- They don't check if `activeSwapPool` exists first
- They don't re-fetch when `activeSwapPool` becomes available
- The fetch fails silently in some cases

**Current Logic**:
```typescript
// BalancePage.tsx
useEffect(() => {
    if (isAuthenticated && principal) {
        dispatch(getAccountPrimaryBalance(principal)); // Fails if no activeSwapPool
        dispatch(getSecondaryBalance(principal));      // Fails if no activeSwapPool
    }
}, [isAuthenticated, principal, dispatch]); // Missing activeSwapPool dependency
```

### 4. Burn Tab Not Loading Required Data

**Issue**: `burnContent.tsx` has correct logic to fetch data when `activeSwapPool` is available, but:
- The dependencies cause multiple re-renders
- Some data (like `maxBurnAllowed`) is calculated client-side instead of being fetched
- Exchange rates depend on multiple async calls that may not be coordinated

### 5. Overfetching Patterns

**Examples of Unnecessary Data Fetching**:

1. **burnContent.tsx** - Fetches canister balance data that might not be needed immediately:
```typescript
useEffect(() => {
    if (isAuthenticated && principal && swap.activeSwapPool) {
        dispatch(getSecondaryBalance(principal));
        dispatch(getCanisterBal());        // May not be needed immediately
        dispatch(getCanisterArchivedBal()); // May not be needed immediately
    }
}, [isAuthenticated, principal, swap.activeSwapPool, dispatch]);
```

2. **swapMain.tsx** - Fetches multiple rates on every render:
```typescript
useEffect(() => {
    dispatch(getSecondaryratio());    // Called on every mount
    dispatch(getPrimaryMintRate());   // Called on every mount  
    dispatch(getSecondaryFee());      // Called on every mount
    dispatch(getPrimaryFee());        // Called on every mount
}, []); // But these need activeSwapPool to work
```

### 6. Data Flow Architecture Issues

**Current Flow** (Problematic):
```
1. SwapMain mounts
2. Child components mount and try to fetch data (FAIL - no activeSwapPool)
3. Token pools fetch completes
4. activeSwapPool set
5. Some components refetch, others don't
```

**Missing Dependencies**: Many `useEffect` hooks are missing `activeSwapPool` as a dependency, so they don't refetch when the pool becomes available.

## Specific Component Issues

### Balance Components
- `BalancePage.tsx` and `balanceContent.tsx` duplicate the same data fetching logic
- Both fetch on mount without checking for `activeSwapPool`
- Neither re-fetches when `activeSwapPool` becomes available
- `PrimaryBalanceCard` and `SecondaryBalanceCard` display data but don't fetch it themselves

### Burn Components  
- `burnContent.tsx` has better logic but still has timing issues
- Calculates `maxBurnAllowed` client-side requiring multiple async values
- Multiple `useEffect` hooks with overlapping dependencies cause unnecessary re-renders

### Data Consistency
- E8s to natural number conversion happens in multiple places
- Some components show loading states, others don't
- Error handling is inconsistent across thunks

## Recommended Fixes

### 1. Centralized Data Fetching
Move all pool-specific data fetching to `swapMain.tsx` and trigger it only after `activeSwapPool` is set.

### 2. Consistent Guard Patterns
All thunks should either:
- Return early with default values if no `activeSwapPool`, OR  
- Throw consistent errors that components can handle

### 3. Proper Dependency Arrays
Add `activeSwapPool` to all `useEffect` dependencies that need it.

### 4. Data Loading Orchestration
Create a centralized hook that coordinates the loading of all required data in the correct order.

### 5. Eliminate Duplicate Fetching
Remove duplicate data fetching logic between parent and child components.

This analysis shows the root cause is a combination of race conditions, inconsistent error handling, and components trying to be too independent in their data fetching rather than coordinating through the parent component.