import { createAsyncThunk } from '@reduxjs/toolkit';
import { Principal } from '@dfinity/principal';
import { RootState } from '@/store';
import { getLbryFunActor, getIcpLedgerActor, getAuthClient, getPrincipal } from '@/features/auth/utils/authUtils';
import { 
  CreateTokenParams, 
  DeploymentRecord,
  TokenStatus 
} from '@/types/deployment';
import {
  setDeployments,
  updateDeployment,
  removeDeployment,
  setActiveDeploymentId,
  setLoading
} from '@/store/slices/deploymentSlice';
import { callWithRetry } from '@/utils/networkRetry';
import { parseDeploymentError } from '@/types/errors';

// Simple persistence utilities
const DEPLOYMENT_STORAGE_PREFIX = 'lbry_deployment_';
const DEPLOYMENT_TTL = 24 * 60 * 60 * 1000; // 24 hours

const persistDeployment = (deployment: DeploymentRecord) => {
  const key = `${DEPLOYMENT_STORAGE_PREFIX}${deployment.id}`;
  
  // Convert BigInt values to strings for JSON serialization
  const serializable = {
    deployment: {
      ...deployment,
      id: deployment.id.toString(),
      deployment_id: deployment.deployment_id.toString(),
      created_at: deployment.created_at.toString(),
      last_activity: deployment.last_activity.toString(),
      token_id: deployment.token_id?.map(id => id.toString()),
      params: {
        ...deployment.params,
        primary_max_supply: deployment.params.primary_max_supply.toString(),
        initial_primary_mint: deployment.params.initial_primary_mint.toString(),
        initial_secondary_burn: deployment.params.initial_secondary_burn.toString(),
        halving_step: deployment.params.halving_step.toString(),
        initial_reward_per_burn_unit: deployment.params.initial_reward_per_burn_unit.toString(),
        distribution_interval_seconds: deployment.params.distribution_interval_seconds.toString(),
        launch_delay_seconds: deployment.params.launch_delay_seconds.toString()
      }
    },
    expires: Date.now() + DEPLOYMENT_TTL
  };
  
  localStorage.setItem(key, JSON.stringify(serializable));
};

const loadPersistedDeployments = (): DeploymentRecord[] => {
  const deployments: DeploymentRecord[] = [];
  const keys = Object.keys(localStorage).filter(k => k.startsWith(DEPLOYMENT_STORAGE_PREFIX));
  
  keys.forEach(key => {
    try {
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      if (data.expires > Date.now() && data.deployment) {
        // Convert string values back to BigInt
        const deployment = data.deployment;
        deployments.push({
          ...deployment,
          id: BigInt(deployment.id),
          deployment_id: BigInt(deployment.deployment_id),
          created_at: BigInt(deployment.created_at),
          last_activity: BigInt(deployment.last_activity),
          token_id: deployment.token_id?.map((id: string) => BigInt(id)),
          params: {
            ...deployment.params,
            primary_max_supply: BigInt(deployment.params.primary_max_supply),
            initial_primary_mint: BigInt(deployment.params.initial_primary_mint),
            initial_secondary_burn: BigInt(deployment.params.initial_secondary_burn),
            halving_step: BigInt(deployment.params.halving_step),
            initial_reward_per_burn_unit: BigInt(deployment.params.initial_reward_per_burn_unit),
            distribution_interval_seconds: BigInt(deployment.params.distribution_interval_seconds),
            launch_delay_seconds: BigInt(deployment.params.launch_delay_seconds)
          }
        });
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  });
  
  return deployments;
};

const clearPersistedDeployment = (deploymentId: string) => {
  localStorage.removeItem(`${DEPLOYMENT_STORAGE_PREFIX}${deploymentId}`);
};

// Clear all stale deployments from localStorage
export const clearStaleDeployments = () => {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(DEPLOYMENT_STORAGE_PREFIX));
  
  keys.forEach(key => {
    try {
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      // Remove if expired or malformed
      if (!data.expires || data.expires <= Date.now() || !data.deployment) {
        localStorage.removeItem(key);
      }
    } catch {
      // Remove if can't parse
      localStorage.removeItem(key);
    }
  });
};

// Initiate token deployment
export const initiateTokenDeployment = createAsyncThunk(
  'deployment/initiate',
  async (params: CreateTokenParams, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      
      // First, approve ICP for the deployment
      const lbry_fun_canister_id = process.env.CANISTER_ID_LBRY_FUN!;
      const deploymentCost = BigInt(5_0000_0000); // 5 ICP in e8s
      const approvalAmount = deploymentCost + BigInt(10000); // Add fee
      
      const actorIcpLedger = await getIcpLedgerActor();
      
      // Get user principal
      const authClient = await getAuthClient();
      const userPrincipalText = getPrincipal(authClient);
      const userPrincipal = Principal.fromText(userPrincipalText);
      
      // Check current approval
      const checkApproval = await actorIcpLedger.icrc2_allowance({
        account: { owner: userPrincipal, subaccount: [] },
        spender: {
          owner: Principal.fromText(lbry_fun_canister_id),
          subaccount: [],
        },
      });
      
      if (checkApproval.allowance < approvalAmount) {
        const resultIcpApprove = await actorIcpLedger.icrc2_approve({
          spender: {
            owner: Principal.fromText(lbry_fun_canister_id),
            subaccount: [],
          },
          amount: approvalAmount,
          fee: [BigInt(10000)],
          memo: [],
          from_subaccount: [],
          created_at_time: [],
          expected_allowance: [],
          expires_at: [],
        });
        
        if ("Err" in resultIcpApprove) {
          console.error("Error in icrc2_approve:", resultIcpApprove.Err);
          return rejectWithValue({
            title: 'Approval Failed',
            message: 'Failed to approve ICP for deployment'
          });
        }
      }
      
      const actor = await getLbryFunActor();
      console.log('Initiating token deployment with params:', params);
      
      const result = await callWithRetry(() => 
        actor.initiate_token_deployment(params)
      );
      
      console.log('Deployment initiation result:', result);
      
      if ('Ok' in result) {
        const deploymentId = result.Ok;
        
        // Create initial deployment record
        const deployment: DeploymentRecord = {
          id: deploymentId,
          deployment_id: deploymentId,
          tokenStatus: { Deploying: { progress: 0 } },
          params,
          created_at: BigInt(Date.now()) * 1_000_000n,
          last_activity: BigInt(Date.now()) * 1_000_000n,
          token_id: []
        };
        
        dispatch(updateDeployment(deployment));
        dispatch(setActiveDeploymentId(deploymentId.toString()));
        persistDeployment(deployment);
        
        // Store active deployment ID
        localStorage.setItem('activeDeploymentId', deploymentId.toString());
        
        return deploymentId.toString();
      } else {
        const parsedError = parseDeploymentError(result.Err);
        return rejectWithValue(parsedError);
      }
    } catch (error) {
      console.error('Deployment initiation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return rejectWithValue({
        title: 'Deployment Failed',
        message: `Failed to initiate deployment: ${errorMessage}`
      });
    } finally {
      dispatch(setLoading(false));
    }
  }
);

// Execute token deployment
export const executeTokenDeployment = createAsyncThunk(
  'deployment/execute',
  async (deploymentId: string, { dispatch, rejectWithValue }) => {
    try {
      const actor = await getLbryFunActor();
      console.log('Executing token deployment for ID:', deploymentId);
      
      const result = await callWithRetry(() => 
        actor.execute_token_deployment(BigInt(deploymentId))
      );
      
      console.log('Deployment execution result:', result);
      
      if ('Ok' in result) {
        // Start polling for status
        dispatch(pollDeploymentStatus(deploymentId));
        return result.Ok;
      } else {
        // If it's a timeout or still processing, start polling
        if (result.Err.includes('timeout') || result.Err.includes('still processing')) {
          dispatch(pollDeploymentStatus(deploymentId));
          
          return rejectWithValue({
            title: 'Deployment In Progress',
            message: 'Deployment is taking longer than expected. Monitoring status...',
            isTimeout: true
          });
        }
        
        const parsedError = parseDeploymentError(result.Err);
        return rejectWithValue(parsedError);
      }
    } catch (error) {
      console.error('Deployment execution error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return rejectWithValue({
        title: 'Execution Error',
        message: `Failed to execute deployment: ${errorMessage}`
      });
    }
  }
);

// Proper polling that checks token status
export const pollDeploymentStatus = createAsyncThunk(
  'deployment/poll',
  async (deploymentId: string, { dispatch, getState }) => {
    const actor = await getLbryFunActor();
    const state = getState() as RootState;
    const deployment = state.deployment.deployments[deploymentId];
    
    if (!deployment) return;
    
    try {
      let updatedDeployment: DeploymentRecord;
      
      // Phase 1: No token_id yet, poll deployment status
      if (!deployment.token_id || deployment.token_id.length === 0) {
        const deployments = await actor.get_my_deployments();
        const backendDeployment = deployments.find(d => d.id.toString() === deploymentId);
        
        if (!backendDeployment) return;
        
        // Convert deployment status to token status
        const deploymentStatus = backendDeployment.status;
        let tokenStatus: TokenStatus;
        
        if (deploymentStatus === 'Active') {
          tokenStatus = {
            Deploying: {
              progress: Math.floor((Number(backendDeployment.canister_count) / 5) * 80)
            }
          };
        } else if (deploymentStatus === 'Failed') {
          tokenStatus = {
            Failed: {
              reason: backendDeployment.last_error?.[0] || 'Deployment failed'
            }
          };
        } else if (deploymentStatus === 'Cleaning') {
          tokenStatus = {
            Failed: {
              reason: 'Deployment is being cleaned up due to failure'
            }
          };
        } else if (deploymentStatus === 'Completed') {
          // Deployment completed successfully
          if (backendDeployment.token_id?.[0]) {
            // Fetch actual token status
            const status = await actor.get_token_status(backendDeployment.token_id[0]);
            tokenStatus = status;
          } else {
            // Shouldn't happen - completed without token
            tokenStatus = {
              Failed: {
                reason: 'Deployment completed but no token created'
              }
            };
          }
        } else {
          // Unknown status
          tokenStatus = {
            Failed: {
              reason: `Unknown deployment status: ${deploymentStatus}`
            }
          };
        }
        
        updatedDeployment = {
          ...deployment,
          tokenStatus,
          token_id: backendDeployment.token_id
        };
      } else {
        // Phase 2: Have token_id, poll token status directly
        const tokenStatus = await actor.get_token_status(deployment.token_id[0]);
        updatedDeployment = {
          ...deployment,
          tokenStatus
        };
      }
      
      // Update store and persist
      dispatch(updateDeployment(updatedDeployment));
      persistDeployment(updatedDeployment);
      
      // Continue polling if still deploying
      if ('Deploying' in updatedDeployment.tokenStatus) {
        setTimeout(() => {
          dispatch(pollDeploymentStatus(deploymentId));
        }, 5000); // Poll every 5 seconds
      } else {
        // Deployment finished (success or failure)
        if ('Live' in updatedDeployment.tokenStatus) {
          // Clear active deployment on success
          dispatch(setActiveDeploymentId(null));
          localStorage.removeItem('activeDeploymentId');
        }
      }
      
    } catch (error) {
      console.error('Polling error for deployment', deploymentId, ':', error);
      // Retry after delay
      setTimeout(() => {
        dispatch(pollDeploymentStatus(deploymentId));
      }, 10000);
    }
  }
);

// Initialize persisted deployments on app load
export const initializeDeployments = createAsyncThunk(
  'deployment/initialize',
  async (_, { dispatch }) => {
    // First load persisted deployments
    const persistedDeployments = loadPersistedDeployments();
    
    // Then sync with backend to get actual status
    try {
      const actor = await getLbryFunActor();
      const backendDeployments = await actor.get_my_deployments();
      
      // Update persisted deployments with backend status
      const syncedDeployments = persistedDeployments.map(persisted => {
        const backend = backendDeployments.find(d => d.id.toString() === persisted.id.toString());
        
        if (!backend) {
          // Deployment doesn't exist in backend
          // Check if this might be a completed deployment by looking for the token ID
          if (persisted.token_id && persisted.token_id.length > 0) {
            // This was likely a successful deployment that was cleaned up
            // Remove it from localStorage
            clearPersistedDeployment(persisted.id.toString());
            return null; // Filter this out
          }
          // Otherwise mark as unknown
          return {
            ...persisted,
            tokenStatus: { Failed: { reason: 'Unknown deployment - may have been cleaned up' } } as TokenStatus
          };
        }
        
        // Check if this is a stuck deployment (initiated but never executed)
        if (backend.status === 'Active' && backend.canister_count === 0n && 
            'Deploying' in persisted.tokenStatus && persisted.tokenStatus.Deploying.progress === 0) {
          // This deployment was initiated but never executed
          return {
            ...persisted,
            tokenStatus: { Failed: { reason: 'Deployment was initiated but never executed. You can either continue or cancel it.' } } as TokenStatus
          };
        }
        
        // Otherwise sync the status
        let tokenStatus: TokenStatus;
        if (backend.status === 'Active') {
          tokenStatus = {
            Deploying: {
              progress: Math.floor((Number(backend.canister_count) / 5) * 80)
            }
          };
        } else if (backend.status === 'Failed') {
          tokenStatus = {
            Failed: {
              reason: backend.last_error?.[0] || 'Deployment failed'
            }
          };
        } else if (backend.status === 'Cleaning') {
          tokenStatus = {
            Failed: {
              reason: 'Deployment is being cleaned up due to failure'
            }
          };
        } else if (backend.status === 'Completed' && backend.token_id?.[0]) {
          // Completed - fetch actual token status
          return persisted; // Will be updated by pollDeploymentStatus
        } else {
          tokenStatus = {
            Failed: {
              reason: `Unknown deployment state: ${backend.status}`
            }
          };
        }
        
        return {
          ...persisted,
          tokenStatus,
          token_id: backend.token_id
        };
      });
      
      // Filter out null values (completed deployments that were cleaned up)
      const validDeployments = syncedDeployments.filter(d => d !== null) as DeploymentRecord[];
      
      dispatch(setDeployments(validDeployments));
      
      // Resume polling for active deployments
      validDeployments.forEach(deployment => {
        if ('Deploying' in deployment.tokenStatus) {
          dispatch(pollDeploymentStatus(deployment.id.toString()));
        }
      });
    } catch (error) {
      console.error('Failed to sync with backend:', error);
      // Fall back to persisted deployments
      dispatch(setDeployments(persistedDeployments));
      
      // Still resume polling
      persistedDeployments.forEach(deployment => {
        if ('Deploying' in deployment.tokenStatus) {
          dispatch(pollDeploymentStatus(deployment.id.toString()));
        }
      });
    }
    
    // Check for active deployment ID
    const activeDeploymentId = localStorage.getItem('activeDeploymentId');
    if (activeDeploymentId) {
      dispatch(setActiveDeploymentId(activeDeploymentId));
    }
  }
);

// Recovery mechanism
export const recoverDeployment = createAsyncThunk(
  'deployment/recover',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const actor = await getLbryFunActor();
      const result = await callWithRetry(() => 
        actor.recover_stuck_deployment()
      );
      
      if ('Ok' in result) {
        // Refresh deployments after recovery
        dispatch(fetchDeploymentHistory());
        
        return result.Ok;
      } else {
        return rejectWithValue({
          title: 'Recovery Failed',
          message: result.Err
        });
      }
    } catch (error) {
      return rejectWithValue({
        title: 'Recovery Error',
        message: 'Failed to recover deployment'
      });
    }
  }
);

// Fetch deployment history (used for manual refresh)
export const fetchDeploymentHistory = createAsyncThunk(
  'deployment/fetchHistory',
  async (_, { dispatch }) => {
    try {
      const actor = await getLbryFunActor();
      const deployments = await callWithRetry(() => 
        actor.get_my_deployments()
      );
      
      // For each deployment, get the actual token status if it has a token_id
      const updatedDeployments: DeploymentRecord[] = await Promise.all(
        deployments.map(async (deployment) => {
          let tokenStatus: TokenStatus;
          
          if (deployment.token_id?.[0]) {
            // Has token, get its status
            try {
              tokenStatus = await actor.get_token_status(deployment.token_id[0]);
            } catch {
              // Error fetching token status
              tokenStatus = { Failed: { reason: 'Failed to fetch token status' } };
            }
          } else if (deployment.status === 'Active') {
            // Still deploying
            tokenStatus = {
              Deploying: {
                progress: Math.floor((Number(deployment.canister_count) / 5) * 80)
              }
            };
          } else if (deployment.status === 'Failed') {
            // Failed deployment
            tokenStatus = {
              Failed: {
                reason: deployment.last_error?.[0] || 'Deployment failed'
              }
            };
          } else if (deployment.status === 'Cleaning') {
            // Being cleaned up
            tokenStatus = {
              Failed: {
                reason: deployment.last_error?.[0] || 'Deployment is being cleaned up'
              }
            };
          } else if (deployment.status === 'Completed') {
            // Completed but no token_id - shouldn't happen
            tokenStatus = { Failed: { reason: 'Deployment completed but no token created' } };
          } else {
            // Unknown state
            console.error('Unknown deployment status:', deployment.status);
            tokenStatus = { Failed: { reason: `Unknown deployment state: ${deployment.status}` } };
          }
          
          // Try to get params from persisted deployment
          const persistedDeployments = loadPersistedDeployments();
          const persistedDeployment = persistedDeployments.find(d => d.id.toString() === deployment.id.toString());
          
          return {
            id: deployment.id,
            deployment_id: deployment.id,
            tokenStatus,
            params: persistedDeployment?.params || {} as CreateTokenParams,
            created_at: deployment.created_at,
            last_activity: deployment.last_activity,
            token_id: deployment.token_id
          };
        })
      );
      
      dispatch(setDeployments(updatedDeployments));
      
      return updatedDeployments;
    } catch (error) {
      throw new Error('Failed to fetch deployment history');
    }
  }
);

// Clean up completed/failed deployments
export const cleanupDeployment = createAsyncThunk(
  'deployment/cleanup',
  async (deploymentId: string, { dispatch }) => {
    dispatch(removeDeployment(deploymentId));
    clearPersistedDeployment(deploymentId);
  }
);