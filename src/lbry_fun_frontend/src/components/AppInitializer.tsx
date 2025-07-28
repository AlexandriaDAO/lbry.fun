import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { setActiveDeployment } from '@/store/slices/deploymentSlice';
import { fetchDeploymentHistory } from '@/features/token/thunk/deploymentThunks';

const AppInitializer: React.FC = () => {
  const dispatch = useAppDispatch();
  
  useEffect(() => {
    // Check for active deployment on app load
    const activeDeploymentId = localStorage.getItem('activeDeploymentId');
    
    if (activeDeploymentId) {
      // Restore deployment state
      dispatch(setActiveDeployment(activeDeploymentId));
      dispatch(fetchDeploymentHistory());
    }
  }, [dispatch]);
  
  return null;
};

export default AppInitializer;