import React, { useEffect, useMemo, lazy, Suspense } from 'react';
import { LoaderCircle } from 'lucide-react';
import TooltipIcon from '@/features/token/components/TooltipIcon';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { analyticsThunks } from '../thunks/analyticsThunks';
import UnifiedSkeleton from './UnifiedSkeleton';

// Lazy load the Chart component
const LineChart = lazy(() => import('./Chart'));

// Destructure for easier access
const { getAllLogs } = analyticsThunks;

const formatTime = (timestamps: number[]) => {
    return timestamps.map(ts => new Date(ts).toLocaleDateString());
};

const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(2);
};

const Insights: React.FC = () => {
    const dispatch = useAppDispatch();
    const { swap } = useAppSelector(state => state);
    const { logsData: insights, logsLoading: isLoading, logsError: error } = swap;
    const poolData = swap.activeSwapPool;
    
    useEffect(() => {
        if (poolData?.[1]?.logs_canister_id) {
            dispatch(getAllLogs(poolData[1].logs_canister_id));
        }
    }, [dispatch, poolData]);

    const summaryData = useMemo(() => {
        if (!insights || insights.time.length === 0) {
            return null;
        }
        const lastIndex = insights.time.length - 1;
        return {
            primaryTokenSupply: insights.primaryTokenSupply[lastIndex],
            secondaryTokenSupply: insights.secondaryTokenSupply[lastIndex],
            totalSecondaryBurned: insights.totalSecondaryBurned[lastIndex],
            totalPrimaryStaked: insights.totalPrimaryStaked[lastIndex],
            stakerCount: insights.stakerCount[lastIndex],
            hourlyIcpRewards: insights.hourlyIcpRewards[lastIndex],
            icpInLpTreasury: insights.icpInLpTreasury[lastIndex],
        };
    }, [insights]);
    
    if (isLoading) {
        return (
            <div className="terminal-pure terminal-boot">
                <div className="terminal-header">
                    <span className="terminal-prompt">&gt;&gt;</span> loading_insights
                </div>
                <div className="flex justify-center items-center h-32">
                    <div className="terminal-status-loading">
                        FETCHING BLOCKCHAIN DATA
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="terminal-pure terminal-boot">
                <div className="terminal-header">
                    <span className="terminal-prompt">&gt;&gt;</span> insights_error
                </div>
                <div className="terminal-row">
                    <span className="terminal-status-error">[ERROR]</span>
                    <span className="terminal-accent ml-2">{error}</span>
                </div>
            </div>
        );
    }

    if (!insights || insights.time.length === 0) {
        return (
            <div className="terminal-pure">
                <div className="terminal-header">
                    <span className="terminal-prompt">&gt;&gt;</span> insights
                </div>
                <div className="terminal-row">
                    <span className="terminal-label">status:</span>
                    <span className="terminal-accent">no_data_available</span>
                </div>
            </div>
        );
    }

    const formattedTime = formatTime(insights.time);

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="terminal-pure mb-8">
                <div className="terminal-header mb-2">
                    <span className="terminal-prompt">&gt;&gt;</span> swap_pool_insights
                </div>
                <div className="terminal-row">
                    <span className="terminal-label">source:</span>
                    <span className="terminal-accent">on_chain_logs_canister</span>
                </div>
            </div>

            {summaryData && (
                <div className="terminal-pure mb-8">
                    <div className="terminal-header mb-2">
                        <span className="terminal-prompt">&gt;</span> latest_metrics
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        <div className="terminal-info">
                            <div className="terminal-row">
                                <span className="terminal-label">primary_supply:</span>
                                <span className="terminal-primary">{formatNumber(summaryData.primaryTokenSupply)}</span>
                            </div>
                        </div>
                        <div className="terminal-info">
                            <div className="terminal-row">
                                <span className="terminal-label">secondary_supply:</span>
                                <span className="terminal-value">{formatNumber(summaryData.secondaryTokenSupply)}</span>
                            </div>
                        </div>
                        <div className="terminal-info">
                            <div className="terminal-row">
                                <span className="terminal-label">secondary_burned:</span>
                                <span className="terminal-value">{formatNumber(summaryData.totalSecondaryBurned)}</span>
                            </div>
                        </div>
                        <div className="terminal-info">
                            <div className="terminal-row">
                                <span className="terminal-label">primary_staked:</span>
                                <span className="terminal-value">{formatNumber(summaryData.totalPrimaryStaked)}</span>
                            </div>
                        </div>
                        <div className="terminal-info">
                            <div className="terminal-row">
                                <span className="terminal-label">stakers:</span>
                                <span className="terminal-value">{summaryData.stakerCount}</span>
                            </div>
                        </div>
                        <div className="terminal-info">
                            <div className="terminal-row">
                                <span className="terminal-label">icp_in_lp:</span>
                                <span className="terminal-value">{formatNumber(summaryData.icpInLpTreasury)}</span>
                            </div>
                        </div>
                        <div className="terminal-info">
                            <div className="terminal-row">
                                <span className="terminal-label">hourly_icp_rewards:</span>
                                <span className="terminal-primary">{summaryData.hourlyIcpRewards.toFixed(6)} ICP</span>
                                <TooltipIcon text="ICP rewards earned per primary token per hour" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <Suspense fallback={<UnifiedSkeleton variant="card" rows={10} />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <div className="flex items-center mb-2">
                        <h3 className="text-xl font-medium text-white">Primary Token Supply</h3>
                        <TooltipIcon text="Tracks the total supply of the primary token over time." />
                    </div>
                    <LineChart dataXaxis={formattedTime} dataYaxis={insights.primaryTokenSupply} xAxisLabel="Time" yAxisLabel="Supply" lineColor="hsl(var(--color-chart-primary))" gardientColor="hsl(var(--color-chart-primary) / 0.3)" />
                </div>
                <div>
                    <div className="flex items-center mb-2">
                        <h3 className="text-xl font-medium text-white">Secondary Token Supply</h3>
                        <TooltipIcon text="Tracks the total supply of the secondary token over time." />
                    </div>
                    <LineChart dataXaxis={formattedTime} dataYaxis={insights.secondaryTokenSupply} xAxisLabel="Time" yAxisLabel="Supply" lineColor="hsl(var(--color-chart-secondary))" gardientColor="hsl(var(--color-chart-secondary) / 0.3)" />
                </div>
                <div>
                    <div className="flex items-center mb-2">
                        <h3 className="text-xl font-medium text-white">Total Secondary Burned</h3>
                        <TooltipIcon text="The cumulative amount of secondary tokens burned." />
                    </div>
                    <LineChart dataXaxis={formattedTime} dataYaxis={insights.totalSecondaryBurned} xAxisLabel="Time" yAxisLabel="Burned" lineColor="hsl(var(--color-chart-warning))" gardientColor="hsl(var(--color-chart-warning) / 0.3)" />
                </div>
                <div>
                    <div className="flex items-center mb-2">
                        <h3 className="text-xl font-medium text-white">Total Primary Staked</h3>
                        <TooltipIcon text="The total amount of primary tokens currently staked in the pool." />
                    </div>
                    <LineChart dataXaxis={formattedTime} dataYaxis={insights.totalPrimaryStaked} xAxisLabel="Time" yAxisLabel="Staked" lineColor="hsl(var(--color-chart-error))" gardientColor="hsl(var(--color-chart-error) / 0.3)" />
                </div>
                <div>
                    <div className="flex items-center mb-2">
                        <h3 className="text-xl font-medium text-white">Staker Count</h3>
                        <TooltipIcon text="The number of unique stakers." />
                    </div>
                    <LineChart dataXaxis={formattedTime} dataYaxis={insights.stakerCount} xAxisLabel="Time" yAxisLabel="Count" lineColor="hsl(var(--color-chart-accent))" gardientColor="hsl(var(--color-chart-accent) / 0.3)" />
                </div>
                <div className="md:col-span-2">
                    <div className="flex items-center mb-2">
                        <h3 className="text-xl font-medium text-white">ICP in LP Treasury</h3>
                        <TooltipIcon text="The amount of ICP held in the liquidity pool treasury." />
                    </div>
                    <LineChart dataXaxis={formattedTime} dataYaxis={insights.icpInLpTreasury} xAxisLabel="Time" yAxisLabel="ICP" lineColor="hsl(var(--color-chart-secondary))" gardientColor="hsl(var(--color-chart-secondary) / 0.3)" />
                </div>
            </div>
            </Suspense>
        </div>
    );
};

export default Insights;