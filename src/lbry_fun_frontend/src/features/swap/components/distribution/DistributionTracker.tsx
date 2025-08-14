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
      <div className="bg-black border border-white/30 font-mono text-sm p-3 mb-6">
        <div className="font-mono font-bold text-white mb-1 text-sm uppercase mb-2">
          <span className="text-pink-500">&gt;</span> distribution_error
        </div>
        <div className="flex justify-between items-center py-0.5">
          <span className="text-red-400">{distributionError}</span>
        </div>
      </div>
    );
  }

  if (!distributionSummary || distributionSummary.message === "Distribution tracking coming soon") {
    return (
      <div className="bg-black border border-white/30 font-mono text-sm p-3 mb-6">
        <div className="font-mono font-bold text-white mb-1 text-sm uppercase mb-2">
          <span className="text-pink-500">&gt;</span> distribution_status
        </div>
        <div className="flex justify-between items-center py-0.5">
          <span className="text-gray-600 text-xs">distribution_event_tracking_coming_soon</span>
        </div>
        <div className="mt-2 text-gray-500 text-xs">
          <span>Protocol fee distribution occurs automatically every interval.</span>
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