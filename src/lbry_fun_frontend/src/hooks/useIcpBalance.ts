import { useEffect, useRef } from 'react';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import getIcpBal from '@/features/icp-ledger/thunks/getIcpBal';
import { RootState } from '@/store';

const BALANCE_STALE_TIME = 30000; // 30 seconds

/**
 * Smart hook for managing ICP balance fetching
 * - Prevents unnecessary fetches if balance was recently loaded
 * - Shared across all components to avoid duplicate requests
 * - Automatically refreshes when stale
 */
export const useIcpBalance = () => {
  const dispatch = useAppDispatch();
  const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
  const { accountBalance, loading, error } = useAppSelector((state: RootState) => state.icpLedger);
  
  // Track when balance was last fetched
  const lastFetchTime = useRef<number>(0);
  
  useEffect(() => {
    if (!isAuthenticated || !principal) {
      return;
    }
    
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime.current;
    
    // Only fetch if:
    // 1. We don't have a balance yet (accountBalance === "0" could be valid)
    // 2. The balance is stale (older than BALANCE_STALE_TIME)
    // 3. We haven't fetched yet in this component lifecycle
    const shouldFetch = 
      lastFetchTime.current === 0 || // Never fetched in this component
      timeSinceLastFetch > BALANCE_STALE_TIME; // Data is stale
    
    if (shouldFetch && !loading) {
      lastFetchTime.current = now;
      dispatch(getIcpBal(principal));
    }
  }, [isAuthenticated, principal, dispatch, loading]);
  
  return {
    balance: accountBalance,
    loading,
    error,
    isAuthenticated,
  };
};