import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '@/store';

// Loading state selectors
export const selectSwapLoading = (state: RootState) => state.swap.loading;
export const selectPrimaryLoading = (state: RootState) => state.primary.loading;
export const selectTokenomicsLoading = (state: RootState) => state.tokenomics.loading;

export const selectNormalizedLoading = createSelector(
  [selectSwapLoading, selectPrimaryLoading, selectTokenomicsLoading],
  (swapLoading, primaryLoading, tokenomicsLoading) => ({
    balances: swapLoading || primaryLoading,
    swap: swapLoading,
    burn: swapLoading,
    stake: swapLoading,
    unstake: swapLoading,
    transfer: swapLoading || primaryLoading,
    claim: swapLoading,
    redeem: swapLoading,
    logs: tokenomicsLoading,
  })
);

// Success state selectors
export const selectNormalizedSuccess = (state: RootState) => ({
  swap: state.swap.swapSuccess,
  burn: state.swap.burnSuccess,
  stake: state.swap.successStake,
  unstake: state.swap.unstakeSuccess,
  transfer: state.swap.transferSuccess || state.primary.transferSuccess,
  claim: state.swap.successClaimReward,
  redeem: state.swap.redeeemSuccess,
});

// Error state selectors
export const selectSwapError = (state: RootState) => state.swap.error;
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