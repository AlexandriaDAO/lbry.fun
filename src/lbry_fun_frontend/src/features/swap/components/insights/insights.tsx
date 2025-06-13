import React, { useEffect, useMemo } from 'react';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { TailSpin } from 'react-loader-spinner';
import LineChart from './chart';
import getAllLogs from '../../thunks/insights/getAllLogs.thunk';
import TooltipIcon from '@/features/token/components/TooltipIcon';

const formatTime = (timestamps: number[]) => {
    return timestamps.map(ts => new Date(ts).toLocaleDateString());
};

const Insights: React.FC = () => {
    const dispatch = useAppDispatch();
    const { activeSwapPool } = useAppSelector((state) => state.swap);
    const { logsData, logsLoading, logsError } = useAppSelector((state) => state.swap);

    const logsCanisterId = useMemo(() => activeSwapPool?.[1].logs_canister_id, [activeSwapPool]);

    useEffect(() => {
        if (logsCanisterId) {
            dispatch(getAllLogs(logsCanisterId));
        }
    }, [dispatch, logsCanisterId]);

    const summaryData = useMemo(() => {
        if (!logsData || logsData.time.length === 0) {
            return null;
        }
        const lastIndex = logsData.time.length - 1;
        return {
            primaryTokenSupply: logsData.primaryTokenSupply[lastIndex],
            secondaryTokenSupply: logsData.secondaryTokenSupply[lastIndex],
            totalSecondaryBurned: logsData.totalSecondaryBurned[lastIndex],
            totalPrimaryStaked: logsData.totalPrimaryStaked[lastIndex],
            stakerCount: logsData.stakerCount[lastIndex],
            apy: logsData.apy[lastIndex],
            icpInLpTreasury: logsData.icpInLpTreasury[lastIndex],
        };
    }, [logsData]);
    
    if (logsLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <TailSpin color="hsl(var(--interactive-primary))" height={50} width={50} />
            </div>
        );
    }

    if (logsError) {
        return <div className="text-center p-4 text-red-500">Error loading logs data: {logsError}</div>;
    }

    if (!logsData || logsData.time.length === 0) {
        return <div className="text-center p-4 text-gray-500">No data available for the selected swap pool.</div>;
    }

    const graphTitleBaseClass = "text-xl font-medium w-full";
    const isDarkMode = false; // Assuming a light mode default, or you can implement a theme switcher.
    const formattedTime = formatTime(logsData.time);

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Swap Pool Insights</h2>
                <p className="text-md text-gray-500 dark:text-gray-400">Live data from the on-chain logs canister.</p>
            </div>

            {summaryData && (
                 <div className="mb-8 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                    <h3 className="text-xl font-semibold mb-4 text-center text-gray-900 dark:text-white">Latest Metrics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-center">
                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Primary Supply</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{summaryData.primaryTokenSupply.toLocaleString()}</p>
                        </div>
                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Secondary Supply</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{summaryData.secondaryTokenSupply.toLocaleString()}</p>
                        </div>
                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Secondary Burned</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{summaryData.totalSecondaryBurned.toLocaleString()}</p>
                        </div>
                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Primary Staked</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{summaryData.totalPrimaryStaked.toLocaleString()}</p>
                        </div>
                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Stakers</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{summaryData.stakerCount}</p>
                        </div>
                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                            <p className="text-sm text-gray-500 dark:text-gray-400">ICP in LP</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{summaryData.icpInLpTreasury.toLocaleString()}</p>
                        </div>
                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                            <p className="text-sm text-gray-500 dark:text-gray-400">APY</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{summaryData.apy.toFixed(2)}%</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <div className="flex items-center mb-2">
                        <h3 className={`${graphTitleBaseClass} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Primary Token Supply</h3>
                        <TooltipIcon text="Tracks the total supply of the primary token over time." />
                    </div>
                    <LineChart dataXaxis={formattedTime} dataYaxis={logsData.primaryTokenSupply} xAxisLabel="Time" yAxisLabel="Supply" lineColor="hsl(var(--color-chart-primary))" gardientColor="hsl(var(--color-chart-primary) / 0.3)" />
                </div>
                <div>
                    <div className="flex items-center mb-2">
                        <h3 className={`${graphTitleBaseClass} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Secondary Token Supply</h3>
                        <TooltipIcon text="Tracks the total supply of the secondary token over time." />
                    </div>
                    <LineChart dataXaxis={formattedTime} dataYaxis={logsData.secondaryTokenSupply} xAxisLabel="Time" yAxisLabel="Supply" lineColor="hsl(var(--color-chart-secondary))" gardientColor="hsl(var(--color-chart-secondary) / 0.3)" />
                </div>
                <div>
                    <div className="flex items-center mb-2">
                        <h3 className={`${graphTitleBaseClass} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Total Secondary Burned</h3>
                        <TooltipIcon text="The cumulative amount of secondary tokens burned." />
                    </div>
                    <LineChart dataXaxis={formattedTime} dataYaxis={logsData.totalSecondaryBurned} xAxisLabel="Time" yAxisLabel="Burned" lineColor="hsl(var(--color-chart-warning))" gardientColor="hsl(var(--color-chart-warning) / 0.3)" />
                </div>
                <div>
                    <div className="flex items-center mb-2">
                        <h3 className={`${graphTitleBaseClass} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Total Primary Staked</h3>
                        <TooltipIcon text="The total amount of primary tokens currently staked in the pool." />
                    </div>
                    <LineChart dataXaxis={formattedTime} dataYaxis={logsData.totalPrimaryStaked} xAxisLabel="Time" yAxisLabel="Staked" lineColor="hsl(var(--color-chart-error))" gardientColor="hsl(var(--color-chart-error) / 0.3)" />
                </div>
                <div>
                    <div className="flex items-center mb-2">
                        <h3 className={`${graphTitleBaseClass} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Staker Count</h3>
                        <TooltipIcon text="The number of unique stakers." />
                    </div>
                    <LineChart dataXaxis={formattedTime} dataYaxis={logsData.stakerCount} xAxisLabel="Time" yAxisLabel="Count" lineColor="hsl(var(--color-chart-accent))" gardientColor="hsl(var(--color-chart-accent) / 0.3)" />
                </div>
                <div>
                    <div className="flex items-center mb-2">
                        <h3 className={`${graphTitleBaseClass} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>APY</h3>
                        <TooltipIcon text="The Annual Percentage Yield for staking." />
                    </div>
                    <LineChart dataXaxis={formattedTime} dataYaxis={logsData.apy} xAxisLabel="Time" yAxisLabel="APY (%)" lineColor="hsl(var(--color-chart-success))" gardientColor="hsl(var(--color-chart-success) / 0.3)" />
                </div>
                <div className="md:col-span-2">
                    <div className="flex items-center mb-2">
                        <h3 className={`${graphTitleBaseClass} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>ICP in LP Treasury</h3>
                        <TooltipIcon text="The amount of ICP held in the liquidity pool treasury." />
                    </div>
                    <LineChart dataXaxis={formattedTime} dataYaxis={logsData.icpInLpTreasury} xAxisLabel="Time" yAxisLabel="ICP" lineColor="hsl(var(--color-chart-secondary))" gardientColor="hsl(var(--color-chart-secondary) / 0.3)" />
                </div>
            </div>
        </div>
    );
};

export default Insights;
