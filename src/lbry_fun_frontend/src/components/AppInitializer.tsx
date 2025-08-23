import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { setActiveDeploymentId } from '@/store/slices/deploymentSlice';
import { initializeDeployments } from '@/features/token/thunk/deploymentThunks';
import { clearAuth, setAuthInitialized } from '@/features/auth/authSlice';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { clearAuthCaches } from '@/features/auth/utils/authUtils';
import { useLbryFun } from '@/hooks/actors';

const AppInitializer: React.FC = () => {
  const dispatch = useAppDispatch();
  const { identity, isInitializing } = useInternetIdentity();
  const { actor: lbryFunActor } = useLbryFun();
  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);
  const principal = useAppSelector(state => state.auth.principal);
  
  useEffect(() => {
    // Initialize persisted deployments on app load
    if (lbryFunActor) {
      dispatch(initializeDeployments({ lbryFunActor }));
    }
  }, [dispatch, lbryFunActor]);
  
  // Validate session state on mount and when identity changes
  useEffect(() => {
    // Skip validation while Internet Identity is initializing
    if (isInitializing) return;
    
    // Check if UI thinks user is authenticated but Internet Identity has no valid identity
    const hasValidIdentity = identity && identity.getPrincipal().toText() !== '2vxsx-fae';
    const uiShowsAuthenticated = isAuthenticated && principal;
    
    // Session check debugging removed - uncomment if needed
    // console.log('[AppInitializer] Session check:', {
    //   isInitializing,
    //   hasValidIdentity,
    //   uiShowsAuthenticated,
    //   identityPrincipal: identity?.getPrincipal().toText(),
    //   reduxPrincipal: principal
    // });
    
    if (uiShowsAuthenticated && !hasValidIdentity) {
      // Session expired - clearing auth state
      dispatch(clearAuth());
      clearAuthCaches(); // Clear all cached actors and agents
      // Force page reload to clear any cached actor state
      window.location.reload();
    }
    
    // Mark auth as initialized after first check
    dispatch(setAuthInitialized(true));
  }, [dispatch, identity, isInitializing, isAuthenticated, principal]);
  
  // Set up periodic validation (every 5 minutes)
  useEffect(() => {
    const validateSession = () => {
      if (isInitializing) return;
      
      const hasValidIdentity = identity && identity.getPrincipal().toText() !== '2vxsx-fae';
      const uiShowsAuthenticated = isAuthenticated && principal;
      
      if (uiShowsAuthenticated && !hasValidIdentity) {
        console.warn('[AppInitializer] Periodic check: Session expired - clearing auth state');
        dispatch(clearAuth());
        clearAuthCaches(); // Clear all cached actors and agents
      }
    };
    
    const interval = setInterval(validateSession, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(interval);
  }, [dispatch, identity, isInitializing, isAuthenticated, principal]);
  
  return null;
};

export default AppInitializer;