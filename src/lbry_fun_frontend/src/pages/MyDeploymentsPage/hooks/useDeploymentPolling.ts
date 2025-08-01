import { useState, useEffect, useCallback } from 'react';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { fetchDeploymentHistory } from '@/features/token/thunk/deploymentThunks';
import { selectActiveDeployments } from '@/store/slices/deploymentSlice';

export const useDeploymentPolling = () => {
  const dispatch = useAppDispatch();
  const activeDeployments = useAppSelector(selectActiveDeployments);
  const [isPolling, setIsPolling] = useState(true);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Auto-refresh active deployments
  useEffect(() => {
    if (isPolling && activeDeployments.length > 0) {
      const interval = setInterval(() => {
        dispatch(fetchDeploymentHistory());
      }, 10000); // Refresh every 10 seconds

      setPollingInterval(interval);

      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    }
  }, [isPolling, activeDeployments.length, dispatch]);

  const togglePolling = useCallback(() => {
    setIsPolling(prev => !prev);
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [pollingInterval]);

  const refreshAll = useCallback(() => {
    dispatch(fetchDeploymentHistory());
  }, [dispatch]);

  return {
    isPolling,
    togglePolling,
    refreshAll
  };
};