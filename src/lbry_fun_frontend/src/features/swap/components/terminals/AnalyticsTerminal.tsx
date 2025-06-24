import React, { useState, useEffect } from 'react';
import { useUnifiedSwapData } from '../../providers/UnifiedSwapDataProvider';
import Insights from '../insights/insights';
import InfoCard from '../info/InfoCard';
import TokenomicsTab from '../tokenomics/TokenomicsTab';

type AnalyticsView = 'insights' | 'tokenomics' | 'technical';

export const AnalyticsTerminal: React.FC = React.memo(() => {
  const [activeView, setActiveView] = useState<AnalyticsView>('insights');
  const { poolData, insights, tokenomics, loadInsights, loadTokenomics, isLoading } = useUnifiedSwapData();

  // Load data based on active view
  useEffect(() => {
    if (activeView === 'insights') {
      loadInsights();
    } else if (activeView === 'tokenomics') {
      loadTokenomics();
    }
  }, [activeView, loadInsights, loadTokenomics]);

  const renderActiveView = () => {
    switch (activeView) {
      case 'insights':
        return (
          <div className="mt-3">
            {isLoading.insights ? (
              <div className="text-gray-400 text-xs">Loading insights data...</div>
            ) : (
              <Insights />
            )}
          </div>
        );
      case 'tokenomics':
        return (
          <div className="mt-3">
            {isLoading.tokenomics ? (
              <div className="text-gray-400 text-xs">Loading tokenomics data...</div>
            ) : (
              <TokenomicsTab />
            )}
          </div>
        );
      case 'technical':
        return (
          <div className="mt-3">
            <InfoCard />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="terminal-pure">
      {/* Terminal Header */}
      <div className="terminal-header mb-3">
        <span className="terminal-prompt">&gt;&gt;</span> analytics_terminal
      </div>

      {/* Quick Stats Summary */}
      <div className="terminal-section mb-3">
        <div className="terminal-header mb-2">
          <span className="terminal-prompt">&gt;</span> quick_stats
        </div>
        {poolData ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div>
              <div className="terminal-label">pool_name:</div>
              <div className="terminal-value truncate">{poolData[1].pool_name}</div>
            </div>
            <div>
              <div className="terminal-label">primary_token:</div>
              <div className="terminal-primary">{poolData[1].primary_token_symbol}</div>
            </div>
            <div>
              <div className="terminal-label">secondary_token:</div>
              <div className="terminal-value">{poolData[1].secondary_token_symbol}</div>
            </div>
            <div>
              <div className="terminal-label">status:</div>
              <div className="terminal-status">[LIVE]</div>
            </div>
          </div>
        ) : (
          <div className="text-gray-400 text-xs">Loading pool data...</div>
        )}
      </div>

      {/* View Navigation */}
      <div className="terminal-section mb-3">
        <div className="flex gap-2">
          {(['insights', 'tokenomics', 'technical'] as const).map(view => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={`
                font-mono text-xs px-3 py-1 transition-colors
                ${activeView === view
                  ? 'bg-black border border-lime-500 text-lime-500'
                  : 'bg-black border border-white/30 text-gray-400 hover:text-white hover:border-white/50'
                }
              `}
            >
              [{view.toUpperCase()}]
            </button>
          ))}
        </div>
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