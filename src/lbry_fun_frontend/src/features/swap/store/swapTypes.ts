import { TokenRecordStringified } from "../../token/thunk/getTokenPools.thunk";
import { ProcessedLogsData } from "../types/logs";
import { TransactionHistoryState } from "../types/transactionTypes";
import { ErrorMessage } from "../utils/errors";
import { TokenomicsCurrentState } from "../thunks/tokenomicsThunks";
import { SerializedDistributionSummary, SerializedDistributionEvent } from "@/utils/bigintSerialization";

// Operation status tracking
export type OperationStatus = 'idle' | 'pending' | 'success' | 'error';

export interface OperationStates {
  swap: OperationStatus;
  burn: OperationStatus;
  stake: OperationStatus;
  unstake: OperationStatus;
  claim: OperationStatus;
  transferPrimary: OperationStatus;
  transferSecondary: OperationStatus;
  transferIcp: OperationStatus;
  redeem: OperationStatus;
}

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
  distributionInterval: number | null;
  logsData: ProcessedLogsData | null;
  
  // Non-cached data
  maxLbryBurn: Number;
  spendingBalance: string;
  activeSwapPool: [string, TokenRecordStringified] | null;
  logsLoading: boolean;
  logsError: string | null;
  transactionHistory: TransactionHistoryState;
  
  // Operation states
  operations: OperationStates;
  operationErrors: Partial<Record<keyof OperationStates, ErrorMessage>>;
  
  // Global loading states for data orchestration
  isLoadingCriticalData: boolean;
  isLoadingSecondaryData: boolean;
  
  // Current tokenomics state
  tokenomicsCurrentState: TokenomicsCurrentState | null;
  tokenomicsCurrentStateLoading: boolean;
  tokenomicsCurrentStateError: string | null;
  
  // Distribution tracking
  distributionSummary: SerializedDistributionSummary | null;
  distributionEvents: SerializedDistributionEvent[];
  latestDistributionEvent: SerializedDistributionEvent | null;
  distributionLoading: boolean;
  distributionError: string | null;
}