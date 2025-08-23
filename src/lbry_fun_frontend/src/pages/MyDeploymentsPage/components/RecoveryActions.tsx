import React, { useState, useEffect } from 'react';
import { DeploymentRecord } from '@/types/deployment';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { recoverDeployment } from '@/features/token/thunk/deploymentThunks';
import { useLbryFun } from '@/hooks/actors';

interface RecoveryActionsProps {
  deployment: DeploymentRecord;
}

interface BlockerInfo {
  type: 'icp' | 'cycles' | 'transfer' | 'other';
  required?: number;
  available?: number;
  message?: string;
}

export const RecoveryActions: React.FC<RecoveryActionsProps> = ({ deployment }) => {
  const dispatch = useAppDispatch();
  const { actor: lbryFunActor } = useLbryFun();
  const [isRecovering, setIsRecovering] = useState(false);
  const [localError, setLocalError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [secondsUntilRetry, setSecondsUntilRetry] = useState(0);
  
  // Parse the last_error field for structured blocker information
  const getBlockerInfo = (): BlockerInfo | null => {
    const lastError = deployment.last_error?.[0]; // last_error is optional array
    if (!lastError) return null;
    
    if (lastError.startsWith('INSUFFICIENT_ICP:')) {
      const parts = lastError.split(':');
      return {
        type: 'icp',
        required: Number(parts[1]) / 100_000_000, // Convert from e8s to ICP
        available: Number(parts[2]) / 100_000_000
      };
    }
    
    if (lastError === 'INSUFFICIENT_CYCLES') {
      return { type: 'cycles' };
    }
    
    if (lastError.startsWith('TRANSFER_FAILED:')) {
      return { 
        type: 'transfer',
        message: lastError.substring('TRANSFER_FAILED:'.length)
      };
    }
    
    return { type: 'other', message: lastError };
  };
  
  // Calculate retry cooldown based on last_activity
  useEffect(() => {
    const checkCooldown = () => {
      const now = Date.now() * 1_000_000; // Convert to nanoseconds
      const lastActivity = Number(deployment.last_activity);
      const timeSinceLastActivity = now - lastActivity;
      const cooldownNanos = 60_000_000_000; // 60 seconds in nanoseconds
      
      if (timeSinceLastActivity < cooldownNanos) {
        const remainingSeconds = Math.ceil((cooldownNanos - timeSinceLastActivity) / 1_000_000_000);
        setSecondsUntilRetry(remainingSeconds);
      } else {
        setSecondsUntilRetry(0);
      }
    };
    
    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, [deployment.last_activity]);
  
  const handleRecover = async () => {
    if (!lbryFunActor) {
      setLocalError('Actor not available');
      return;
    }
    
    setIsRecovering(true);
    setLocalError('');
    setSuccessMessage('');
    
    try {
      const result = await dispatch(recoverDeployment({ actor: lbryFunActor }));
      
      if (recoverDeployment.fulfilled.match(result)) {
        setSuccessMessage(result.payload as string);
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(''), 5000);
      } else if (recoverDeployment.rejected.match(result)) {
        const error = result.payload as { title?: string; message?: string } | string;
        const errorMessage = typeof error === 'string' 
          ? error 
          : error.message || 'Recovery failed';
        
        setLocalError(errorMessage);
      }
    } catch (error) {
      console.error('Recovery error:', error);
      setLocalError('An unexpected error occurred during recovery');
    } finally {
      setIsRecovering(false);
    }
  };
  
  const blocker = getBlockerInfo();
  const canRetry = secondsUntilRetry === 0;
  
  return (
    <div className="mt-4 bg-black/40 p-4 rounded">
      <h4 className="text-green-400 font-semibold mb-2">Recovery Status</h4>
      
      {/* Progress information */}
      <div className="text-sm text-gray-300 mb-3 space-y-1">
        <p>
          Refund amount: 4 ICP (5 ICP payment - 1 ICP platform fee)
        </p>
      </div>
      
      {/* Show specific blocker if any */}
      {blocker && (
        <div className="mb-3 p-2 bg-yellow-900/20 border border-yellow-500/50 rounded">
          {blocker.type === 'icp' ? (
            <>
              <p className="text-yellow-400 text-sm font-semibold">Waiting for ICP</p>
              <p className="text-yellow-300 text-xs mt-1">
                Need {blocker.required?.toFixed(4)} ICP, have {blocker.available?.toFixed(4)} ICP
              </p>
              <p className="text-yellow-300 text-xs mt-1">
                Contact admin to add {((blocker.required || 0) - (blocker.available || 0)).toFixed(4)} ICP
              </p>
            </>
          ) : blocker.type === 'cycles' ? (
            <>
              <p className="text-yellow-400 text-sm font-semibold">Insufficient Cycles</p>
              <p className="text-yellow-300 text-xs mt-1">
                Canister needs cycles to complete cleanup. Contact admin.
              </p>
            </>
          ) : blocker.type === 'transfer' ? (
            <>
              <p className="text-yellow-400 text-sm font-semibold">Transfer Failed</p>
              <p className="text-yellow-300 text-xs mt-1">{blocker.message}</p>
            </>
          ) : (
            <p className="text-yellow-400 text-sm">{blocker.message}</p>
          )}
        </div>
      )}
      
      {successMessage && (
        <div className="mb-3 p-2 bg-green-900/20 border border-green-500/50 rounded text-green-400 text-sm">
          {successMessage}
        </div>
      )}
      
      {localError && (
        <div className="mb-3 p-2 bg-red-900/20 border border-red-500/50 rounded text-red-400 text-sm">
          {localError}
        </div>
      )}
      
      <button
        onClick={handleRecover}
        disabled={!canRetry || isRecovering}
        className={`w-full px-4 py-2 rounded text-white transition-colors ${
          !canRetry || isRecovering
            ? 'bg-gray-600 cursor-not-allowed' 
            : 'bg-orange-600 hover:bg-orange-700'
        }`}
      >
        {isRecovering ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            Processing Recovery...
          </span>
        ) : !canRetry ? (
          `Retry in ${secondsUntilRetry}s`
        ) : (
          'Retry Recovery'
        )}
      </button>
      
    </div>
  );
};