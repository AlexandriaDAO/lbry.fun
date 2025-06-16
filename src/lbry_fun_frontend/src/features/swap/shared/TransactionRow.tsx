import React from 'react';
import { Badge } from "@/lib/components/ui/badge";
import TokenDisplay from './TokenDisplay';

export interface Transaction {
  id: string;
  type: 'swap' | 'burn' | 'stake' | 'unstake' | 'transfer' | 'claim';
  amount: string;
  tokenSymbol: string;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
  fee?: string;
  recipient?: string;
  hash?: string;
}

interface TransactionRowProps {
  transaction: Transaction;
  onViewDetails?: (transaction: Transaction) => void;
  showLogo?: boolean;
  logoBase64?: string;
}

const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  onViewDetails,
  showLogo = true,
  logoBase64
}) => {
  const getTypeColor = (type: Transaction['type']) => {
    switch (type) {
      case 'swap': return 'bg-blue-100 text-blue-800';
      case 'burn': return 'bg-red-100 text-red-800';
      case 'stake': return 'bg-green-100 text-green-800';
      case 'unstake': return 'bg-yellow-100 text-yellow-800';
      case 'transfer': return 'bg-purple-100 text-purple-800';
      case 'claim': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getTypeSymbol = (type: Transaction['type']) => {
    switch (type) {
      case 'swap': return '⇄';
      case 'burn': return '🔥';
      case 'stake': return '🔒';
      case 'unstake': return '🔓';
      case 'transfer': return '→';
      case 'claim': return '💰';
      default: return '?';
    }
  };

  return (
    <div 
      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => onViewDetails?.(transaction)}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
          <span className="text-lg">{getTypeSymbol(transaction.type)}</span>
        </div>
        
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Badge className={getTypeColor(transaction.type)}>
              {transaction.type.toUpperCase()}
            </Badge>
            <Badge className={getStatusColor(transaction.status)}>
              {transaction.status.toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatTimestamp(transaction.timestamp)}
          </p>
          {transaction.recipient && (
            <p className="text-xs text-muted-foreground">
              To: {transaction.recipient.slice(0, 10)}...{transaction.recipient.slice(-4)}
            </p>
          )}
        </div>
      </div>

      <div className="text-right">
        <TokenDisplay
          symbol={transaction.tokenSymbol}
          amount={transaction.amount}
          logoBase64={showLogo ? logoBase64 : undefined}
          size="sm"
          showUsd={false}
        />
        {transaction.fee && (
          <p className="text-xs text-muted-foreground">
            Fee: {transaction.fee}
          </p>
        )}
      </div>
    </div>
  );
};

export default TransactionRow;