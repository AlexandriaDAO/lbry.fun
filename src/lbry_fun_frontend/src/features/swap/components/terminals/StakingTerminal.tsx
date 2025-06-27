import React, { useState } from 'react';
import StakeContent from '../StakeContent';
import { useAppSelector } from '@/store/hooks/useAppSelector';

export const StakingTerminal: React.FC = React.memo(() => {
  // Get data directly from Redux
  const { auth, swap } = useAppSelector(state => state);
  const isAuthenticated = auth.isAuthenticated;
  const poolData = swap.activeSwapPool;
  const stakeInfo = swap.stakeInfo;
  
  // Simple balance data
  const balances = {
    staked: stakeInfo?.stakedPrimary || '0',
    claimable: stakeInfo?.rewardIcp || '0'
  };

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


  return (
    <div className="terminal-pure terminal-flicker p-4 min-h-[400px]">
      {/* Terminal Header */}
      <div className="terminal-header terminal-boot mb-3">
        <span className="terminal-prompt">&gt;&gt;</span> STAKING_TERMINAL
      </div>

      <div className="terminal-divider-single" />

      {/* Stake Overview */}
      <div className="terminal-section terminal-boot" style={{ animationDelay: '0.1s' }}>
        {isAuthenticated ? (
          <>
            <div className="terminal-row justify-between">
              <span className="terminal-label">staked_amount:</span>
              <span className="terminal-primary cyber-glow">
                {poolData 
                  ? `${parseFloat(balances.staked).toFixed(0)} ${poolData[1].primary_token_symbol}`
                  : '0 TOKENS'
                }
              </span>
            </div>
            <div className="terminal-row justify-between">
              <span className="terminal-label">reward_interval:</span>
              <span className="terminal-value terminal-pulse">[HOURLY]</span>
            </div>
            <div className="terminal-row justify-between">
              <span className="terminal-label">current_apy:</span>
              <span className="terminal-primary terminal-typewriter">{calculateAPY()}%</span>
            </div>
            <div className="terminal-row justify-between">
              <span className="terminal-label">total_staked:</span>
              <span className="terminal-value">
                {poolData && swap.totalStaked
                  ? `${parseFloat(swap.totalStaked).toFixed(4)} ${poolData[1].primary_token_symbol}`
                  : '99.9996 FGHJ'
                }
              </span>
            </div>
            <div className="terminal-row justify-between">
              <span className="terminal-label">stakers:</span>
              <span className="terminal-value">1</span>
            </div>
          </>
        ) : (
          <div className="terminal-status ml-4">
            [NOT CONNECTED] - Connect wallet to view staking data
          </div>
        )}
      </div>

      {/* Combined Stake Interface Section */}

      {/* Stake Interface with Amount Input */}
      <div className="terminal-section">
        <span className="terminal-prompt">&gt;</span> stake_interface
        <div className="ml-4">
          {isAuthenticated && (
            <>
              <div className="terminal-row justify-between mb-1">
                <span className="terminal-label">icp_in_lp:</span>
                <span className="terminal-value">2.66K</span>
              </div>
              <div className="terminal-row justify-between">
                <span className="terminal-label">apy:</span>
                <span className="terminal-primary">2354860309441.08%</span>
              </div>
            </>
          )}
        </div>
        <StakeContent />
      </div>
    </div>
  );
});

// Add display name for debugging
StakingTerminal.displayName = 'StakingTerminal';