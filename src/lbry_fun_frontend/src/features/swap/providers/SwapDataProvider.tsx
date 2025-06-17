import React, { createContext, useContext, ReactNode } from 'react';
import { useSwapDataLoader, LoadingPhase } from '../hooks/useSwapDataLoader';
import { LoaderCircle } from 'lucide-react';

interface SwapDataContextValue {
  loadingPhase: LoadingPhase;
  isSwapReady: boolean;
  criticalDataLoaded: boolean;
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

  // Always provide context and render children
  // Let individual components handle loading states with skeleton loaders
  // This ensures UI is always visible, even when not authenticated
  return (
    <SwapDataContext.Provider value={swapDataLoader}>
      {children}
    </SwapDataContext.Provider>
  );
};