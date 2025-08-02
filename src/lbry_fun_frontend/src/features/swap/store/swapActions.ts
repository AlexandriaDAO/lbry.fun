import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { SwapState } from "./swapTypes";
import { TokenRecordStringified } from "../../token/thunk/getTokenPools.thunk";

// Define the initial state using the SwapState interface
export const initialState: SwapState = {
  // Core data
  secondaryRatio: null,
  secondaryFee: "0",
  secondaryBalance: "0",
  archivedBalance: "0",
  stakeInfo: { stakedPrimary: "0", rewardIcp: "0", unix_stake_time: "0" },
  totalStakers: "0",
  canisterArchivedBal: { canisterUnClaimedIcp: 0, canisterArchivedBal: 0 },
  totalStaked: "0",
  averageAPY: 0,
  distributionInterval: null,
  logsData: null,
  
  // Non-cached data
  maxLbryBurn: 0,
  swapSuccess: false,
  redeeemSuccess: false,
  successStake: false,
  burnSuccess: false,
  successClaimReward: false,
  unstakeSuccess: false,
  transferSuccess: false,
  loading: false,
  error: null,
  spendingBalance: "0",
  logsLoading: false,
  logsError: null,
  activeSwapPool: null,
  transactionHistory: {
    transactions: [],
    loading: false,
    error: null,
    lastFetch: null,
    hasMore: true,
    currentPage: 0
  },
  
  // Global loading states
  isLoadingCriticalData: false,
  isLoadingSecondaryData: false,
  
  // Current tokenomics state
  tokenomicsCurrentState: null,
  tokenomicsCurrentStateLoading: false,
  tokenomicsCurrentStateError: null,
  
  // Distribution tracking
  distributionSummary: null,
  distributionEvents: [],
  latestDistributionEvent: null,
  distributionLoading: false,
  distributionError: null
};

// Action creators
export const swapActions = {
  flagHandler: (state: SwapState) => {
    state.swapSuccess = false;
    state.burnSuccess = false;
    state.successStake = false;
    state.successClaimReward = false;
    state.unstakeSuccess = false;
    state.transferSuccess = false;
    state.redeeemSuccess = false;
    state.error = null;
  },
  
  setIsLoadingCriticalData: (state: SwapState, action: PayloadAction<boolean>) => {
    state.isLoadingCriticalData = action.payload;
  },
  
  setIsLoadingSecondaryData: (state: SwapState, action: PayloadAction<boolean>) => {
    state.isLoadingSecondaryData = action.payload;
  },
  
  setActiveSwapPool: (state: SwapState, action: PayloadAction<[string, TokenRecordStringified] | null>) => {
    const newPoolId = action.payload?.[0];
    const currentPoolId = state.activeSwapPool?.[0];
    
    // If switching to a different pool, reset pool-specific data
    if (newPoolId && currentPoolId && newPoolId !== currentPoolId) {
      // Reset pool-specific data to trigger fresh fetches
      state.secondaryRatio = null;
      state.secondaryBalance = null;
      state.secondaryFee = null;
      state.archivedBalance = null;
      state.stakeInfo = null;
      state.totalStakers = null;
      state.totalStaked = null;
      state.canisterArchivedBal = null;
      state.averageAPY = null;
      state.distributionInterval = null;
      state.logsData = null;
      state.tokenomicsCurrentState = null;
      state.tokenomicsCurrentStateError = null;
      
      // Reset distribution data
      state.distributionSummary = null;
      state.distributionEvents = [];
      state.latestDistributionEvent = null;
      state.distributionError = null;
      
      // Reset transaction history
      state.transactionHistory.transactions = [];
      state.transactionHistory.currentPage = 0;
      state.transactionHistory.hasMore = true;
      state.transactionHistory.lastFetch = null;
    }
    
    state.activeSwapPool = action.payload;
  },
  
  resetTransactionHistory: (state: SwapState) => {
    state.transactionHistory.transactions = [];
    state.transactionHistory.currentPage = 0;
    state.transactionHistory.hasMore = true;
    state.transactionHistory.error = null;
  }
};