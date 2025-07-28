import React, { useEffect, useState } from 'react';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { RootState } from '@/store';
import { 
  executeTokenDeployment, 
  recoverDeployment,
  fetchDeploymentHistory 
} from '../thunk/deploymentThunks';
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
  const deployment = useAppSelector((state: RootState) => 
    deploymentId ? state.deployment.deployments[deploymentId] : null
  );
  const [localError, setLocalError] = useState<string>('');
  
  const [recoveryCountdown, setRecoveryCountdown] = useState<number>(0);
  
  useEffect(() => {
    if (isOpen && deploymentId && deployment?.frontendStatus === DeploymentStatus.INITIATED) {
      executePhase2();
    }
  }, [isOpen, deploymentId, deployment?.frontendStatus]);
  
  useEffect(() => {
    if (deployment?.frontendStatus === DeploymentStatus.FAILED && !deployment.recoverable) {
      const interval = setInterval(() => {
        const timeSinceActivity = Date.now() - Number(deployment.last_activity / 1_000_000n);
        const timeUntilRecovery = Math.max(0, 300000 - timeSinceActivity);
        setRecoveryCountdown(timeUntilRecovery);
        
        if (timeUntilRecovery === 0) {
          clearInterval(interval);
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
      onSuccess(result.payload.token_id);
    } else if (result.payload?.isTimeout) {
      setLocalError('Deployment is taking longer than expected. Monitoring status...');
    } else {
      setLocalError(result.payload?.message || 'Deployment failed');
    }
  };
  
  const handleRecover = async () => {
    const result = await dispatch(recoverDeployment());
    
    if (recoverDeployment.fulfilled.match(result)) {
      setLocalError('');
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
              
              <div className="terminal-progress mb-3">
                <span className="terminal-label">Progress:</span>
                <div className="mt-1">
                  <div className="w-48 h-2 border border-green-400 inline-block">
                    <div 
                      className="h-full bg-green-400 transition-all duration-300 ease-out" 
                      style={{
                        width: `${(canisterCount / 5) * 100}%`
                      }} 
                    />
                  </div>
                  <span className="ml-2">{canisterCount}/5</span>
                </div>
              </div>
              
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
              const timeUntilRecovery = Math.max(0, 300000 - timeSinceActivity);
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