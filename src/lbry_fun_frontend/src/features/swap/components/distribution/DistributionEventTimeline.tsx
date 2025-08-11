import React from 'react';
import type { DistributionEvent } from '../../types/distributionTypes';
import DistributionEventCard from './DistributionEventCard';

interface DistributionEventTimelineProps {
  events: DistributionEvent[];
}

const DistributionEventTimeline: React.FC<DistributionEventTimelineProps> = ({ events }) => {
  return (
    <div className="bg-black border border-white/30 font-mono text-sm p-3">
      <div className="font-mono font-bold text-white mb-1 text-sm uppercase mb-4">
        <span className="text-pink-500">&gt;</span> recent_distributions
      </div>
      
      <div className="space-y-4">
        {events.length === 0 ? (
          <div className="bg-blue-900/20 border border-blue-500/30 text-blue-400 p-3 font-mono text-sm">
            <span className="text-gray-500">no_distribution_events_yet</span>
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