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
    <div className="bg-black border border-white/30 font-mono text-sm p-3 mb-6">
      <div className="font-mono font-bold text-white mb-1 text-sm uppercase mb-4">
        <span className="text-pink-500">&gt;</span> pool_allocations
      </div>
      
      <div className="space-y-4">
        {/* Alexandria Pool */}
        <div className="bg-blue-900/20 border border-blue-500/30 text-blue-400 p-3 font-mono text-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs">alexandria_pool (1%):</span>
            <span className="text-gray-600 text-xs">{formatDistributionAmount(data.alexandria_total)}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full"
              style={{ width: `${alexandriaPercent}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {alexandriaPercent.toFixed(2)}% of total distributions
          </div>
        </div>

        {/* LP Treasury Pool */}
        <div className="bg-blue-900/20 border border-blue-500/30 text-blue-400 p-3 font-mono text-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs">locked_lp (99%):</span>
            <span className="text-gray-600 text-xs">{formatDistributionAmount(data.lp_treasury_total)}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full"
              style={{ width: `${lpPercent}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {lpPercent.toFixed(2)}% of total distributions
          </div>
        </div>

      </div>
      
      <div className="mt-4 pt-4 border-t border-lime-500/20">
        <div className="flex justify-between items-center py-0.5">
          <span className="text-gray-400 text-xs">total_distributed:</span>
          <span className="text-white text-sm text-lg">{formatDistributionAmount(data.total_distributed)}</span>
        </div>
      </div>
    </div>
  );
};

export default PoolAllocationChart;