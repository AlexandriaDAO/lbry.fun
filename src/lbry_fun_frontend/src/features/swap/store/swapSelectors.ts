import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '@/store';

// Base selectors
const selectSwapState = (state: RootState) => state.swap;

// Memoized selectors
export const selectActiveSwapPool = createSelector(
  [selectSwapState],
  (swap) => swap.activeSwapPool
);

export const selectSecondaryRatio = createSelector(
  [selectSwapState],
  (swap) => swap.secondaryRatio
);

export const selectSecondaryBalance = createSelector(
  [selectSwapState],
  (swap) => swap.secondaryBalance
);

export const selectStakeInfo = createSelector(
  [selectSwapState],
  (swap) => swap.stakeInfo
);

export const selectTotalStaked = createSelector(
  [selectSwapState],
  (swap) => swap.totalStaked
);

export const selectTotalStakers = createSelector(
  [selectSwapState],
  (swap) => swap.totalStakers
);

export const selectAverageAPY = createSelector(
  [selectSwapState],
  (swap) => swap.averageAPY
);

export const selectDistributionInterval = createSelector(
  [selectSwapState],
  (swap) => swap.distributionInterval
);

export const selectTransactionHistory = createSelector(
  [selectSwapState],
  (swap) => swap.transactionHistory
);

export const selectCanisterArchivedBalance = createSelector(
  [selectSwapState],
  (swap) => swap.canisterArchivedBal
);

export const selectIsLoading = createSelector(
  [selectSwapState],
  (swap) => swap.loading
);

export const selectError = createSelector(
  [selectSwapState],
  (swap) => swap.error
);

// Combined selectors
export const selectIsDataReady = createSelector(
  [selectActiveSwapPool, selectSecondaryRatio],
  (pool, ratio) => pool !== null && ratio !== null
);

export const selectPoolTokens = createSelector(
  [selectActiveSwapPool],
  (pool) => {
    if (!pool) return null;
    return {
      primarySymbol: pool[1].primary_token_symbol,
      secondarySymbol: pool[1].secondary_token_symbol,
      primaryName: pool[1].primary_token_name,
      secondaryName: pool[1].secondary_token_name,
    };
  }
);

export const selectHasTransactionHistory = createSelector(
  [selectTransactionHistory],
  (history) => history.transactions.length > 0
);

export const selectSwapLoadingStates = createSelector(
  [selectSwapState],
  (swap) => ({
    isLoadingCriticalData: swap.isLoadingCriticalData,
    isLoadingSecondaryData: swap.isLoadingSecondaryData,
    isLoadingLogs: swap.logsLoading,
    isLoadingTransactions: swap.transactionHistory.loading
  })
);