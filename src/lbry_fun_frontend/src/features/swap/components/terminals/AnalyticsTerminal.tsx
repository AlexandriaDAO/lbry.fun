import React, { useState, lazy, Suspense } from 'react';
import UnifiedInfoDisplay from '../UnifiedInfoDisplay';
import UnifiedSkeleton from '../UnifiedSkeleton';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { TerminalExpander } from '../TerminalExpander';

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
    <TerminalExpander
      title="ANALYTICS_TERMINAL"
      status="[MONITORING]"
      terminalId="analytics"
      defaultExpanded={false}
    >
      <div className="p-4 min-h-[400px]">
        {/* View Navigation */}
        <div className="flex gap-1 mb-3">
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

        <div className="terminal-divider-single" />

        {/* Active View Content */}
        <div className="terminal-section">
          {renderActiveView()}
        </div>
      </div>
    </TerminalExpander>
  );
});

// Add display name for debugging
AnalyticsTerminal.displayName = 'AnalyticsTerminal';