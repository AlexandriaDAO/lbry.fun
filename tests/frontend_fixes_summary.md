# Frontend Fixes Summary

## Problem Analysis

The core backend code was already fixed (using ICRC-1 standard for balance queries). The issues were in the frontend:

1. **Staking Issue**: The frontend wasn't approving enough tokens to cover the transaction fee
2. **Burning Issue**: Similar approval amount problem - not including fee buffer

## Fixes Applied

### 1. Fixed `stakePrimary.ts`
- Added logic to get the primary token fee from Redux state
- Now approves `amount + fee` instead of just `amount`
- This ensures the icp_swap canister can deduct both the stake amount and fee

```typescript
// Get the primary token fee from state
const primaryFee = state.primary.primaryFee;
const feeInE8s = BigInt(Math.ceil(Number(primaryFee) * 10 ** 8));

// Add fee buffer to approval amount
const approvalAmount = amountFormat + feeInE8s;
```

### 2. Fixed `burnSecondary.ts`
- Added logic to get the secondary token fee from Redux state
- Now approves `amount + fee` instead of just `amount`
- This ensures proper approval for burning operations

```typescript
// Get the secondary token fee from state
const secondaryFee = state.swap.secondaryFee;
const feeInE8s = BigInt(Math.ceil(Number(secondaryFee) * 10 ** 8));

// Add fee buffer to approval amount
const approvalAmount = amountFormate8s + feeInE8s;
```

## Why These Fixes Work

The backend `stake_primary` and `burn_secondary` functions use `icrc2_transfer_from` which requires:
1. The user to approve the canister to spend their tokens
2. The approval amount must cover both the transaction amount AND the token fee

Without the fee buffer in the approval, the transfer_from would fail silently because there wasn't enough approved to cover fees.

## Testing Recommendations

1. **Test Staking**:
   - Ensure primary token fee is loaded in Redux state
   - Try staking various amounts
   - Verify tokens are transferred and stake records created

2. **Test Burning**:
   - Ensure secondary token fee is loaded in Redux state
   - Try burning various amounts
   - Verify secondary tokens burned, ICP returned, and primary tokens minted

3. **Edge Cases**:
   - Test with exact balance amounts
   - Test with very small amounts
   - Test rapid successive operations

## Notes
- The `swapSecondary.ts` already had proper fee handling (adds 0.0001 ICP buffer)
- Both fees should be fetched when the swap pool is loaded
- The UI already shows available balance minus fees in the stake component