import { ActionReducerMapBuilder, createSlice } from "@reduxjs/toolkit";
import { toast } from "sonner";
import { stakingThunks } from "../thunks/stakingThunks";
import { tradingThunks } from "../thunks/tradingThunks";
import { balanceThunks } from "../thunks/balanceThunks";
import { analyticsThunks } from "../thunks/analyticsThunks";
import { fetchTokenomicsCurrentState } from "../thunks/tokenomicsThunks";
import { distributionThunks } from "../thunks/distributionThunks";
import fetchTokenLogosForPool from "../../token/thunk/fetchTokenLogosForPoolThunk";
import { SwapState } from "./swapTypes";
import { initialState, swapActions } from "./swapActions";

// Destructure thunks for easier access
const { stakePrimary, unstake, claimReward, getStakedInfo, getAllStakesInfo, getStakersCount, getAverageApy } = stakingThunks;
const { swapSecondary, burnSecondary, transferSecondary, getSecondaryRatio } = tradingThunks;
const { getSecondaryBalance, getSecondaryFee, getArchivedBalance, getCanisterArchivedBalance, redeemArchivedBalance } = balanceThunks;
const { fetchTransactionHistory, getAllLogs } = analyticsThunks;
const { fetchDistributionSummary, fetchDistributionEvents, fetchLatestDistributionEvent } = distributionThunks;

const swapSlice = createSlice({
  name: "swap",
  initialState,
  reducers: swapActions,
  extraReducers: (builder: ActionReducerMapBuilder<SwapState>) => {
    builder
      // Secondary Ratio
      .addCase(getSecondaryRatio.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getSecondaryRatio.fulfilled, (state, action) => {
        state.secondaryRatio = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(getSecondaryRatio.rejected, (state) => {
        toast.error("[ERROR] SECONDARY RATIO FETCH FAILED");
        state.loading = false;
        state.error = null;
      })
      
      // Secondary Balance
      .addCase(getSecondaryBalance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getSecondaryBalance.fulfilled, (state, action) => {
        state.secondaryBalance = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(getSecondaryBalance.rejected, (state, action) => {
        toast.error("[ERROR] SECONDARY BALANCE FETCH FAILED");
        state.loading = false;
        state.error = {
          message: "",
          title: (action.payload as string) || "",
        };
      })
      
      // Staked Info
      .addCase(getStakedInfo.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getStakedInfo.fulfilled, (state, action) => {
        state.stakeInfo = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(getStakedInfo.rejected, (state, action) => {
        toast.error("[ERROR] STAKED INFO FETCH FAILED");
        state.loading = false;
        state.error = {
          message: "",
          title: (action.payload as string) || "",
        };
      })
      
      // Swap Secondary
      .addCase(swapSecondary.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.swapSuccess = false;
      })
      .addCase(swapSecondary.fulfilled, (state) => {
        state.swapSuccess = true;
        state.loading = false;
        state.error = null;
        toast.success("[SUCCESS] SWAP COMPLETE");
      })
      .addCase(swapSecondary.rejected, (state, action) => {
        state.loading = false;
        state.swapSuccess = false;
        state.error = action.payload || { title: "Swap failed", message: "Please try again" };
        toast.error(`[ERROR] SWAP FAILED: ${action.payload?.title || "UNKNOWN ERROR"}`);
      })
      
      // Burn Secondary
      .addCase(burnSecondary.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.burnSuccess = false;
      })
      .addCase(burnSecondary.fulfilled, (state) => {
        state.burnSuccess = true;
        state.loading = false;
        state.error = null;
        toast.success("[SUCCESS] BURN COMPLETE");
      })
      .addCase(burnSecondary.rejected, (state, action) => {
        state.loading = false;
        state.burnSuccess = false;
        state.error = action.payload || { title: "Burn failed", message: "Please try again" };
        toast.error(`[ERROR] BURN FAILED: ${action.payload?.title || "UNKNOWN ERROR"}`);
      })
      
      // Stake Primary
      .addCase(stakePrimary.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.successStake = false;
      })
      .addCase(stakePrimary.fulfilled, (state) => {
        state.successStake = true;
        state.loading = false;
        state.error = null;
        toast.success("[SUCCESS] STAKE COMPLETE");
      })
      .addCase(stakePrimary.rejected, (state, action) => {
        state.loading = false;
        state.successStake = false;
        state.error = action.payload || { title: "Stake failed", message: "Please try again" };
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
      
      // Add remaining thunks in a more concise manner
      .addCase(unstake.fulfilled, (state) => { state.unstakeSuccess = true; })
      .addCase(claimReward.fulfilled, (state) => { state.successClaimReward = true; })
      .addCase(transferSecondary.fulfilled, (state) => { state.transferSuccess = true; })
      .addCase(redeemArchivedBalance.fulfilled, (state) => { state.redeeemSuccess = true; })
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

export const { flagHandler, setActiveSwapPool, resetTransactionHistory, setIsLoadingCriticalData, setIsLoadingSecondaryData } = swapSlice.actions;
export default swapSlice.reducer;