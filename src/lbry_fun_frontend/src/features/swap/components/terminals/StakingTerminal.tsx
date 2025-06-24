import React, { useEffect, useState } from 'react';
import { useUnifiedSwapData } from '../../providers/UnifiedSwapDataProvider';
import StakeContent from '../stake/stakeContent';
import { useAppSelector } from '@/store/hooks/useAppSelector';

export const StakingTerminal: React.FC = React.memo(() => {
  const { balances, poolData, insights, loadInsights, isLoading } = useUnifiedSwapData();
  const { auth, swap } = useAppSelector(state => state);
  const isAuthenticated = auth.isAuthenticated;
  const [showCharts, setShowCharts] = useState(false);

  // Load insights when charts are shown
  useEffect(() => {
    if (showCharts && poolData) {
      loadInsights();
    }
  }, [showCharts, poolData, loadInsights]);

  // Calculate APY (placeholder - replace with actual calculation)
  const calculateAPY = () => {
    // This should come from actual calculations based on pool data
    return '125.50';
  };

  // Calculate estimated daily rewards
  const calculateDailyRewards = () => {
    if (!balances.staked || parseFloat(balances.staked) === 0) return '0';
    // Placeholder calculation - replace with actual
    return '0.1';
  };

  // Placeholder chart data - will implement with a lightweight charting solution later
  const chartPlaceholder = "Chart visualization coming soon...";

  return (
    <div className="terminal-pure">
      {/* Terminal Header */}
      <div className="terminal-header mb-3">
        <span className="terminal-prompt">&gt;&gt;</span> staking_terminal
      </div>

      {/* Stake Overview */}
      <div className="terminal-section mb-3">
        <div className="terminal-header mb-2">
          <span className="terminal-prompt">&gt;</span> stake_overview
        </div>
        {isAuthenticated ? (
          <div className="space-y-1">
            <div className="terminal-row">
              <span className="terminal-label">your_stake:</span>
              <span className="terminal-primary">
                {poolData 
                  ? `${parseFloat(balances.staked).toFixed(4)} ${poolData[1].primary_token_symbol}`
                  : '0'
                }
              </span>
            </div>
            <div className="terminal-row">
              <span className="terminal-label">total_staked:</span>
              <span className="terminal-value">
                {poolData && swap.totalStaked
                  ? `${parseFloat(swap.totalStaked).toFixed(4)} ${poolData[1].primary_token_symbol}`
                  : '0'
                }
              </span>
            </div>
            <div className="terminal-row">
              <span className="terminal-label">apy:</span>
              <span className="terminal-primary">{calculateAPY()}%</span>
            </div>
          </div>
        ) : (
          <div className="text-gray-400 text-xs">
            [NOT CONNECTED] - Connect wallet to view staking data
          </div>
        )}
      </div>

      {/* Rewards */}
      {isAuthenticated && (
        <div className="terminal-section mb-3">
          <div className="terminal-header mb-2">
            <span className="terminal-prompt">&gt;</span> rewards
          </div>
          <div className="space-y-1">
            <div className="terminal-row">
              <span className="terminal-label">earned:</span>
              <span className="terminal-primary">
                {parseFloat(balances.claimable).toFixed(4)} ICP
              </span>
            </div>
            <div className="terminal-row">
              <span className="terminal-label">estimated_daily:</span>
              <span className="terminal-value">{calculateDailyRewards()} ICP</span>
            </div>
          </div>
        </div>
      )}

      {/* Stake/Unstake/Claim Interface */}
      <div className="terminal-section mb-3">
        <StakeContent />
      </div>

      {/* Pool Performance Charts */}
      <div className="terminal-section">
        <div 
          className="terminal-header mb-2 cursor-pointer flex justify-between items-center"
          onClick={() => setShowCharts(!showCharts)}
        >
          <div>
            <span className="terminal-prompt">&gt;</span> pool_performance
          </div>
          <span className="terminal-accent text-xs">
            [{showCharts ? 'COLLAPSE' : 'EXPAND'}]
          </span>
        </div>
        
        {showCharts && (
          <div className="mt-2 space-y-3">
            {isLoading.insights ? (
              <div className="text-gray-400 text-xs">Loading performance data...</div>
            ) : (
              <>
                {/* APY Trend */}
                <div>
                  <div className="terminal-label mb-1">APY trend (last 7 days)</div>
                  <div className="h-20 bg-black/50 border border-white/10 p-2 flex items-center justify-center">
                    <span className="text-gray-400 text-xs">{chartPlaceholder}</span>
                  </div>
                </div>

                {/* Total Staked Trend */}
                <div>
                  <div className="terminal-label mb-1">Total staked trend</div>
                  <div className="h-20 bg-black/50 border border-white/10 p-2 flex items-center justify-center">
                    <span className="text-gray-400 text-xs">{chartPlaceholder}</span>
                  </div>
                </div>

                {/* Rewards Accumulation */}
                <div>
                  <div className="terminal-label mb-1">Your rewards accumulation</div>
                  <div className="h-20 bg-black/50 border border-white/10 p-2 flex items-center justify-center">
                    <span className="text-gray-400 text-xs">{chartPlaceholder}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// Add display name for debugging
StakingTerminal.displayName = 'StakingTerminal';