# Frontend Recovery Plan V2 - Clean Architecture

## Overview

This plan implements a resilient two-phase deployment system for token creation, ensuring users never lose funds if deployment fails. The system separates payment from execution and provides robust recovery mechanisms.

## Architecture Overview

The new system implements:
1. **Two-phase deployment**: Payment (phase 1) returns ID immediately, execution (phase 2) happens async
2. **Persistent state**: LocalStorage ensures deployments survive page refreshes
3. **Automatic recovery**: Smart polling and recovery mechanisms
4. **Dedicated deployment management**: Full deployment history and status tracking

## Essential Improvements

These improvements can be implemented immediately with minimal complexity:

1. **Smarter Polling** - Progressive intervals instead of fixed 5-second polling
2. **Visual Progress** - Show canister creation progress (backend already provides data)
3. **Recovery Countdown** - Display time remaining until recovery is available
4. **Clear Cost Display** - Show exact ICP amounts and refund policy upfront
5. **Simple Network Retry** - Basic retry logic for transient network failures

## Phase 1: Foundational Setup

### 1. Define Data Structures (`types/deployment.ts`)

```typescript
// Deployment status enum for clear state management
export enum DeploymentStatus {
  INITIATED = 'initiated',
  EXECUTING = 'executing', 
  POLLING = 'polling',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RECOVERABLE = 'recoverable'
}

// Mirror backend types
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

// Extended deployment info for frontend state
export interface DeploymentRecord extends DeploymentInfo {
  frontendStatus: DeploymentStatus;
  lastChecked: number;
  recoverable: boolean;
  params?: CreateTokenParams; // Store original params for retry
}
```

### 2. Redux State Management (`store/deploymentSlice.ts`)

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DeploymentRecord, DeploymentStatus } from '@/types/deployment';

interface DeploymentState {
  // All deployments keyed by ID
  deployments: Record<string, DeploymentRecord>;
  
  // Currently active deployment
  activeDeploymentId: string | null;
  
  // Overall deployment flow status
  status: 'idle' | 'initiating' | 'executing' | 'polling' | 'recovering' | 'completed' | 'failed';
  
  // Current error if any
  error: { title: string; message: string } | null;
  
  // Polling state
  pollingInterval: NodeJS.Timeout | null;
  pollAttempts: number;
  maxPollAttempts: 60; // 5 minutes at 5 second intervals
}

const initialState: DeploymentState = {
  deployments: {},
  activeDeploymentId: null,
  status: 'idle',
  error: null,
  pollingInterval: null,
  pollAttempts: 0,
  maxPollAttempts: 60
};

const deploymentSlice = createSlice({
  name: 'deployment',
  initialState,
  reducers: {
    setActiveDeployment: (state, action: PayloadAction<string>) => {
      state.activeDeploymentId = action.payload;
      state.error = null;
    },
    
    updateDeployment: (state, action: PayloadAction<DeploymentRecord>) => {
      const id = action.payload.id.toString();
      state.deployments[id] = action.payload;
    },
    
    setDeploymentStatus: (state, action: PayloadAction<{
      id: string;
      status: DeploymentStatus;
      error?: string;
    }>) => {
      const { id, status, error } = action.payload;
      if (state.deployments[id]) {
        state.deployments[id].frontendStatus = status;
        state.deployments[id].lastChecked = Date.now();
        
        if (error) {
          state.deployments[id].last_error = [error];
        }
        
        // Check if recoverable
        if (status === DeploymentStatus.FAILED) {
          const deployment = state.deployments[id];
          const timeSinceActivity = Date.now() - Number(deployment.last_activity / 1_000_000n);
          deployment.recoverable = timeSinceActivity > 5 * 60 * 1000; // 5 minutes
        }
      }
    },
    
    clearActiveDeployment: (state) => {
      state.activeDeploymentId = null;
      state.status = 'idle';
      state.error = null;
      state.pollAttempts = 0;
      
      if (state.pollingInterval) {
        clearInterval(state.pollingInterval);
        state.pollingInterval = null;
      }
      
      // Clear from localStorage
      localStorage.removeItem('activeDeploymentId');
    },
    
    setPollingInterval: (state, action: PayloadAction<NodeJS.Timeout | null>) => {
      if (state.pollingInterval) {
        clearInterval(state.pollingInterval);
      }
      state.pollingInterval = action.payload;
    },
    
    incrementPollAttempts: (state) => {
      state.pollAttempts += 1;
    },
    
    setError: (state, action: PayloadAction<{ title: string; message: string } | null>) => {
      state.error = action.payload;
    }
  }
});

export const {
  setActiveDeployment,
  updateDeployment,
  setDeploymentStatus,
  clearActiveDeployment,
  setPollingInterval,
  incrementPollAttempts,
  setError
} = deploymentSlice.actions;

export default deploymentSlice.reducer;
```

### 3. Redux Thunks (`store/deploymentThunks.ts`)

```typescript
import { createAsyncThunk } from '@reduxjs/toolkit';
import { getLbryFunActor } from '@/features/auth/utils/authUtils';
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
} from './deploymentSlice';
import { callWithRetry } from '@/utils/networkRetry';

// Polling intervals that progressively increase
const POLL_INTERVALS = [2000, 5000, 10000, 15000, 30000]; // ms

// Initiate token deployment (Phase 1)
export const initiateTokenDeployment = createAsyncThunk(
  'deployment/initiate',
  async (params: CreateTokenParams, { dispatch, rejectWithValue }) => {
    try {
      const actor = await getLbryFunActor();
      const result = await callWithRetry(() => 
        actor.initiate_token_deployment(params)
      );
      
      if ('Ok' in result) {
        const deploymentId = result.Ok.toString();
        
        // Store in localStorage for persistence
        localStorage.setItem('activeDeploymentId', deploymentId);
        
        // Create initial deployment record
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
        return rejectWithValue({
          title: 'Deployment Initiation Failed',
          message: result.Err
        });
      }
    } catch (error) {
      return rejectWithValue({
        title: 'Network Error',
        message: 'Failed to connect to the network'
      });
    }
  }
);

// Execute token deployment (Phase 2)
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
        
        // Clear active deployment
        dispatch(clearActiveDeployment());
        
        return result.Ok;
      } else {
        // Check if it's a timeout error
        if (result.Err.includes('timeout') || result.Err.includes('still processing')) {
          dispatch(setDeploymentStatus({ 
            id: deploymentId, 
            status: DeploymentStatus.POLLING,
            error: result.Err
          }));
          
          // Start polling
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
        
        return rejectWithValue({
          title: 'Deployment Failed',
          message: result.Err
        });
      }
    } catch (error) {
      return rejectWithValue({
        title: 'Execution Error',
        message: 'Failed to execute deployment'
      });
    }
  }
);

// Poll deployment status with progressive intervals
export const pollDeploymentStatus = createAsyncThunk(
  'deployment/poll',
  async (deploymentId: string, { dispatch, getState }) => {
    let pollIndex = 0;
    
    const poll = async () => {
      try {
        const state = getState() as any;
        
        // Check if we've exceeded max attempts
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
          
          // Check backend status
          if (deployment.status === 'completed') {
            dispatch(setPollingInterval(null));
            dispatch(setDeploymentStatus({
              id: deploymentId,
              status: DeploymentStatus.COMPLETED
            }));
            dispatch(clearActiveDeployment());
          } else if (deployment.status === 'failed') {
            dispatch(setPollingInterval(null));
            
            // Check if recoverable
            const timeSinceActivity = Date.now() - Number(deployment.last_activity / 1_000_000n);
            const isRecoverable = timeSinceActivity > 5 * 60 * 1000;
            
            dispatch(setDeploymentStatus({
              id: deploymentId,
              status: isRecoverable ? DeploymentStatus.RECOVERABLE : DeploymentStatus.FAILED,
              error: deployment.last_error?.[0] || 'Deployment failed'
            }));
          }
        }
        
        // Schedule next poll with progressive interval
        if (state.deployment.pollingInterval) {
          const nextPollDelay = POLL_INTERVALS[Math.min(pollIndex, POLL_INTERVALS.length - 1)];
          pollIndex++;
          
          const timeoutId = setTimeout(poll, nextPollDelay);
          dispatch(setPollingInterval(timeoutId as any));
        }
      } catch (error) {
        console.error('Polling error:', error);
        // Retry on network error
        if (state.deployment.pollingInterval) {
          const timeoutId = setTimeout(poll, 5000);
          dispatch(setPollingInterval(timeoutId as any));
        }
      }
    };
    
    // Start polling
    poll();
  }
);

// Recover stuck deployment
export const recoverDeployment = createAsyncThunk(
  'deployment/recover',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const actor = await getLbryFunActor();
      const result = await callWithRetry(() => 
        actor.recover_stuck_deployment()
      );
      
      if ('Ok' in result) {
        // Fetch updated deployment info
        const deployments = await actor.get_my_deployments();
        const activeDeployment = deployments.find(d => d.status === 'active');
        
        if (activeDeployment) {
          const deploymentId = activeDeployment.id.toString();
          dispatch(setActiveDeployment(deploymentId));
          
          // Try to execute again
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

// Get deployment history
export const fetchDeploymentHistory = createAsyncThunk(
  'deployment/fetchHistory',
  async (_, { dispatch }) => {
    try {
      const actor = await getLbryFunActor();
      const deployments = await callWithRetry(() => 
        actor.get_my_deployments()
      );
      
      // Convert to deployment records
      deployments.forEach(deployment => {
        const record: DeploymentRecord = {
          ...deployment,
          frontendStatus: deployment.status === 'active' ? DeploymentStatus.EXECUTING :
                         deployment.status === 'completed' ? DeploymentStatus.COMPLETED :
                         DeploymentStatus.FAILED,
          lastChecked: Date.now(),
          recoverable: false
        };
        
        // Check recoverability for failed deployments
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
```

## Phase 2: UI Components

### 4. Update Token Creation Form (`TerminalCreateToken.tsx`)

```typescript
import React, { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { initiateTokenDeployment } from '@/store/deploymentThunks';
import { DeploymentStatusModal } from './DeploymentStatusModal';

const TerminalCreateToken: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { activeDeploymentId } = useAppSelector(state => state.deployment);
  
  const [showDeploymentModal, setShowDeploymentModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    setSubmitAttempted(true);
    if (Object.keys(errors).length > 0) return;
    
    setIsSubmitting(true);
    setStatus({ type: 'loading', message: 'Initiating deployment...' });
    
    // Convert form data to deployment params
    const params: CreateTokenParams = {
      primary_token_name: form.primary_token_name,
      primary_token_symbol: form.primary_token_symbol,
      primary_token_description: form.primary_token_description,
      primary_logo: form.primary_token_logo_base64,
      secondary_token_name: form.secondary_token_name,
      secondary_token_symbol: form.secondary_token_symbol,
      secondary_token_description: form.secondary_token_description,
      secondary_logo: form.secondary_token_logo_base64,
      primary_max_supply: BigInt(form.primary_max_supply) * BigInt(TokenConversionService.getE8S()),
      initial_primary_mint: BigInt(form.tge_allocation) * BigInt(TokenConversionService.getE8S()),
      initial_secondary_burn: BigInt(form.initial_secondary_burn) * BigInt(TokenConversionService.getE8S()),
      halving_step: BigInt(form.halving_step),
      threshold_multiplier: parseFloat(form.threshold_multiplier),
      initial_reward_per_burn_unit: BigInt(Math.floor(parseFloat(form.initial_reward_per_burn_unit) * Number(TokenConversionService.getE8S()))),
      distribution_interval_seconds: BigInt(form.distribution_interval_seconds),
      launch_delay_seconds: BigInt(form.launch_delay_seconds)
    };
    
    // Phase 1: Initiate deployment
    const result = await dispatch(initiateTokenDeployment(params));
    
    if (initiateTokenDeployment.fulfilled.match(result)) {
      // Successfully initiated, open modal to execute phase 2
      setShowDeploymentModal(true);
      setIsSubmitting(false);
    } else {
      // Initiation failed
      setStatus({ 
        type: 'error', 
        message: result.payload?.message || 'Failed to initiate deployment' 
      });
      setIsSubmitting(false);
    }
  };
  
  // Check for existing deployment on mount
  useEffect(() => {
    const savedDeploymentId = localStorage.getItem('activeDeploymentId');
    if (savedDeploymentId && !activeDeploymentId) {
      // Restore deployment state
      dispatch(fetchDeploymentHistory());
      setShowDeploymentModal(true);
    }
  }, []);
  
  return (
    <div className="terminal-form">
      {/* Existing form content... */}
      
      {/* Cost transparency display */}
      <div className="terminal-info mb-4">
        <div className="terminal-label">Deployment Cost:</div>
        <div className="text-sm">
          <span>Total: 5.0 ICP</span>
          <span className="ml-4 text-xs text-gray-400">
            (Refundable on failure: 4.0 ICP)
          </span>
        </div>
      </div>
      
      {/* Add deployment history button */}
      <div className="terminal-commands">
        <button
          type="button"
          onClick={() => navigate('/deployments')}
          className="terminal-command"
        >
          > view_deployment_history
        </button>
      </div>
      
      {/* Deployment Status Modal */}
      <DeploymentStatusModal 
        deploymentId={activeDeploymentId}
        isOpen={showDeploymentModal}
        onClose={() => setShowDeploymentModal(false)}
        onSuccess={(tokenId) => {
          navigate(`/token/success?id=${tokenId}`);
        }}
      />
    </div>
  );
};
```

### 5. Create Deployment Status Modal (`DeploymentStatusModal.tsx`)

```typescript
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { 
  executeTokenDeployment, 
  recoverDeployment,
  fetchDeploymentHistory 
} from '@/store/deploymentThunks';
import { DeploymentStatus } from '@/types/deployment';

interface DeploymentStatusModalProps {
  deploymentId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (tokenId: bigint) => void;
}

export const DeploymentStatusModal: React.FC<DeploymentStatusModalProps> = ({
  deploymentId,
  isOpen,
  onClose,
  onSuccess
}) => {
  const dispatch = useAppDispatch();
  const deployment = useAppSelector(state => 
    deploymentId ? state.deployment.deployments[deploymentId] : null
  );
  const [localError, setLocalError] = useState<string>('');
  
  const [recoveryCountdown, setRecoveryCountdown] = useState<number>(0);
  
  useEffect(() => {
    if (isOpen && deploymentId && deployment?.frontendStatus === DeploymentStatus.INITIATED) {
      // Auto-execute phase 2 for new deployments
      executePhase2();
    }
  }, [isOpen, deploymentId, deployment?.frontendStatus]);
  
  // Update recovery countdown
  useEffect(() => {
    if (deployment?.frontendStatus === DeploymentStatus.FAILED && !deployment.recoverable) {
      const interval = setInterval(() => {
        const timeSinceActivity = Date.now() - Number(deployment.last_activity / 1_000_000n);
        const timeUntilRecovery = Math.max(0, 300000 - timeSinceActivity);
        setRecoveryCountdown(timeUntilRecovery);
        
        if (timeUntilRecovery === 0) {
          clearInterval(interval);
          // Refresh deployment status
          dispatch(fetchDeploymentHistory());
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [deployment?.frontendStatus, deployment?.recoverable]);
  
  const executePhase2 = async () => {
    if (!deploymentId) return;
    
    const result = await dispatch(executeTokenDeployment(deploymentId));
    
    if (executeTokenDeployment.fulfilled.match(result)) {
      // Success - redirect to token page
      onSuccess(result.payload.token_id);
    } else if (result.payload?.isTimeout) {
      // Timeout - polling will handle status updates
      setLocalError('Deployment is taking longer than expected. Monitoring status...');
    } else {
      // Hard failure
      setLocalError(result.payload?.message || 'Deployment failed');
    }
  };
  
  const handleRecover = async () => {
    const result = await dispatch(recoverDeployment());
    
    if (recoverDeployment.fulfilled.match(result)) {
      setLocalError('');
      // Recovery initiated, modal will update with new status
    } else {
      setLocalError(result.payload?.message || 'Recovery failed');
    }
  };
  
  const renderContent = () => {
    if (!deployment) return null;
    
    switch (deployment.frontendStatus) {
      case DeploymentStatus.INITIATED:
      case DeploymentStatus.EXECUTING:
        return (
          <div className="terminal-content">
            <div className="terminal-loading">
              <div>Creating token deployment...</div>
              <div className="terminal-progress">
                <span className="terminal-label">Status:</span> Initializing canisters
              </div>
              <div className="terminal-blink mt-2">_</div>
            </div>
          </div>
        );
        
      case DeploymentStatus.POLLING:
        const canisterNames = ['Secondary Token', 'Primary Token', 'Swap', 'Tokenomics', 'Logs'];
        const canisterCount = Number(deployment.canister_count);
        
        return (
          <div className="terminal-content">
            <div className="terminal-info">
              <div className="mb-2">[INFO] Deployment in progress</div>
              
              {/* Visual progress indicator */}
              <div className="terminal-progress mb-3">
                <span className="terminal-label">Progress:</span>
                <div className="mt-1">
                  <div className="terminal-progress-bar" style={{width: '200px', height: '10px', border: '1px solid #4ade80', display: 'inline-block'}}>
                    <div 
                      className="terminal-progress-fill" 
                      style={{
                        width: `${(canisterCount / 5) * 100}%`, 
                        height: '100%', 
                        backgroundColor: '#4ade80',
                        transition: 'width 0.3s ease'
                      }} 
                    />
                  </div>
                  <span className="ml-2">{canisterCount}/5</span>
                </div>
              </div>
              
              {/* Canister creation status */}
              <div className="terminal-progress mb-2">
                <span className="terminal-label">Creating:</span>
                <div className="mt-1 text-xs">
                  {canisterNames.map((name, i) => (
                    <div key={name} className={i < canisterCount ? 'text-green-400' : 'text-gray-500'}>
                      {i < canisterCount ? '✓' : '○'} {name}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="terminal-progress">
                <span className="terminal-label">Status:</span> {deployment.status}
              </div>
              <div className="mt-3 text-xs text-gray-400">
                Checking status automatically...
              </div>
            </div>
          </div>
        );
        
      case DeploymentStatus.FAILED:
        return (
          <div className="terminal-content">
            <div className="terminal-error mb-3">
              [ERROR] {deployment.last_error?.[0] || localError || 'Deployment failed'}
            </div>
            
            <div className="terminal-info mb-3">
              <div className="mb-2">Deployment Details:</div>
              <div className="text-xs">
                <span className="terminal-label">ID:</span> {deploymentId}
              </div>
              <div className="text-xs">
                <span className="terminal-label">Created:</span> {new Date(Number(deployment.created_at / 1_000_000n)).toLocaleString()}
              </div>
              <div className="text-xs">
                <span className="terminal-label">Canisters created:</span> {deployment.canister_count.toString()}
              </div>
            </div>
            
            {!deployment.recoverable && (() => {
              const timeSinceActivity = Date.now() - Number(deployment.last_activity / 1_000_000n);
              const timeUntilRecovery = Math.max(0, 300000 - timeSinceActivity); // 5 minutes in ms
              const minutes = Math.floor(timeUntilRecovery / 60000);
              const seconds = Math.floor((timeUntilRecovery % 60000) / 1000);
              
              return (
                <div className="terminal-warning">
                  Recovery available in: {minutes}m {seconds}s
                  <div className="text-xs mt-1">Keep this deployment ID safe: {deploymentId}</div>
                </div>
              );
            })()}
          </div>
        );
        
      case DeploymentStatus.RECOVERABLE:
        return (
          <div className="terminal-content">
            <div className="terminal-info mb-3">
              [INFO] This deployment can be recovered
            </div>
            
            <div className="mb-3">
              <div className="terminal-label mb-1">Last error:</div>
              <div className="terminal-error text-sm">
                {deployment.last_error?.[0] || 'Unknown error'}
              </div>
            </div>
            
            <button 
              onClick={handleRecover} 
              className="terminal-command"
            >
              > recover_deployment
            </button>
          </div>
        );
        
      case DeploymentStatus.COMPLETED:
        return (
          <div className="terminal-content">
            <div className="terminal-success mb-3">
              [SUCCESS] Token deployment completed!
            </div>
            <div className="terminal-info">
              Redirecting to token page...
            </div>
          </div>
        );
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="terminal-modal-overlay">
      <div className="terminal-modal">
        <div className="terminal-header">
          <span className="terminal-prompt">>></span> deployment_status
          {deploymentId && (
            <span className="terminal-status float-right">
              [ID: {deploymentId}]
            </span>
          )}
        </div>
        
        {renderContent()}
        
        <div className="terminal-commands mt-4">
          {deployment?.frontendStatus !== DeploymentStatus.COMPLETED && (
            <button
              onClick={onClose}
              className="terminal-command"
            >
              > hide_modal
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
```

### 6. Create Deployment History Page (`pages/DeploymentsPage.tsx`)

```typescript
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchDeploymentHistory } from '@/store/deploymentThunks';
import { setActiveDeployment } from '@/store/deploymentSlice';
import { DeploymentStatus } from '@/types/deployment';

export const DeploymentsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const deployments = useAppSelector(state => state.deployment.deployments);
  
  useEffect(() => {
    dispatch(fetchDeploymentHistory());
  }, []);
  
  const getStatusBadge = (status: DeploymentStatus) => {
    const badges = {
      [DeploymentStatus.INITIATED]: 'terminal-badge-info',
      [DeploymentStatus.EXECUTING]: 'terminal-badge-info',
      [DeploymentStatus.POLLING]: 'terminal-badge-warning',
      [DeploymentStatus.COMPLETED]: 'terminal-badge-success',
      [DeploymentStatus.FAILED]: 'terminal-badge-error',
      [DeploymentStatus.RECOVERABLE]: 'terminal-badge-warning'
    };
    
    return badges[status] || 'terminal-badge';
  };
  
  const handleSelectDeployment = (deploymentId: string) => {
    dispatch(setActiveDeployment(deploymentId));
    navigate('/');
  };
  
  const sortedDeployments = Object.values(deployments)
    .sort((a, b) => Number(b.created_at - a.created_at));
  
  return (
    <div className="terminal-page">
      <div className="terminal-header">
        <span className="terminal-prompt">>></span> deployment_history
        <span className="terminal-status float-right">
          [{sortedDeployments.length} deployments]
        </span>
      </div>
      
      {sortedDeployments.length === 0 ? (
        <div className="terminal-content">
          <div className="terminal-info">No deployments found</div>
        </div>
      ) : (
        <div className="terminal-list">
          {sortedDeployments.map(deployment => (
            <div 
              key={deployment.id.toString()}
              className="terminal-list-item"
              onClick={() => handleSelectDeployment(deployment.id.toString())}
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="terminal-label">ID:</span> {deployment.id.toString()}
                  <span className={`ml-3 ${getStatusBadge(deployment.frontendStatus)}`}>
                    {deployment.frontendStatus}
                  </span>
                </div>
                <div className="text-xs">
                  {new Date(Number(deployment.created_at / 1_000_000n)).toLocaleString()}
                </div>
              </div>
              
              {deployment.token_id.length > 0 && (
                <div className="text-xs mt-1">
                  <span className="terminal-label">Token ID:</span> {deployment.token_id[0].toString()}
                </div>
              )}
              
              {deployment.last_error.length > 0 && (
                <div className="text-xs mt-1 terminal-error">
                  {deployment.last_error[0]}
                </div>
              )}
              
              {deployment.frontendStatus === DeploymentStatus.RECOVERABLE && (
                <div className="text-xs mt-1 terminal-warning">
                  Click to recover this deployment
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <div className="terminal-commands mt-4">
        <button
          onClick={() => navigate('/')}
          className="terminal-command"
        >
          > create_new_token
        </button>
      </div>
    </div>
  );
};
```

### 7. Add Route Configuration

```typescript
// routes/routeConfig.ts
import { DeploymentsPage } from '@/pages/DeploymentsPage';

export const routes = [
  // ... existing routes
  {
    path: '/deployments',
    element: <DeploymentsPage />,
    protected: true
  }
];
```

### 8. Update Root Reducer

```typescript
// store/rootReducer.ts
import deploymentReducer from './deploymentSlice';

export const rootReducer = {
  // ... existing reducers
  deployment: deploymentReducer
};
```

## Phase 3: Essential Improvements Implementation

### 9. Add Network Retry Wrapper (`utils/networkRetry.ts`)

```typescript
// Simple retry wrapper for API calls
export const callWithRetry = async <T>(
  apiCall: () => Promise<T>, 
  retries = 2
): Promise<T> => {
  try {
    return await apiCall();
  } catch (error: any) {
    if (retries > 0 && (
      error.message?.includes('network') || 
      error.message?.includes('Failed to fetch') ||
      error.code === 'ERR_NETWORK'
    )) {
      // Wait 1 second before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      return callWithRetry(apiCall, retries - 1);
    }
    throw error;
  }
};
```

## Phase 4: Resilience & Error Handling

### 9. Handle Page Refreshes (App initialization)

```typescript
// App.tsx or similar initialization file
import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { fetchDeploymentHistory, setActiveDeployment } from '@/store/deployment';

const AppInitializer: React.FC = () => {
  const dispatch = useAppDispatch();
  
  useEffect(() => {
    // Check for active deployment on app load
    const activeDeploymentId = localStorage.getItem('activeDeploymentId');
    
    if (activeDeploymentId) {
      // Restore deployment state
      dispatch(setActiveDeployment(activeDeploymentId));
      dispatch(fetchDeploymentHistory());
    }
  }, []);
  
  return null;
};
```

### 10. Enhanced Error Types

```typescript
// types/errors.ts
export interface DeploymentError {
  title: string;
  message: string;
  deploymentId?: string;
  canRetry?: boolean;
  refundAvailable?: boolean;
  isTimeout?: boolean;
}

export const parseDeploymentError = (error: string): DeploymentError => {
  if (error.includes('timeout') || error.includes('still processing')) {
    return {
      title: 'Deployment In Progress',
      message: 'The deployment is taking longer than expected. We\'re monitoring its progress.',
      canRetry: false,
      isTimeout: true
    };
  }
  
  if (error.includes('insufficient funds')) {
    return {
      title: 'Insufficient Funds',
      message: 'Please ensure you have enough ICP to complete the deployment.',
      canRetry: false
    };
  }
  
  if (error.includes('canister creation failed')) {
    return {
      title: 'Canister Creation Failed',
      message: 'Failed to create one or more canisters. Your payment will be refunded.',
      refundAvailable: true,
      canRetry: true
    };
  }
  
  return {
    title: 'Deployment Failed',
    message: error,
    canRetry: true
  };
};
```

## Consolidated User Flow

1. **Token Creation**:
   - User fills form and submits
   - `initiateTokenDeployment` is called
   - Deployment ID is returned and stored in localStorage
   - DeploymentStatusModal opens automatically

2. **Deployment Execution**:
   - Modal calls `executeTokenDeployment`
   - Shows progress indicators
   - Handles success, timeout, or failure scenarios

3. **Timeout Handling**:
   - If execution times out, polling begins
   - Status updates every 5 seconds
   - User can hide modal - polling continues in background

4. **Failure & Recovery**:
   - Failed deployments show error details
   - After 5 minutes, recovery button appears
   - User can attempt recovery or view deployment history

5. **Page Refresh**:
   - Active deployment ID restored from localStorage
   - Deployment state fetched from backend
   - Modal reopens if deployment is active

6. **Success Flow**:
   - On completion, user redirected to success page with token ID
   - Deployment marked as completed
   - localStorage cleared

## Benefits

1. **Resilient Architecture**: Survives page refreshes and network issues
2. **Clear User Communication**: Always shows deployment status and next steps
3. **Automatic Recovery**: Smart polling and recovery mechanisms
4. **Clean Code**: No backward compatibility concerns
5. **Audit Trail**: Complete deployment history available

## Key Improvements Implemented

1. **Progressive Polling**: Instead of fixed 5-second intervals, uses increasing delays (2s → 5s → 10s → 15s → 30s) to reduce server load
2. **Visual Progress**: Shows canister creation progress with visual indicators and checkmarks
3. **Recovery Countdown**: Real-time countdown showing exactly when recovery becomes available
4. **Cost Transparency**: Upfront display of deployment cost (5 ICP) and refund amount (4.0 ICP)
5. **Network Retry**: Automatic retry logic for transient network failures on all API calls

## Implementation Timeline

- Day 1: Redux setup, type definitions, and network retry wrapper
- Day 2: Core thunks with progressive polling and retry logic
- Day 3: UI components with visual improvements (Modal, History page)
- Day 4: Integration, countdown timer, and error handling
- Day 5: Testing and refinement

Total: 5 days for complete implementation with all essential improvements