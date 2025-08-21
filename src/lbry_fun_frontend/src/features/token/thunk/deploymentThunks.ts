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
      last_error: deployment.last_error, // Include last_error if present
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
          last_error: deployment.last_error, // Preserve last_error if present
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
        
        // Don't store in localStorage - we'll use URL params instead
        
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
  async (deploymentId: string, { dispatch, getState, rejectWithValue }) => {
    try {
      const actor = await getLbryFunActor();
      console.log('Executing token deployment for ID:', deploymentId);
      
      const result = await callWithRetry(() => 
        actor.execute_token_deployment(BigInt(deploymentId))
      );
      
      console.log('Deployment execution result:', result);
      
      if ('Ok' in result) {
        // Execution succeeded - we have the token_id!
        const { token_id, message } = result.Ok;
        console.log('Deployment executed successfully! Token ID:', token_id.toString(), 'Message:', message);
        
        // Get the deployment from state
        const state = getState() as RootState;
        const deployment = state.deployment.deployments[deploymentId];
        
        if (deployment) {
          // Fetch the token status immediately
          try {
            const tokenStatus = await actor.get_token_status(token_id);
            
            // Update deployment with token info
            const updatedDeployment: DeploymentRecord = {
              ...deployment,
              tokenStatus: 'Ok' in tokenStatus ? tokenStatus.Ok : { Live: { pool_id: "unknown" } },
              token_id: [token_id]
            };
            
            dispatch(updateDeployment(updatedDeployment));
            persistDeployment(updatedDeployment);
            
            // If live, force a full refresh to sync all deployments
            if ('Ok' in tokenStatus && 'Live' in tokenStatus.Ok) {
              // Force a full refresh to sync all deployments
              setTimeout(() => {
                dispatch(initializeDeployments());
              }, 1000);
            }
          } catch (error) {
            console.error('Failed to fetch token status:', error);
            // Still update with token_id even if status fetch fails
            const updatedDeployment: DeploymentRecord = {
              ...deployment,
              tokenStatus: { Live: { pool_id: "unknown" } },
              token_id: [token_id]
            };
            dispatch(updateDeployment(updatedDeployment));
            persistDeployment(updatedDeployment);
          }
        }
        
        // Check status once after a delay to ensure backend has updated
        setTimeout(() => {
          dispatch(checkDeploymentOnce(deploymentId));
        }, 5000); // 5 second delay
        
        return result.Ok;
      } else {
        // If it's a timeout or still processing, check once after delay
        if (result.Err.includes('timeout') || result.Err.includes('still processing')) {
          setTimeout(() => {
            dispatch(checkDeploymentOnce(deploymentId));
          }, 5000);
          
          return rejectWithValue({
            title: 'Deployment In Progress',
            message: 'Deployment is taking longer than expected. Will check status shortly...',
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

// Check deployment status once (no continuous polling)
export const checkDeploymentOnce = createAsyncThunk(
  'deployment/checkOnce',
  async (deploymentId: string, { dispatch, getState }) => {
    const actor = await getLbryFunActor();
    const state = getState() as RootState;
    const deployment = state.deployment.deployments[deploymentId];
    
    if (!deployment) {
      return;
    }
    
    try {
      let updatedDeployment: DeploymentRecord;
      
      // Phase 1: No token_id yet, poll deployment status
      if (!deployment.token_id || deployment.token_id.length === 0) {
        const deployments = await actor.get_my_deployments();
        const backendDeployment = deployments.find(d => d.id.toString() === deploymentId);
        
        if (!backendDeployment) {
          // Deployment not found - it might have completed and been cleaned up
          // Check if a token was created by looking at all tokens
          const allTokens = await actor.get_all_token_record();
          
          // Look for a token created by this user around the same time
          const userPrincipal = await getPrincipal(await getAuthClient());
          const matchingToken = allTokens.find(([_, record]) => {
            // Match by caller and creation time (within 5 minutes)
            const timeDiff = Math.abs(Number(record.created_time) - Number(deployment.created_at));
            return record.caller.toString() === userPrincipal && 
                   timeDiff < 5 * 60 * 1_000_000_000; // 5 minutes in nanoseconds
          });
          
          if (matchingToken) {
            // Token found! Update deployment as successful
            const [tokenId, tokenRecord] = matchingToken;
            
            updatedDeployment = {
              ...deployment,
              tokenStatus: tokenRecord.status,
              token_id: [tokenId],
              // Update params with actual token info if they're missing
              params: deployment.params.primary_token_name ? deployment.params : {
                ...deployment.params,
                primary_token_name: tokenRecord.primary_token_name,
                primary_token_symbol: tokenRecord.primary_token_symbol,
                secondary_token_name: tokenRecord.secondary_token_name,
                secondary_token_symbol: tokenRecord.secondary_token_symbol,
              }
            };
            
            // Update and stop polling
            dispatch(updateDeployment(updatedDeployment));
            persistDeployment(updatedDeployment);
            
            // Token is now live - modal will handle cleanup when closed
            return;
          }
          
          // No token found and no deployment - mark as failed
          updatedDeployment = {
            ...deployment,
            tokenStatus: { 
              Failed: { 
                reason: 'Deployment not found and no token created' 
              } 
            } as TokenStatus
          };
          
          dispatch(updateDeployment(updatedDeployment));
          persistDeployment(updatedDeployment);
          return;
        }
        
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
          token_id: backendDeployment.token_id,
          last_error: backendDeployment.last_error,
          last_activity: backendDeployment.last_activity
        };
      } else {
        // Phase 2: Have token_id, poll token status directly
        const tokenStatusResult = await actor.get_token_status(deployment.token_id[0]);
        
        // Handle the Result type from backend
        let tokenStatus: TokenStatus;
        if ('Ok' in tokenStatusResult) {
          tokenStatus = tokenStatusResult.Ok;
        } else {
          tokenStatus = { 
            Failed: { 
              reason: tokenStatusResult.Err || 'Failed to fetch token status' 
            } 
          } as TokenStatus;
        }
        
        updatedDeployment = {
          ...deployment,
          tokenStatus
        };
      }
      
      // Update store and persist
      dispatch(updateDeployment(updatedDeployment));
      persistDeployment(updatedDeployment);
      
      // No more continuous polling - just update the status once
      
    } catch (error) {
      console.error('Error checking deployment', deploymentId, ':', error);
      // Don't retry - just log the error
    }
  }
);

// Initialize persisted deployments on app load
export const initializeDeployments = createAsyncThunk(
  'deployment/initialize',
  async (_, { dispatch }) => {
    // One-time clear of old wrapped formats (can be removed after first deployment)
    const needsClear = localStorage.getItem('deployment_format_cleaned') !== 'v2';
    if (needsClear) {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(DEPLOYMENT_STORAGE_PREFIX));
      keys.forEach(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          // Check if it has the old wrapped format
          if (data.deployment?.tokenStatus && typeof data.deployment.tokenStatus === 'object' && 
              ('Ok' in data.deployment.tokenStatus || 'Err' in data.deployment.tokenStatus)) {
            localStorage.removeItem(key);
          }
        } catch {
          // Invalid JSON, remove it
          localStorage.removeItem(key);
        }
      });
      localStorage.setItem('deployment_format_cleaned', 'v2');
    }
    
    // First load persisted deployments
    const persistedDeployments = loadPersistedDeployments();
    
    // Then sync with backend to get actual status
    try {
      const actor = await getLbryFunActor();
      const backendDeployments = await actor.get_my_deployments();
      const allTokens = await actor.get_all_token_record();
      const userPrincipal = await getPrincipal(await getAuthClient());
      
      // Update persisted deployments with backend status
      const syncedDeployments = await Promise.all(persistedDeployments.map(async persisted => {
        const backend = backendDeployments.find(d => d.id.toString() === persisted.id.toString());
        
        if (!backend) {
          // Deployment doesn't exist in backend
          
          // First check if we already have a token_id (completed deployment)
          if (persisted.token_id && persisted.token_id.length > 0) {
            // Try to find the token in allTokens
            const token = allTokens.find(([id]) => id === persisted.token_id![0]);
            if (token) {
              // Token exists, update status
              const [tokenId, tokenRecord] = token;
              return {
                ...persisted,
                tokenStatus: tokenRecord.status,
                token_id: [tokenId]
              };
            }
            // Token doesn't exist anymore, clean up
            clearPersistedDeployment(persisted.id.toString());
            return null;
          }
          
          // No token_id yet - check if a token was created by matching user/time
          const matchingToken = allTokens.find(([_, record]) => {
            const timeDiff = Math.abs(Number(record.created_time) - Number(persisted.created_at));
            return record.caller.toString() === userPrincipal && 
                   timeDiff < 5 * 60 * 1_000_000_000; // 5 minutes
          });
          
          if (matchingToken) {
            // Found a matching token!
            const [tokenId, tokenRecord] = matchingToken;
            return {
              ...persisted,
              tokenStatus: tokenRecord.status,
              token_id: [tokenId],
              // Update params with actual token info
              params: {
                ...persisted.params,
                primary_token_name: tokenRecord.primary_token_name,
                primary_token_symbol: tokenRecord.primary_token_symbol,
                secondary_token_name: tokenRecord.secondary_token_name,
                secondary_token_symbol: tokenRecord.secondary_token_symbol,
              }
            };
          }
          
          // No matching token found - mark as unknown
          return {
            ...persisted,
            tokenStatus: { Failed: { reason: 'Deployment not found - may have failed or been cleaned up' } } as TokenStatus
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
          token_id: backend.token_id,
          last_error: backend.last_error,
          last_activity: backend.last_activity
        };
      }));
      
      // Filter out null values (completed deployments that were cleaned up)
      const validDeployments = syncedDeployments.filter(d => d !== null) as DeploymentRecord[];
      
      dispatch(setDeployments(validDeployments));
      
      // No automatic polling - deployments will check status when needed
    } catch (error) {
      console.error('Failed to sync with backend:', error);
      // Fall back to persisted deployments
      dispatch(setDeployments(persistedDeployments));
      
      // No automatic polling on error either
    }
    
    // Don't restore activeDeploymentId on app init to prevent unwanted redirects
    // The deployment page will set it explicitly when needed
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
    // Use the same logic as initializeDeployments to sync properly
    dispatch(initializeDeployments());
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