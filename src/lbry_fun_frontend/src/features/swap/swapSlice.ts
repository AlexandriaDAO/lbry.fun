import { ActionReducerMapBuilder, createSlice } from "@reduxjs/toolkit";
import { toast } from "sonner";
import getSecondaryratio from "./thunks/getSecondaryratio";
import swapSecondary from "./thunks/swapSecondary";
import burnSecondary from "./thunks/burnSecondary";
import getSecondaryBalance from "./thunks/secondaryIcrc/getSecondaryBalance";
import stakePrimary from "./thunks/stakePrimary";
import getStakeInfo from "./thunks/getStakedInfo";
import claimReward from "./thunks/claimReward";
import unstake from "./thunks/unstake";
import transferSecondary from "./thunks/secondaryIcrc/transferSecondary";
import getALlStakesInfo from "./thunks/getAllStakesInfo";
import getArchivedBal from "./thunks/getArchivedBal";
import redeemArchivedBalance from "./thunks/redeemArchivedBalance";
import getStakersCount from "./thunks/getStakersCount";
import getCanisterArchivedBal from "./thunks/getCanisterArchivedBal";
import getAverageApy from "./thunks/getAverageApy";
import getSecondaryFee from "./thunks/secondaryIcrc/getSecondaryFee";
import getAllLogs from "./thunks/insights/getAllLogs.thunk";
import fetchTransactionHistory from "./thunks/fetchTransactionHistory.thunk";
import { ErrorMessage } from "./utlis/erorrs";
import { TokenRecordStringified } from "../token/thunk/getTokenPools.thunk";
import fetchTokenLogosForPool from "../token/thunk/fetchTokenLogosForPoolThunk";
import { ProcessedLogsData } from "./types/logs";
import { TransactionHistoryState } from "./types/transactionTypes";
import { CacheableData, updateCacheEntry, invalidatePoolCache, CACHE_DURATIONS } from "../../utils/cacheManager";

// Define the interface for our node state
export interface StakeInfo {
  stakedPrimary: string;
  rewardIcp: string;
  unix_stake_time: string;
}
export interface CanisterArchived {
  canisterArchivedBal: Number;
  canisterUnClaimedIcp: Number;
}

export interface SwapState {
  // Cached data with timestamps
  secondaryRatio: CacheableData<string>;
  secondaryBalance: CacheableData<string>;
  secondaryFee: CacheableData<string>;
  archivedBalance: CacheableData<string>;
  stakeInfo: CacheableData<StakeInfo>;
  totalStakers: CacheableData<string>;
  totalStaked: CacheableData<string>;
  canisterArchivedBal: CacheableData<CanisterArchived>;
  averageAPY: CacheableData<number>;
  logsData: CacheableData<ProcessedLogsData | null>;
  
  // Non-cached data
  maxLbryBurn: Number;
  loading: boolean;
  swapSuccess: boolean;
  burnSuccess: boolean;
  successStake: boolean;
  successClaimReward: boolean;
  unstakeSuccess: boolean;
  transferSuccess: boolean;
  redeeemSuccess: boolean;
  error: ErrorMessage | null;
  spendingBalance: string;
  activeSwapPool: [string, TokenRecordStringified] | null;
  logsLoading: boolean;
  logsError: string | null;
  transactionHistory: TransactionHistoryState;
  
  // Global loading states for data orchestration
  isLoadingCriticalData: boolean;
  isLoadingSecondaryData: boolean;
}

// Define the initial state using the ManagerState interface
const initialState: SwapState = {
  // Cached data with timestamps
  secondaryRatio: { data: "0", lastFetch: null },
  secondaryFee: { data: "0", lastFetch: null },
  secondaryBalance: { data: "0", lastFetch: null },
  archivedBalance: { data: "0", lastFetch: null },
  stakeInfo: { data: { stakedPrimary: "0", rewardIcp: "0", unix_stake_time: "0" }, lastFetch: null },
  totalStakers: { data: "0", lastFetch: null },
  canisterArchivedBal: { data: { canisterUnClaimedIcp: 0, canisterArchivedBal: 0 }, lastFetch: null },
  totalStaked: { data: "0", lastFetch: null },
  averageAPY: { data: 0, lastFetch: null },
  logsData: { data: null, lastFetch: null },
  
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
  isLoadingSecondaryData: false
};

const swapSlice = createSlice({
  name: "swap",
  initialState,
  reducers: {
    flagHandler: (state) => {
      state.swapSuccess = false;
      state.burnSuccess = false;
      state.successStake = false;
      state.successClaimReward = false;
      state.unstakeSuccess = false;
      state.transferSuccess = false;
      state.redeeemSuccess = false;
      state.error = null;
    },
    setIsLoadingCriticalData: (state, action) => {
      state.isLoadingCriticalData = action.payload;
    },
    setIsLoadingSecondaryData: (state, action) => {
      state.isLoadingSecondaryData = action.payload;
    },
    setActiveSwapPool: (state, action) => {
      const newPoolId = action.payload?.[0];
      const currentPoolId = state.activeSwapPool?.[0];
      
      // If switching to a different pool, invalidate pool-specific cache
      if (newPoolId && currentPoolId && newPoolId !== currentPoolId) {
        // Invalidate cached data for pool-specific items
        state.secondaryRatio.lastFetch = null;
        state.secondaryBalance.lastFetch = null;
        state.secondaryFee.lastFetch = null;
        state.archivedBalance.lastFetch = null;
        state.stakeInfo.lastFetch = null;
        state.totalStakers.lastFetch = null;
        state.totalStaked.lastFetch = null;
        state.canisterArchivedBal.lastFetch = null;
        state.averageAPY.lastFetch = null;
        state.logsData.lastFetch = null;
        
        // Reset transaction history
        state.transactionHistory.transactions = [];
        state.transactionHistory.currentPage = 0;
        state.transactionHistory.hasMore = true;
        state.transactionHistory.lastFetch = null;
      }
      
      state.activeSwapPool = action.payload;
    },
    resetTransactionHistory: (state) => {
      state.transactionHistory.transactions = [];
      state.transactionHistory.currentPage = 0;
      state.transactionHistory.hasMore = true;
      state.transactionHistory.error = null;
    },
    cleanupExpiredCache: (state) => {
      const now = Date.now();
      
      // Check each cached field and invalidate if expired
      if (state.secondaryRatio.lastFetch && (now - state.secondaryRatio.lastFetch) > CACHE_DURATIONS.SECONDARY_RATIO) {
        state.secondaryRatio.lastFetch = null;
      }
      if (state.secondaryBalance.lastFetch && (now - state.secondaryBalance.lastFetch) > CACHE_DURATIONS.BALANCES) {
        state.secondaryBalance.lastFetch = null;
      }
      if (state.secondaryFee.lastFetch && (now - state.secondaryFee.lastFetch) > CACHE_DURATIONS.FEES) {
        state.secondaryFee.lastFetch = null;
      }
      if (state.archivedBalance.lastFetch && (now - state.archivedBalance.lastFetch) > CACHE_DURATIONS.BALANCES) {
        state.archivedBalance.lastFetch = null;
      }
      if (state.stakeInfo.lastFetch && (now - state.stakeInfo.lastFetch) > CACHE_DURATIONS.STAKE_INFO) {
        state.stakeInfo.lastFetch = null;
      }
      if (state.totalStakers.lastFetch && (now - state.totalStakers.lastFetch) > CACHE_DURATIONS.TOTAL_STAKED) {
        state.totalStakers.lastFetch = null;
      }
      if (state.totalStaked.lastFetch && (now - state.totalStaked.lastFetch) > CACHE_DURATIONS.TOTAL_STAKED) {
        state.totalStaked.lastFetch = null;
      }
      if (state.canisterArchivedBal.lastFetch && (now - state.canisterArchivedBal.lastFetch) > CACHE_DURATIONS.BALANCES) {
        state.canisterArchivedBal.lastFetch = null;
      }
      if (state.averageAPY.lastFetch && (now - state.averageAPY.lastFetch) > CACHE_DURATIONS.AVERAGE_APY) {
        state.averageAPY.lastFetch = null;
      }
      if (state.logsData.lastFetch && (now - state.logsData.lastFetch) > CACHE_DURATIONS.LOGS_DATA) {
        state.logsData.lastFetch = null;
      }
    }
  },
  extraReducers: (builder: ActionReducerMapBuilder<SwapState>) => {
    builder
      .addCase(getSecondaryratio.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getSecondaryratio.fulfilled, (state, action) => {
        state.secondaryRatio = updateCacheEntry(action.payload, state.activeSwapPool?.[0]);
        state.loading = false;
        state.error = null;
      })
      .addCase(getSecondaryratio.rejected, (state, action) => {
        toast.error("Secondary ratio could not be fetched!");
        state.loading = false;
        state.error = null; // action.payload as string;
      })
      .addCase(getSecondaryBalance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getSecondaryBalance.fulfilled, (state, action) => {
        state.secondaryBalance = updateCacheEntry(action.payload, state.activeSwapPool?.[0]);
        state.loading = false;
        state.error = null;
      })
      .addCase(getSecondaryBalance.rejected, (state, action) => {
        toast.error("Secondary balance could not be fetched!");
        state.loading = false;
        state.error = state.error = {
          message: "",
          title: (action.payload as string) || "",
        };
      })
      .addCase(getStakeInfo.pending, (state) => {
        // toast.info("Fetching staked info!");
        state.loading = true;
        state.error = null;
      })
      .addCase(getStakeInfo.fulfilled, (state, action) => {
        state.stakeInfo = updateCacheEntry(action.payload, state.activeSwapPool?.[0]);
        state.loading = false;
        state.error = null;
      })
      .addCase(getStakeInfo.rejected, (state, action) => {
        toast.error("Could not fetched staked info!");
        state.loading = false;
        state.error = state.error = {
          message: "",
          title: (action.payload as string) || "",
        };
      })
      .addCase(getALlStakesInfo.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getALlStakesInfo.fulfilled, (state, action) => {
        // toast.success("Fetched all staked info!");
        state.totalStaked = updateCacheEntry(action.payload, state.activeSwapPool?.[0]);
        state.loading = false;
        state.error = null;
      })
      .addCase(getALlStakesInfo.rejected, (state, action) => {
        toast.error("Could not fetched all staked info!");
        state.loading = false;
        state.error = state.error = {
          message: "",
          title: (action.payload as string) || "",
        };
      })
      .addCase(swapSecondary.pending, (state) => {
        // toast.info("Swapping!");
        state.loading = true;
        state.error = null;
      })
      .addCase(swapSecondary.fulfilled, (state, action) => {
        toast.success("Successfully Swaped!");
        state.loading = false;
        state.swapSuccess = true;
        state.error = null;
      })
      .addCase(swapSecondary.rejected, (state, action) => {
        toast.error(action.payload?.message);
        state.loading = false;
        state.error = {
          message: action?.payload?.message || "",
          title: action.payload?.title || "",
        };
      })
      .addCase(stakePrimary.pending, (state) => {
        toast.info("Staking!");
        state.loading = true;
        state.error = null;
      })
      .addCase(stakePrimary.fulfilled, (state, action) => {
        toast.success("Successfully staked!");
        state.loading = false;
        state.successStake = true;
      })
      .addCase(stakePrimary.rejected, (state, action) => {
        toast.error("Error while staking!");
        state.loading = false;
        state.error = {
          message: action?.payload?.message || "",
          title: action.payload?.title || "",
        };
      })
      .addCase(burnSecondary.pending, (state) => {
        toast.info("Burning!");
        state.loading = true;
        state.error = null;
      })
      .addCase(burnSecondary.fulfilled, (state, action) => {
        toast.success("Burned sucessfully!");
        state.burnSuccess = true;
        state.loading = false;
        state.error = null;
      })
      .addCase(burnSecondary.rejected, (state, action) => {
        toast.error(action.payload?.message);
        state.loading = false;
        state.error = {
          message: action?.payload?.message || "",
          title: action.payload?.title || "",
        };
      })
      .addCase(claimReward.pending, (state) => {
        // toast.info("Claiming!");
        state.loading = true;
        state.error = null;
      })
      .addCase(claimReward.fulfilled, (state, action) => {
        toast.success("Successfully Claimed!");
        state.loading = false;
        state.successClaimReward = true;
        state.error = null;
      })
      .addCase(claimReward.rejected, (state, action) => {
        toast.error("Error while claiming!");
        state.loading = false;
        state.error = {
          message: action?.payload?.message || "",
          title: action.payload?.title || "",
        };
      })
      .addCase(unstake.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(unstake.fulfilled, (state, action) => {
        toast.success("Successfully unstaked!");
        state.loading = false;
        state.unstakeSuccess = true;
        state.error = null;
      })
      .addCase(unstake.rejected, (state, action) => {
        toast.error("Error while unstaking!");
        state.loading = false;
        state.error = {
          message: action?.payload?.message || "",
          title: action.payload?.title || "",
        };
      })

      .addCase(transferSecondary.pending, (state) => {
        toast.info("Processing Secondary transfer!");
        state.loading = true;
        state.error = null;
      })
      .addCase(transferSecondary.fulfilled, (state, action) => {
        toast.success("Successfully transfered Secondary!");
        state.transferSuccess = true;
        state.loading = false;
        state.error = null;
      })
      .addCase(transferSecondary.rejected, (state, action) => {
        toast.error("Error while transfering Secondary");
        state.loading = false;
        state.error = {
          message: action?.payload || "",
          title: "",
        };
      })
      .addCase(getArchivedBal.pending, (state) => {
        // toast.info("Fetching archived balance!");
        state.loading = true;
        state.error = null;
      })
      .addCase(getArchivedBal.fulfilled, (state, action) => {
        // toast.success("Successfully fetched archived balance!");
        state.archivedBalance = updateCacheEntry(action.payload, state.activeSwapPool?.[0]);
        state.loading = false;
        state.error = null;
      })
      .addCase(getArchivedBal.rejected, (state, action) => {
        toast.error("Error while fetching archived balance");
        state.loading = false;
        state.error = {
          message: action?.payload || "",
          title: action.payload || "",
        };
      })
      .addCase(redeemArchivedBalance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(redeemArchivedBalance.fulfilled, (state, action) => {
        toast.success("Successfully redeem!");
        state.loading = false;
        state.redeeemSuccess = true;
        state.error = null;
      })
      .addCase(redeemArchivedBalance.rejected, (state, action) => {
        toast.error("Error while claiming!");
        state.loading = false;
        state.error = {
          message: action?.payload?.message || "",
          title: action.payload?.title || "",
        };
      })
      .addCase(getStakersCount.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getStakersCount.fulfilled, (state, action) => {
        state.loading = false;
        state.totalStakers = updateCacheEntry(action.payload, state.activeSwapPool?.[0]);
        state.error = null;
      })
      .addCase(getStakersCount.rejected, (state, action) => {
        toast.error("Error while fetching total stakers!");
        state.loading = false;
        state.error = state.error = {
          message: "",
          title: action.payload || "",
        };
      })
      .addCase(getCanisterArchivedBal.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getCanisterArchivedBal.fulfilled, (state, action) => {
        state.loading = false;
        state.canisterArchivedBal = updateCacheEntry(action.payload, state.activeSwapPool?.[0]);
        state.error = null;
      })
      .addCase(getCanisterArchivedBal.rejected, (state, action) => {
        toast.error("Error while fetching canister archived balance!");
        state.loading = false;
        state.error = {
          message: "",
          title: action.payload || "",
        };
      })
      .addCase(getAverageApy.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAverageApy.fulfilled, (state, action) => {
        state.loading = false;
        state.averageAPY = updateCacheEntry(action.payload, state.activeSwapPool?.[0]);
        state.error = null;
      })
      .addCase(getAverageApy.rejected, (state, action) => {
        toast.error("Error while fetching canister average APY!");
        state.loading = false;
        state.error = {
          message: "",
          title: action.payload || "",
        };
      })
      .addCase(getSecondaryFee.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getSecondaryFee.fulfilled, (state, action) => {
        state.secondaryFee = updateCacheEntry(action.payload, state.activeSwapPool?.[0]);
        state.loading = false;
        state.error = null;
      })
      .addCase(getSecondaryFee.rejected, (state, action) => {
        state.loading = false;
        state.error = {
          message: "",
          title: action.payload || "",
        };
      })

      .addCase(getAllLogs.pending, (state) => {
        state.logsLoading = true;
      })
      .addCase(getAllLogs.fulfilled, (state, action) => {
        state.logsData = updateCacheEntry(action.payload, state.activeSwapPool?.[0]);
        state.logsLoading = false;
      })
      .addCase(getAllLogs.rejected, (state, action) => {
        state.logsLoading = false;
        state.logsError = action.payload as string;
        state.error = {
          message: "",
          title: (action.payload as string) || "Failed to get log data",
        };
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
        // No loading state change, it's a background update
      })
      .addCase(fetchTransactionHistory.pending, (state) => {
        state.transactionHistory.loading = true;
        state.transactionHistory.error = null;
      })
      .addCase(fetchTransactionHistory.fulfilled, (state, action) => {
        const { transactions, hasMore } = action.payload;
        
        if (state.transactionHistory.currentPage === 0) {
          // First page - replace transactions
          state.transactionHistory.transactions = transactions;
        } else {
          // Subsequent pages - append transactions
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
      });
  },
});
export const { flagHandler, setActiveSwapPool, resetTransactionHistory, cleanupExpiredCache, setIsLoadingCriticalData, setIsLoadingSecondaryData } = swapSlice.actions;
export default swapSlice.reducer;
