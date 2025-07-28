export enum DeploymentStatus {
  INITIATED = 'initiated',
  EXECUTING = 'executing', 
  POLLING = 'polling',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RECOVERABLE = 'recoverable'
}

export interface CreateTokenParams {
  primary_token_name: string;
  primary_token_symbol: string;
  primary_token_description: string;
  primary_logo: string;
  secondary_token_name: string;
  secondary_token_symbol: string;
  secondary_token_description: string;
  secondary_logo: string;
  primary_max_supply: bigint;
  initial_primary_mint: bigint;
  initial_secondary_burn: bigint;
  halving_step: bigint;
  threshold_multiplier: number;
  initial_reward_per_burn_unit: bigint;
  distribution_interval_seconds: bigint;
  launch_delay_seconds: bigint;
}

export interface DeploymentInfo {
  id: bigint;
  status: string;
  token_id: [] | [bigint];
  canister_count: bigint;
  cleanup_progress: number;
  last_error: [] | [string];
  created_at: bigint;
  last_activity: bigint;
  failed_at: [] | [bigint];
}

export interface TokenDeploymentResult {
  token_id: bigint;
  message: string;
}

export interface DeploymentRecord extends DeploymentInfo {
  frontendStatus: DeploymentStatus;
  lastChecked: number;
  recoverable: boolean;
  params?: CreateTokenParams;
}