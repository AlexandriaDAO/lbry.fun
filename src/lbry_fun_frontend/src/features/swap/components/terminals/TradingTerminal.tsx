import React, { useState, useEffect } from 'react';
import { useUnifiedSwapData } from '../../providers/UnifiedSwapDataProvider';
import SwapContent from '../swap/swapContent';
import TransferContent from '../transfer/TransferContent';
import BurnContent from '../burn/burnContent';
import TransactionHistory from '../transactionHistory/transactionHistory';
import { useAppSelector } from '@/store/hooks/useAppSelector';

type OperationMode = 'swap' | 'transfer' | 'burn';

export const TradingTerminal: React.FC = React.memo(() => {
  const [activeOperation, setActiveOperation] = useState<OperationMode>('swap');
  const [showTransactions, setShowTransactions] = useState(false);
  const { balances, poolData, transactions, loadTransactions, isLoading } = useUnifiedSwapData();
  const { auth } = useAppSelector(state => state);
  const isAuthenticated = auth.isAuthenticated;

  // Load transactions when expanded
  useEffect(() => {
    if (showTransactions && isAuthenticated) {
      loadTransactions();
    }
  }, [showTransactions, isAuthenticated, loadTransactions]);

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
    <div className="terminal-pure">
      {/* Terminal Header */}
      <div className="terminal-header mb-3">
        <span className="terminal-prompt">&gt;&gt;</span> trading_terminal
      </div>

      {/* Operation Navigation */}
      <div className="terminal-section mb-3">
        <div className="terminal-header mb-2">
          <span className="terminal-prompt">&gt;</span> active_operations
        </div>
        <div className="flex gap-2">
          {(['swap', 'transfer', 'burn'] as const).map(op => (
            <button
              key={op}
              onClick={() => setActiveOperation(op)}
              className={`
                font-mono text-xs px-3 py-1 transition-colors
                ${activeOperation === op
                  ? 'bg-black border border-lime-500 text-lime-500'
                  : 'bg-black border border-white/30 text-gray-400 hover:text-white hover:border-white/50'
                }
              `}
            >
              [{op.toUpperCase()}]
            </button>
          ))}
        </div>
      </div>

      {/* Account Summary */}
      <div className="terminal-section mb-3">
        <div className="terminal-header mb-2">
          <span className="terminal-prompt">&gt;</span> account_summary
        </div>
        {isAuthenticated ? (
          <div className="space-y-1">
            <div className="terminal-row">
              <span className="terminal-label">icp_balance:</span>
              <div className="text-right">
                <span className="terminal-primary">
                  {parseFloat(balances.icp).toFixed(4)}
                </span>
                <span className="terminal-accent ml-2">
                  [{parseFloat(balances.icp).toFixed(2)} ICP]
                </span>
              </div>
            </div>
            {poolData && (
              <>
                <div className="terminal-row">
                  <span className="terminal-label">primary_balance:</span>
                  <span className="terminal-value">
                    {formatBalance(balances.primary, poolData[1].primary_token_symbol)}
                  </span>
                </div>
                <div className="terminal-row">
                  <span className="terminal-label">secondary_balance:</span>
                  <span className="terminal-value">
                    {formatBalance(balances.secondary, poolData[1].secondary_token_symbol)}
                  </span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-gray-400 text-xs">
            [NOT CONNECTED] - Connect wallet to view balances
          </div>
        )}
      </div>

      {/* Active Operation Interface */}
      <div className="terminal-section mb-3">
        {renderActiveOperation()}
      </div>

      {/* Recent Transactions (Collapsible) */}
      {isAuthenticated && (
        <div className="terminal-section">
          <div 
            className="terminal-header mb-2 cursor-pointer flex justify-between items-center"
            onClick={() => setShowTransactions(!showTransactions)}
          >
            <div>
              <span className="terminal-prompt">&gt;</span> recent_transactions
            </div>
            <span className="terminal-accent text-xs">
              [{showTransactions ? 'COLLAPSE' : 'EXPAND'}]
            </span>
          </div>
          
          {showTransactions && (
            <div className="mt-2">
              {isLoading.transactions ? (
                <div className="text-gray-400 text-xs">Loading transactions...</div>
              ) : transactions.length > 0 ? (
                <>
                  {/* Show last 5 transactions */}
                  <div className="space-y-2 mb-2">
                    {transactions.slice(0, 5).map((tx, index) => (
                      <div key={index} className="text-xs">
                        <div className="terminal-row">
                          <span className="terminal-label">{tx.timestamp}:</span>
                          <span className="terminal-value">{tx.type} - {tx.amount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {transactions.length > 5 && (
                    <button 
                      className="terminal-accent text-xs hover:text-white transition-colors"
                      onClick={() => {/* Navigate to full history */}}
                    >
                      [VIEW_ALL] {transactions.length} transactions
                    </button>
                  )}
                </>
              ) : (
                <div className="text-gray-400 text-xs">No transactions found</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// Add display name for debugging
TradingTerminal.displayName = 'TradingTerminal';