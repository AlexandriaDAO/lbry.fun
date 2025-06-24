import React from 'react';
import { TransactionData } from "../../types/transactionTypes";
import { format } from "date-fns";

interface TransactionItemProps {
  transaction: TransactionData;
  onViewDetails?: (transaction: TransactionData) => void;
}

const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  onViewDetails
}) => {
  const getKindSymbol = (kind: TransactionData['kind']) => {
    switch (kind) {
      case 'transfer': return '→';
      case 'burn': return '🔥';
      case 'mint': return '⚡';
      case 'approve': return '✓';
      default: return '?';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss');
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div 
      className="terminal-info cursor-pointer hover:bg-white/5 transition-colors"
      onClick={() => onViewDetails?.(transaction)}
    >
      <div className="terminal-row">
        <span className="terminal-label">tx_id:</span>
        <span className="hex-address">{shortenAddress(transaction.id)}</span>
      </div>
      <div className="terminal-row">
        <span className="terminal-label">type:</span>
        <span className="terminal-value">
          {getKindSymbol(transaction.kind)} {transaction.kind}
        </span>
      </div>
      <div className="terminal-row">
        <span className="terminal-label">status:</span>
        <span className={transaction.status === 'completed' ? 'terminal-primary' : 
                        transaction.status === 'failed' ? 'terminal-status' : 
                        'terminal-accent'}>
          [{transaction.status.toUpperCase()}]
        </span>
      </div>
      <div className="terminal-row">
        <span className="terminal-label">amount:</span>
        <span className="terminal-value">
          {transaction.amount} {transaction.tokenTicker?.toUpperCase() || transaction.token.toUpperCase()}
        </span>
      </div>
      {transaction.fee && (
        <div className="terminal-row">
          <span className="terminal-label">fee:</span>
          <span className="terminal-accent">{transaction.fee}</span>
        </div>
      )}
      {transaction.to && (
        <div className="terminal-row">
          <span className="terminal-label">to:</span>
          <span className="hex-address">{shortenAddress(transaction.to)}</span>
        </div>
      )}
      {transaction.from && (
        <div className="terminal-row">
          <span className="terminal-label">from:</span>
          <span className="hex-address">{shortenAddress(transaction.from)}</span>
        </div>
      )}
      <div className="terminal-row">
        <span className="terminal-label">timestamp:</span>
        <span className="terminal-accent text-xs">{formatTimestamp(transaction.timestamp)}</span>
      </div>
    </div>
  );
};

export default TransactionItem;