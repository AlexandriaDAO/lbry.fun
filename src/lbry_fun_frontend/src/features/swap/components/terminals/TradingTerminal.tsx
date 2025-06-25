import React, { useState } from 'react';
import SwapContent from '../swap/swapContent';
import TransferContent from '../transfer/TransferContent';
import BurnContent from '../burn/burnContent';
import TransactionHistory from '../transactionHistory/transactionHistory';
import { useAppSelector } from '@/store/hooks/useAppSelector';

type OperationMode = 'swap' | 'transfer' | 'burn';

export const TradingTerminal: React.FC = React.memo(() => {
  const [activeOperation, setActiveOperation] = useState<OperationMode>('swap');
  const [showTransactions, setShowTransactions] = useState(false);
  
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
    <div className="terminal-pure terminal-flicker">
      {/* ASCII Art Header */}
      <pre className="terminal-ascii-header">
{`╔══════════════════════════════════════╗
║     TRADING TERMINAL v1.337          ║
╚══════════════════════════════════════╝`}
      </pre>

      {/* Terminal Header with timestamp */}
      <div className="terminal-header terminal-boot">
        <span className="terminal-prompt">&gt;&gt;</span> trading_terminal
        <span className="terminal-timestamp ml-2">
          {new Date().toTimeString().slice(0, 8)}
        </span>
      </div>

      <div className="terminal-divider-single" />

      {/* Operation Navigation */}
      <div className="terminal-section terminal-boot" style={{ animationDelay: '0.1s' }}>
        <span className="terminal-prompt">&gt;</span> active_operations
        <div className="flex gap-2 mt-1">
          {(['swap', 'transfer', 'burn'] as const).map(op => (
            <button
              key={op}
              onClick={() => setActiveOperation(op)}
              className={`
                terminal-button text-xs px-2 py-0.5
                ${activeOperation === op
                  ? 'border-lime-500 text-lime-500'
                  : 'border-white/30 text-gray-400 hover:text-white hover:border-white/50'
                }
              `}
            >
              [{op.toUpperCase()}]
            </button>
          ))}
        </div>
      </div>

      {/* Account Summary */}
      <div className="terminal-section terminal-boot" style={{ animationDelay: '0.2s' }}>
        <span className="terminal-prompt">&gt;</span> account_summary
        {isAuthenticated ? (
          <div className="ml-4">
            <pre className="text-gray-600 text-xs mb-2">
{`┌─────────────────────────────────────┐
│ WALLET STATUS: CONNECTED            │
└─────────────────────────────────────┘`}
            </pre>
            <div className="terminal-row justify-between">
              <span className="terminal-label">icp_balance:</span>
              <span className="terminal-value cyber-glow">
                {parseFloat(balances.icp).toFixed(4)}
                <span className="terminal-accent ml-1 text-xs">
                  {balances.icp === '0' ? '' : `ICP`}
                </span>
              </span>
            </div>
            {poolData && (
              <>
                <div className="terminal-row justify-between">
                  <span className="terminal-label">balance:</span>
                  <span className="terminal-value">
                    {parseFloat(balances.primary).toFixed(0)} {poolData[1].primary_token_symbol}
                  </span>
                </div>
                <div className="terminal-row justify-between">  
                  <span className="terminal-label">[max]</span>
                  <span className="terminal-value">
                    {parseFloat(balances.secondary).toFixed(0)} {poolData[1].secondary_token_symbol}
                  </span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="terminal-status-error ml-4 terminal-blink">
            [WALLET_NOT_CONNECTED] - Authentication required
          </div>
        )}
      </div>

      <div className="terminal-divider-dots" />

      {/* Active Operation Interface */}
      <div className="terminal-section terminal-boot" style={{ animationDelay: '0.4s' }}>
        <pre className="text-gray-600 text-xs mb-3">
{`>>> EXECUTING: ${activeOperation.toUpperCase()}_PROTOCOL`}
        </pre>
        {renderActiveOperation()}
      </div>

      {/* Recent Transactions (Collapsible) */}
      {isAuthenticated && (
        <div className="terminal-section terminal-boot" style={{ animationDelay: '0.5s' }}>
          <div 
            className="terminal-row cursor-pointer justify-between"
            onClick={() => setShowTransactions(!showTransactions)}
          >
            <span>
              <span className="terminal-prompt">&gt;</span> recent_transactions
            </span>
            <span className="terminal-accent text-xs">
              [{showTransactions ? '-' : '+'}]
            </span>
          </div>
          
          {showTransactions && (
            <div className="mt-1">
              <TransactionHistory />
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// Add display name for debugging
TradingTerminal.displayName = 'TradingTerminal';