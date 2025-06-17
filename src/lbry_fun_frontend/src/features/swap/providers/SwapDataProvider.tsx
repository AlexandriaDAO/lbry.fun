import React, { createContext, useContext, ReactNode } from 'react';
import { useSwapDataLoader, LoadingPhase } from '../hooks/useSwapDataLoader';
import { LoaderCircle } from 'lucide-react';

interface SwapDataContextValue {
  loadingPhase: LoadingPhase;
  isSwapReady: boolean;
  criticalDataLoaded: boolean;
  error: string | null;
  retryLoading: () => void;
}

const SwapDataContext = createContext<SwapDataContextValue | undefined>(undefined);

export const useSwapData = () => {
  const context = useContext(SwapDataContext);
  if (!context) {
    throw new Error('useSwapData must be used within SwapDataProvider');
  }
  return context;
};

interface SwapDataProviderProps {
  children: ReactNode;
}

export const SwapDataProvider: React.FC<SwapDataProviderProps> = ({ children }) => {
  const swapDataLoader = useSwapDataLoader();
  const { loadingPhase, criticalDataLoaded, error, retryLoading } = swapDataLoader;

  // Show error state with retry option - this is critical and should block
  if (error && loadingPhase === LoadingPhase.ERROR) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-destructive">
            Failed to load swap data
          </p>
          <p className="text-sm text-muted-foreground">
            {error}
          </p>
          <button
            onClick={retryLoading}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Always provide context - let children handle loading states
  return (
    <SwapDataContext.Provider value={swapDataLoader}>
      {children}
    </SwapDataContext.Provider>
  );
};