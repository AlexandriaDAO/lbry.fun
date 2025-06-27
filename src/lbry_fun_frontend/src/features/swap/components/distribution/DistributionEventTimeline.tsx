import React from 'react';
import type { DistributionEvent } from '../../types/distributionTypes';
import DistributionEventCard from './DistributionEventCard';

interface DistributionEventTimelineProps {
  events: DistributionEvent[];
}

const DistributionEventTimeline: React.FC<DistributionEventTimelineProps> = ({ events }) => {
  return (
    <div className="terminal-pure">
      <div className="terminal-header mb-4">
        <span className="terminal-prompt">&gt;</span> recent_distributions
      </div>
      
      <div className="terminal-distribution-timeline">
        {events.length === 0 ? (
          <div className="terminal-info">
            <span className="terminal-dim">no_distribution_events_yet</span>
          </div>
        ) : (
          events.map((event) => (
            <DistributionEventCard key={event.event_id.toString()} event={event} />
          ))
        )}
      </div>
    </div>
  );
};

export default DistributionEventTimeline;