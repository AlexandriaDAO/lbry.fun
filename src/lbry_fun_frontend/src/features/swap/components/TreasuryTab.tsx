import React, { useState, useEffect } from 'react';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { getLbryFunActor } from '@/features/auth/utils/authUtils';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { 
  formatE8sToICP, 
  formatDiscrepancy, 
  formatBasisPoints, 
  formatNanoTimestamp,
  calculateTimeUntilNextDistribution,
  getHealthColor 
} from '@/utils/treasury';
import TooltipIcon from '@/features/token/components/TooltipIcon';
import ValidationStatus from './ValidationStatus';
import { createActor } from '@/utils/createActor';
import { idlFactory as icpSwapIdlFactory } from '../../../../../declarations/icp_swap';
import type { ReconciliationStatus } from '../../../../../declarations/icp_swap/icp_swap.did';
import { Principal } from '@dfinity/principal';

// Collection metrics interface - this would come from lbry_fun in the future
interface CollectionMetrics {
  total_accumulated_icp: bigint;
  total_burned_lbry: bigint;
  collection_efficiency_basis_points: bigint;
  last_successful_collection: bigint;
  failed_collections_24h: bigint;
}

interface TreasuryState {
  collectionMetrics: CollectionMetrics | null;
  tokenReconciliation: ReconciliationStatus | null;
  isLoading: boolean;
  error: string | null;
  dataLoadStatus: {
    metrics: boolean;
    token: boolean;
  };
}

const TreasuryTab: React.FC = () => {
  const { activeSwapPool, distributionInterval } = useAppSelector(state => state.swap);
  const [collectionMetrics, setCollectionMetrics] = useState<CollectionMetrics | null>(null);
  const [tokenReconciliation, setTokenReconciliation] = useState<ReconciliationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataLoadStatus, setDataLoadStatus] = useState({
    metrics: false,
    token: false
  });
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const canRefresh = Date.now() - lastRefresh > 30000; // 30 second cooldown

  const fetchData = async () => {
    if (!activeSwapPool || !activeSwapPool[1]?.icp_swap_canister_id) return;
    
    try {
      // Get the ICP swap canister ID from the active pool
      const icpSwapCanisterId = activeSwapPool[1].icp_swap_canister_id;
      
      // Create an actor for the specific ICP swap canister
      const icpSwapActor = await createActor(icpSwapCanisterId, icpSwapIdlFactory);
      
      // Fetch reconciliation status from the ICP swap canister
      icpSwapActor.get_reconciliation_status()
        .then((reconciliation: ReconciliationStatus) => {
          setTokenReconciliation(reconciliation);
          setDataLoadStatus(prev => ({ ...prev, token: true }));
        })
        .catch(err => {
          console.error('Failed to fetch reconciliation data:', err);
          setError('Failed to fetch treasury reconciliation data');
        });
      
      // Get swap stats from lbry_fun canister for collection metrics
      const lbryFunActor = await getLbryFunActor();
      lbryFunActor.get_swap_stats()
        .then(([totalBurned, lastSwapTime, lastSwapAmount]) => {
          // Convert to collection metrics format
          const metrics: CollectionMetrics = {
            total_accumulated_icp: BigInt(0), // Not tracked in new system
            total_burned_lbry: totalBurned,
            collection_efficiency_basis_points: BigInt(10000), // 100% in new system
            last_successful_collection: lastSwapTime,
            failed_collections_24h: BigInt(0), // Not tracked in new system
          };
          setCollectionMetrics(metrics);
          setDataLoadStatus(prev => ({ ...prev, metrics: true }));
        })
        .catch(err => {
          console.error('Failed to fetch swap stats:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
        
    } catch (err) {
      console.error('Failed to get actors:', err);
      setError('Failed to connect to backend');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeSwapPool]);

  const handleRefresh = () => {
    if (canRefresh) {
      setIsLoading(true);
      setError(null);
      setDataLoadStatus({
        metrics: false,
        token: false
      });
      fetchData();
      setLastRefresh(Date.now());
    }
  };

  if (!activeSwapPool) {
    return (
      <div className="text-gray-400 text-center py-8">
        No active token pool selected
      </div>
    );
  }

  if (isLoading && Object.values(dataLoadStatus).every(v => !v)) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoaderCircle className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (error && !Object.values(dataLoadStatus).some(v => v)) {
    return (
      <div className="border-t border-white/30 mt-2 pt-1">
        <div className="text-pink-500 text-xs uppercase text-red-400">[ERROR]</div>
        <p className="mt-2 text-gray-400">{error}</p>
        <button onClick={handleRefresh} className="mt-4 bg-black border border-white/30 text-white font-mono text-sm px-4 py-2 hover:bg-white/10">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Refresh button */}
      <div className="flex justify-end">
        <button
          onClick={handleRefresh}
          disabled={!canRefresh}
          className={`bg-black border border-white/30 text-white font-mono text-sm px-4 py-2 hover:bg-white/10 flex items-center gap-2 ${!canRefresh ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Token Treasury - Priority 1 */}
      {dataLoadStatus.token && tokenReconciliation && (
        <div className="border-t border-white/30 mt-2 pt-1">
          <div className="font-mono font-bold text-white mb-1 text-sm uppercase mb-3">
            <span className="text-pink-500">&gt;&gt;</span> TOKEN TREASURY
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 text-xs flex items-center">
                Reward Pool (Awaiting Distribution):
                <TooltipIcon text="ICP collected from users buying secondary tokens. Every interval (e.g., hourly), 1% of this pool is distributed: 99% to stakers as yield, 1% as platform fees. Think of it as the 'treasury' that pays out staking rewards." />
              </span>
              <span className="text-white text-sm text-lime-400">
                {formatE8sToICP(tokenReconciliation.reward_pool)} ICP
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 text-xs flex items-center">
                Reserved for Stakers:
                <TooltipIcon text="Total ICP rewards earned by all stakers but not yet claimed. This is YOUR money if you're staking - it accumulates every distribution and you can claim it anytime. Higher stakes = bigger share of rewards." />
              </span>
              <span className="text-white text-sm">
                {formatE8sToICP(tokenReconciliation.total_staked)} ICP
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 text-xs flex items-center">
                Pending Collection:
                <TooltipIcon text="Platform fees (1% of distributions) waiting to be collected by the protocol. These fees support the parent project ($LBRY) through buy-and-burn mechanics. Not claimable by users." />
              </span>
              <span className="text-white text-sm text-amber-400">
                {formatE8sToICP(
                  tokenReconciliation.uncollected_alex_fees
                )} ICP
              </span>
            </div>
            {tokenReconciliation.requires_attention && (
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-400 text-xs">Status:</span>
                <span className="text-white text-sm text-red-400">⚠️ Attention Required</span>
              </div>
            )}
            
            {/* Always show reconciliation details */}
            <div className="terminal-divider-single my-2" />
            <div className="text-xs space-y-1 text-gray-500">
                  <div className="flex justify-between">
                    <span className="flex items-center">
                      Expected Balance:
                      <TooltipIcon text="Sum of all ICP that should be in the contract: reward pool + staker rewards + platform fees + operational buffer. This is what the math says we should have." />
                    </span>
                    <span>{formatE8sToICP(tokenReconciliation.icp_balance_expected)} ICP</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center">
                      Actual Balance:
                      <TooltipIcon text="The real ICP balance from the blockchain ledger. This is what we actually have. Should match Expected Balance exactly." />
                    </span>
                    <span>{formatE8sToICP(tokenReconciliation.icp_balance_actual)} ICP</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center">
                      Discrepancy:
                      <TooltipIcon text="Difference between Expected and Actual. Should be zero. Any non-zero value indicates an accounting error that needs investigation." />
                    </span>
                    <span className={tokenReconciliation.requires_attention ? 'text-red-400' : 'text-gray-400'}>
                      {formatDiscrepancy(tokenReconciliation.discrepancy_e8s)}
                    </span>
                  </div>
                  {tokenReconciliation.operational_balance_suspicious && (
                    <div className="flex justify-between">
                      <span className="flex items-center">
                        Operational Balance:
                        <TooltipIcon text="ICP buffer for transaction fees and operations. Should be minimal (< 0.1 ICP). High values indicate ICP that isn't properly allocated to rewards or fees." />
                      </span>
                      <span className="text-amber-400">
                        {formatE8sToICP(tokenReconciliation.operational_balance)} ICP (High)
                      </span>
                    </div>
                  )}
                </div>
          </div>
        </div>
      )}
      
      {/* Distribution Metrics - Priority 2 */}
      {dataLoadStatus.metrics && collectionMetrics && (
        <div className="border-t border-white/30 mt-2 pt-1">
          <div className="font-mono font-bold text-white mb-1 text-sm uppercase mb-3">
            <span className="text-pink-500">&gt;&gt;</span> DISTRIBUTION METRICS
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 text-xs flex items-center">
                Total ICP Distributed:
                <TooltipIcon text="Lifetime ICP paid out to stakers. This shows the protocol's total yield generation. Higher = more rewards have been earned by stakers over time." />
              </span>
              <span className="text-white text-sm">
                {formatE8sToICP(collectionMetrics.total_accumulated_icp)} ICP
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 text-xs flex items-center">
                Total LBRY Burned:
                <TooltipIcon text="Amount of $LBRY (parent project token) bought and burned using platform fees. This creates deflationary pressure on $LBRY, benefiting all holders." />
              </span>
              <span className="text-white text-sm">
                {formatE8sToICP(collectionMetrics.total_burned_lbry)} LBRY
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 text-xs flex items-center">
                Platform Fee Rate:
                <TooltipIcon text="Percentage of total reward pool collected as platform fees. Target is 1% - this shows the actual collection rate achieved." />
              </span>
              <span className={`terminal-value ${
                collectionMetrics.collection_efficiency_basis_points > 50 && 
                collectionMetrics.collection_efficiency_basis_points < 150
                  ? 'text-lime-400' 
                  : 'text-amber-400'
              }`}>
                {formatBasisPoints(collectionMetrics.collection_efficiency_basis_points)}
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 text-xs flex items-center">
                Next Distribution:
                <TooltipIcon text="Countdown to next reward payout. When this hits zero, 1% of the reward pool gets distributed to stakers. Set your watch and compound those gains!" />
              </span>
              <span className="text-white text-sm">
                {calculateTimeUntilNextDistribution(
                  collectionMetrics.last_successful_collection,
                  distributionInterval || 3600
                )}
              </span>
            </div>
            {collectionMetrics.failed_collections_24h > 0 && (
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-400 text-xs">Failed Collections (24h):</span>
                <span className="text-white text-sm text-amber-400">
                  {collectionMetrics.failed_collections_24h}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Accounting Validation - Priority 3 */}
      {activeSwapPool && activeSwapPool[1]?.icp_swap_canister_id && (
        <ValidationStatus tokenId={activeSwapPool[1].icp_swap_canister_id} />
      )}

      {/* Loading individual sections */}
      {isLoading && (
        <div className="text-center text-gray-500 text-sm">
          Loading treasury data...
        </div>
      )}
    </div>
  );
};

export default React.memo(TreasuryTab);