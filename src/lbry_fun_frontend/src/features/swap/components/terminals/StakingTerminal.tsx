import React, { useState } from 'react';
import StakeContent from '../StakeContent';
import { useAppSelector } from '@/store/hooks/useAppSelector';

export const StakingTerminal: React.FC = React.memo(() => {
  // Get data directly from Redux
  const { auth, swap } = useAppSelector(state => state);
  const isAuthenticated = auth.isAuthenticated;
  const poolData = swap.activeSwapPool;
  const stakeInfo = swap.stakeInfo;
  const averageAPY = swap.averageAPY;
  const distributionInterval = swap.distributionInterval;
  
  // Simple balance data
  const balances = {
    staked: stakeInfo?.stakedPrimary || '0',
    claimable: stakeInfo?.rewardIcp || '0'
  };

  // Calculate APY - now using real data from Redux
  const calculateAPY = () => {
    if (averageAPY === null || averageAPY === undefined) {
      return 'Calculating...';
    }
    if (averageAPY === 0) {
      return '0.00';
    }
    // Format to 2 decimal places
    return averageAPY.toFixed(2);
  };

  // Calculate estimated daily rewards based on APY
  const calculateDailyRewards = () => {
    if (!balances.staked || parseFloat(balances.staked) === 0) return '0';
    if (!averageAPY) return '0';
    
    // Daily rate = Annual rate / 365
    const dailyRate = averageAPY / 365 / 100; // Convert percentage to decimal
    const stakedAmount = parseFloat(balances.staked);
    const dailyRewards = stakedAmount * dailyRate;
    
    return dailyRewards.toFixed(4);
  };

  // Format distribution interval for display
  const formatDistributionInterval = () => {
    if (!distributionInterval) return '';
    
    const seconds = distributionInterval;
    if (seconds < 60) return `${seconds} seconds`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''}`;
    
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''}`;
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
              <span className="terminal-value terminal-pulse">
                {distributionInterval ? `[EVERY ${formatDistributionInterval().toUpperCase()}]` : '[LOADING...]'}
              </span>
            </div>
            <div className="terminal-row justify-between">
              <span className="terminal-label">current_apy:</span>
              <span className="terminal-primary terminal-typewriter">
                {calculateAPY()}%
                {distributionInterval && averageAPY && averageAPY > 0 && 
                  <span className="terminal-secondary text-xs ml-2">
                    (rewards every {formatDistributionInterval()})
                  </span>
                }
              </span>
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