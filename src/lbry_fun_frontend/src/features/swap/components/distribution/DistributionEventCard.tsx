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
    <div className="terminal-distribution-event">
      <div 
        className="terminal-info mb-2 cursor-pointer hover:border-terminal-primary/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="terminal-row">
          <span className="terminal-label">cycle_#{event.distribution_cycle}:</span>
          <span className="terminal-value">{formatTimestamp(event.timestamp)}</span>
          <span className="terminal-accent ml-2">{formatDistributionAmount(event.total_available)}</span>
          <span className="ml-2 text-xs terminal-dim">
            {expanded ? '[-]' : '[+]'}
          </span>
        </div>
      </div>
      
      {expanded && (
        <div className="mt-2 ml-4 space-y-3">
          {/* Allocations */}
          <div className="space-y-2">
            <div className="terminal-row text-sm">
              <span className={`terminal-pool-badge ${getPoolBadgeClass('alexandria')}`}>
                alexandria
              </span>
              <span className="ml-2">{formatDistributionAmount(event.allocations.alexandria_allocated)}</span>
            </div>
            
            <div className="terminal-row text-sm">
              <span className={`terminal-pool-badge ${getPoolBadgeClass('lp')}`}>
                lp_treasury
              </span>
              <span className="ml-2">{formatDistributionAmount(event.allocations.lp_treasury_allocated)}</span>
            </div>
            
            <div className="terminal-row text-sm">
              <span className={`terminal-pool-badge ${getPoolBadgeClass('stakers')}`}>
                stakers
              </span>
              <span className="ml-2">{formatDistributionAmount(event.allocations.stakers_allocated)}</span>
            </div>
          </div>
          
          {/* Results */}
          <div className="pt-2 border-t border-terminal-primary/20">
            <div className="text-xs terminal-dim mb-2">distribution_results:</div>
            
            {/* LP Provision Status */}
            <div className="terminal-row text-sm mb-2">
              <span className="terminal-label">lp_provision:</span>
              <span className={formatLpProvisionStatus(event.results.lp_provision_status).className}>
                {formatLpProvisionStatus(event.results.lp_provision_status).text}
              </span>
            </div>
            
            {/* Staker Rollover */}
            {event.results.stakers_rollover > 0n && (
              <div className="terminal-row text-sm mb-2">
                <span className="terminal-label">staker_rollover:</span>
                <span className="terminal-value">{formatDistributionAmount(event.results.stakers_rollover)}</span>
              </div>
            )}
            
            {/* Error Details */}
            {event.results.error_details && event.results.error_details.length > 0 && (
              <div className="mt-2">
                <div className="text-xs terminal-error mb-1">errors:</div>
                {event.results.error_details.map((error, idx) => (
                  <div key={idx} className="text-xs terminal-error ml-2">
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