import React, { useState, lazy, Suspense } from 'react';
import UnifiedInfoDisplay from '../UnifiedInfoDisplay';
import UnifiedSkeleton from '../UnifiedSkeleton';
import { useAppSelector } from '@/store/hooks/useAppSelector';

// Lazy load heavy components
const Insights = lazy(() => import('../Insights'));
const TokenomicsTab = lazy(() => import('../TokenomicsTab'));

type AnalyticsView = 'insights' | 'tokenomics' | 'technical';

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
      default:
        return null;
    }
  };

  return (
    <div className="terminal-pure terminal-flicker">
      {/* ASCII Art Header */}
      <pre className="terminal-ascii-header">
{`╔══════════════════════════════════════╗
║    ANALYTICS TERMINAL v2.049         ║
║    [REAL-TIME DATA MONITORING]       ║
╚══════════════════════════════════════╝`}
      </pre>

      {/* Terminal Header */}
      <div className="terminal-header terminal-boot">
        <span className="terminal-prompt">&gt;&gt;</span> analytics_terminal
        <span className="terminal-status-live ml-2">[LIVE]</span>
      </div>

      <div className="terminal-divider-double" />

      {/* Quick Stats Summary */}
      <div className="terminal-section terminal-boot" style={{ animationDelay: '0.1s' }}>
        <span className="terminal-prompt">&gt;</span> quick_stats
        {poolData ? (
          <>
            <pre className="text-gray-600 text-xs ml-4 mb-2">
{`┌─────────────────────────────────────┐
│ POOL METRICS - REAL TIME            │
└─────────────────────────────────────┘`}
            </pre>
            <div className="ml-4 grid grid-cols-2 md:grid-cols-4 gap-x-4 text-xs">
              <div className="terminal-row">
                <span className="terminal-label">pool_name:</span>
                <span className="terminal-value ml-1 terminal-typewriter">{poolData[1].pool_name}</span>
              </div>
              <div className="terminal-row">
                <span className="terminal-label">primary_token:</span>
                <span className="terminal-primary ml-1 cyber-glow">{poolData[1].primary_token_symbol}</span>
              </div>
              <div className="terminal-row">
                <span className="terminal-label">secondary_token:</span>
                <span className="terminal-value ml-1">{poolData[1].secondary_token_symbol}</span>
              </div>
              <div className="terminal-row">
                <span className="terminal-label">status:</span>
                <span className="terminal-status-live ml-1">[ACTIVE]</span>
              </div>
            </div>
          </>
        ) : (
          <div className="terminal-status-loading ml-4">Loading pool metrics</div>
        )}
      </div>

      {/* View Navigation */}
      <div className="flex gap-2 mt-2 mb-1">
        {(['insights', 'tokenomics', 'technical'] as const).map(view => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`
              terminal-button text-xs px-2 py-0.5
              ${activeView === view
                ? 'border-lime-500 text-lime-500'
                : 'border-white/30 text-gray-400 hover:text-white hover:border-white/50'
              }
            `}
          >
            [{view.toUpperCase()}]
          </button>
        ))}
      </div>

      {/* Active View Content */}
      <div className="terminal-section">
        {renderActiveView()}
      </div>
    </div>
  );
});

// Add display name for debugging
AnalyticsTerminal.displayName = 'AnalyticsTerminal';