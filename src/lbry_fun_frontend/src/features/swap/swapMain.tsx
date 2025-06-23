import React, { useEffect, Suspense } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import "./style.css"

import { useAppSelector } from '@/store/hooks/useAppSelector';
import AccountCards from './components/balance/accountCards';
import SwapContent from './components/swap/swapContent';
import TransferContent from './components/transfer/TransferContent';
import BurnContent from './components/burn/burnContent';
import StakeContent from './components/stake/stakeContent';
import TransactionHistory from './components/transactionHistory/transactionHistory';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-regular-svg-icons';
import Insights from './components/insights/insights';
import SwapPageWrapper from './components/SwapPageWrapper';
import InfoCard from './components/info/InfoCard';
import TokenomicsTab from './components/tokenomics/TokenomicsTab';

import { SwapDataProvider } from './providers/SwapDataProvider';
import { SwapErrorBoundary } from './components/SwapErrorBoundary';
import { usePoolInitializer, PoolInitState } from './hooks/usePoolInitializer';
import { LoaderCircle } from 'lucide-react';

const SwapMain = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const swap = useAppSelector(state => state.swap);
    const idFromUrl = searchParams.get("id");
    
    // Use the pool initializer hook
    const { poolInitState, isPoolReady, error: poolError } = usePoolInitializer();

    const tabs = [
        { id: 2, path: 'swap', label: 'Swap', hover: `Swap ICP for ${swap.activeSwapPool&&swap.activeSwapPool[1].secondary_token_symbol}`, Component: SwapContent },
        { id: 3, path: 'transfer', label: 'Transfer', hover: 'Send or receive tokens', Component: TransferContent },
        { id: 6, path: 'burn', label: 'Burn', hover: `Burn ${swap.activeSwapPool&&swap.activeSwapPool[1].secondary_token_symbol}, get back ${swap.activeSwapPool&&swap.activeSwapPool[1].primary_token_symbol} and ICP`, Component: BurnContent },
        { id: 7, path: 'stake', label: 'Stake', hover: null, Component: StakeContent },
        { id: 9, path: 'history', label: 'Transaction history', hover: null, Component: TransactionHistory },
        { id: 10, path: 'insights', label: 'Insights', hover: null, Component: Insights },
        { id: 11, path: 'info', label: 'Info', hover: null, Component: InfoCard },
        { id: 12, path: 'tokenomics', label: 'Tokenomics', hover: "View tokenomics graphs and distribution schedules", Component: TokenomicsTab }
    ];

    const currentPath = location.pathname.split('/').pop() || 'swap';
    const activeTab = tabs.find(tab => tab.path === currentPath)?.id || 2;

    useEffect(() => {
        if (localStorage.getItem("tab")) {
            navigate('/swap/stake');
            localStorage.removeItem("tab");
        }
    }, []);

    // Redirect old routes to their new locations
    useEffect(() => {
        if (currentPath === 'send' || currentPath === 'receive') {
            navigate(`/swap/transfer?id=${idFromUrl}`, { replace: true });
        }
        // Redirect old redeem and balance routes to swap route
        if (currentPath === 'redeem' || currentPath === 'balance') {
            navigate(`/swap/swap?id=${idFromUrl}`, { replace: true });
        }
    }, [currentPath, idFromUrl, navigate]);

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
        <div className='tabs py-10 2xl:py-20 xl:py-16 lg:py-14 md:py-12 sm:py-10'>
            <div className='container px-5'>
                <AccountCards />
                <div className='tabs-content'>
                    <div className='tabs-content'>
                        <div className="flex mb-5 flex-wrap">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => navigate(`/swap/${tab.path}?id=${idFromUrl}`)}
                                    className={`px-2 py-2 flex items-center ${activeTab === tab.id
                                        ? 'text-base 2xl:text-xl bg-interactive-primary text-primary-foreground px-5'
                                        : 'bg-background text-foreground'} transition-colors duration-300 text-base font-semibold leading-6 min-w-24 h-11 border border-border rounded-2xl mr-3 hover:bg-interactive-primary hover:text-primary-foreground px-5 mb-4 z-20`}
                                >
                                    {tab.label}
                                    {tab.hover === null ? (<></>) : (<div className='relative group'>
                                        <FontAwesomeIcon icon={faQuestionCircle} className='text-muted-foreground text-2xl ml-3 position-relative' />
                                        <span className='bg-popover text-popover-foreground p-3 rounded-2xl absolute bottom-12 left-1/2 -translate-x-1/2 text-xs font-light w-52 z-10 invisible group-hover:visible before:content-[" "] before:block before:absolute before:border-l-[10px] before:border-l-transparent before:border-r-[10px] before:border-r-transparent before:border-b-[20px] before:border-b-popover before:rotate-180 before:-bottom-5 before:left-1/2 before:-translate-x-1/2'>{tab.hover}</span>
                                    </div>)}
                                </button>
                            ))}
                        </div>

                        <div className="mt-4">
                            <SwapErrorBoundary>
                                {isPoolReady ? (
                                    <SwapDataProvider>
                                        <SwapPageWrapper>
                                            {(() => {
                                                const activeTabData = tabs.find(tab => tab.path === currentPath);
                                                if (activeTabData && activeTabData.Component) {
                                                    const Component = activeTabData.Component;
                                                    return <Component />;
                                                }
                                                return null;
                                            })()}
                                        </SwapPageWrapper>
                                    </SwapDataProvider>
                                ) : (
                                    <div className="flex flex-col items-center justify-center min-h-[200px]">
                                        <LoaderCircle size={32} className="animate-spin text-primary" />
                                        <p className="mt-2 text-sm text-muted-foreground">Initializing...</p>
                                    </div>
                                )}
                            </SwapErrorBoundary>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SwapMain;
