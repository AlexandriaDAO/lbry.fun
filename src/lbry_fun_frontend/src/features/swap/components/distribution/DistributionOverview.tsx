import React, { useEffect, useState } from 'react';
import type { DistributionSummary } from '../../types/distributionTypes';
import { formatDistributionAmount, formatCountdown, getNextDistributionTime } from '../../utils/distributionUtils';

interface DistributionOverviewProps {
  summary: DistributionSummary;
}

const DistributionOverview: React.FC<DistributionOverviewProps> = ({ summary }) => {
  const [countdown, setCountdown] = useState<string>('--');

  useEffect(() => {
    // Assuming 1-hour intervals (3600 seconds)
    const nextDistTime = getNextDistributionTime(3600n);
    
    const updateCountdown = () => {
      setCountdown(formatCountdown(nextDistTime));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [summary.total_cycles]);

  return (
    <div className="terminal-pure mb-6">
      <div className="terminal-header mb-2">
        <span className="terminal-prompt">&gt;</span> distribution_status
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="terminal-info">
          <span className="terminal-label">cycle:</span>
          <span className="terminal-value">#{summary.total_cycles}</span>
        </div>
        
        <div className="terminal-info">
          <span className="terminal-label">next_distribution:</span>
          <span className="terminal-accent">{countdown}</span>
        </div>
        
        <div className="terminal-info">
          <span className="terminal-label">lp_queue:</span>
          <span className="terminal-value">{formatDistributionAmount(summary.current_lp_provision_queue)}</span>
        </div>
        
        <div className="terminal-info">
          <span className="terminal-label">total_distributed:</span>
          <span className="terminal-value">{formatDistributionAmount(summary.lifetime_totals.total_distributed)}</span>
        </div>
      </div>
      
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="terminal-info">
          <span className="terminal-label">alexandria_total:</span>
          <span className="terminal-accent">{formatDistributionAmount(summary.total_alexandria_sent)}</span>
        </div>
        
        <div className="terminal-info">
          <span className="terminal-label">lp_treasury_balance:</span>
          <span className="terminal-accent">{formatDistributionAmount(summary.total_lp_treasury_balance)}</span>
        </div>
        
        <div className="terminal-info">
          <span className="terminal-label">stakers_rewards:</span>
          <span className="terminal-accent">{formatDistributionAmount(summary.total_stakers_distributed)}</span>
        </div>
      </div>
    </div>
  );
};

export default DistributionOverview;