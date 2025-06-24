import React, { useEffect, Suspense } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import "./style.css"

import { useAppSelector } from '@/store/hooks/useAppSelector';
import ConsolidatedTerminal from './components/balance/ConsolidatedTerminal';
import { UnifiedSwapDataProvider } from './providers/UnifiedSwapDataProvider';
import { SwapErrorBoundary } from './components/SwapErrorBoundary';
import { usePoolInitializer, PoolInitState } from './hooks/usePoolInitializer';
import { LoaderCircle } from 'lucide-react';
import { TradingTerminal } from './components/terminals/TradingTerminal';
import { StakingTerminal } from './components/terminals/StakingTerminal';
import { AnalyticsTerminal } from './components/terminals/AnalyticsTerminal';

const SwapMainConsolidated = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const swap = useAppSelector(state => state.swap);
    const idFromUrl = searchParams.get("id");
    
    // Use the pool initializer hook
    const { poolInitState, isPoolReady, error: poolError } = usePoolInitializer();

    // Use activeSwapPool ID as fallback when URL param is missing
    const poolId = idFromUrl || swap.activeSwapPool?.[0];
    
    const tabs = [
        { id: 1, path: 'trade', label: 'Trading Terminal', Component: TradingTerminal },
        { id: 2, path: 'stake', label: 'Staking & Rewards', Component: StakingTerminal },
        { id: 3, path: 'analytics', label: 'Analytics & Info', Component: AnalyticsTerminal }
    ];

    const currentPath = location.pathname.split('/').pop() || 'trade';
    // Handle index route (/swap) by defaulting to trade tab
    const effectivePath = currentPath === 'swap' && location.pathname === '/swap' ? 'trade' : currentPath;
    const activeTab = tabs.find(tab => tab.path === effectivePath)?.id || 1;

    useEffect(() => {
        if (localStorage.getItem("tab")) {
            navigate('/swap/stake');
            localStorage.removeItem("tab");
        }
    }, []);

    // Redirect index route to trade tab
    useEffect(() => {
        if (location.pathname === '/swap' && poolId) {
            navigate(`/swap/trade?id=${poolId}`, { replace: true });
        }
    }, [poolId, navigate, location.pathname]);

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
        <div className='tabs py-2 sm:py-3 md:py-4'>
            <div className='container px-2 sm:px-3 md:px-4'>
                {isPoolReady ? (
                    <UnifiedSwapDataProvider>
                        <ConsolidatedTerminal />
                        <div className='tabs-content'>
                            <div className='tabs-content'>
                                {/* Consolidated Tab Navigation */}
                                <div className="flex mb-3 flex-wrap">
                                    {tabs.map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => navigate(`/swap/${tab.path}?id=${poolId}`)}
                                            className={`font-mono text-sm px-4 py-2 mr-2 mb-2 transition-colors ${
                                                activeTab === tab.id
                                                    ? 'bg-black border-2 border-lime-500 text-lime-500'
                                                    : 'bg-black border border-white/30 text-gray-400 hover:text-white hover:border-white/50'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-4">
                                    <SwapErrorBoundary>
                                        {(() => {
                                            const activeTabData = tabs.find(tab => tab.path === effectivePath);
                                            if (activeTabData && activeTabData.Component) {
                                                const Component = activeTabData.Component;
                                                return <Component />;
                                            }
                                            return null;
                                        })()}
                                    </SwapErrorBoundary>
                                </div>
                            </div>
                        </div>
                    </UnifiedSwapDataProvider>
                ) : (
                    <>
                        <ConsolidatedTerminal />
                        <div className='tabs-content'>
                            <div className="flex flex-col items-center justify-center min-h-[200px]">
                                <LoaderCircle size={32} className="animate-spin text-primary" />
                                <p className="mt-2 text-sm text-muted-foreground">Initializing...</p>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default SwapMainConsolidated;