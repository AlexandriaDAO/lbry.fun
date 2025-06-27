import React, { useEffect, Suspense, lazy } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import "./style.css"

import { useAppSelector } from '@/store/hooks/useAppSelector';
import ConsolidatedTerminal from './components/ConsolidatedTerminal';
import { SwapErrorBoundary } from './components/SwapErrorBoundary';
import { usePoolInitializer, PoolInitState } from './hooks/usePoolInitializer';
import { LoaderCircle } from 'lucide-react';
import UnifiedSkeleton from './components/UnifiedSkeleton';

// Lazy load terminals for better performance
const TradingTerminal = lazy(() => import('./components/terminals/TradingTerminal').then(m => ({ default: m.TradingTerminal })));
const StakingTerminal = lazy(() => import('./components/terminals/StakingTerminal').then(m => ({ default: m.StakingTerminal })));
const AnalyticsTerminal = lazy(() => import('./components/terminals/AnalyticsTerminal').then(m => ({ default: m.AnalyticsTerminal })));

const SwapMainConsolidated = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const swap = useAppSelector(state => state.swap);
    const idFromUrl = searchParams.get("id");
    
    // Use the pool initializer hook
    const { poolInitState, isPoolReady, error: poolError } = usePoolInitializer();

    // Use activeSwapPool ID as fallback when URL param is missing
    const poolId = idFromUrl || swap.activeSwapPool?.[0];
    
    const terminals = [
        { id: 1, label: 'Wallet Terminal', Component: ConsolidatedTerminal },
        { id: 2, label: 'Trading Terminal', Component: TradingTerminal },
        { id: 3, label: 'Staking & Rewards', Component: StakingTerminal },
        { id: 4, label: 'Analytics & Info', Component: AnalyticsTerminal }
    ];

    useEffect(() => {
        if (localStorage.getItem("tab") && poolId) {
            localStorage.removeItem("tab");
        }
    }, [poolId]);

    // Show loading state while pool is initializing
    if (poolInitState === PoolInitState.LOADING_POOLS || poolInitState === PoolInitState.SETTING_POOL) {
        return (
            <div className='tabs py-10 2xl:py-20 xl:py-16 lg:py-14 md:py-12 sm:py-10'>
                <div className='container px-5'>
                    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                        <LoaderCircle size={48} className="animate-spin text-primary" />
                        <p className="text-lg font-medium text-foreground">
                            Loading token pool...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Show error state for invalid pool
    if (poolInitState === PoolInitState.INVALID_POOL || poolInitState === PoolInitState.ERROR) {
        return (
            <div className='tabs py-10 2xl:py-20 xl:py-16 lg:py-14 md:py-12 sm:py-10'>
                <div className='container px-5'>
                    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                        <div className="text-center space-y-2">
                            <p className="text-lg font-medium text-destructive">
                                {poolError || 'Failed to load token pool'}
                            </p>
                            <button
                                onClick={() => navigate('/')}
                                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                            >
                                Back to Token List
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Only render main content when pool is ready
    return (
        <div className='py-2 sm:py-3 md:py-4'>
            <div className='container px-2 sm:px-3 md:px-4 lg:px-6 xl:px-8'>
                {isPoolReady ? (
                    <>
                        {/* Terminal Grid - responsive: 1 column mobile, 2 columns desktop */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <SwapErrorBoundary>
                                {terminals.map((terminal) => (
                                    <div key={terminal.id}>
                                        <Suspense fallback={<UnifiedSkeleton variant="terminal" />}>
                                            <terminal.Component />
                                        </Suspense>
                                    </div>
                                ))}
                            </SwapErrorBoundary>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="terminal-pure p-4 mb-4">
                            <ConsolidatedTerminal />
                        </div>
                        <div className="flex flex-col items-center justify-center min-h-[200px]">
                            <LoaderCircle size={32} className="animate-spin text-primary" />
                            <p className="mt-2 text-sm text-muted-foreground">Initializing...</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default SwapMainConsolidated;