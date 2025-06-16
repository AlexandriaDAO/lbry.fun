import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/lib/components/ui/dialog";
import { Button } from "@/lib/components/ui/button";
import TokenDisplay from './TokenDisplay';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  transactionType: 'swap' | 'burn' | 'stake' | 'unstake' | 'transfer' | 'claim';
  amount?: string;
  tokenSymbol?: string;
  recipient?: string;
  fee?: string;
  estimatedGas?: string;
  logoBase64?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
  transactionType,
  amount,
  tokenSymbol,
  recipient,
  fee,
  estimatedGas,
  logoBase64
}) => {
  const getActionColor = (type: string) => {
    switch (type) {
      case 'burn': return 'bg-red-600 hover:bg-red-700';
      case 'stake': return 'bg-green-600 hover:bg-green-700';
      case 'unstake': return 'bg-yellow-600 hover:bg-yellow-700';
      case 'transfer': return 'bg-purple-600 hover:bg-purple-700';
      default: return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction Summary */}
          {amount && tokenSymbol && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Transaction Summary</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Amount:</span>
                  <TokenDisplay
                    symbol={tokenSymbol}
                    amount={amount}
                    logoBase64={logoBase64}
                    size="sm"
                    showUsd={false}
                  />
                </div>
                
                {recipient && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">To:</span>
                    <span className="text-sm font-mono">
                      {recipient.slice(0, 10)}...{recipient.slice(-4)}
                    </span>
                  </div>
                )}
                
                {fee && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Fee:</span>
                    <span className="text-sm">{fee}</span>
                  </div>
                )}
                
                {estimatedGas && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Est. Gas:</span>
                    <span className="text-sm">{estimatedGas}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Warning for destructive actions */}
          {transactionType === 'burn' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                ⚠️ This action cannot be undone. Your tokens will be permanently burned.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className={getActionColor(transactionType)}
          >
            {isLoading ? 'Processing...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmModal;