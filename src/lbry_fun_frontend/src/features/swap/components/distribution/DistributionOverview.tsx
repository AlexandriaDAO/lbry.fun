import React, { useEffect, useState } from 'react';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import type { DistributionSummary } from '../../types/distributionTypes';
import { formatDistributionAmount, formatCountdown, getNextDistributionTime } from '../../utils/distributionUtils';

interface DistributionOverviewProps {
  summary: DistributionSummary;
}

const DistributionOverview: React.FC<DistributionOverviewProps> = ({ summary }) => {
  const [countdown, setCountdown] = useState<string>('--');
  const distributionInterval = useAppSelector(state => state.swap.distributionInterval);

  useEffect(() => {
    // Use actual interval from state, fallback to 3600 if not loaded
    const intervalSeconds = distributionInterval || 3600;
    const nextDistTime = getNextDistributionTime(BigInt(intervalSeconds));
    
    const updateCountdown = () => {
      setCountdown(formatCountdown(nextDistTime));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [summary.total_cycles, distributionInterval]);

  return (
    <div className="bg-black border border-white/30 font-mono text-sm p-3 mb-6">
      <div className="font-mono font-bold text-white mb-1 text-sm uppercase mb-2">
        <span className="text-pink-500">&gt;</span> distribution_status
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-black border border-white/30 p-3 font-mono text-sm">
          <span className="text-gray-400 text-xs">cycle:</span>
          <span className="text-white text-sm">#{summary.total_cycles}</span>
        </div>
        
        <div className="bg-black border border-white/30 p-3 font-mono text-sm">
          <span className="text-gray-400 text-xs">next_distribution:</span>
          <span className="text-gray-600 text-xs">{countdown}</span>
        </div>
        
        <div className="bg-black border border-white/30 p-3 font-mono text-sm">
          <span className="text-gray-400 text-xs">lp_queue:</span>
          <span className="text-white text-sm">{formatDistributionAmount(summary.current_lp_provision_queue)}</span>
        </div>
        
        <div className="bg-black border border-white/30 p-3 font-mono text-sm">
          <span className="text-gray-400 text-xs">total_distributed:</span>
          <span className="text-white text-sm">{formatDistributionAmount(summary.lifetime_totals.total_distributed)}</span>
        </div>
      </div>
      
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-black border border-white/30 p-3 font-mono text-sm">
          <span className="text-gray-400 text-xs">alexandria_total:</span>
          <span className="text-gray-600 text-xs">{formatDistributionAmount(summary.total_alexandria_sent)}</span>
        </div>
        
        <div className="bg-black border border-white/30 p-3 font-mono text-sm">
          <span className="text-gray-400 text-xs">lp_treasury_balance:</span>
          <span className="text-gray-600 text-xs">{formatDistributionAmount(summary.total_lp_treasury_balance)}</span>
        </div>
        
        <div className="bg-black border border-white/30 p-3 font-mono text-sm">
          <span className="text-gray-400 text-xs">stakers_rewards:</span>
          <span className="text-gray-600 text-xs">{formatDistributionAmount(summary.total_stakers_distributed)}</span>
        </div>
      </div>
    </div>
  );
};

export default DistributionOverview;