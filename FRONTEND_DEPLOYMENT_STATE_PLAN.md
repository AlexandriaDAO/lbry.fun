# Frontend Deployment State Plan

## Overview
This plan outlines frontend changes to support the new atomic deployment system where pool creation determines success/failure. The key principle: **With atomic deployments, the frontend becomes simpler - just reflect backend state without complex reconciliation.**

## Current Frontend Issues
1. Complex state machine trying to reconcile multiple backend states
2. No persistence across page refreshes
3. Poor visibility into deployment progress
4. Modal disappears - users lose track of deployments
5. Users can't see when deployment fails at pool creation step

## Core Principles
1. **Single Source of Truth** - Backend TokenStatus is authoritative
2. **No Dual State** - Remove frontendStatus, only use tokenStatus
3. **Clear Pool Creation Visibility** - Show this critical final step
4. **Simple Components** - Small, focused components that just display state

## File-by-File Frontend Changes

### 1. `src/types/deployment.ts` - Simplified Types

**REMOVE dual state tracking, use only backend TokenStatus:**
```typescript
// Add TokenStatus type matching backend (simplified - no backwards compatibility)
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
  // Remove: status, frontendStatus, canister_count, last_error
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
      message: getDeploymentStageMessage(tokenStatus.Deploying.progress),
      isRecoverable: false,
      canTrade: false
    };
  }
  
  if ('Failed' in tokenStatus) {
    const isPoolFailure = tokenStatus.Failed.reason.includes('Pool creation');
    return {
      status: 'failed',
      progress: 0,
      message: isPoolFailure 
        ? 'Pool creation failed - deployment incomplete' 
        : tokenStatus.Failed.reason,
      isRecoverable: true,
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

// Clear progress messages showing pool creation as final step
function getDeploymentStageMessage(progress: number): string {
  if (progress < 20) return "Creating swap mechanism...";
  if (progress < 40) return "Setting up tokenomics...";
  if (progress < 60) return "Creating token contracts...";
  if (progress < 80) return "Configuring trading rules...";
  if (progress < 95) return "Finalizing deployment...";
  return "Creating liquidity pool (final step)..."; // Critical visibility
}
```

### 2. `src/store/slices/deploymentSlice.ts` - Simplified State

**SIMPLIFIED to just store deployments:**
```typescript
interface DeploymentState {
  deployments: Record<string, DeploymentRecord>;
  activeDeploymentId: string | null;
  isLoading: boolean;
}

// Simple actions - no complex state management
export const deploymentSlice = createSlice({
  name: 'deployment',
  initialState: {
    deployments: {},
    activeDeploymentId: null,
    isLoading: false
  },
  reducers: {
    // Just store/update deployments
    setDeployments: (state, action: PayloadAction<DeploymentRecord[]>) => {
      state.deployments = {};
      action.payload.forEach(d => {
        state.deployments[d.id.toString()] = d;
      });
    },
    
    updateDeployment: (state, action: PayloadAction<DeploymentRecord>) => {
      state.deployments[action.payload.id.toString()] = action.payload;
    },
    
    removeDeployment: (state, action: PayloadAction<string>) => {
      delete state.deployments[action.payload];
    },
    
    setActiveDeploymentId: (state, action: PayloadAction<string | null>) => {
      state.activeDeploymentId = action.payload;
    },
    
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    }
  }
});

// No complex state derivation - just selectors
export const selectDeploymentUIState = (deploymentId: string) => (state: RootState) => {
  const deployment = state.deployment.deployments[deploymentId];
  return deployment ? getUIState(deployment.tokenStatus) : null;
};

export const selectActiveDeployments = (state: RootState) => {
  return Object.values(state.deployment.deployments).filter(d => 
    'Deploying' in d.tokenStatus
  );
};

### 3. `src/features/token/thunk/deploymentThunks.ts` - Proper Status Polling

**SIMPLIFIED with correct status polling:**
```typescript
// Simple persistence utilities
const DEPLOYMENT_STORAGE_PREFIX = 'lbry_deployment_';
const DEPLOYMENT_TTL = 24 * 60 * 60 * 1000; // 24 hours

const persistDeployment = (deployment: DeploymentRecord) => {
  const key = `${DEPLOYMENT_STORAGE_PREFIX}${deployment.id}`;
  localStorage.setItem(key, JSON.stringify({
    deployment,
    expires: Date.now() + DEPLOYMENT_TTL
  }));
};

const loadPersistedDeployments = (): DeploymentRecord[] => {
  const deployments: DeploymentRecord[] = [];
  const keys = Object.keys(localStorage).filter(k => k.startsWith(DEPLOYMENT_STORAGE_PREFIX));
  
  keys.forEach(key => {
    try {
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      if (data.expires > Date.now() && data.deployment) {
        deployments.push(data.deployment);
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  });
  
  return deployments;
};

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
        
        if (deploymentStatus === 'active') {
          tokenStatus = {
            Deploying: {
              deployment_id: BigInt(deploymentId),
              progress: (Number(backendDeployment.canister_count) / 5) * 80,
              created_canisters: []
            }
          };
        } else if (deploymentStatus === 'failed') {
          tokenStatus = {
            Failed: {
              deployment_id: BigInt(deploymentId),
              reason: backendDeployment.last_error?.[0] || 'Deployment failed',
              failed_at: backendDeployment.failed_at?.[0] || BigInt(Date.now() * 1_000_000)
            }
          };
        } else {
          // Completed - should have token_id
          if (backendDeployment.token_id?.[0]) {
            // Fetch actual token status
            const status = await actor.get_token_status(backendDeployment.token_id[0]);
            tokenStatus = status;
          } else {
            // Shouldn't happen - completed without token
            tokenStatus = {
              Failed: {
                deployment_id: BigInt(deploymentId),
                reason: 'Deployment completed but no token created',
                failed_at: BigInt(Date.now() * 1_000_000)
              }
            };
          }
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
      }
      
    } catch (error) {
      console.error('Polling error:', error);
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
    const deployments = loadPersistedDeployments();
    dispatch(setDeployments(deployments));
    
    // Resume polling for active deployments
    deployments.forEach(deployment => {
      if ('Deploying' in deployment.tokenStatus) {
        dispatch(pollDeploymentStatus(deployment.id.toString()));
      }
    });
  }
);
```

### 4. Component Structure for Better Organization

**BREAK DOWN into focused components:**

```
src/pages/MyDeploymentsPage/
├── index.tsx                    // Main container (< 100 lines)
├── components/
│   ├── DeploymentCard.tsx       // Single deployment display
│   ├── DeploymentProgress.tsx   // Progress bar with clear stages
│   ├── PoolCreationStatus.tsx   // Special handling for pool creation
│   └── RecoveryActions.tsx      // Recovery buttons and info
├── hooks/
│   ├── useDeploymentPolling.ts  // Auto-refresh logic
│   └── useDeploymentActions.ts  // Recovery/continue actions
└── utils/
    └── deploymentHelpers.ts     // UI state derivation
```

### 5. `src/pages/MyDeploymentsPage/components/DeploymentCard.tsx`

**FOCUSED component for single deployment:**
```typescript
import React from 'react';
import { DeploymentRecord, getUIState } from '@/types/deployment';
import { DeploymentProgress } from './DeploymentProgress';
import { PoolCreationStatus } from './PoolCreationStatus';
import { RecoveryActions } from './RecoveryActions';
import { formatDistanceToNow } from 'date-fns';

interface DeploymentCardProps {
  deployment: DeploymentRecord;
  onRemove: (id: string) => void;
  onViewToken: (tokenId: bigint) => void;
}

export const DeploymentCard: React.FC<DeploymentCardProps> = ({
  deployment,
  onRemove,
  onViewToken
}) => {
  const uiState = getUIState(deployment.tokenStatus);
  
  return (
    <div className={`
      border rounded-lg p-4 transition-all duration-200
      ${uiState.status === 'deploying' ? 'border-yellow-500' : 'border-gray-700'}
      hover:border-gray-600
    `}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-mono text-lg">
            {deployment.params.primary_token_symbol} / 
            {deployment.params.secondary_token_symbol}
          </h3>
          <p className="text-xs text-gray-500">
            {formatDistanceToNow(Number(deployment.created_at / 1_000_000n), { addSuffix: true })}
          </p>
        </div>
        
        <StatusBadge status={uiState.status} />
      </div>

      {/* Progress for deploying state */}
      {uiState.status === 'deploying' && (
        <DeploymentProgress 
          progress={uiState.progress} 
          message={uiState.message}
        />
      )}

      {/* Pool creation visibility for high progress */}
      {uiState.status === 'deploying' && uiState.progress >= 95 && (
        <PoolCreationStatus />
      )}

      {/* Failed state with clear reason */}
      {uiState.status === 'failed' && (
        <FailureDetails 
          reason={uiState.message}
          isPoolFailure={uiState.message.includes('Pool creation')}
        />
      )}

      {/* Success state */}
      {uiState.status === 'live' && deployment.token_id?.[0] && (
        <div className="mt-3">
          <button
            onClick={() => onViewToken(deployment.token_id![0])}
            className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white"
          >
            View Token →
          </button>
        </div>
      )}

      {/* Recovery actions */}
      {uiState.isRecoverable && (
        <RecoveryActions deployment={deployment} />
      )}
    </div>
  );
};

// Sub-components
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors = {
    deploying: 'bg-yellow-500',
    failed: 'bg-red-500',
    live: 'bg-green-500'
  };
  
  return (
    <span className={`
      px-2 py-1 rounded text-xs text-white
      ${colors[status as keyof typeof colors] || 'bg-gray-500'}
    `}>
      {status.toUpperCase()}
    </span>
  );
};

const FailureDetails: React.FC<{ reason: string; isPoolFailure: boolean }> = ({ 
  reason, 
  isPoolFailure 
}) => (
  <div className="mt-3 bg-red-900/20 border border-red-500 p-3 rounded">
    <div className="flex items-start gap-2">
      <span className="text-red-500">⚠️</span>
      <div className="flex-1">
        <p className="text-sm text-red-400">{reason}</p>
        {isPoolFailure && (
          <p className="text-xs text-gray-400 mt-1">
            Your tokens were created but cannot be traded without a liquidity pool.
          </p>
        )}
      </div>
    </div>
  </div>
);
```

### 6. `src/pages/MyDeploymentsPage/components/PoolCreationStatus.tsx`

**SPECIAL component for pool creation visibility:**
```typescript
import React from 'react';
import { AlertCircle } from 'lucide-react';

export const PoolCreationStatus: React.FC = () => {
  return (
    <div className="mt-3 bg-yellow-900/20 border border-yellow-500 p-3 rounded animate-pulse">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-yellow-500" />
        <div>
          <p className="font-semibold text-yellow-400">Creating Liquidity Pool</p>
          <p className="text-xs text-gray-400 mt-1">
            This is the final and most critical step. If this fails, your deployment will be rolled back
            and you'll receive a refund.
          </p>
        </div>
      </div>
    </div>
  );
};
```

### 7. `src/pages/MyDeploymentsPage/components/RecoveryActions.tsx`

**CLEAR recovery component:**
```typescript
import React from 'react';
import { DeploymentRecord } from '@/types/deployment';
import { useAppDispatch } from '@/store/hooks';
import { recoverDeployment } from '@/features/token/thunk/deploymentThunks';

interface RecoveryActionsProps {
  deployment: DeploymentRecord;
}

export const RecoveryActions: React.FC<RecoveryActionsProps> = ({ deployment }) => {
  const dispatch = useAppDispatch();
  
  return (
    <div className="mt-4 bg-black/40 p-4 rounded">
      <h4 className="text-green-400 font-semibold mb-2">Recovery Available</h4>
      <p className="text-sm text-gray-300 mb-3">
        Your deployment failed and you're eligible for a refund of 4 ICP 
        (5 ICP payment minus 1 ICP platform fee).
      </p>
      <button
        onClick={() => dispatch(recoverDeployment())}
        className="w-full bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded text-white"
      >
        Recover Funds (4 ICP)
      </button>
    </div>
  );
};
```

### 8. Main Page Simplified (`src/pages/MyDeploymentsPage/index.tsx`)

**SIMPLE container component:**
```typescript
import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useNavigate } from 'react-router-dom';
import { DeploymentCard } from './components/DeploymentCard';
import { useDeploymentPolling } from './hooks/useDeploymentPolling';
import { initializeDeployments } from '@/features/token/thunk/deploymentThunks';
import { RefreshCw } from 'lucide-react';

export const MyDeploymentsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const deployments = useAppSelector(state => state.deployment.deployments);
  const { isPolling, togglePolling, refreshAll } = useDeploymentPolling();

  useEffect(() => {
    dispatch(initializeDeployments());
  }, []);

  const sortedDeployments = Object.values(deployments).sort(
    (a, b) => Number(b.created_at) - Number(a.created_at)
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Deployments</h1>
        
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isPolling}
              onChange={togglePolling}
              className="rounded"
            />
            <span className="text-sm">Auto-refresh</span>
          </label>
          
          <button
            onClick={refreshAll}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      {sortedDeployments.length === 0 ? (
        <EmptyState onNavigate={() => navigate('/')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedDeployments.map(deployment => (
            <DeploymentCard
              key={deployment.id.toString()}
              deployment={deployment}
              onRemove={(id) => dispatch(removeDeployment(id))}
              onViewToken={(tokenId) => navigate(`/swap/${tokenId}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const EmptyState: React.FC<{ onNavigate: () => void }> = ({ onNavigate }) => (
  <div className="text-center py-12 text-gray-500">
    <p>No deployments found.</p>
    <button
      onClick={onNavigate}
      className="mt-4 text-green-400 hover:underline"
    >
      Create your first token →
    </button>
  </div>
);
```

## Key Improvements from Evaluation

1. **No Dual State** - Only TokenStatus from backend, UI state derived
2. **Clear Pool Creation** - Special component shows this critical final step
3. **Simple Components** - Each component has single responsibility
4. **Proper Status Polling** - Polls get_token_status instead of get_my_deployments
5. **No Raw Backend Exposure** - UI state abstracted from TokenStatus
6. **Better UX for Failures** - Clear messaging about pool creation failures

## Benefits of Simplified Approach

1. **Less Code** - No complex state reconciliation
2. **Fewer Bugs** - Single source of truth prevents inconsistencies  
3. **Clear User Experience** - Pool creation visibility prevents confusion
4. **Easy Maintenance** - Small, focused components
5. **Better Performance** - No redundant state updates