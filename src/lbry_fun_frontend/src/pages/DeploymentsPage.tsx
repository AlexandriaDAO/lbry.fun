import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { RootState } from '@/store';
import { fetchDeploymentHistory } from '@/features/token/thunk/deploymentThunks';
import { setActiveDeploymentId } from '@/store/slices/deploymentSlice';
import { setActiveTokenView } from '@/store/slices/uiSlice';
import { getUIState } from '@/types/deployment';
import { useLbryFun } from '@/hooks/actors';

const DeploymentsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { actor: lbryFunActor } = useLbryFun();
  const deployments = useAppSelector((state: RootState) => state.deployment.deployments);
  
  useEffect(() => {
    if (lbryFunActor) {
      dispatch(fetchDeploymentHistory({ lbryFunActor }));
    }
    
    // Clean up when leaving the page
    return () => {
      // Don't clear activeDeploymentId here as it's needed for navigation
      // It will be cleared by the TokenPage cleanup
    };
  }, [dispatch, lbryFunActor]);
  
  const getStatusBadge = (status: 'deploying' | 'failed' | 'live') => {
    const badges = {
      deploying: 'bg-blue-900/20 border border-blue-500/30 text-blue-400 px-2 py-1 text-xs font-mono',
      failed: 'bg-red-900/20 border border-red-500/30 text-red-400 px-2 py-1 text-xs font-mono',
      live: 'bg-green-900/20 border border-green-500/30 text-green-400 px-2 py-1 text-xs font-mono'
    };
    
    return badges[status] || 'bg-gray-900/20 border border-gray-500/30 text-gray-400 px-2 py-1 text-xs font-mono';
  };
  
  const handleSelectDeployment = (deploymentId: string) => {
    // Navigate with deploymentId in URL instead of setting state
    navigate(`/?deploymentId=${deploymentId}`);
  };
  
  const sortedDeployments = Object.values(deployments || {})
    .filter(deployment => deployment && deployment.id)
    .sort((a, b) => Number(b.created_at - a.created_at));
  
  return (
    <div className="bg-black border border-white/30 font-mono text-sm p-4">
      <div className="font-mono font-bold text-white mb-1 text-sm uppercase">
        <span className="text-pink-500">&gt;&gt;</span> deployment_history
        <span className="text-gray-400 text-xs float-right">
          [{sortedDeployments.length} deployments]
        </span>
      </div>
      
      {sortedDeployments.length === 0 ? (
        <div className="p-4">
          <div className="bg-blue-900/20 border border-blue-500/30 text-blue-400 p-3 font-mono text-sm">No deployments found</div>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedDeployments.map(deployment => (
            <div 
              key={deployment.id.toString()}
              className="bg-black border border-white/30 font-mono text-sm p-4 cursor-pointer hover:bg-gray-800"
              onClick={() => handleSelectDeployment(deployment.id.toString())}
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-gray-400 text-xs">ID:</span> {deployment.id.toString()}
                  <span className={`ml-3 ${getStatusBadge(getUIState(deployment.tokenStatus).status)}`}>
                    {getUIState(deployment.tokenStatus).status}
                  </span>
                </div>
                <div className="text-xs">
                  {new Date(Number(deployment.created_at / 1_000_000n)).toLocaleString()}
                </div>
              </div>
              
              {deployment.token_id && deployment.token_id.length > 0 && (
                <div className="text-xs mt-1">
                  <span className="text-gray-400 text-xs">Token ID:</span> {deployment.token_id[0].toString()}
                </div>
              )}
              
              {getUIState(deployment.tokenStatus).status === 'failed' && (
                <div className="text-xs mt-1 text-red-400">
                  {getUIState(deployment.tokenStatus).message}
                </div>
              )}
              
              {getUIState(deployment.tokenStatus).isRecoverable && (
                <div className="text-xs mt-1 text-yellow-400">
                  Click to recover this deployment
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <div className="flex gap-4 mt-4">
        <button
          onClick={() => navigate('/')}
          className="bg-black border border-white/30 text-white font-mono text-sm px-4 py-2 hover:bg-white/10"
        >
          &gt; create_new_token
        </button>
      </div>
    </div>
  );
};

export default DeploymentsPage;