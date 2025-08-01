import React, { useEffect, useState } from 'react';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { 
  executeTokenDeployment, 
  recoverDeployment,
  pollDeploymentStatus
} from '../thunk/deploymentThunks';
import { selectDeploymentById, selectDeploymentUIState } from '@/store/slices/deploymentSlice';
import { DeploymentProgress } from '@/pages/MyDeploymentsPage/components/DeploymentProgress';
import { PoolCreationStatus } from '@/pages/MyDeploymentsPage/components/PoolCreationStatus';

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
    deploymentId ? selectDeploymentById(deploymentId)(state) : null
  );
  const uiState = useAppSelector(state => 
    deploymentId ? selectDeploymentUIState(deploymentId)(state) : null
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
      onSuccess(deployment.token_id[0]);
    }
  }, [deployment, uiState?.status, onSuccess]);
  
  const executePhase2 = async () => {
    if (!deploymentId) return;
    
    console.log('DeploymentStatusModal: Starting phase 2 execution for deployment:', deploymentId);
    const result = await dispatch(executeTokenDeployment(deploymentId));
    
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
            
            <DeploymentProgress 
              progress={uiState.progress} 
              message={uiState.message}
            />
            
            {/* Show pool creation warning when near completion */}
            {uiState.progress >= 95 && (
              <div className="mt-4">
                <PoolCreationStatus />
              </div>
            )}
            
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
                <span className="terminal-label">ID:</span> {deploymentId}
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
          {deploymentId && (
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