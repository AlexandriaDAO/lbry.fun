import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '@/store';

// Loading state selectors
export const selectOperations = (state: RootState) => state.swap.operations;
export const selectPrimaryLoading = (state: RootState) => state.primary.loading;
export const selectTokenomicsLoading = (state: RootState) => state.tokenomics.loading;

export const selectNormalizedLoading = createSelector(
  [selectOperations, selectPrimaryLoading, selectTokenomicsLoading],
  (operations, primaryLoading, tokenomicsLoading) => ({
    balances: primaryLoading,
    swap: operations.swap === 'pending',
    burn: operations.burn === 'pending',
    stake: operations.stake === 'pending',
    unstake: operations.unstake === 'pending',
    transfer: operations.transferPrimary === 'pending' || operations.transferSecondary === 'pending' || primaryLoading,
    claim: operations.claim === 'pending',
    redeem: operations.redeem === 'pending',
    logs: tokenomicsLoading,
  })
);

// Success state selectors
export const selectNormalizedSuccess = (state: RootState) => ({
  swap: state.swap.operations.swap === 'success',
  burn: state.swap.operations.burn === 'success',
  stake: state.swap.operations.stake === 'success',
  unstake: state.swap.operations.unstake === 'success',
  transfer: state.swap.operations.transferPrimary === 'success' || state.swap.operations.transferSecondary === 'success' || state.primary.transferSuccess,
  claim: state.swap.operations.claim === 'success',
  redeem: state.swap.operations.redeem === 'success',
});

// Error state selectors
export const selectSwapError = (state: RootState) => {
  // Return the first error found in operation errors
  const errors = state.swap.operationErrors;
  const errorKey = Object.keys(errors).find(key => errors[key as keyof typeof errors]);
  return errorKey ? errors[errorKey as keyof typeof errors] : null;
};
export const selectPrimaryError = (state: RootState) => state.primary.error;
export const selectTokenomicsError = (state: RootState) => state.tokenomics.error;

export const selectNormalizedError = createSelector(
  [selectSwapError, selectPrimaryError, selectTokenomicsError],
  (swapError, primaryError, tokenomicsError) => {
    // Return the first error found, prioritizing swap errors
    if (swapError) return swapError;
    if (primaryError) return { message: primaryError, title: 'Primary Token Error' };
    if (tokenomicsError) return { message: tokenomicsError, title: 'Tokenomics Error' };
    return null;
  }
);

// Logs selectors
export const selectLogsData = (state: RootState) => state.swap.logsData;
export const selectLogsLoading = (state: RootState) => state.swap.logsLoading;
export const selectLogsError = (state: RootState) => state.swap.logsError;

export const selectNormalizedLogs = createSelector(
  [selectLogsData, selectLogsLoading, selectLogsError],
  (data, loading, error) => ({ data, loading, error })
);

// Active pool selector
export const selectActivePool = (state: RootState) => state.swap.activeSwapPool;

// Spending balance selector
export const selectSpendingBalance = (state: RootState) => state.swap.spendingBalance;