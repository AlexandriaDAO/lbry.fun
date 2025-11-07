import React, { useEffect, useMemo, lazy, Suspense, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import TooltipIcon from '@/features/token/components/TooltipIcon';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { analyticsThunks } from '../thunks/analyticsThunks';
import UnifiedSkeleton from './UnifiedSkeleton';
import { RootState } from '@/store';
import getPoolsTvl from '@/features/token/thunk/getPoolsTvl.thunk';

// Lazy load the Chart component
const LineChart = lazy(() => import('./Chart'));

// Lazy load the distribution tracker
const DistributionTracker = lazy(() => import('./distribution/DistributionTracker'));

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
    const tvlData = useAppSelector((state: RootState) => state.lbryFun.tvlData);
    const tvlLoading = useAppSelector((state: RootState) => state.lbryFun.tvlLoading);
    const [copySuccess, setCopySuccess] = useState(false);

    useEffect(() => {
        if (poolData?.[1]?.logs_canister_id) {
            dispatch(getAllLogs(poolData[1].logs_canister_id));
        }
        // Also fetch TVL data if we have a pool
        if (poolData && !tvlData[poolData[0]] && !tvlLoading) {
            dispatch(getPoolsTvl([poolData]));
        }
    }, [dispatch, poolData, tvlData, tvlLoading]);

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
            apy: insights.apy ? insights.apy[lastIndex] : null,
            hourlyIcpRewards: insights.hourlyIcpRewards[lastIndex],
        };
    }, [insights]);

    const copyToClipboard = () => {
        if (!insights) return;

        const formattedTime = formatTime(insights.time);
        const insightsData = {
            poolId: poolData?.[0]?.toString(),
            timestamp: new Date().toISOString(),
            graphs: {
                time: formattedTime,
                primaryTokenSupply: {
                    xAxis: formattedTime,
                    yAxis: insights.primaryTokenSupply
                },
                secondaryTokenSupply: {
                    xAxis: formattedTime,
                    yAxis: insights.secondaryTokenSupply
                },
                totalSecondaryBurned: {
                    xAxis: formattedTime,
                    yAxis: insights.totalSecondaryBurned
                },
                totalPrimaryStaked: {
                    xAxis: formattedTime,
                    yAxis: insights.totalPrimaryStaked
                },
                stakerCount: {
                    xAxis: formattedTime,
                    yAxis: insights.stakerCount
                },
                ...(insights.apy && {
                    historicalApy: {
                        xAxis: formattedTime,
                        yAxis: insights.apy
                    }
                })
            },
            summary: summaryData
        };

        navigator.clipboard.writeText(JSON.stringify(insightsData, null, 2));
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

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
            <div className="container mx-auto px-4 py-8">
                <div className="text-center text-muted-foreground">
                    <p>No insights data available yet. Data will appear once the pool has some activity.</p>
                </div>
            </div>
        );
    }

    const formattedTime = formatTime(insights.time);

    return (
        <div className="container mx-auto px-4 py-8">
            {summaryData && (
                <div className="terminal-pure mb-8">
                    <div className="terminal-header mb-4">
                        <span className="terminal-prompt">&gt;</span> LATEST_METRICS
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-8 font-mono text-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">primary_supply:</span>
                            <span className="text-lime-500">{formatNumber(summaryData.primaryTokenSupply)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">secondary_supply:</span>
                            <span className="text-white">{formatNumber(summaryData.secondaryTokenSupply)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">secondary_burned:</span>
                            <span className="text-white">{formatNumber(summaryData.totalSecondaryBurned)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">primary_staked:</span>
                            <span className="text-white">{formatNumber(summaryData.totalPrimaryStaked)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">stakers:</span>
                            <span className="text-white">{summaryData.stakerCount}</span>
                        </div>
                        {poolData && tvlData[poolData[0]] && (
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400 flex items-center gap-1">
                                    pool_tvl:
                                    <TooltipIcon text="Total Value Locked in the Kongswap liquidity pool for this token pair" />
                                </span>
                                <span className="text-lime-500 font-bold">
                                    ${formatNumber(Number(tvlData[poolData[0]].tvl) / 100_000_000)}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">reward_per_token:</span>
                            <span className="text-lime-500 font-bold">{summaryData.hourlyIcpRewards.toFixed(6)} ICP</span>
                        </div>
                        {summaryData.apy && (
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400 flex items-center gap-1">
                                    snapshot_apy:
                                    <TooltipIcon text="APY at the time of last hourly snapshot. For real-time APY, check the Stake tab. Formula: APY = (Hourly Snapshot ICP Rewards per Token × Distributions/Year × ICP Price) ÷ Primary Token Price × 100%" />
                                </span>
                                <span className="text-lime-500 font-bold">{summaryData.apy.toExponential(2)}%</span>
                            </div>
                        )}
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
                {insights.apy && (
                    <div>
                        <div className="flex items-center mb-2">
                            <h3 className="text-xl font-medium text-white">Historical APY (Hourly Snapshots)</h3>
                            <TooltipIcon text="Historical APY captured once per hour by the logs canister. May differ from real-time APY shown in Stake tab due to timing of snapshots. Formula: APY = (Hourly Snapshot ICP Rewards per Token × Distributions/Year × ICP Price) ÷ Primary Token Price × 100%" />
                        </div>
                        <LineChart 
                            dataXaxis={formattedTime} 
                            dataYaxis={insights.apy.map(val => val || 0)} 
                            xAxisLabel="Time (Hourly Snapshots)" 
                            yAxisLabel="APY % at Snapshot" 
                            lineColor="hsl(var(--color-chart-success))" 
                            gardientColor="hsl(var(--color-chart-success) / 0.3)" 
                        />
                    </div>
                )}
            </div>
            </Suspense>

            {/* Copy Graph Data Button */}
            <div className="bg-black border border-white/30 p-3 font-mono mt-8">
                <div className="flex justify-between items-center py-0.5 justify-end">
                    <button
                        type="button"
                        onClick={copyToClipboard}
                        className="bg-black border border-white/30 text-white font-mono text-sm px-4 py-2 hover:bg-white/10 text-xs px-3 py-1"
                    >
                        <span className="text-pink-500">&gt;</span> {copySuccess ? 'copied_to_clipboard' : 'copy_graph_data'}
                    </button>
                </div>
            </div>

            {/* Add Distribution Tracking Section */}
            {poolData?.[1]?.icp_swap_canister_id && (
                <Suspense fallback={<UnifiedSkeleton variant="card" rows={10} />}>
                    <div className="mt-12">
                        <div className="bg-black border border-white/30 font-mono text-sm p-3 mb-6">
                            <div className="font-mono font-bold text-white mb-1 text-sm uppercase">
                                <span className="text-pink-500">&gt;&gt;</span> distribution_tracking
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-gray-400 text-xs">protocol:</span>
                                <span className="text-gray-600 text-xs">1%_alexandria | 99%_locked_lp</span>
                            </div>
                        </div>
                        <DistributionTracker icpSwapCanisterId={poolData[1].icp_swap_canister_id} />
                    </div>
                </Suspense>
            )}
        </div>
    );
};

export default Insights;