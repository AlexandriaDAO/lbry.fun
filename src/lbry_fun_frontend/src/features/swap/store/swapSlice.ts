import { ActionReducerMapBuilder, createSlice } from "@reduxjs/toolkit";
import { toast } from "sonner";
import { stakingThunks } from "../thunks/stakingThunks";
import { tradingThunks } from "../thunks/tradingThunks";
import { balanceThunks } from "../thunks/balanceThunks";
import { analyticsThunks } from "../thunks/analyticsThunks";
import { fetchTokenomicsCurrentState, fetchTokenomicsConfig } from "../thunks/tokenomicsThunks";
import { distributionThunks } from "../thunks/distributionThunks";
import fetchTokenLogosForPool from "../../token/thunk/fetchTokenLogosForPoolThunk";
import transferICP from "../../icp-ledger/thunks/transferICP";
import { SwapState } from "./swapTypes";
import { initialState, swapActions } from "./swapActions";

// Destructure thunks for easier access
const { stakePrimary, unstake, claimReward, getStakedInfo, getAllStakesInfo, getStakersCount, getAverageApy } = stakingThunks;
const { swapSecondary, burnSecondary, transferSecondary, transferPrimary, getSecondaryRatio } = tradingThunks;
const { getSecondaryBalance, getSecondaryFee, getArchivedBalance, getCanisterArchivedBalance, redeemArchivedBalance } = balanceThunks;
const { fetchTransactionHistory, getAllLogs } = analyticsThunks;
const { fetchDistributionSummary, fetchDistributionEvents, fetchLatestDistributionEvent } = distributionThunks;

const swapSlice = createSlice({
  name: "swap",
  initialState,
  reducers: swapActions,
  extraReducers: (builder: ActionReducerMapBuilder<SwapState>) => {
    builder
      // Secondary Ratio (non-operation, keep as is)
      .addCase(getSecondaryRatio.fulfilled, (state, action) => {
        state.secondaryRatio = action.payload;
      })
      .addCase(getSecondaryRatio.rejected, () => {
        toast.error("[ERROR] SECONDARY RATIO FETCH FAILED");
      })
      
      // Secondary Balance (non-operation, keep as is)
      .addCase(getSecondaryBalance.fulfilled, (state, action) => {
        state.secondaryBalance = action.payload;
      })
      .addCase(getSecondaryBalance.rejected, (state, action) => {
        toast.error("[ERROR] SECONDARY BALANCE FETCH FAILED");
      })
      
      // Staked Info (non-operation, keep as is)
      .addCase(getStakedInfo.fulfilled, (state, action) => {
        state.stakeInfo = action.payload;
      })
      .addCase(getStakedInfo.rejected, () => {
        toast.error("[ERROR] STAKED INFO FETCH FAILED");
      })
      
      // Swap Secondary
      .addCase(swapSecondary.pending, (state) => {
        state.operations.swap = 'pending';
        state.operationErrors.swap = undefined;
      })
      .addCase(swapSecondary.fulfilled, (state) => {
        state.operations.swap = 'success';
        toast.success("[SUCCESS] SWAP COMPLETE");
      })
      .addCase(swapSecondary.rejected, (state, action) => {
        state.operations.swap = 'error';
        state.operationErrors.swap = action.payload || { title: "Swap failed", message: "Please try again" };
        toast.error(`[ERROR] SWAP FAILED: ${action.payload?.title || "UNKNOWN ERROR"}`);
      })
      
      // Burn Secondary
      .addCase(burnSecondary.pending, (state) => {
        state.operations.burn = 'pending';
        state.operationErrors.burn = undefined;
      })
      .addCase(burnSecondary.fulfilled, (state) => {
        state.operations.burn = 'success';
        toast.success("[SUCCESS] BURN COMPLETE");
      })
      .addCase(burnSecondary.rejected, (state, action) => {
        state.operations.burn = 'error';
        state.operationErrors.burn = action.payload || { title: "Burn failed", message: "Please try again" };
        toast.error(`[ERROR] BURN FAILED: ${action.payload?.title || "UNKNOWN ERROR"}`);
      })
      
      // Stake Primary
      .addCase(stakePrimary.pending, (state) => {
        state.operations.stake = 'pending';
        state.operationErrors.stake = undefined;
      })
      .addCase(stakePrimary.fulfilled, (state) => {
        state.operations.stake = 'success';
        toast.success("[SUCCESS] STAKE COMPLETE");
      })
      .addCase(stakePrimary.rejected, (state, action) => {
        state.operations.stake = 'error';
        state.operationErrors.stake = action.payload || { title: "Stake failed", message: "Please try again" };
        toast.error(`[ERROR] STAKE FAILED: ${action.payload?.title || "UNKNOWN ERROR"}`);
      })
      
      // Transaction History
      .addCase(fetchTransactionHistory.pending, (state) => {
        state.transactionHistory.loading = true;
        state.transactionHistory.error = null;
      })
      .addCase(fetchTransactionHistory.fulfilled, (state, action) => {
        const { transactions, hasMore } = action.payload;
        
        if (state.transactionHistory.currentPage === 0) {
          state.transactionHistory.transactions = transactions;
        } else {
          state.transactionHistory.transactions.push(...transactions);
        }
        
        state.transactionHistory.loading = false;
        state.transactionHistory.hasMore = hasMore;
        state.transactionHistory.lastFetch = Date.now();
        state.transactionHistory.currentPage += 1;
      })
      .addCase(fetchTransactionHistory.rejected, (state, action) => {
        state.transactionHistory.loading = false;
        state.transactionHistory.error = action.payload || "Failed to fetch transactions";
      })
      
      // Unstake
      .addCase(unstake.pending, (state) => {
        state.operations.unstake = 'pending';
        state.operationErrors.unstake = undefined;
      })
      .addCase(unstake.fulfilled, (state) => {
        state.operations.unstake = 'success';
      })
      .addCase(unstake.rejected, (state, action) => {
        state.operations.unstake = 'error';
        state.operationErrors.unstake = action.payload;
      })
      
      // Claim Reward
      .addCase(claimReward.pending, (state) => {
        state.operations.claim = 'pending';
        state.operationErrors.claim = undefined;
      })
      .addCase(claimReward.fulfilled, (state) => {
        state.operations.claim = 'success';
      })
      .addCase(claimReward.rejected, (state, action) => {
        state.operations.claim = 'error';
        state.operationErrors.claim = action.payload;
      })
      
      // Transfer Secondary
      .addCase(transferSecondary.pending, (state) => {
        state.operations.transferSecondary = 'pending';
        state.operationErrors.transferSecondary = undefined;
      })
      .addCase(transferSecondary.fulfilled, (state) => {
        state.operations.transferSecondary = 'success';
      })
      .addCase(transferSecondary.rejected, (state, action) => {
        state.operations.transferSecondary = 'error';
        state.operationErrors.transferSecondary = action.payload;
      })
      
      // Transfer Primary
      .addCase(transferPrimary.pending, (state) => {
        state.operations.transferPrimary = 'pending';
        state.operationErrors.transferPrimary = undefined;
      })
      .addCase(transferPrimary.fulfilled, (state) => {
        state.operations.transferPrimary = 'success';
      })
      .addCase(transferPrimary.rejected, (state, action) => {
        state.operations.transferPrimary = 'error';
        state.operationErrors.transferPrimary = action.payload;
      })
      
      // Transfer ICP
      .addCase(transferICP.pending, (state) => {
        state.operations.transferIcp = 'pending';
        state.operationErrors.transferIcp = undefined;
      })
      .addCase(transferICP.fulfilled, (state) => {
        state.operations.transferIcp = 'success';
      })
      .addCase(transferICP.rejected, (state, action) => {
        state.operations.transferIcp = 'error';
        state.operationErrors.transferIcp = { 
          title: "ICP Transfer Failed", 
          message: action.payload as string || "Unknown error" 
        };
      })
      
      // Redeem Archived Balance
      .addCase(redeemArchivedBalance.pending, (state) => {
        state.operations.redeem = 'pending';
        state.operationErrors.redeem = undefined;
      })
      .addCase(redeemArchivedBalance.fulfilled, (state) => {
        state.operations.redeem = 'success';
      })
      .addCase(redeemArchivedBalance.rejected, (state, action) => {
        state.operations.redeem = 'error';
        state.operationErrors.redeem = action.payload;
      })
      .addCase(getSecondaryFee.fulfilled, (state, action) => { state.secondaryFee = action.payload; })
      .addCase(getArchivedBalance.fulfilled, (state, action) => { state.archivedBalance = action.payload; })
      .addCase(getCanisterArchivedBalance.fulfilled, (state, action) => { state.canisterArchivedBal = action.payload; })
      .addCase(getAllStakesInfo.fulfilled, (state, action) => { state.totalStaked = action.payload; })
      .addCase(getStakersCount.fulfilled, (state, action) => { state.totalStakers = action.payload; })
      .addCase(getAverageApy.fulfilled, (state, action) => { 
        state.averageAPY = action.payload.apy; 
        state.distributionInterval = action.payload.distributionInterval;
      })
      .addCase(getAllLogs.pending, (state) => { state.logsLoading = true; })
      .addCase(getAllLogs.fulfilled, (state, action) => {
        state.logsData = action.payload;
        state.logsLoading = false;
      })
      .addCase(getAllLogs.rejected, (state, action) => {
        state.logsLoading = false;
        state.logsError = action.payload as string;
      })
      .addCase(fetchTokenLogosForPool.fulfilled, (state, action) => {
        const { poolId, primaryTokenLogo, secondaryTokenLogo } = action.payload;
        if (state.activeSwapPool && state.activeSwapPool[0] === poolId) {
          const updatedRecord = { ...state.activeSwapPool[1] };
          if (primaryTokenLogo !== undefined) {
            updatedRecord.primary_token_logo_base64 = primaryTokenLogo;
          }
          if (secondaryTokenLogo !== undefined) {
            updatedRecord.secondary_token_logo_base64 = secondaryTokenLogo;
          }
          state.activeSwapPool = [state.activeSwapPool[0], updatedRecord];
        }
      })
      
      // Tokenomics Current State
      .addCase(fetchTokenomicsCurrentState.pending, (state) => {
        state.tokenomicsCurrentStateLoading = true;
        state.tokenomicsCurrentStateError = null;
      })
      .addCase(fetchTokenomicsCurrentState.fulfilled, (state, action) => {
        state.tokenomicsCurrentState = action.payload;
        state.tokenomicsCurrentStateLoading = false;
        state.tokenomicsCurrentStateError = null;
      })
      .addCase(fetchTokenomicsCurrentState.rejected, (state, action) => {
        state.tokenomicsCurrentStateLoading = false;
        state.tokenomicsCurrentStateError = action.payload?.message || "Failed to fetch current state";
      })
      
      // Tokenomics Config
      .addCase(fetchTokenomicsConfig.pending, (state) => {
        state.tokenomicsConfigLoading = true;
        state.tokenomicsConfigError = null;
      })
      .addCase(fetchTokenomicsConfig.fulfilled, (state, action) => {
        state.tokenomicsConfig = action.payload;
        state.tokenomicsConfigLoading = false;
        state.tokenomicsConfigError = null;
      })
      .addCase(fetchTokenomicsConfig.rejected, (state, action) => {
        state.tokenomicsConfigLoading = false;
        state.tokenomicsConfigError = action.payload?.message || "Failed to fetch tokenomics config";
      })
      
      // Distribution Summary
      .addCase(fetchDistributionSummary.pending, (state) => {
        state.distributionLoading = true;
        state.distributionError = null;
      })
      .addCase(fetchDistributionSummary.fulfilled, (state, action) => {
        state.distributionSummary = action.payload;
        state.distributionLoading = false;
      })
      .addCase(fetchDistributionSummary.rejected, (state, action) => {
        state.distributionError = action.payload as string;
        state.distributionLoading = false;
      })
      
      // Distribution Events
      .addCase(fetchDistributionEvents.pending, (state) => {
        state.distributionLoading = true;
        state.distributionError = null;
      })
      .addCase(fetchDistributionEvents.fulfilled, (state, action) => {
        state.distributionEvents = action.payload;
        state.distributionLoading = false;
      })
      .addCase(fetchDistributionEvents.rejected, (state, action) => {
        state.distributionError = action.payload as string;
        state.distributionLoading = false;
      })
      
      // Latest Distribution Event
      .addCase(fetchLatestDistributionEvent.pending, (state) => {
        state.distributionLoading = true;
        state.distributionError = null;
      })
      .addCase(fetchLatestDistributionEvent.fulfilled, (state, action) => {
        state.latestDistributionEvent = action.payload;
        state.distributionLoading = false;
      })
      .addCase(fetchLatestDistributionEvent.rejected, (state, action) => {
        state.distributionError = action.payload as string;
        state.distributionLoading = false;
      });
  },
});

export const { resetOperation, setActiveSwapPool, resetTransactionHistory, setIsLoadingCriticalData, setIsLoadingSecondaryData, setRefreshing } = swapSlice.actions;
export default swapSlice.reducer;