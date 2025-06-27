import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { RootState } from '@/store';
import { setActiveSwapPool } from '../store/swapSlice';
import getTokenPools from '@/features/token/thunk/getTokenPools.thunk';
import fetchTokenLogosForPool from '@/features/token/thunk/fetchTokenLogosForPoolThunk';
import { fetchTokenomicsSchedule, fetchTokenomicsCurrentState } from '../thunks/tokenomicsThunks';

export enum PoolInitState {
  IDLE = 'IDLE',
  LOADING_POOLS = 'LOADING_POOLS',
  SETTING_POOL = 'SETTING_POOL',
  READY = 'READY',
  ERROR = 'ERROR',
  INVALID_POOL = 'INVALID_POOL'
}

interface UsePoolInitializerReturn {
  poolInitState: PoolInitState;
  isPoolReady: boolean;
  error: string | null;
}

export const usePoolInitializer = (): UsePoolInitializerReturn => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idFromUrl = searchParams.get("id");
  
  const { activeSwapPool } = useAppSelector((state: RootState) => state.swap);
  const { tokenPools, loading: lbryFunLoading, error: lbryFunError, success: lbryFunSuccess } = 
    useAppSelector((state: RootState) => state.lbryFun);
  
  const [poolInitState, setPoolInitState] = useState<PoolInitState>(PoolInitState.IDLE);
  const [error, setError] = useState<string | null>(null);

  // Load token pools if not already loaded
  useEffect(() => {
    if (tokenPools.length === 0 && !lbryFunLoading && !lbryFunError) {
      setPoolInitState(PoolInitState.LOADING_POOLS);
      dispatch(getTokenPools());
    }
  }, [dispatch, tokenPools.length, lbryFunLoading, lbryFunError]);

  // Handle pool initialization based on URL
  useEffect(() => {
    // If no ID in URL but we have an active pool, update the URL instead of redirecting
    if (!idFromUrl && activeSwapPool) {
      const currentPath = window.location.pathname;
      navigate(`${currentPath}?id=${activeSwapPool[0]}`, { replace: true });
      return;
    }
    
    // Only redirect to home if we have neither URL param nor active pool
    if (!idFromUrl && !activeSwapPool) {
      navigate('/');
      return;
    }

    // Wait for pools to load
    if (lbryFunLoading) {
      setPoolInitState(PoolInitState.LOADING_POOLS);
      return;
    }

    // Handle loading error
    if (lbryFunError) {
      setPoolInitState(PoolInitState.ERROR);
      setError('Failed to load token pools');
      return;
    }

    // Find the pool matching the URL ID
    const pool = tokenPools.find((p) => p[0] === idFromUrl);

    if (pool) {
      // Only update if different from current pool
      if (!activeSwapPool || activeSwapPool[0] !== pool[0]) {
        setPoolInitState(PoolInitState.SETTING_POOL);
        dispatch(setActiveSwapPool(pool));
        
        // Load token logos if needed
        const poolData = pool[1];
        if ((poolData.primary_token_id && !poolData.primary_token_logo_base64) || 
            (poolData.secondary_token_id && !poolData.secondary_token_logo_base64)) {
          dispatch(fetchTokenLogosForPool({
            poolId: pool[0],
            primaryTokenId: poolData.primary_token_id,
            secondaryTokenId: poolData.secondary_token_id,
          }));
        }
        
        // Fetch tokenomics schedule and current state for the pool
        if (poolData.tokenomics_canister_id) {
          dispatch(fetchTokenomicsSchedule(poolData.tokenomics_canister_id));
          dispatch(fetchTokenomicsCurrentState(poolData.tokenomics_canister_id));
        }
      }
      setPoolInitState(PoolInitState.READY);
    } else if (lbryFunSuccess && tokenPools.length > 0) {
      // Pool ID not found
      setPoolInitState(PoolInitState.INVALID_POOL);
      setError(`Token pool with ID "${idFromUrl}" not found`);
      
      // Clear active pool if set
      if (activeSwapPool !== null) {
        dispatch(setActiveSwapPool(null));
      }
    }
  }, [idFromUrl, tokenPools, lbryFunLoading, lbryFunError, dispatch, activeSwapPool, lbryFunSuccess, navigate]);

  return {
    poolInitState,
    isPoolReady: poolInitState === PoolInitState.READY && activeSwapPool !== null,
    error
  };
};