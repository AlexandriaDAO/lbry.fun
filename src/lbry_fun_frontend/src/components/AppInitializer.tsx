import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { setActiveDeploymentId } from '@/store/slices/deploymentSlice';
import { initializeDeployments } from '@/features/token/thunk/deploymentThunks';

const AppInitializer: React.FC = () => {
  const dispatch = useAppDispatch();
  
  useEffect(() => {
    // Initialize persisted deployments on app load
    dispatch(initializeDeployments());
  }, [dispatch]);
  
  return null;
};

export default AppInitializer;