import React, { createContext, useContext, ReactNode, useEffect, useCallback, useRef, useState } from 'react';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import getTokenPools from '@/features/token/thunk/getTokenPools.thunk';
import getIcpBal from '@/features/icp-ledger/thunks/getIcpBal';
import getAccountPrimaryBalance from '@/features/swap/thunks/primaryIcrc/getAccountPrimaryBalance';
import getSecondaryBalance from '@/features/swap/thunks/secondaryIcrc/getSecondaryBalance';
import fetchTransactionHistory from '@/features/swap/thunks/fetchTransactionHistory.thunk';
import getPrimaryMintRate from '@/features/swap/thunks/tokenomics/getPrimaryMintRate';
import getTokenomicsInfo from '@/features/swap/thunks/tokenomics/getTokenomicsInfo';
import getTotalPrimarySupply from '@/features/swap/thunks/tokenomics/getTotalPrimarySupply';
import getStakedInfo from '@/features/swap/thunks/getStakedInfo';
import claimReward from '@/features/swap/thunks/claimReward';
import getAllLogs from '@/features/swap/thunks/insights/getAllLogs.thunk';
import { Principal } from '@dfinity/principal';

// Loading phases for progressive loading
export enum LoadingPhase {
  IDLE = 'IDLE',
  LOADING_CRITICAL = 'LOADING_CRITICAL',  // Balances, pool data
  LOADING_SECONDARY = 'LOADING_SECONDARY', // Charts, logs, tokenomics
  READY = 'READY',
  ERROR = 'ERROR'
}

export interface UnifiedSwapData {
  // Core data (fetched immediately)
  poolData: any;
  balances: {
    icp: string;
    primary: string;
    secondary: string;
    staked: string;
    claimable: string;
  };
  rates: {
    primaryMintRate: bigint;
    secondaryMintRate: bigint;
  };
  
  // Lazy-loaded data
  transactions: any[];
  insights: any;
  tokenomics: any;
  
  // Loading states
  isLoading: {
    core: boolean;
    transactions: boolean;
    insights: boolean;
    tokenomics: boolean;
  };
  
  // Error states
  errors: {
    core: string | null;
    transactions: string | null;
    insights: string | null;
    tokenomics: string | null;
  };
  
  // Actions
  refreshBalances: () => Promise<void>;
  refreshRates: () => Promise<void>;
  refreshAll: () => Promise<void>;
  loadTransactions: () => Promise<void>;
  loadInsights: () => Promise<void>;
  loadTokenomics: () => Promise<void>;
}

const UnifiedSwapDataContext = createContext<UnifiedSwapData | undefined>(undefined);

export const useUnifiedSwapData = () => {
  const context = useContext(UnifiedSwapDataContext);
  if (!context) {
    throw new Error('useUnifiedSwapData must be used within UnifiedSwapDataProvider');
  }
  return context;
};

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface UnifiedSwapDataProviderProps {
  children: ReactNode;
}

const CACHE_DURATION = {
  POOL_DATA: 10 * 60 * 1000,     // 10 minutes (rarely changes)
  BALANCES: 30 * 1000,           // 30 seconds (user actions)
  RATES: 2 * 60 * 1000,          // 2 minutes (moderate frequency)
  TRANSACTIONS: 5 * 60 * 1000,   // 5 minutes
  INSIGHTS: 15 * 60 * 1000,      // 15 minutes (historical data)
  TOKENOMICS: 30 * 60 * 1000     // 30 minutes (static config)
};

export const UnifiedSwapDataProvider: React.FC<UnifiedSwapDataProviderProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  const { auth, swap, icpLedger, primary } = useAppSelector(state => state);
  
  // Cache refs
  const cacheRef = useRef<{
    poolData?: CacheEntry<any>;
    balances?: CacheEntry<any>;
    rates?: CacheEntry<any>;
    transactions?: CacheEntry<any>;
    insights?: CacheEntry<any>;
    tokenomics?: CacheEntry<any>;
  }>({});
  
  // Loading phase state
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>(LoadingPhase.IDLE);
  
  // Loading states
  const [isLoading, setIsLoading] = React.useState({
    core: true,
    transactions: false,
    insights: false,
    tokenomics: false
  });
  
  // Error states
  const [errors, setErrors] = React.useState({
    core: null as string | null,
    transactions: null as string | null,
    insights: null as string | null,
    tokenomics: null as string | null
  });

  const isAuthenticated = auth.isAuthenticated;
  const principal = auth.principal;
  const poolId = swap.activeSwapPool?.[0];

  // Helper to check if cache is valid
  const isCacheValid = <T,>(entry: CacheEntry<T> | undefined, duration: number): boolean => {
    if (!entry) return false;
    return Date.now() - entry.timestamp < duration;
  };

  // Stale-while-revalidate pattern for better UX
  const getCachedOrFetch = useCallback(async <T,>(
    key: string,
    fetcher: () => Promise<T>,
    duration: number
  ): Promise<T | null> => {
    const cached = cacheRef.current[key as keyof typeof cacheRef.current];
    
    // Return stale data immediately while fetching fresh
    if (cached && Date.now() - cached.timestamp < duration * 2) {
      if (Date.now() - cached.timestamp > duration) {
        // Fetch fresh data in background
        fetcher().then(data => {
          cacheRef.current[key as keyof typeof cacheRef.current] = { 
            data, 
            timestamp: Date.now() 
          } as any;
        }).catch(console.error);
      }
      return cached.data;
    }
    
    // No cache or too stale, fetch fresh
    try {
      const data = await fetcher();
      cacheRef.current[key as keyof typeof cacheRef.current] = { 
        data, 
        timestamp: Date.now() 
      } as any;
      return data;
    } catch (error) {
      console.error(`Failed to fetch ${key}:`, error);
      return null;
    }
  }, []);

  // Batch fetch core data
  const fetchCoreData = useCallback(async () => {
    if (!poolId) return;
    
    try {
      setLoadingPhase(LoadingPhase.LOADING_CRITICAL);
      setIsLoading(prev => ({ ...prev, core: true }));
      setErrors(prev => ({ ...prev, core: null }));
      
      // Check cache for pool data
      if (!isCacheValid(cacheRef.current.poolData, CACHE_DURATION.POOL_DATA)) {
        // Pool data is already loaded by usePoolInitializer
        // Just cache the current active pool
        cacheRef.current.poolData = {
          data: swap.activeSwapPool,
          timestamp: Date.now()
        };
      }
      
      // Fetch balances and rates in parallel if authenticated
      if (isAuthenticated && principal) {
        const principalObj = Principal.fromText(principal);
        
        // Batch balance fetches
        if (!isCacheValid(cacheRef.current.balances, CACHE_DURATION.BALANCES) && swap.activeSwapPool) {
          await Promise.all([
            dispatch(getIcpBal(principal)),
            dispatch(getAccountPrimaryBalance(principal)),
            dispatch(getSecondaryBalance(principal)),
            dispatch(getStakedInfo({ principalId: principal, poolId }))
          ]);
          
          cacheRef.current.balances = {
            data: {
              icp: icpLedger.accountBalance || '0',
              primary: primary.primaryBal || '0',
              secondary: swap.secondaryBalance || '0',
              staked: swap.stakeInfo?.stakedPrimary || '0',
              claimable: swap.stakeInfo?.rewardIcp || '0'
            },
            timestamp: Date.now()
          };
        }
      }
      
      // Fetch rates
      if (!isCacheValid(cacheRef.current.rates, CACHE_DURATION.RATES) && swap.activeSwapPool) {
        const tokenomicsCanisterId = swap.activeSwapPool[1].tokenomics_canister_id;
        await Promise.all([
          dispatch(getPrimaryMintRate()),
          dispatch(getTokenomicsInfo(tokenomicsCanisterId))
        ]);
        
        cacheRef.current.rates = {
          data: {
            primaryMintRate: swap.primaryMintRate || 0n,
            secondaryMintRate: swap.secondaryMintRate || 0n
          },
          timestamp: Date.now()
        };
      }
      
      setLoadingPhase(LoadingPhase.READY);
    } catch (error) {
      setLoadingPhase(LoadingPhase.ERROR);
      setErrors(prev => ({ ...prev, core: error instanceof Error ? error.message : 'Failed to load core data' }));
    } finally {
      setIsLoading(prev => ({ ...prev, core: false }));
    }
  }, [dispatch, poolId, isAuthenticated, principal, swap, icpLedger, primary]);

  // Lazy load transactions
  const loadTransactions = useCallback(async () => {
    if (!isAuthenticated || !principal || !poolId) return;
    
    if (isCacheValid(cacheRef.current.transactions, CACHE_DURATION.TRANSACTIONS)) {
      return;
    }
    
    try {
      setIsLoading(prev => ({ ...prev, transactions: true }));
      setErrors(prev => ({ ...prev, transactions: null }));
      
      await dispatch(fetchTransactionHistory({ 
        principal: Principal.fromText(principal),
        poolId 
      }));
      
      cacheRef.current.transactions = {
        data: swap.transactionHistory.transactions,
        timestamp: Date.now()
      };
    } catch (error) {
      setErrors(prev => ({ ...prev, transactions: error instanceof Error ? error.message : 'Failed to load transactions' }));
    } finally {
      setIsLoading(prev => ({ ...prev, transactions: false }));
    }
  }, [dispatch, isAuthenticated, principal, poolId, swap.transactions]);

  // Lazy load insights
  const loadInsights = useCallback(async () => {
    if (!poolId) return;
    
    if (isCacheValid(cacheRef.current.insights, CACHE_DURATION.INSIGHTS)) {
      return;
    }
    
    try {
      setIsLoading(prev => ({ ...prev, insights: true }));
      setErrors(prev => ({ ...prev, insights: null }));
      
      // Get logs canister ID from pool data
      const logsCanisterId = swap.activeSwapPool?.[1]?.logs_canister_id;
      if (logsCanisterId) {
        await dispatch(getAllLogs(logsCanisterId));
      }
      
      cacheRef.current.insights = {
        data: swap.logsData,
        timestamp: Date.now()
      };
    } catch (error) {
      setErrors(prev => ({ ...prev, insights: error instanceof Error ? error.message : 'Failed to load insights' }));
    } finally {
      setIsLoading(prev => ({ ...prev, insights: false }));
    }
  }, [dispatch, poolId, swap.logsData]);

  // Lazy load tokenomics
  const loadTokenomics = useCallback(async () => {
    if (!poolId) return;
    
    if (isCacheValid(cacheRef.current.tokenomics, CACHE_DURATION.TOKENOMICS)) {
      return;
    }
    
    try {
      setIsLoading(prev => ({ ...prev, tokenomics: true }));
      setErrors(prev => ({ ...prev, tokenomics: null }));
      
      // Tokenomics data is typically part of pool data
      // Add specific tokenomics fetch if needed
      
      cacheRef.current.tokenomics = {
        data: swap.activeSwapPool?.[1],
        timestamp: Date.now()
      };
    } catch (error) {
      setErrors(prev => ({ ...prev, tokenomics: error instanceof Error ? error.message : 'Failed to load tokenomics' }));
    } finally {
      setIsLoading(prev => ({ ...prev, tokenomics: false }));
    }
  }, [poolId, swap.activeSwapPool]);

  // Refresh functions
  const refreshBalances = useCallback(async () => {
    cacheRef.current.balances = undefined;
    await fetchCoreData();
  }, [fetchCoreData]);

  const refreshRates = useCallback(async () => {
    cacheRef.current.rates = undefined;
    await fetchCoreData();
  }, [fetchCoreData]);

  const refreshAll = useCallback(async () => {
    cacheRef.current = {};
    await fetchCoreData();
  }, [fetchCoreData]);

  // Initial data load
  useEffect(() => {
    fetchCoreData();
  }, [fetchCoreData]);

  // Auto-refresh balances when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated && principal) {
      refreshBalances();
    }
  }, [isAuthenticated, principal, refreshBalances]);

  const contextValue: UnifiedSwapData = {
    poolData: swap.activeSwapPool,
    balances: {
      icp: icpLedger.accountBalance || '0',
      primary: primary.primaryBal || '0',
      secondary: swap.secondaryBalance || '0',
      staked: swap.stakeInfo?.stakedPrimary || '0',
      claimable: swap.stakeInfo?.rewardIcp || '0'
    },
    rates: {
      primaryMintRate: swap.primaryMintRate || 0n,
      secondaryMintRate: swap.secondaryMintRate || 0n
    },
    transactions: swap.transactionHistory.transactions,
    insights: swap.logsData,
    tokenomics: swap.activeSwapPool?.[1],
    isLoading,
    errors,
    refreshBalances,
    refreshRates,
    refreshAll,
    loadTransactions,
    loadInsights,
    loadTokenomics
  };

  return (
    <UnifiedSwapDataContext.Provider value={contextValue}>
      {children}
    </UnifiedSwapDataContext.Provider>
  );
};