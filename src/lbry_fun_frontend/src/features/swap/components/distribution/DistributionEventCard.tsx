import React, { useState } from 'react';
import type { DistributionEvent } from '../../types/distributionTypes';
import { 
  formatDistributionAmount, 
  formatTimestamp, 
  formatLpProvisionStatus,
  getPoolBadgeClass 
} from '../../utils/distributionUtils';

interface DistributionEventCardProps {
  event: DistributionEvent;
}

const DistributionEventCard: React.FC<DistributionEventCardProps> = ({ event }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bg-black border border-white/30 font-mono text-sm p-4 mb-4">
      <div 
        className="bg-blue-900/20 border border-blue-500/30 text-blue-400 p-3 font-mono text-sm mb-2 cursor-pointer hover:border-lime-500/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex justify-between items-center py-0.5">
          <span className="text-gray-400 text-xs">cycle_#{event.distribution_cycle}:</span>
          <span className="text-white text-sm">{formatTimestamp(event.timestamp)}</span>
          <span className="text-gray-600 text-xs ml-2">{formatDistributionAmount(event.total_available)}</span>
          <span className="ml-2 text-xs text-gray-500">
            {expanded ? '[-]' : '[+]'}
          </span>
        </div>
      </div>
      
      {expanded && (
        <div className="mt-2 ml-4 space-y-3">
          {/* Allocations */}
          <div className="space-y-2">
            <div className="flex justify-between items-center py-0.5 text-sm">
              <span className={`px-2 py-1 text-xs font-mono rounded ${getPoolBadgeClass('alexandria')}`}>
                alexandria
              </span>
              <span className="ml-2">{formatDistributionAmount(event.allocations.alexandria_allocated)}</span>
            </div>
            
            <div className="flex justify-between items-center py-0.5 text-sm">
              <span className={`px-2 py-1 text-xs font-mono rounded ${getPoolBadgeClass('lp')}`}>
                lp_treasury
              </span>
              <span className="ml-2">{formatDistributionAmount(event.allocations.lp_treasury_allocated)}</span>
            </div>
            
            <div className="flex justify-between items-center py-0.5 text-sm">
              <span className={`px-2 py-1 text-xs font-mono rounded ${getPoolBadgeClass('stakers')}`}>
                stakers
              </span>
              <span className="ml-2">{formatDistributionAmount(event.allocations.stakers_allocated)}</span>
            </div>
          </div>
          
          {/* Results */}
          <div className="pt-2 border-t border-lime-500/20">
            <div className="text-xs text-gray-500 mb-2">distribution_results:</div>
            
            {/* LP Provision Status */}
            <div className="terminal-row text-sm mb-2">
              <span className="text-gray-400 text-xs">lp_provision:</span>
              <span className={formatLpProvisionStatus(event.results.lp_provision_status).className}>
                {formatLpProvisionStatus(event.results.lp_provision_status).text}
              </span>
            </div>
            
            {/* Staker Rollover */}
            {event.results.stakers_rollover > 0n && (
              <div className="terminal-row text-sm mb-2">
                <span className="text-gray-400 text-xs">staker_rollover:</span>
                <span className="text-white text-sm">{formatDistributionAmount(event.results.stakers_rollover)}</span>
              </div>
            )}
            
            {/* Error Details */}
            {event.results.error_details && event.results.error_details.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-red-400 mb-1">errors:</div>
                {event.results.error_details.map((error, idx) => (
                  <div key={idx} className="text-xs text-red-400 ml-2">
                    - {error}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DistributionEventCard;