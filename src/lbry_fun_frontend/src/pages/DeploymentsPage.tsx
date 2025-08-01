import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { RootState } from '@/store';
import { fetchDeploymentHistory } from '@/features/token/thunk/deploymentThunks';
import { setActiveDeploymentId } from '@/store/slices/deploymentSlice';
import { getUIState } from '@/types/deployment';

const DeploymentsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const deployments = useAppSelector((state: RootState) => state.deployment.deployments);
  
  useEffect(() => {
    dispatch(fetchDeploymentHistory());
  }, []);
  
  const getStatusBadge = (status: 'deploying' | 'failed' | 'live') => {
    const badges = {
      deploying: 'terminal-badge-info',
      failed: 'terminal-badge-error',
      live: 'terminal-badge-success'
    };
    
    return badges[status] || 'terminal-badge';
  };
  
  const handleSelectDeployment = (deploymentId: string) => {
    dispatch(setActiveDeploymentId(deploymentId));
    navigate('/');
  };
  
  const sortedDeployments = Object.values(deployments || {})
    .filter(deployment => deployment && deployment.id)
    .sort((a, b) => Number(b.created_at - a.created_at));
  
  return (
    <div className="terminal-page">
      <div className="terminal-header">
        <span className="terminal-prompt">&gt;&gt;</span> deployment_history
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
              className="terminal-list-item cursor-pointer hover:bg-gray-800"
              onClick={() => handleSelectDeployment(deployment.id.toString())}
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="terminal-label">ID:</span> {deployment.id.toString()}
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
                  <span className="terminal-label">Token ID:</span> {deployment.token_id[0].toString()}
                </div>
              )}
              
              {getUIState(deployment.tokenStatus).status === 'failed' && (
                <div className="text-xs mt-1 terminal-error">
                  {getUIState(deployment.tokenStatus).message}
                </div>
              )}
              
              {getUIState(deployment.tokenStatus).isRecoverable && (
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
          &gt; create_new_token
        </button>
      </div>
    </div>
  );
};

export default DeploymentsPage;