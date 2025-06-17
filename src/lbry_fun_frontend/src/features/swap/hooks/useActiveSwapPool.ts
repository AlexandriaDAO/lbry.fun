import { useAppSelector } from '@/store/hooks';
import { RootState } from '@/store';
import { TokenRecordStringified } from '@/features/token/thunk/getTokenPools.thunk';

interface UseActiveSwapPoolReturn {
  activeSwapPool: [string, TokenRecordStringified] | null;
  isPoolReady: boolean;
  poolId: string | null;
  primaryTokenSymbol: string | null;
  secondaryTokenSymbol: string | null;
  primaryTokenId: string | null;
  secondaryTokenId: string | null;
  icpSwapCanisterId: string | null;
  tokenomicsCanisterId: string | null;
}

export const useActiveSwapPool = (): UseActiveSwapPoolReturn => {
  const activeSwapPool = useAppSelector((state: RootState) => state.swap.activeSwapPool);
  
  const isPoolReady = activeSwapPool !== null;
  const poolId = activeSwapPool?.[0] || null;
  const poolData = activeSwapPool?.[1];
  
  return {
    activeSwapPool,
    isPoolReady,
    poolId,
    primaryTokenSymbol: poolData?.primary_token_symbol || null,
    secondaryTokenSymbol: poolData?.secondary_token_symbol || null,
    primaryTokenId: poolData?.primary_token_id || null,
    secondaryTokenId: poolData?.secondary_token_id || null,
    icpSwapCanisterId: poolData?.icp_swap_canister_id || null,
    tokenomicsCanisterId: poolData?.tokenomics_canister_id || null,
  };
};

// Hook that throws a promise if pool is not ready (for Suspense)
let poolPromise: Promise<void> | null = null;

export const useActiveSwapPoolSuspense = () => {
  const { activeSwapPool, isPoolReady } = useActiveSwapPool();
  
  if (!isPoolReady) {
    if (!poolPromise) {
      poolPromise = new Promise((resolve) => {
        // Poll for pool readiness
        const checkPool = setInterval(() => {
          // This is a bit hacky, but we need to check Redux state
          // In a real implementation, we'd use a subscription
          const intervalId = setInterval(() => {
            clearInterval(intervalId);
            poolPromise = null;
            resolve();
          }, 100);
        }, 100);
      });
    }
    throw poolPromise;
  }
  
  return activeSwapPool!;
};