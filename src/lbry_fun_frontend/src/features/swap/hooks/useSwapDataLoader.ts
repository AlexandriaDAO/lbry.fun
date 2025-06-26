import { useEffect, useState, useCallback } from 'react';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { RootState } from '@/store';
import { performanceMonitor } from '../utils/performanceMonitor';
import { setIsLoadingCriticalData, setIsLoadingSecondaryData } from '../swapSlice';
import { useIcpBalance } from '@/hooks/useIcpBalance';

// Import thunks for data fetching
import { stakingThunks } from '../thunks/stakingThunks';
import { tradingThunks } from '../thunks/tradingThunks';
import { balanceThunks } from '../thunks/balanceThunks';
import { analyticsThunks } from '../thunks/analyticsThunks';
import getIcpPrice from '@/features/icp-ledger/thunks/getIcpPrice';
import getCanisterBal from '@/features/icp-ledger/thunks/getCanisterBal';

// Destructure for easier access
const { getStakedInfo } = stakingThunks;
const { getSecondaryRatio } = tradingThunks;
const { getPrimaryBalance, getSecondaryBalance, getPrimaryFee, getSecondaryFee, getArchivedBalance, getCanisterArchivedBalance } = balanceThunks;
const { getPrimaryMintRate, getTokenomicsInfo, getTotalPrimarySupply } = analyticsThunks;

export enum LoadingPhase {
  IDLE = 'IDLE',
  LOADING_POOL = 'LOADING_POOL',
  LOADING_CRITICAL = 'LOADING_CRITICAL',
  LOADING_SECONDARY = 'LOADING_SECONDARY',
  READY = 'READY'
}

interface UseSwapDataLoaderReturn {
  loadingPhase: LoadingPhase;
  isSwapReady: boolean;
  criticalDataLoaded: boolean;
}

export const useSwapDataLoader = (): UseSwapDataLoaderReturn => {
  const dispatch = useAppDispatch();
  const { activeSwapPool, isLoadingCriticalData, isLoadingSecondaryData } = useAppSelector((state: RootState) => state.swap);
  const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
  
  // Use the optimized ICP balance hook
  useIcpBalance();
  
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>(LoadingPhase.IDLE);

  // Critical data that must be loaded before rendering
  const loadCriticalData = useCallback(async () => {
    if (!activeSwapPool || isLoadingCriticalData) return;
    
    dispatch(setIsLoadingCriticalData(true));
    setLoadingPhase(LoadingPhase.LOADING_CRITICAL);
    performanceMonitor.startMetric('loadCriticalData');
    
    try {
      // Separate public data (always loads) from user data (only when authenticated)
      const publicDataPromises = [
        dispatch(getSecondaryRatio()).unwrap(),
        dispatch(getPrimaryMintRate()).unwrap(),
        dispatch(getSecondaryFee()).unwrap(),
        dispatch(getPrimaryFee()).unwrap(),
        dispatch(getIcpPrice()).unwrap(),
        dispatch(getCanisterBal()).unwrap(), // Needed for burn calculations
        dispatch(getCanisterArchivedBalance()).unwrap(), // Also needed for burn calculations
      ];
      
      // Add tokenomics data fetching if we have the canister IDs
      if (activeSwapPool[1].primary_token_id) {
        publicDataPromises.push(dispatch(getTotalPrimarySupply(activeSwapPool[1].primary_token_id)).unwrap());
      }
      if (activeSwapPool[1].tokenomics_canister_id) {
        publicDataPromises.push(dispatch(getTokenomicsInfo(activeSwapPool[1].tokenomics_canister_id)).unwrap());
      }

      // Load public data first - these should work without authentication
      try {
        await Promise.all(publicDataPromises);
      } catch (publicErr) {
        console.warn('Some public data failed to load:', publicErr);
        // Continue anyway - UI can show with partial data
      }

      // If authenticated, also load user-specific critical data
      if (isAuthenticated && principal) {
        const userDataPromises = [
          dispatch(getPrimaryBalance(principal)).unwrap(),
          dispatch(getSecondaryBalance(principal)).unwrap()
        ];

        try {
          await Promise.all(userDataPromises);
        } catch (userErr) {
          console.warn('User data failed to load:', userErr);
          // This is OK - user might not have balances yet
        }
      }
      
      performanceMonitor.endMetric('loadCriticalData', 'success');
    } catch (err) {
      performanceMonitor.endMetric('loadCriticalData', 'error', err instanceof Error ? err.message : 'Unknown error');
      // Only show error for complete failure, not partial failures
      console.error('Critical data loading error:', err);
    } finally {
      dispatch(setIsLoadingCriticalData(false));
    }
    
    // Always proceed to secondary loading regardless of errors
    setLoadingPhase(LoadingPhase.LOADING_SECONDARY);
  }, [activeSwapPool, dispatch, isAuthenticated, principal, isLoadingCriticalData]);

  // Secondary data that can be loaded after initial render
  const loadSecondaryData = useCallback(async () => {
    if (!activeSwapPool || !isAuthenticated || !principal || isLoadingSecondaryData) {
      setLoadingPhase(LoadingPhase.READY);
      return;
    }
    
    dispatch(setIsLoadingSecondaryData(true));
    performanceMonitor.startMetric('loadSecondaryData');
    
    try {
      // Load secondary data in parallel
      const secondaryPromises = [
        dispatch(getStakedInfo(principal)).unwrap(),
        dispatch(getArchivedBalance(principal)).unwrap(),
      ];

      await Promise.all(secondaryPromises);
      
      performanceMonitor.endMetric('loadSecondaryData', 'success');
      setLoadingPhase(LoadingPhase.READY);
    } catch (err) {
      performanceMonitor.endMetric('loadSecondaryData', 'error', err instanceof Error ? err.message : 'Unknown error');
      // Secondary data failures are non-critical
      console.error('Failed to load secondary data:', err);
      // Still mark as ready since critical data is loaded
      setLoadingPhase(LoadingPhase.READY);
    } finally {
      dispatch(setIsLoadingSecondaryData(false));
    }
  }, [activeSwapPool, dispatch, isAuthenticated, principal, isLoadingSecondaryData]);

  // Main loading orchestration
  useEffect(() => {
    const loadData = async () => {
      if (!activeSwapPool) {
        setLoadingPhase(LoadingPhase.LOADING_POOL);
        return;
      }

      // Always try to load data, don't let errors block the UI
      await loadCriticalData();
      await loadSecondaryData();
    };

    loadData();
  }, [activeSwapPool]); // Only depend on activeSwapPool to prevent unnecessary re-runs

  return {
    loadingPhase,
    isSwapReady: loadingPhase === LoadingPhase.READY,
    criticalDataLoaded: [LoadingPhase.LOADING_SECONDARY, LoadingPhase.READY].includes(loadingPhase)
  };
};