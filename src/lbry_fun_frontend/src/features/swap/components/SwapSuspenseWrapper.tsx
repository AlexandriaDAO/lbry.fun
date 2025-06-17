import React, { Suspense } from 'react';
import { LoaderCircle } from 'lucide-react';

interface SwapSuspenseWrapperProps {
  children: React.ReactNode;
}

const SwapLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
    <LoaderCircle size={48} className="animate-spin text-primary" />
    <div className="text-center space-y-2">
      <p className="text-lg font-medium text-foreground">
        Preparing swap interface...
      </p>
      <p className="text-sm text-muted-foreground">
        Loading market data and balances
      </p>
    </div>
  </div>
);

export const SwapSuspenseWrapper: React.FC<SwapSuspenseWrapperProps> = ({ children }) => {
  return (
    <Suspense fallback={<SwapLoadingFallback />}>
      {children}
    </Suspense>
  );
};