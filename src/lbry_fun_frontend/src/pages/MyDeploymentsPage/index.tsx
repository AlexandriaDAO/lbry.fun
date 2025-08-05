import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { DeploymentCard } from './components/DeploymentCard';
import { useDeploymentPolling } from './hooks/useDeploymentPolling';
import { initializeDeployments, cleanupDeployment } from '@/features/token/thunk/deploymentThunks';
import { RefreshCw } from 'lucide-react';
import { selectAllDeployments } from '@/store/slices/deploymentSlice';

export const MyDeploymentsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const deployments = useAppSelector(selectAllDeployments);
  const { isPolling, togglePolling, refreshAll } = useDeploymentPolling();

  useEffect(() => {
    dispatch(initializeDeployments());
  }, [dispatch]);

  const sortedDeployments = deployments.sort(
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
              onRemove={(id) => dispatch(cleanupDeployment(id))}
              onViewToken={(tokenId) => navigate(`/swap?id=${tokenId}`)}
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

export default MyDeploymentsPage;