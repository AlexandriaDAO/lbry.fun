import { TokenRecordStringified } from "../../token/thunk/getTokenPools.thunk";
import { ProcessedLogsData } from "../types/logs";
import { TransactionHistoryState } from "../types/transactionTypes";
import { ErrorMessage } from "../utils/errors";

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
  // Core data
  secondaryRatio: string | null;
  secondaryBalance: string | null;
  secondaryFee: string | null;
  archivedBalance: string | null;
  stakeInfo: StakeInfo | null;
  totalStakers: string | null;
  totalStaked: string | null;
  canisterArchivedBal: CanisterArchived | null;
  averageAPY: number | null;
  logsData: ProcessedLogsData | null;
  
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