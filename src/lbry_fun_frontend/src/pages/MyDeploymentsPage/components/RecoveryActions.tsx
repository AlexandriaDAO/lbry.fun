import React from 'react';
import { DeploymentRecord } from '@/types/deployment';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
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