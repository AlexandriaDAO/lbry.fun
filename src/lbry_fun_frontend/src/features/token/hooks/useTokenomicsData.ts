import { useState, useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import previewTokenomicsSchedule, { TokenomicsSchedule } from '../thunk/previewTokenomicsSchedule.thunk';
import { useLbryFun } from '@/hooks/actors';

interface UseTokenomicsDataParams {
  primaryMaxSupply: string;
  tgeAllocation: string;
  initialSecondaryBurn: string;
  halvingStep: string;
  initialRewardPerBurnUnit: string;
  thresholdMultiplier?: string;  // Optional with default value
}

interface UseTokenomicsDataResult {
  data: TokenomicsSchedule | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook for fetching and managing tokenomics preview data.
 * This provides a single source of truth for tokenomics calculations,
 * ensuring consistency between token creation and analytics views.
 */
export const useTokenomicsData = (params: UseTokenomicsDataParams): UseTokenomicsDataResult => {
  const dispatch = useAppDispatch();
  const { actor: lbryFunActor } = useLbryFun();
  const [data, setData] = useState<TokenomicsSchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Skip if any required parameter is missing or zero
    if (!params.primaryMaxSupply || !params.initialSecondaryBurn || 
        !params.halvingStep || !params.initialRewardPerBurnUnit ||
        params.primaryMaxSupply === '0' || params.initialSecondaryBurn === '0' || 
        params.halvingStep === '0' || params.initialRewardPerBurnUnit === '0') {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchData = async () => {
      if (!lbryFunActor) {
        setError('Actor not available');
        return;
      }
      
      setLoading(true);
      setError(null);

      try {
        // Convert natural numbers to E8S for backend
        const E8S_MULTIPLIER = BigInt(100_000_000);
        
        const primary_per_threshold = parseInt(params.initialRewardPerBurnUnit);
        const max_primary_supply = BigInt(params.primaryMaxSupply) * E8S_MULTIPLIER;
        const initial_secondary_burn = parseInt(params.initialSecondaryBurn);
        const halving_step = parseInt(params.halvingStep);
        const tge_allocation = BigInt(params.tgeAllocation || '0') * E8S_MULTIPLIER;

        const result = await dispatch(previewTokenomicsSchedule({
          args: {
            primary_per_threshold,
            max_primary_supply,
            initial_secondary_burn,
            halving_step,
            tge_allocation,
            threshold_multiplier: parseFloat(params.thresholdMultiplier || '2.0'),
          },
          lbryFunActor: lbryFunActor,
        })).unwrap();

        setData(result);
      } catch (err) {
        console.error('Failed to fetch tokenomics schedule:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch tokenomics preview');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    params.primaryMaxSupply,
    params.tgeAllocation,
    params.initialSecondaryBurn,
    params.halvingStep,
    params.initialRewardPerBurnUnit,
    dispatch,
    lbryFunActor
  ]);

  return { data, loading, error };
};