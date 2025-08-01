import React, { useEffect, useState } from 'react';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { 
  executeTokenDeployment, 
  recoverDeployment
} from '../thunk/deploymentThunks';
import getTokenPools from '@/features/token/thunk/getTokenPools.thunk';
import { selectDeploymentById, selectDeploymentUIState } from '@/store/slices/deploymentSlice';

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
  // Store the deployment ID locally so it doesn't get lost when activeDeploymentId is cleared
  const [localDeploymentId, setLocalDeploymentId] = useState<string | null>(null);
  
  // Capture the ID when modal opens with a deployment
  useEffect(() => {
    if (deploymentId && !localDeploymentId) {
      setLocalDeploymentId(deploymentId);
    }
  }, [deploymentId, localDeploymentId]);
  
  // Clear local ID when modal closes
  useEffect(() => {
    if (!isOpen) {
      setLocalDeploymentId(null);
    }
  }, [isOpen]);
  
  // Use the local ID if we have it, otherwise use the prop
  const effectiveDeploymentId = localDeploymentId || deploymentId;
  
  const deployment = useAppSelector(state => 
    effectiveDeploymentId ? selectDeploymentById(effectiveDeploymentId)(state) : null
  );
  const uiState = useAppSelector(state => 
    effectiveDeploymentId ? selectDeploymentUIState(effectiveDeploymentId)(state) : null
  );
  const [localError, setLocalError] = useState<string>('');
  const [hasStartedExecution, setHasStartedExecution] = useState(false);
  
  // Start execution when modal opens with new deployment
  useEffect(() => {
    if (isOpen && deploymentId && deployment && !hasStartedExecution) {
      // Check if this is a fresh deployment (no token status yet)
      if ('Deploying' in deployment.tokenStatus && deployment.tokenStatus.Deploying.progress === 0) {
        setHasStartedExecution(true);
        executePhase2();
      }
    }
  }, [isOpen, deploymentId, deployment, hasStartedExecution]);
  
  // Handle success when token goes live
  useEffect(() => {
    if (deployment && uiState?.status === 'live' && deployment.token_id?.[0]) {
      // Refresh token pools to ensure the new token is in the list
      dispatch(getTokenPools()).then(() => {
        // Navigate after pools are refreshed
        onSuccess(deployment.token_id[0]);
      });
    }
  }, [deployment, uiState?.status, onSuccess, dispatch]);
  
  const executePhase2 = async () => {
    if (!effectiveDeploymentId) return;
    
    console.log('DeploymentStatusModal: Starting phase 2 execution for deployment:', effectiveDeploymentId);
    const result = await dispatch(executeTokenDeployment(effectiveDeploymentId));
    
    if (executeTokenDeployment.rejected.match(result)) {
      console.error('DeploymentStatusModal: Execution failed:', result.payload);
      if (result.payload?.isTimeout) {
        // Already polling, just show status
        setLocalError('');
      } else {
        setLocalError(result.payload?.message || 'Deployment failed');
      }
    }
  };
  
  const handleRecover = async () => {
    const result = await dispatch(recoverDeployment());
    
    if (recoverDeployment.fulfilled.match(result)) {
      setLocalError('');
      onClose();
    } else {
      setLocalError(result.payload?.message || 'Recovery failed');
    }
  };
  
  const renderContent = () => {
    if (!deployment || !uiState) return null;
    
    switch (uiState.status) {
      case 'deploying':
        return (
          <div className="terminal-content">
            <div className="terminal-info mb-4">
              [INFO] Deployment in progress
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="animate-spin h-5 w-5 border-2 border-green-500 border-t-transparent rounded-full"></div>
              <span className="text-gray-300">Deployment in progress...</span>
            </div>
            
            
            <div className="mt-4 text-xs text-gray-400">
              Status updates automatically...
            </div>
          </div>
        );
        
      case 'failed':
        const isPoolFailure = uiState.message.includes('Pool creation');
        
        return (
          <div className="terminal-content">
            <div className="terminal-error mb-3">
              [ERROR] {uiState.message}
            </div>
            
            {localError && (
              <div className="terminal-error mb-3 text-sm">
                {localError}
              </div>
            )}
            
            <div className="terminal-info mb-3">
              <div className="mb-2">Deployment Details:</div>
              <div className="text-xs">
                <span className="terminal-label">ID:</span> {effectiveDeploymentId}
              </div>
              <div className="text-xs">
                <span className="terminal-label">Created:</span> {
                  new Date(Number(deployment.created_at / 1_000_000n)).toLocaleString()
                }
              </div>
            </div>
            
            {isPoolFailure && (
              <div className="terminal-warning mb-3">
                Your tokens were created but the liquidity pool could not be established.
                The deployment has been rolled back.
              </div>
            )}
            
            {uiState.isRecoverable && (
              <button 
                onClick={handleRecover} 
                className="terminal-command"
              >
                &gt; recover_deployment (4 ICP refund)
              </button>
            )}
          </div>
        );
        
      case 'live':
        return (
          <div className="terminal-content">
            <div className="terminal-success mb-3">
              [SUCCESS] Token deployment completed!
            </div>
            <div className="terminal-info">
              <div className="mb-2">Your token is now live!</div>
              {deployment.token_id?.[0] && (
                <div className="text-xs">
                  <span className="terminal-label">Token ID:</span> {deployment.token_id[0].toString()}
                </div>
              )}
            </div>
            <div className="mt-3 text-sm text-gray-400">
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
          <span className="terminal-prompt">&gt;&gt;</span> deployment_status
          {effectiveDeploymentId && (
            <span className="terminal-status float-right">
              [{uiState?.status.toUpperCase()}]
            </span>
          )}
        </div>
        
        {renderContent()}
        
        <div className="terminal-commands mt-4">
          {uiState?.status !== 'live' && (
            <button
              onClick={onClose}
              className="terminal-command"
            >
              &gt; hide_modal (continue in background)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};