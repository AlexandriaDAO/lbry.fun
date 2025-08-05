import React, { useState } from 'react';
import SwapContent from '../SwapContent';
import TransferContent from '../TransferContent';
import BurnContent from '../BurnContent';
import UnifiedTransaction from '../UnifiedTransaction';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { useSwapDataLoader } from '../../hooks/useSwapDataLoader';
import { TerminalExpander } from '../TerminalExpander';

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
    <TerminalExpander
      title="TRADING_TERMINAL"
      status="[ACTIVE]"
      terminalId="trading"
      defaultExpanded={false}
    >
      <div className="p-4 min-h-[400px]">
        {/* Operation Tabs */}
        <div className="flex gap-1 mb-3">
          {(['swap', 'transfer', 'burn'] as const).map(op => (
            <button
              key={op}
              onClick={() => setActiveOperation(op)}
              className={`
                text-xs px-3 py-1 transition-all
                ${activeOperation === op
                  ? 'bg-lime-500 text-black font-bold'
                  : 'bg-transparent text-gray-400 hover:text-white'
                }
              `}
            >
              {op.toUpperCase()}
            </button>
          ))}
          <button
            onClick={() => setShowTransactions(!showTransactions)}
            className={`
              text-xs px-3 py-1 transition-all
              ${showTransactions ? 'bg-lime-500 text-black font-bold' : 'bg-transparent text-gray-400 hover:text-white'}
            `}
          >
            HISTORY
          </button>
        </div>

        <div className="terminal-divider-single" />

        {/* Active Operation Interface */}
        <div className="terminal-section">
          {renderActiveOperation()}
        </div>

        {/* Recent Transactions */}
        {isAuthenticated && showTransactions && (
          <div className="terminal-section mt-4">
            <UnifiedTransaction view="history" />
          </div>
        )}
      </div>
    </TerminalExpander>
  );
});

// Add display name for debugging
TradingTerminal.displayName = 'TradingTerminal';