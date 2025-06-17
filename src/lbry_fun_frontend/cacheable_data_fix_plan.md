# CacheableData Fix Plan

## Problem
React components are directly rendering CacheableData objects instead of accessing their `.data` property, causing "Objects are not valid as a React child" errors.

## Issues Found

### 1. BurnContent.tsx
- **Line 137**: `{swap.secondaryBalance}` should be `{swap.secondaryBalance.data}`

### 2. SwapContent.tsx
- **Line 62**: `setSecondaryRatio(Number(swap.secondaryRatio))` should be `setSecondaryRatio(Number(swap.secondaryRatio.data))`
- **Line 64**: `Number(swap.secondaryRatio) * Number(amount)` should be `Number(swap.secondaryRatio.data) * Number(amount)`
- **Line 66**: Uses `swap.secondaryRatio` in dependency array but should use `swap.secondaryRatio.data`

## Todo List

- [ ] Fix BurnContent.tsx: Change line 137 to use `swap.secondaryBalance.data`
- [ ] Fix SwapContent.tsx: Change line 62 to use `swap.secondaryRatio.data`
- [ ] Fix SwapContent.tsx: Change line 64 to use `swap.secondaryRatio.data`
- [ ] Fix SwapContent.tsx: Update useEffect dependency on line 66 to use `swap.secondaryRatio.data`
- [ ] Test burn functionality to ensure no more errors
- [ ] Test swap functionality to ensure no more errors
- [ ] Verify stake and redeem pages are working correctly

## Root Cause
CacheableData is a wrapper object with structure `{ data: T, lastFetch: number | null }`. Components must access the `.data` property to get the actual value for rendering.

## Verification
After fixes, the error logs mentioning "Objects are not valid as a React child" on Burn, Stake, and Redeem tabs should be resolved.

## Review Section

### Changes Made

1. **BurnContent.tsx** (/home/theseus/alexandria/lbryfun/src/lbry_fun_frontend/src/features/swap/components/burn/burnContent.tsx)
   - **Line 137**: Fixed `{swap.secondaryBalance}` to `{swap.secondaryBalance.data}` for proper display of secondary token balance
   - **Line 85**: Fixed `Number(swap.secondaryBalance)` to `Number(swap.secondaryBalance.data)` in handleMaxLbry function
   - **Line 85**: Fixed `Number(swap.secondaryFee)` to `Number(swap.secondaryFee.data)` in handleMaxLbry function  
   - **Line 86**: Fixed `Number(swap.secondaryRatio)` to `Number(swap.secondaryRatio.data)` in handleMaxLbry function

2. **SwapContent.tsx** (/home/theseus/alexandria/lbryfun/src/lbry_fun_frontend/src/features/swap/components/swap/swapContent.tsx)
   - **Line 62**: Fixed `setSecondaryRatio(Number(swap.secondaryRatio))` to `setSecondaryRatio(Number(swap.secondaryRatio.data))`
   - **Line 64**: Fixed `Number(swap.secondaryRatio) * Number(amount)` to `Number(swap.secondaryRatio.data) * Number(amount)`
   - **Line 66**: Updated useEffect dependency from `swap.secondaryRatio` to `swap.secondaryRatio.data`

### Summary
The "Objects are not valid as a React child" errors were caused by React components attempting to render CacheableData objects directly instead of accessing their `.data` property. CacheableData objects have the structure `{ data: T, lastFetch: number | null }`, so the actual data must be accessed via the `.data` property.

The fixes ensure that:
- All display values properly extract data from CacheableData objects
- Mathematical operations use the actual numeric values, not the wrapper objects
- useEffect dependencies track the actual data changes, not object reference changes

The application builds successfully after these fixes, confirming no TypeScript compilation errors were introduced.