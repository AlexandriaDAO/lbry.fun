import { createAsyncThunk } from '@reduxjs/toolkit';
import { Principal } from '@dfinity/principal';
import { RootState } from '@/store';
import { getLbryFunActor, getIcpLedgerActor, getAuthClient, getPrincipal } from '@/features/auth/utils/authUtils';
import { 
  DeploymentStatus, 
  CreateTokenParams, 
  DeploymentRecord 
} from '@/types/deployment';
import {
  setActiveDeployment,
  updateDeployment,
  setDeploymentStatus,
  clearActiveDeployment,
  setPollingInterval,
  incrementPollAttempts,
  setError
} from '@/store/slices/deploymentSlice';
import { callWithRetry } from '@/utils/networkRetry';
import { parseDeploymentError } from '@/types/errors';

const POLL_INTERVALS = [2000, 5000, 10000, 15000, 30000];

export const initiateTokenDeployment = createAsyncThunk(
  'deployment/initiate',
  async (params: CreateTokenParams, { dispatch, rejectWithValue }) => {
    try {
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
      const result = await callWithRetry(() => 
        actor.initiate_token_deployment(params)
      );
      
      if ('Ok' in result) {
        const deploymentId = result.Ok.toString();
        
        localStorage.setItem('activeDeploymentId', deploymentId);
        
        const deployment: DeploymentRecord = {
          id: result.Ok,
          status: 'active',
          token_id: [],
          canister_count: 0n,
          cleanup_progress: 0,
          last_error: [],
          created_at: BigInt(Date.now()) * 1_000_000n,
          last_activity: BigInt(Date.now()) * 1_000_000n,
          failed_at: [],
          frontendStatus: DeploymentStatus.INITIATED,
          lastChecked: Date.now(),
          recoverable: false,
          params
        };
        
        dispatch(updateDeployment(deployment));
        dispatch(setActiveDeployment(deploymentId));
        
        return deploymentId;
      } else {
        const parsedError = parseDeploymentError(result.Err);
        return rejectWithValue(parsedError);
      }
    } catch (error) {
      return rejectWithValue({
        title: 'Network Error',
        message: 'Failed to connect to the network'
      });
    }
  }
);

export const executeTokenDeployment = createAsyncThunk(
  'deployment/execute',
  async (deploymentId: string, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setDeploymentStatus({ 
        id: deploymentId, 
        status: DeploymentStatus.EXECUTING 
      }));
      
      const actor = await getLbryFunActor();
      const result = await callWithRetry(() => 
        actor.execute_token_deployment(BigInt(deploymentId))
      );
      
      if ('Ok' in result) {
        dispatch(setDeploymentStatus({ 
          id: deploymentId, 
          status: DeploymentStatus.COMPLETED 
        }));
        
        dispatch(clearActiveDeployment());
        
        return result.Ok;
      } else {
        if (result.Err.includes('timeout') || result.Err.includes('still processing')) {
          dispatch(setDeploymentStatus({ 
            id: deploymentId, 
            status: DeploymentStatus.POLLING,
            error: result.Err
          }));
          
          dispatch(pollDeploymentStatus(deploymentId));
          
          return rejectWithValue({
            title: 'Deployment In Progress',
            message: 'Deployment is taking longer than expected. Monitoring status...',
            isTimeout: true
          });
        }
        
        dispatch(setDeploymentStatus({ 
          id: deploymentId, 
          status: DeploymentStatus.FAILED,
          error: result.Err
        }));
        
        const parsedError = parseDeploymentError(result.Err);
        return rejectWithValue(parsedError);
      }
    } catch (error) {
      return rejectWithValue({
        title: 'Execution Error',
        message: 'Failed to execute deployment'
      });
    }
  }
);

export const pollDeploymentStatus = createAsyncThunk(
  'deployment/poll',
  async (deploymentId: string, { dispatch, getState }) => {
    let pollIndex = 0;
    
    const poll = async () => {
      try {
        const state = getState() as RootState;
        
        if (state.deployment.pollAttempts >= state.deployment.maxPollAttempts) {
          dispatch(setPollingInterval(null));
          dispatch(setDeploymentStatus({
            id: deploymentId,
            status: DeploymentStatus.FAILED,
            error: 'Polling timeout exceeded. Please try recovery.'
          }));
          return;
        }
        
        dispatch(incrementPollAttempts());
        
        const actor = await getLbryFunActor();
        const deployments = await callWithRetry(() => 
          actor.get_my_deployments()
        );
        
        const deployment = deployments.find(d => d.id.toString() === deploymentId);
        
        if (deployment) {
          const record: DeploymentRecord = {
            ...deployment,
            frontendStatus: DeploymentStatus.POLLING,
            lastChecked: Date.now(),
            recoverable: false
          };
          
          dispatch(updateDeployment(record));
          
          if (deployment.status === 'completed') {
            dispatch(setPollingInterval(null));
            dispatch(setDeploymentStatus({
              id: deploymentId,
              status: DeploymentStatus.COMPLETED
            }));
            dispatch(clearActiveDeployment());
          } else if (deployment.status === 'failed') {
            dispatch(setPollingInterval(null));
            
            const timeSinceActivity = Date.now() - Number(deployment.last_activity / 1_000_000n);
            const isRecoverable = timeSinceActivity > 5 * 60 * 1000;
            
            dispatch(setDeploymentStatus({
              id: deploymentId,
              status: isRecoverable ? DeploymentStatus.RECOVERABLE : DeploymentStatus.FAILED,
              error: deployment.last_error?.[0] || 'Deployment failed'
            }));
          }
        }
        
        if (state.deployment.pollingInterval) {
          const nextPollDelay = POLL_INTERVALS[Math.min(pollIndex, POLL_INTERVALS.length - 1)];
          pollIndex++;
          
          const timeoutId = setTimeout(poll, nextPollDelay);
          dispatch(setPollingInterval(timeoutId as unknown as NodeJS.Timeout));
        }
      } catch (error) {
        console.error('Polling error:', error);
        const state = getState() as RootState;
        if (state.deployment.pollingInterval) {
          const timeoutId = setTimeout(poll, 5000);
          dispatch(setPollingInterval(timeoutId as unknown as NodeJS.Timeout));
        }
      }
    };
    
    poll();
  }
);

export const recoverDeployment = createAsyncThunk(
  'deployment/recover',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const actor = await getLbryFunActor();
      const result = await callWithRetry(() => 
        actor.recover_stuck_deployment()
      );
      
      if ('Ok' in result) {
        const deployments = await actor.get_my_deployments();
        const activeDeployment = deployments.find(d => d.status === 'active');
        
        if (activeDeployment) {
          const deploymentId = activeDeployment.id.toString();
          dispatch(setActiveDeployment(deploymentId));
          
          return dispatch(executeTokenDeployment(deploymentId));
        }
        
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

export const fetchDeploymentHistory = createAsyncThunk(
  'deployment/fetchHistory',
  async (_, { dispatch }) => {
    try {
      const actor = await getLbryFunActor();
      const deployments = await callWithRetry(() => 
        actor.get_my_deployments()
      );
      
      deployments.forEach(deployment => {
        const record: DeploymentRecord = {
          ...deployment,
          frontendStatus: deployment.status === 'active' ? DeploymentStatus.EXECUTING :
                         deployment.status === 'completed' ? DeploymentStatus.COMPLETED :
                         DeploymentStatus.FAILED,
          lastChecked: Date.now(),
          recoverable: false
        };
        
        if (deployment.status === 'failed') {
          const timeSinceActivity = Date.now() - Number(deployment.last_activity / 1_000_000n);
          record.recoverable = timeSinceActivity > 5 * 60 * 1000;
          if (record.recoverable) {
            record.frontendStatus = DeploymentStatus.RECOVERABLE;
          }
        }
        
        dispatch(updateDeployment(record));
      });
      
      return deployments;
    } catch (error) {
      throw new Error('Failed to fetch deployment history');
    }
  }
);