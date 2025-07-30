import React, { useState, lazy, Suspense } from 'react';
import UnifiedInfoDisplay from '../UnifiedInfoDisplay';
import UnifiedSkeleton from '../UnifiedSkeleton';
import { useAppSelector } from '@/store/hooks/useAppSelector';

// Lazy load heavy components
const Insights = lazy(() => import('../Insights'));
const TokenomicsTab = lazy(() => import('../TokenomicsTab'));
const TreasuryTab = lazy(() => import('../TreasuryTab'));

type AnalyticsView = 'insights' | 'tokenomics' | 'technical' | 'treasury';

export const AnalyticsTerminal: React.FC = React.memo(() => {
  const [activeView, setActiveView] = useState<AnalyticsView>('insights');
  const { swap } = useAppSelector(state => state);
  const poolData = swap.activeSwapPool;

  const renderActiveView = () => {
    switch (activeView) {
      case 'insights':
        return (
          <Suspense fallback={<UnifiedSkeleton variant="card" rows={5} />}>
            <Insights />
          </Suspense>
        );
      case 'tokenomics':
        return (
          <Suspense fallback={<UnifiedSkeleton variant="card" rows={5} />}>
            <TokenomicsTab />
          </Suspense>
        );
      case 'technical':
        return <UnifiedInfoDisplay variant="developer" />;
      case 'treasury':
        return (
          <Suspense fallback={<UnifiedSkeleton variant="card" rows={5} />}>
            <TreasuryTab />
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <div className="terminal-pure terminal-flicker p-4 min-h-[400px]">
      {/* Terminal Header with view tabs */}
      <div className="flex justify-between items-center mb-3">
        <div className="terminal-header terminal-boot">
          <span className="terminal-prompt">&gt;&gt;</span> ANALYTICS_TERMINAL
        </div>
        {/* View Navigation */}
        <div className="flex gap-1">
          {(['insights', 'tokenomics', 'technical', 'treasury'] as const).map(view => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={`
                text-xs px-3 py-1 transition-all
                ${activeView === view
                  ? 'bg-lime-500 text-black font-bold'
                  : 'bg-transparent text-gray-400 hover:text-white'
                }
              `}
            >
              {view.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="terminal-divider-single" />

      {/* Active View Content */}
      <div className="terminal-section">
        {renderActiveView()}
      </div>
    </div>
  );
});

// Add display name for debugging
AnalyticsTerminal.displayName = 'AnalyticsTerminal';