import React, { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { distributionThunks } from '../../thunks/distributionThunks';
import DistributionOverview from './DistributionOverview';
import PoolAllocationChart from './PoolAllocationChart';
import DistributionEventTimeline from './DistributionEventTimeline';
import UnifiedSkeleton from '@/features/swap/components/UnifiedSkeleton';

interface DistributionTrackerProps {
  icpSwapCanisterId: string;
}

const DistributionTracker: React.FC<DistributionTrackerProps> = ({ icpSwapCanisterId }) => {
  const dispatch = useAppDispatch();
  const {
    distributionSummary,
    distributionEvents,
    distributionLoading,
    distributionError
  } = useAppSelector((state) => state.swap);

  useEffect(() => {
    if (icpSwapCanisterId) {
      dispatch(distributionThunks.fetchDistributionSummary(icpSwapCanisterId));
      dispatch(distributionThunks.fetchDistributionEvents({ 
        icpSwapId: icpSwapCanisterId, 
        limit: 10 
      }));
    }
  }, [dispatch, icpSwapCanisterId]);

  // Refresh distribution data every minute
  useEffect(() => {
    if (!icpSwapCanisterId) return;

    const interval = setInterval(() => {
      dispatch(distributionThunks.fetchDistributionSummary(icpSwapCanisterId));
      dispatch(distributionThunks.fetchLatestDistributionEvent(icpSwapCanisterId));
    }, 60000); // 1 minute

    return () => clearInterval(interval);
  }, [dispatch, icpSwapCanisterId]);

  if (distributionLoading && !distributionSummary) {
    return <UnifiedSkeleton variant="card" rows={20} />;
  }

  if (distributionError) {
    return (
      <div className="terminal-pure mb-6">
        <div className="terminal-header mb-2">
          <span className="terminal-prompt">&gt;</span> distribution_error
        </div>
        <div className="terminal-row">
          <span className="terminal-error">{distributionError}</span>
        </div>
      </div>
    );
  }

  if (!distributionSummary) {
    return (
      <div className="terminal-pure mb-6">
        <div className="terminal-header mb-2">
          <span className="terminal-prompt">&gt;</span> distribution_status
        </div>
        <div className="terminal-row">
          <span className="terminal-accent">no_distribution_data_available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DistributionOverview summary={distributionSummary} />
      
      {distributionSummary.lifetime_totals && (
        <PoolAllocationChart data={distributionSummary.lifetime_totals} />
      )}
      
      {distributionEvents.length > 0 && (
        <DistributionEventTimeline events={distributionEvents} />
      )}
    </div>
  );
};

export default DistributionTracker;