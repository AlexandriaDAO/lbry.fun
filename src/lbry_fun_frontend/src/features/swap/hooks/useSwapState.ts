import { useAppSelector } from '@/store/hooks/useAppSelector';
import {
  selectNormalizedBalances,
  selectNormalizedStaking,
  selectNormalizedTokenomics,
  selectNormalizedLoading,
  selectNormalizedSuccess,
  selectNormalizedError,
  selectNormalizedLogs,
  selectActivePool,
  selectSpendingBalance
} from '../selectors';

// Main hook for swap state
export const useSwapState = () => {
  const balances = useAppSelector(selectNormalizedBalances);
  const staking = useAppSelector(selectNormalizedStaking);
  const tokenomics = useAppSelector(selectNormalizedTokenomics);
  const loading = useAppSelector(selectNormalizedLoading);
  const success = useAppSelector(selectNormalizedSuccess);
  const error = useAppSelector(selectNormalizedError);
  const logs = useAppSelector(selectNormalizedLogs);
  const activePool = useAppSelector(selectActivePool);
  const spendingBalance = useAppSelector(selectSpendingBalance);

  return {
    balances,
    staking,
    tokenomics,
    ui: {
      loading,
      success,
      error,
    },
    logs,
    activePool,
    spendingBalance,
  };
};

// Specific hooks for focused state access
export const useBalances = () => useAppSelector(selectNormalizedBalances);
export const useStaking = () => useAppSelector(selectNormalizedStaking);  
export const useTokenomics = () => useAppSelector(selectNormalizedTokenomics);
export const useSwapLoading = () => useAppSelector(selectNormalizedLoading);
export const useSwapSuccess = () => useAppSelector(selectNormalizedSuccess);
export const useSwapError = () => useAppSelector(selectNormalizedError);
export const useSwapLogs = () => useAppSelector(selectNormalizedLogs);
export const useActivePool = () => useAppSelector(selectActivePool);

// Convenience hooks for common combinations
export const useBalanceWithLoading = () => {
  const balances = useBalances();
  const loading = useSwapLoading();
  return { balances, loading: loading.balances };
};

export const useStakeWithLoading = () => {
  const staking = useStaking();
  const loading = useSwapLoading();
  const success = useSwapSuccess();
  return { 
    staking, 
    loading: loading.stake,
    success: success.stake,
    claimSuccess: success.claim,
    unstakeSuccess: success.unstake
  };
};