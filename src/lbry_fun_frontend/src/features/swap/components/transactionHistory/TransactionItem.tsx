import React from 'react';
import { Badge } from "@/lib/components/badge";
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
  const getKindColor = (kind: TransactionData['kind']) => {
    switch (kind) {
      case 'transfer': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'burn': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'mint': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'approve': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getStatusColor = (status: TransactionData['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getKindSymbol = (kind: TransactionData['kind']) => {
    switch (kind) {
      case 'transfer': return '→';
      case 'burn': return '🔥';
      case 'mint': return '⚡';
      case 'approve': return '✓';
      default: return '?';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return format(timestamp, 'PPpp');
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  return (
    <div 
      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => onViewDetails?.(transaction)}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
          <span className="text-lg">{getKindSymbol(transaction.kind)}</span>
        </div>
        
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Badge className={getKindColor(transaction.kind)}>
              {transaction.kind.toUpperCase()}
            </Badge>
            <Badge className={getStatusColor(transaction.status)}>
              {transaction.status.toUpperCase()}
            </Badge>
            <Badge variant="outline">
              {transaction.token.toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatTimestamp(transaction.timestamp)}
          </p>
          {transaction.to && (
            <p className="text-xs text-muted-foreground">
              To: {shortenAddress(transaction.to)}
            </p>
          )}
          {transaction.from && (
            <p className="text-xs text-muted-foreground">
              From: {shortenAddress(transaction.from)}
            </p>
          )}
        </div>
      </div>

      <div className="text-right">
        <p className="font-medium">{transaction.amount}</p>
        {transaction.fee && (
          <p className="text-xs text-muted-foreground">
            Fee: {transaction.fee}
          </p>
        )}
      </div>
    </div>
  );
};

export default TransactionItem;