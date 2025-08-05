import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '@/store';

// Balance selectors
export const selectPrimaryBalance = (state: RootState) => state.primary.primaryBal;
export const selectPrimaryFee = (state: RootState) => state.primary.primaryFee;
export const selectPrimaryPriceUsd = (state: RootState) => state.primary.primaryPriceUsd;

export const selectSecondaryBalance = (state: RootState) => state.swap.secondaryBalance;
export const selectSecondaryFee = (state: RootState) => state.swap.secondaryFee;
export const selectSecondaryRatio = (state: RootState) => state.swap.secondaryRatio;

export const selectArchivedBalance = (state: RootState) => state.swap.archivedBalance;
export const selectCanisterArchivedBal = (state: RootState) => state.swap.canisterArchivedBal;

// Normalized balance selectors
export const selectNormalizedBalances = createSelector(
  [selectPrimaryBalance, selectPrimaryFee, selectPrimaryPriceUsd,
   selectSecondaryBalance, selectSecondaryFee, selectSecondaryRatio,
   selectArchivedBalance],
  (primaryBal, primaryFee, primaryPriceUsd, secondaryBal, secondaryFee, secondaryRatio, archivedBal) => ({
    primary: {
      balance: primaryBal,
      fee: primaryFee,
      priceUsd: primaryPriceUsd,
    },
    secondary: {
      balance: secondaryBal,
      fee: secondaryFee,
      ratio: secondaryRatio,
    },
    icp: {
      balance: '0', // TODO: Add ICP balance from icpLedger slice if needed
      archivedBalance: archivedBal,
    },
  })
);

// Loading state selectors
export const selectBalanceLoading = createSelector(
  [(state: RootState) => state.primary.loading, (state: RootState) => state.swap.operations],
  (primaryLoading, operations) => {
    // Check if any operation is pending
    const anyOperationPending = Object.values(operations).some(status => status === 'pending');
    return primaryLoading || anyOperationPending;
  }
);

// Staking selectors
export const selectStakeInfo = (state: RootState) => state.swap.stakeInfo;
export const selectTotalStaked = (state: RootState) => state.swap.totalStaked;
export const selectTotalStakers = (state: RootState) => state.swap.totalStakers;
export const selectAverageAPY = (state: RootState) => state.swap.averageAPY;

export const selectNormalizedStaking = createSelector(
  [selectStakeInfo, selectTotalStaked, selectTotalStakers, selectAverageAPY],
  (userStake, totalStaked, totalStakers, averageAPY) => ({
    userStake,
    totalStaked,
    totalStakers,
    averageAPY,
  })
);

// Tokenomics selectors
export const selectPrimaryMintRate = (state: RootState) => state.tokenomics.primaryMintRate;
export const selectMaxBurnAllowed = (state: RootState) => state.swap.maxLbryBurn;

export const selectNormalizedTokenomics = createSelector(
  [selectPrimaryMintRate, selectMaxBurnAllowed],
  (primaryMintRate, maxBurnAllowed) => ({
    primaryMintRate,
    maxBurnAllowed,
  })
);