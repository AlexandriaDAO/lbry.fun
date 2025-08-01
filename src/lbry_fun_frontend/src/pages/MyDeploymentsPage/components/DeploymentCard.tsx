import React from 'react';
import { DeploymentRecord, getUIState } from '@/types/deployment';
import { DeploymentProgress } from './DeploymentProgress';
import { PoolCreationStatus } from './PoolCreationStatus';
import { RecoveryActions } from './RecoveryActions';
import { formatDistanceToNow } from 'date-fns';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { executeTokenDeployment, recoverDeployment } from '@/features/token/thunk/deploymentThunks';

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
      {uiState.status === 'live' && deployment.token_id && deployment.token_id.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => onViewToken(deployment.token_id![0])}
            className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white"
          >
            View Token →
          </button>
        </div>
      )}

      {/* Actions for stuck deployments (0% progress) */}
      {uiState.status === 'deploying' && uiState.progress === 0 && (
        <StuckDeploymentActions deployment={deployment} />
      )}

      {/* Recovery actions */}
      {uiState.isRecoverable && (
        <RecoveryActions deployment={deployment} />
      )}
      
      {/* Remove button for failed deployments */}
      {uiState.status === 'failed' && !uiState.isRecoverable && (
        <div className="mt-3">
          <button
            onClick={() => onRemove(deployment.id.toString())}
            className="w-full bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded text-white text-sm"
          >
            Remove from List
          </button>
        </div>
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

// Component for stuck deployments (initiated but not executed)
const StuckDeploymentActions: React.FC<{ deployment: DeploymentRecord }> = ({ deployment }) => {
  const dispatch = useAppDispatch();
  const [isProcessing, setIsProcessing] = React.useState(false);
  
  const handleExecute = async () => {
    setIsProcessing(true);
    try {
      await dispatch(executeTokenDeployment(deployment.id.toString()));
    } catch (error) {
      console.error('Failed to execute deployment:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleCancel = async () => {
    setIsProcessing(true);
    try {
      await dispatch(recoverDeployment());
    } catch (error) {
      console.error('Failed to cancel deployment:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="mt-4 bg-yellow-900/20 border border-yellow-500 p-3 rounded">
      <div className="flex items-start gap-2 mb-3">
        <span className="text-yellow-500">⚠️</span>
        <div className="flex-1">
          <p className="text-sm text-yellow-400 font-semibold">Deployment Stuck</p>
          <p className="text-xs text-gray-300 mt-1">
            This deployment was initiated but never executed. You can either continue or cancel it.
          </p>
        </div>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={handleExecute}
          disabled={isProcessing}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-3 py-2 rounded text-white text-sm"
        >
          {isProcessing ? 'Processing...' : 'Continue Deployment'}
        </button>
        
        <button
          onClick={handleCancel}
          disabled={isProcessing}
          className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 px-3 py-2 rounded text-white text-sm"
        >
          {isProcessing ? 'Processing...' : 'Cancel & Recover (4 ICP)'}
        </button>
      </div>
    </div>
  );
};