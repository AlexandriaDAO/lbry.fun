import React, { useState } from 'react';
import StakeContent from '../StakeContent';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { TerminalExpander } from '../TerminalExpander';

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
    <TerminalExpander
      title="STAKING_TERMINAL"
      status="[ACTIVE]"
      terminalId="staking"
      defaultExpanded={false}
    >
      <StakeContent />
    </TerminalExpander>
  );
});

// Add display name for debugging
StakingTerminal.displayName = 'StakingTerminal';