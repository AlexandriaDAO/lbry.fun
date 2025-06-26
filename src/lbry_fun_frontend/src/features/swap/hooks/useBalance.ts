import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useBalanceWithLoading } from './useSwapState';
import { balanceThunks } from '../thunks/balanceThunks';

// Destructure for easier access
const { getPrimaryBalance, getSecondaryBalance } = balanceThunks;

interface UseBalanceOptions {
  refreshOnMount?: boolean;
  autoRefreshInterval?: number; // in milliseconds, 0 to disable
}

export const useBalance = (options: UseBalanceOptions = {}) => {
  const { refreshOnMount = true, autoRefreshInterval = 0 } = options;
  
  const dispatch = useAppDispatch();
  const { principal, isAuthenticated } = useAppSelector(state => state.auth);
  const { balances, loading } = useBalanceWithLoading();

  const refreshBalances = useCallback(() => {
    if (isAuthenticated && principal) {
      dispatch(getPrimaryBalance(principal));
      dispatch(getSecondaryBalance(principal));
    }
  }, [dispatch, isAuthenticated, principal]);

  // Initial load on mount
  useEffect(() => {
    if (refreshOnMount) {
      refreshBalances();
    }
  }, [refreshOnMount, refreshBalances]);

  // Auto refresh interval
  useEffect(() => {
    if (autoRefreshInterval > 0) {
      const interval = setInterval(refreshBalances, autoRefreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefreshInterval, refreshBalances]);

  return {
    balances,
    loading,
    refreshBalances,
    isAuthenticated,
  };
};

// Specific balance hooks for individual tokens
export const usePrimaryBalance = () => {
  const { balances, loading, refreshBalances } = useBalance();
  
  return {
    balance: balances.primary.balance,
    fee: balances.primary.fee,
    priceUsd: balances.primary.priceUsd,
    loading,
    refresh: refreshBalances,
  };
};

export const useSecondaryBalance = () => {
  const { balances, loading, refreshBalances } = useBalance();
  
  return {
    balance: balances.secondary.balance,
    fee: balances.secondary.fee,
    ratio: balances.secondary.ratio,
    loading,
    refresh: refreshBalances,
  };
};

export const useIcpBalance = () => {
  const { balances, loading, refreshBalances } = useBalance();
  
  return {
    balance: balances.icp.balance,
    archivedBalance: balances.icp.archivedBalance,
    loading,
    refresh: refreshBalances,
  };
};