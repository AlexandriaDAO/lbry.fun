import React from 'react';
import { AlertCircle } from 'lucide-react';

export const PoolCreationStatus: React.FC = () => {
  return (
    <div className="mt-3 bg-yellow-900/20 border border-yellow-500 p-3 rounded animate-pulse">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-yellow-500" />
        <div>
          <p className="font-semibold text-yellow-400">Creating Liquidity Pool</p>
          <p className="text-xs text-gray-400 mt-1">
            This is the final and most critical step. If this fails, your deployment will be rolled back
            and you'll receive a refund.
          </p>
        </div>
      </div>
    </div>
  );
};