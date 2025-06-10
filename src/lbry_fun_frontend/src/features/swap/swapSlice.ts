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
// import fetchTransaction from "./thunks/secondaryIcrc/getTransactions";
// import getSpendingBalance from "./thunks/lbryIcrc/getSpendingBalance";
// import getPrimarySpendingBalance from "./thunks/alexIcrc/getPrimarySpendingBalance";

// import { TransactionType } from "./thunks/secondaryIcrc/getTransactions";
import getStakersCount from "./thunks/getStakersCount";
import getCanisterArchivedBal from "./thunks/getCanisterArchivedBal";
import getAverageApy from "./thunks/getAverageApy";
import getSecondaryFee from "./thunks/secondaryIcrc/getSecondaryFee";
import getAllLogs from "./thunks/insights/getAllLogs.thunk";
import { ErrorMessage } from "./utlis/erorrs";
import { TokenRecordStringified } from "../token/thunk/getTokenPools.thunk";
import fetchTokenLogosForPool from "../token/thunk/fetchTokenLogosForPoolThunk";
import { ProcessedLogsData } from "./types/logs";

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
  secondaryRatio: string;
  secondaryBalance: string;
  secondaryFee: string;
  archivedBalance: string;
  maxLbryBurn: Number;
  stakeInfo: StakeInfo;
  totalStakers: string;
  totalStaked: string;
  canisterArchivedBal: CanisterArchived;
  loading: boolean;
  swapSuccess: boolean;
  burnSuccess: boolean;
  successStake: boolean;
  successClaimReward: boolean;
  unstakeSuccess: boolean;
  transferSuccess: boolean;
  redeeemSuccess: boolean;
  // transactions: TransactionType[];
  averageAPY: number;
  error: ErrorMessage | null;
  spendingBalance: string;
  activeSwapPool: [string, TokenRecordStringified] | null;
  logsData: ProcessedLogsData | null;
  logsLoading: boolean;
  logsError: string | null;
}

// Define the initial state using the ManagerState interface
const initialState: SwapState = {
  secondaryRatio: "0",
  secondaryFee: "0",
  secondaryBalance: "0",
  archivedBalance: "0",
  maxLbryBurn: 0,
  stakeInfo: { stakedPrimary: "0", rewardIcp: "0", unix_stake_time: "0" },
  totalStakers: "0",
  canisterArchivedBal: { canisterUnClaimedIcp: 0, canisterArchivedBal: 0 },
  totalStaked: "0",
  swapSuccess: false,
  redeeemSuccess: false,
  successStake: false,
  burnSuccess: false,
  successClaimReward: false,
  unstakeSuccess: false,
  transferSuccess: false,
  // transactions: [],
  loading: false,
  averageAPY: 0,
  error: null,
  spendingBalance: "0",
  logsData: null,
  logsLoading: false,
  logsError: null,
  activeSwapPool: null,
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
    setActiveSwapPool: (state, action) => {
      state.activeSwapPool = action.payload;
    }
  },
  extraReducers: (builder: ActionReducerMapBuilder<SwapState>) => {
    builder
      .addCase(getSecondaryratio.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getSecondaryratio.fulfilled, (state, action) => {
        state.secondaryRatio = action.payload;
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
        state.secondaryBalance = action.payload;
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
        state.stakeInfo = action.payload;
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
        state.totalStaked = action.payload;
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
        state.archivedBalance = action.payload;
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
      // .addCase(fetchTransaction.pending, (state) => {
      //   // toast.info("Fetching!");
      //   state.loading = true;
      //   state.error = null;
      // })
      // .addCase(fetchTransaction.fulfilled, (state, action) => {
      //   // toast.success("Fetched Transactions!");
      //   state.loading = false;
      //   state.transactions = action.payload;
      //   state.error = null;
      // })
      // .addCase(fetchTransaction.rejected, (state, action) => {
      //   toast.error("Error while fetching transactions!");
      //   state.loading = false;
      //   state.error = {
      //     message: "",
      //     title: action.payload || "",
      //   };
      // })
      .addCase(getStakersCount.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getStakersCount.fulfilled, (state, action) => {
        state.loading = false;
        state.totalStakers = action.payload;
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
        state.canisterArchivedBal = action.payload;
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
        state.averageAPY = action.payload;
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
        state.secondaryFee = action.payload;
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
        state.logsData = action.payload;
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
      });
  },
});
export const { flagHandler ,setActiveSwapPool} = swapSlice.actions;
export default swapSlice.reducer;
