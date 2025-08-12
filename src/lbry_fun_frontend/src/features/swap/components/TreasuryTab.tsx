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
import type { 
  SystemReconciliationSummary, 
  CollectionMetrics, 
  TokenHealthSummary,
  ReconciliationDetail
} from '../../../../../declarations/lbry_fun/lbry_fun.did';

interface TreasuryState {
  systemReconciliation: SystemReconciliationSummary | null;
  collectionMetrics: CollectionMetrics | null;
  tokenHealth: TokenHealthSummary | null;
  tokenReconciliation: ReconciliationDetail | null;
  isLoading: boolean;
  error: string | null;
  dataLoadStatus: {
    system: boolean;
    metrics: boolean;
    health: boolean;
    token: boolean;
  };
}

const TreasuryTab: React.FC = () => {
  const { activeSwapPool, distributionInterval } = useAppSelector(state => state.swap);
  const [systemReconciliation, setSystemReconciliation] = useState<SystemReconciliationSummary | null>(null);
  const [collectionMetrics, setCollectionMetrics] = useState<CollectionMetrics | null>(null);
  const [tokenHealth, setTokenHealth] = useState<TokenHealthSummary | null>(null);
  const [tokenReconciliation, setTokenReconciliation] = useState<ReconciliationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataLoadStatus, setDataLoadStatus] = useState({
    system: false,
    metrics: false,
    health: false,
    token: false
  });
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [showAdvanced, setShowAdvanced] = useState(false);

  const canRefresh = Date.now() - lastRefresh > 30000; // 30 second cooldown

  const fetchData = async () => {
    if (!activeSwapPool) return;
    
    // activeSwapPool[0] is the numeric pool ID as a string, convert to BigInt for the backend call
    const tokenId = BigInt(activeSwapPool[0]);
    try {
      const actor = await getLbryFunActor();
      
      // Fetch system-wide data (don't wait for token-specific data)
      Promise.all([
        actor.get_system_reconciliation(),
        actor.get_collection_metrics(),
        actor.get_token_health_summary()
      ]).then(([systemRecon, metrics, health]) => {
        setSystemReconciliation(systemRecon);
        setCollectionMetrics(metrics);
        setTokenHealth(health);
        setDataLoadStatus(prev => ({ ...prev, system: true, metrics: true, health: true }));
      }).catch(err => {
        console.error('Failed to fetch system data:', err);
      });
      
      // Fetch token-specific data separately
      console.log('Fetching token reconciliation for token ID:', tokenId.toString());
      actor.get_token_reconciliation(tokenId)
        .then(result => {
          console.log('Token reconciliation result:', result);
          if ('Ok' in result) {
            setTokenReconciliation(result.Ok);
            setDataLoadStatus(prev => ({ ...prev, token: true }));
          } else {
            console.error('Token reconciliation returned Err:', result.Err);
            setError(`Token reconciliation error: ${result.Err}`);
          }
        })
        .catch(err => {
          console.error('Failed to fetch token data:', err);
          setError('Failed to fetch token reconciliation data');
        })
        .finally(() => {
          setIsLoading(false);
        });
    } catch (err) {
      console.error('Failed to get actor:', err);
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
        system: false,
        metrics: false,
        health: false,
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
              <span className="text-gray-400 text-xs">Reward Pool (Awaiting Distribution):</span>
              <span className="text-white text-sm text-lime-400">
                {formatE8sToICP(tokenReconciliation.reconciliation.reward_pool)} ICP
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 text-xs">Reserved for Stakers:</span>
              <span className="text-white text-sm">
                {formatE8sToICP(tokenReconciliation.reconciliation.total_staked)} ICP
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 text-xs">Pending Collection:</span>
              <span className="text-white text-sm text-amber-400">
                {formatE8sToICP(
                  tokenReconciliation.reconciliation.uncollected_alex_fees
                )} ICP
              </span>
            </div>
            {tokenReconciliation.reconciliation.requires_attention && (
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-400 text-xs">Status:</span>
                <span className="text-white text-sm text-red-400">⚠️ Attention Required</span>
              </div>
            )}
            
            {/* Toggle for advanced details */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-gray-500 hover:text-gray-400 mt-2"
            >
              {showAdvanced ? '− Hide' : '+ Show'} reconciliation details
            </button>
            
            {/* Developer-friendly reconciliation details */}
            {(tokenReconciliation.reconciliation.requires_attention || showAdvanced) && (
              <>
                <div className="terminal-divider-single my-2" />
                <div className="text-xs space-y-1 text-gray-500">
                  <div className="flex justify-between">
                    <span>Expected Balance:</span>
                    <span>{formatE8sToICP(tokenReconciliation.reconciliation.icp_balance_expected)} ICP</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Actual Balance:</span>
                    <span>{formatE8sToICP(tokenReconciliation.reconciliation.icp_balance_actual)} ICP</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discrepancy:</span>
                    <span className={tokenReconciliation.reconciliation.requires_attention ? 'text-red-400' : 'text-gray-400'}>
                      {formatDiscrepancy(tokenReconciliation.reconciliation.discrepancy_e8s)}
                    </span>
                  </div>
                  {tokenReconciliation.reconciliation.operational_balance_suspicious && (
                    <div className="flex justify-between">
                      <span>Operational Balance:</span>
                      <span className="text-amber-400">
                        {formatE8sToICP(tokenReconciliation.reconciliation.operational_balance)} ICP (High)
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
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
              <span className="text-gray-400 text-xs">Total ICP Distributed:</span>
              <span className="text-white text-sm">
                {formatE8sToICP(collectionMetrics.total_accumulated_icp)} ICP
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 text-xs">Total LBRY Burned:</span>
              <span className="text-white text-sm">
                {formatE8sToICP(collectionMetrics.total_burned_lbry)} LBRY
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 text-xs">Collection Efficiency:</span>
              <span className={`terminal-value ${
                collectionMetrics.collection_efficiency_basis_points > 9000 
                  ? 'text-lime-400' 
                  : 'text-amber-400'
              }`}>
                {formatBasisPoints(collectionMetrics.collection_efficiency_basis_points)}
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 text-xs">Next Distribution:</span>
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
      
      {/* System Overview - Priority 3 */}
      {dataLoadStatus.system && systemReconciliation && tokenHealth && (
        <div className="border-t border-white/30 mt-2 pt-1">
          <div className="font-mono font-bold text-white mb-1 text-sm uppercase mb-3">
            <span className="text-pink-500">&gt;&gt;</span> SYSTEM OVERVIEW
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 text-xs">Platform-wide Pending Fees:</span>
              <span className="text-white text-sm">
                {formatE8sToICP(
                  systemReconciliation.total_uncollected_alex
                )} ICP
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 text-xs">Healthy Tokens:</span>
              <span className="text-white text-sm text-lime-400">
                {tokenHealth.healthy_tokens} / {tokenHealth.healthy_tokens + tokenHealth.unhealthy_tokens}
              </span>
            </div>
            {tokenHealth.stagnant_tokens.length > 0 && (
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-400 text-xs">Stagnant Tokens:</span>
                <span className="text-white text-sm text-amber-400">
                  {tokenHealth.stagnant_tokens.length}
                </span>
              </div>
            )}
            {systemReconciliation.tokens_with_discrepancies.length > 0 && (
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-400 text-xs">Tokens with Discrepancies:</span>
                <span className="text-white text-sm text-red-400">
                  {systemReconciliation.tokens_with_discrepancies.length}
                </span>
              </div>
            )}
          </div>
        </div>
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