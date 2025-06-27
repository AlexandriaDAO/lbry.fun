import React, { useState } from 'react';
import SwapContent from '../SwapContent';
import TransferContent from '../TransferContent';
import BurnContent from '../BurnContent';
import UnifiedTransaction from '../UnifiedTransaction';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { useSwapDataLoader } from '../../hooks/useSwapDataLoader';

type OperationMode = 'swap' | 'transfer' | 'burn';

export const TradingTerminal: React.FC = React.memo(() => {
  const [activeOperation, setActiveOperation] = useState<OperationMode>('swap');
  const [showTransactions, setShowTransactions] = useState(false);
  
  // Load swap data
  const { loadingPhase, criticalDataLoaded } = useSwapDataLoader();
  
  // Get data directly from Redux - no provider needed
  const { auth, swap, icpLedger, primary } = useAppSelector(state => state);
  const isAuthenticated = auth.isAuthenticated;
  const poolData = swap.activeSwapPool;
  
  // Simple balance data
  const balances = {
    icp: icpLedger.accountBalance || '0',
    primary: primary.primaryBal || '0',
    secondary: swap.secondaryBalance || '0'
  };

  const renderActiveOperation = () => {
    switch (activeOperation) {
      case 'swap':
        return <SwapContent />;
      case 'transfer':
        return <TransferContent />;
      case 'burn':
        return <BurnContent />;
      default:
        return null;
    }
  };

  const formatBalance = (balance: string, symbol: string) => {
    // Balance is already in natural units as a string
    const balanceNum = parseFloat(balance) || 0;
    const formatted = balanceNum.toFixed(4);
    return `${formatted} ${symbol}`;
  };

  return (
    <div className="terminal-pure terminal-flicker p-4 min-h-[400px]">
      {/* Terminal Header with tabs */}
      <div className="flex justify-between items-center mb-3">
        <div className="terminal-header terminal-boot">
          <span className="terminal-prompt">&gt;&gt;</span> TRADING_TERMINAL
        </div>
        {/* Operation Tabs */}
        <div className="flex gap-2">
          {(['swap', 'transfer', 'burn'] as const).map(op => (
            <button
              key={op}
              onClick={() => setActiveOperation(op)}
              className={`
                terminal-button text-xs px-2 py-1
                ${activeOperation === op
                  ? 'border-lime-500 text-lime-500'
                  : 'border-white/30 text-gray-400 hover:text-white hover:border-white/50'
                }
              `}
            >
              [{op.toUpperCase()}]
            </button>
          ))}
          <button
            onClick={() => setShowTransactions(!showTransactions)}
            className={`
              terminal-button text-xs px-2 py-1
              ${showTransactions ? 'border-lime-500 text-lime-500' : 'border-white/30 text-gray-400'}
            `}
          >
            [HISTORY]
          </button>
        </div>
      </div>

      <div className="terminal-divider-single" />

      {/* Active Operation Interface */}
      <div className="terminal-section terminal-boot" style={{ animationDelay: '0.4s' }}>
        {renderActiveOperation()}
      </div>

      {/* Recent Transactions */}
      {isAuthenticated && showTransactions && (
        <div className="terminal-section terminal-boot" style={{ animationDelay: '0.5s' }}>
          <UnifiedTransaction view="history" />
        </div>
      )}
    </div>
  );
});

// Add display name for debugging
TradingTerminal.displayName = 'TradingTerminal';