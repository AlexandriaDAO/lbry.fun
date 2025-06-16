// Normalized swap state types
export interface TokenBalance {
  primary: {
    balance: string;
    fee: string;
    priceUsd: string;
  };
  secondary: {
    balance: string;
    fee: string; 
    ratio: string;
  };
  icp: {
    balance: string;
    archivedBalance: string;
  };
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

export interface LoadingStates {
  balances: boolean;
  swap: boolean;
  burn: boolean;
  stake: boolean;
  unstake: boolean;
  transfer: boolean;
  claim: boolean;
  redeem: boolean;
  logs: boolean;
}

export interface SuccessStates {
  swap: boolean;
  burn: boolean;
  stake: boolean;
  unstake: boolean;
  transfer: boolean;
  claim: boolean;
  redeem: boolean;
}

export interface ErrorState {
  message: string;
  title: string;
}

export interface ProcessedLogsData {
  // Add proper type definition based on actual logs structure
  [key: string]: any;
}

export interface TokenRecordStringified {
  primary_token_logo_base64?: string;
  secondary_token_logo_base64?: string;
  [key: string]: any;
}

// Main normalized swap state
export interface NormalizedSwapState {
  balances: TokenBalance;
  staking: {
    userStake: StakeInfo;
    totalStaked: string;
    totalStakers: string;
    averageAPY: number;
  };
  canisterStats: CanisterArchived;
  tokenomics: {
    primaryMintRate: string;
    maxBurnAllowed: Number;
  };
  ui: {
    loading: LoadingStates;
    success: SuccessStates;
    error: ErrorState | null;
  };
  logs: {
    data: ProcessedLogsData | null;
    loading: boolean;
    error: string | null;
  };
  activePool: [string, TokenRecordStringified] | null;
  spendingBalance: string;
}