import React from 'react';
import type { LifetimeDistributionTotals } from '../../types/distributionTypes';
import { formatDistributionAmount, calculatePercentage } from '../../utils/distributionUtils';

interface PoolAllocationChartProps {
  data: LifetimeDistributionTotals;
}

const PoolAllocationChart: React.FC<PoolAllocationChartProps> = ({ data }) => {
  const alexandriaPercent = calculatePercentage(data.alexandria_total, data.total_distributed);
  const lpPercent = calculatePercentage(data.lp_treasury_total, data.total_distributed);
  const stakersPercent = calculatePercentage(data.stakers_total, data.total_distributed);

  return (
    <div className="terminal-pure mb-6">
      <div className="terminal-header mb-4">
        <span className="terminal-prompt">&gt;</span> pool_allocations
      </div>
      
      <div className="space-y-4">
        {/* Alexandria Pool */}
        <div className="terminal-info">
          <div className="flex items-center justify-between mb-2">
            <span className="terminal-label">alexandria_pool (1%):</span>
            <span className="terminal-accent">{formatDistributionAmount(data.alexandria_total)}</span>
          </div>
          <div className="terminal-progress-bar">
            <div 
              className="terminal-progress-fill terminal-pool-badge-alexandria"
              style={{ width: `${alexandriaPercent}%` }}
            />
          </div>
          <div className="mt-1 text-xs terminal-dim">
            {alexandriaPercent.toFixed(2)}% of total distributions
          </div>
        </div>

        {/* LP Treasury Pool */}
        <div className="terminal-info">
          <div className="flex items-center justify-between mb-2">
            <span className="terminal-label">lp_treasury (49.5%):</span>
            <span className="terminal-accent">{formatDistributionAmount(data.lp_treasury_total)}</span>
          </div>
          <div className="terminal-progress-bar">
            <div 
              className="terminal-progress-fill terminal-pool-badge-lp"
              style={{ width: `${lpPercent}%` }}
            />
          </div>
          <div className="mt-1 text-xs terminal-dim">
            {lpPercent.toFixed(2)}% of total distributions
          </div>
        </div>

        {/* Stakers Pool */}
        <div className="terminal-info">
          <div className="flex items-center justify-between mb-2">
            <span className="terminal-label">stakers_pool (49.5%):</span>
            <span className="terminal-accent">{formatDistributionAmount(data.stakers_total)}</span>
          </div>
          <div className="terminal-progress-bar">
            <div 
              className="terminal-progress-fill terminal-pool-badge-stakers"
              style={{ width: `${stakersPercent}%` }}
            />
          </div>
          <div className="mt-1 text-xs terminal-dim">
            {stakersPercent.toFixed(2)}% of total distributions
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-terminal-primary/20">
        <div className="terminal-row">
          <span className="terminal-label">total_distributed:</span>
          <span className="terminal-value text-lg">{formatDistributionAmount(data.total_distributed)}</span>
        </div>
      </div>
    </div>
  );
};

export default PoolAllocationChart;