import { Principal } from '@dfinity/principal';

// Token creation parameters
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

// Backend deployment info (from get_my_deployments)
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

// TokenStatus type matching backend (simplified - no backwards compatibility)
export type TokenStatus = 
  | { Deploying: { progress: number } }
  | { Failed: { reason: string } }
  | { Live: { pool_id: string } };

// Simplified deployment record - NO frontendStatus
export interface DeploymentRecord {
  id: bigint;
  deployment_id: bigint;
  tokenStatus: TokenStatus;         // ONLY backend status
  params: CreateTokenParams;
  created_at: bigint;
  last_activity: bigint;
  token_id?: bigint[];
}

// UI State derived from TokenStatus
export interface UIDeploymentState {
  status: 'deploying' | 'failed' | 'live';
  progress: number;
  message: string;
  isRecoverable: boolean;
  canTrade: boolean;
}

// Derive UI state instead of storing it
export function getUIState(tokenStatus: TokenStatus): UIDeploymentState {
  if ('Deploying' in tokenStatus) {
    return {
      status: 'deploying',
      progress: tokenStatus.Deploying.progress,
      message: 'Deployment in progress...',
      isRecoverable: false,
      canTrade: false
    };
  }
  
  if ('Failed' in tokenStatus) {
    const isPoolFailure = tokenStatus.Failed.reason.includes('Pool creation');
    const isCleaningUp = tokenStatus.Failed.reason.includes('being cleaned');
    const isUnknownStatus = tokenStatus.Failed.reason.includes('Unknown deployment state');
    const isNotFound = tokenStatus.Failed.reason.includes('Deployment not found');
    const isStuck = tokenStatus.Failed.reason.includes('initiated but never executed');
    
    return {
      status: 'failed',
      progress: 0,
      message: isPoolFailure 
        ? 'Pool creation failed - deployment incomplete' 
        : isCleaningUp
        ? 'Deployment failed and is being cleaned up. You can recover funds shortly.'
        : isUnknownStatus
        ? 'This deployment has been cleaned up'
        : isNotFound
        ? 'Deployment not found - may have completed or been cleaned up'
        : isStuck
        ? 'Deployment was initiated but never executed. You can either continue or cancel it.'
        : tokenStatus.Failed.reason,
      isRecoverable: !isUnknownStatus && !isNotFound, // Can't recover if cleaned up or not found
      canTrade: false
    };
  }
  
  if ('Live' in tokenStatus) {
    // Token is live - launch time check happens in backend
    return {
      status: 'live',
      progress: 100,
      message: 'Token is live!',
      isRecoverable: false,
      canTrade: true
    };
  }
  
  // Should never reach here
  return {
    status: 'failed',
    progress: 0,
    message: 'Unknown status',
    isRecoverable: false,
    canTrade: false
  };
}


// Result type for token deployment
export interface TokenDeploymentResult {
  token_id: bigint;
  message: string;
}