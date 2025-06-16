import { lazy } from 'react';

// Lazy load all swap pages for better performance
export const LazyBalancePage = lazy(() => import('./BalancePage'));
export const LazySwapPage = lazy(() => import('./SwapPage'));
export const LazyBurnPage = lazy(() => import('./BurnPage'));
export const LazyStakePage = lazy(() => import('./StakePage'));
export const LazySendPage = lazy(() => import('./SendPage'));
export const LazyReceivePage = lazy(() => import('./ReceivePage'));
export const LazyHistoryPage = lazy(() => import('./HistoryPage'));
export const LazyInsightsPage = lazy(() => import('./InsightsPage'));
export const LazyRedeemPage = lazy(() => import('./RedeemPage'));