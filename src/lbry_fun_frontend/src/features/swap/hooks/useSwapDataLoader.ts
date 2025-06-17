import { useEffect, useState, useCallback } from 'react';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { RootState } from '@/store';

// Import thunks for data fetching
import getSecondaryratio from '../thunks/getSecondaryratio';
import getPrimaryMintRate from '../thunks/tokenomics/getPrimaryMintRate';
import getSecondaryFee from '../thunks/secondaryIcrc/getSecondaryFee';
import getPrimaryFee from '../thunks/primaryIcrc/getPrimaryFee';
import getAccountPrimaryBalance from '../thunks/primaryIcrc/getAccountPrimaryBalance';
import getSecondaryBalance from '../thunks/secondaryIcrc/getSecondaryBalance';
import getStakedInfo from '../thunks/getStakedInfo';
import getIcpBal from '@/features/icp-ledger/thunks/getIcpBal';
import getIcpPrice from '@/features/icp-ledger/thunks/getIcpPrice';
import getCanisterBal from '@/features/icp-ledger/thunks/getCanisterBal';
import getArchivedBal from '../thunks/getArchivedBal';
import getCanisterArchivedBal from '../thunks/getCanisterArchivedBal';

export enum LoadingPhase {
  IDLE = 'IDLE',
  LOADING_POOL = 'LOADING_POOL',
  LOADING_CRITICAL = 'LOADING_CRITICAL',
  LOADING_SECONDARY = 'LOADING_SECONDARY',
  READY = 'READY',
  ERROR = 'ERROR'
}

interface UseSwapDataLoaderReturn {
  loadingPhase: LoadingPhase;
  isSwapReady: boolean;
  criticalDataLoaded: boolean;
  error: string | null;
  retryLoading: () => void;
}

export const useSwapDataLoader = (): UseSwapDataLoaderReturn => {
  const dispatch = useAppDispatch();
  const { activeSwapPool } = useAppSelector((state: RootState) => state.swap);
  const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
  
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>(LoadingPhase.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Critical data that must be loaded before rendering
  const loadCriticalData = useCallback(async () => {
    if (!activeSwapPool) return;
    
    setLoadingPhase(LoadingPhase.LOADING_CRITICAL);
    
    try {
      // Load critical data in parallel
      const criticalPromises = [
        dispatch(getSecondaryratio()).unwrap(),
        dispatch(getPrimaryMintRate()).unwrap(),
        dispatch(getSecondaryFee()).unwrap(),
        dispatch(getPrimaryFee()).unwrap(),
        dispatch(getIcpPrice()).unwrap(),
        dispatch(getCanisterBal()).unwrap(), // Needed for burn calculations
        dispatch(getCanisterArchivedBal()).unwrap(), // Also needed for burn calculations
      ];

      // If authenticated, also load user-specific critical data
      if (isAuthenticated && principal) {
        criticalPromises.push(
          dispatch(getIcpBal(principal)).unwrap(),
          dispatch(getAccountPrimaryBalance(principal)).unwrap(),
          dispatch(getSecondaryBalance(principal)).unwrap()
        );
      }

      await Promise.all(criticalPromises);
      
      setLoadingPhase(LoadingPhase.LOADING_SECONDARY);
    } catch (err) {
      setError('Failed to load critical data');
      setLoadingPhase(LoadingPhase.ERROR);
      throw err;
    }
  }, [activeSwapPool, dispatch, isAuthenticated, principal]);

  // Secondary data that can be loaded after initial render
  const loadSecondaryData = useCallback(async () => {
    if (!activeSwapPool || !isAuthenticated || !principal) {
      setLoadingPhase(LoadingPhase.READY);
      return;
    }
    
    try {
      // Load secondary data in parallel
      const secondaryPromises = [
        dispatch(getStakedInfo(principal)).unwrap(),
        dispatch(getArchivedBal(principal)).unwrap(),
      ];

      await Promise.all(secondaryPromises);
      
      setLoadingPhase(LoadingPhase.READY);
    } catch (err) {
      // Secondary data failures are non-critical
      console.error('Failed to load secondary data:', err);
      // Still mark as ready since critical data is loaded
      setLoadingPhase(LoadingPhase.READY);
    }
  }, [activeSwapPool, dispatch, isAuthenticated, principal]);

  // Main loading orchestration
  useEffect(() => {
    const loadData = async () => {
      if (!activeSwapPool) {
        setLoadingPhase(LoadingPhase.LOADING_POOL);
        return;
      }

      try {
        await loadCriticalData();
        await loadSecondaryData();
      } catch (err) {
        console.error('Data loading failed:', err);
        
        // Implement exponential backoff retry
        if (retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1000;
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, delay);
        }
      }
    };

    loadData();
  }, [activeSwapPool, retryCount, loadCriticalData, loadSecondaryData]);

  const retryLoading = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setLoadingPhase(LoadingPhase.IDLE);
  }, []);

  return {
    loadingPhase,
    isSwapReady: loadingPhase === LoadingPhase.READY,
    criticalDataLoaded: [LoadingPhase.LOADING_SECONDARY, LoadingPhase.READY].includes(loadingPhase),
    error,
    retryLoading
  };
};