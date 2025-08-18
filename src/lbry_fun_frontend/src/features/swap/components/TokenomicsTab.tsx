import React, { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import getTokenomicsGraphs, { ProcessedGraphData } from '@/features/token/thunk/getTokenomicsGraphs.thunk';
import LineChart from './Chart';
import TooltipIcon from '@/features/token/components/TooltipIcon';
import { TokenConversionService } from '@/utils/TokenConversionService';

const TokenomicsTab: React.FC = () => {
    const dispatch = useAppDispatch();
    const { swap } = useAppSelector(state => state);
    const poolData = swap.activeSwapPool;
    const [graphData, setGraphData] = useState<ProcessedGraphData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);

    useEffect(() => {
        if (poolData && poolData[0]) {
            setLoading(true);
            setError(null);
            
            dispatch(getTokenomicsGraphs(poolData[0].toString()))
                .unwrap()
                .then(data => {
                    setGraphData(data);
                    setLoading(false);
                })
                .catch(error => {
                    console.error("Failed to fetch tokenomics graphs:", error);
                    setError(error.message || "Failed to fetch tokenomics data");
                    setLoading(false);
                });
        }
    }, [poolData, dispatch]);

    // Render states
    if (!poolData) {
        return (
            <div className="bg-black border border-white/30 font-mono text-sm p-3">
                <div className="font-mono font-bold text-white mb-1 text-sm uppercase">
                    <span className="text-pink-500">&gt;&gt;</span> tokenomics
                </div>
                <div className="flex justify-between items-center py-0.5">
                    <span className="text-gray-400 text-xs">status:</span>
                    <span className="text-gray-600 text-xs">no_active_pool_selected</span>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-black border border-white/30 font-mono text-sm p-3">
                <div className="font-mono font-bold text-white mb-1 text-sm uppercase">
                    <span className="text-pink-500">&gt;&gt;</span> tokenomics
                </div>
                <div className="flex justify-between items-center py-0.5">
                    <span className="text-gray-400 text-xs">status:</span>
                    <span className="text-lime-500 font-bold text-sm">loading...</span>
                    <LoaderCircle className="w-4 h-4 animate-spin inline-block ml-2" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-black border border-white/30 font-mono text-sm p-3">
                <div className="font-mono font-bold text-white mb-1 text-sm uppercase">
                    <span className="text-pink-500">&gt;&gt;</span> tokenomics
                </div>
                <div className="flex justify-between items-center py-0.5">
                    <span className="text-gray-400 text-xs">error:</span>
                    <span className="text-red-400">{error}</span>
                </div>
            </div>
        );
    }

    if (!graphData) {
        return (
            <div className="bg-black border border-white/30 font-mono text-sm p-3">
                <div className="font-mono font-bold text-white mb-1 text-sm uppercase">
                    <span className="text-pink-500">&gt;&gt;</span> tokenomics
                </div>
                <div className="flex justify-between items-center py-0.5">
                    <span className="text-gray-400 text-xs">status:</span>
                    <span className="text-gray-600 text-xs">no_data_available</span>
                </div>
            </div>
        );
    }

    // Prepare data for charts - converting from backend format to chart format
    const cumulativeSupplyData = {
        xAxis: graphData.cumulative_supply_data_x.map(x => x / 100_000_000), // Convert from E8S
        yAxis: graphData.cumulative_supply_data_y.map(y => y / 100_000_000)
    };

    const mintedPerEpochData = {
        xAxis: graphData.minted_per_epoch_data_x,
        yAxis: graphData.minted_per_epoch_data_y.map(y => y / 100_000_000)
    };

    const costToMintData = {
        xAxis: graphData.cost_to_mint_data_x.map(x => x / 100_000_000),
        yAxis: graphData.cost_to_mint_data_y
    };

    const cumulativeUsdCostData = {
        xAxis: graphData.cumulative_usd_cost_data_x.map(x => x / 100_000_000),
        yAxis: graphData.cumulative_usd_cost_data_y
    };

    const copyToClipboard = () => {
        const chartData = {
            poolId: poolData?.[0]?.toString(),
            graphs: {
                cumulativeSupply: cumulativeSupplyData,
                mintedPerEpoch: mintedPerEpochData,
                costToMint: costToMintData,
                cumulativeUsdCost: cumulativeUsdCostData
            }
        };
        
        navigator.clipboard.writeText(JSON.stringify(chartData, null, 2));
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    const tokenConfig = poolData?.[1];

    // Helper functions for better formatting
    const formatSupplyNumber = (value: string | number) => {
        const num = Number(TokenConversionService.formatE8sDisplay(value, 0));
        if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toFixed(0);
    };

    const formatTimeInterval = (seconds: string | number) => {
        const totalSeconds = Number(seconds);
        const hours = totalSeconds / 3600;
        const days = hours / 24;
        
        if (days >= 1) {
            return days === 1 ? '1 day' : `${days.toFixed(0)} days`;
        } else if (hours >= 1) {
            return hours === 1 ? '1 hour' : `${hours.toFixed(0)} hours`;
        } else {
            const minutes = totalSeconds / 60;
            if (minutes >= 1) {
                return minutes === 1 ? '1 minute' : `${minutes.toFixed(0)} minutes`;
            }
            return totalSeconds === 1 ? '1 second' : `${totalSeconds} seconds`;
        }
    };

    const formatRewardPerBurn = (value: string | number) => {
        const num = Number(TokenConversionService.formatE8sDisplay(value, 4));
        if (num === 0) return '1.0'; // Default to 1.0 if it appears as 0
        return num.toFixed(2);
    };

    return (
        <div className="w-full">
            {/* Tokenomics Configuration Section */}
            {tokenConfig && (
                <div className="terminal-pure mb-8">
                    <div className="terminal-header mb-4">
                        <span className="terminal-prompt">&gt;</span> TOKENOMICS_CONFIGURATION
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-8 font-mono text-sm">
                        {/* Supply Parameters */}
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400 flex items-center gap-1">
                                max_supply:
                                <TooltipIcon text="Maximum number of primary tokens that can ever be minted. Hard cap for the entire token supply." />
                            </span>
                            <span className="text-white">{formatSupplyNumber(tokenConfig.primary_token_max_supply)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400 flex items-center gap-1">
                                initial_mint:
                                <TooltipIcon text="Number of primary tokens minted in the first epoch when burning starts. Sets the baseline for future epochs." />
                            </span>
                            <span className="text-white">{formatSupplyNumber(tokenConfig.initial_primary_mint || '100000000')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400 flex items-center gap-1">
                                burn_unit:
                                <TooltipIcon text="Amount of secondary tokens required for one burn operation in the first epoch. Increases each epoch." />
                            </span>
                            <span className="text-white">{formatSupplyNumber(tokenConfig.initial_secondary_burn)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400 flex items-center gap-1">
                                initial_reward:
                                <TooltipIcon text="Number of primary tokens minted per burn unit in the first epoch. Decreases with halvings." />
                            </span>
                            <span className="text-lime-500">{formatRewardPerBurn(tokenConfig.initial_reward_per_burn_unit)}</span>
                        </div>
                        
                        {/* Mechanics Parameters */}
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400 flex items-center gap-1">
                                halving_step:
                                <TooltipIcon text="Percentage of previous epoch's reward retained after halving. 95% means each new epoch mints 95% of the previous epoch's amount." />
                            </span>
                            <span className="text-white">{tokenConfig.halving_step}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400 flex items-center gap-1">
                                threshold_mult:
                                <TooltipIcon text="How much more burning is required to reach the next epoch. 1.5x means each epoch requires 50% more burns than the previous." />
                            </span>
                            <span className="text-white">{tokenConfig.threshold_multiplier}x</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400 flex items-center gap-1">
                                distribution:
                                <TooltipIcon text="How often 1% of the reward pool is distributed to stakers. Shorter = more frequent payouts." />
                            </span>
                            <span className="text-white">{formatTimeInterval(tokenConfig.distribution_interval_seconds)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400 flex items-center gap-1">
                                launch_delay:
                                <TooltipIcon text="Time after creation before minting/burning becomes active. Allows time for initial liquidity setup." />
                            </span>
                            <span className="text-white">{formatTimeInterval(tokenConfig.launch_delay_seconds)}</span>
                        </div>
                        
                        {/* Metadata */}
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">created:</span>
                            <span className="text-gray-500">
                                {new Date(Number(tokenConfig.created_time) / 1_000_000).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric' 
                                })}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">launched:</span>
                            <span className="text-gray-500">
                                {new Date(Number(tokenConfig.launched_at) / 1_000_000).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric' 
                                })}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Existing Graphs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Cumulative Supply Chart */}
                <div className="bg-background-secondary p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4">Cumulative Supply</h3>
                    <LineChart
                        dataXaxis={cumulativeSupplyData.xAxis}
                        dataYaxis={cumulativeSupplyData.yAxis}
                        xAxisLabel="Secondary Burned"
                        yAxisLabel="Primary Minted"
                        lineColor="hsl(var(--color-chart-primary))"
                        gardientColor="hsl(var(--color-chart-primary) / 0.3)"
                    />
                </div>

                {/* Minted Per Epoch Chart */}
                <div className="bg-background-secondary p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4">Minted Per Epoch</h3>
                    <LineChart
                        dataXaxis={mintedPerEpochData.xAxis}
                        dataYaxis={mintedPerEpochData.yAxis}
                        xAxisLabel="Epoch"
                        yAxisLabel="Tokens Minted"
                        lineColor="hsl(var(--color-chart-secondary))"
                        gardientColor="hsl(var(--color-chart-secondary) / 0.3)"
                    />
                </div>

                {/* Cost to Mint Chart */}
                <div className="bg-background-secondary p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4">Cost to Mint</h3>
                    <LineChart
                        dataXaxis={costToMintData.xAxis}
                        dataYaxis={costToMintData.yAxis}
                        xAxisLabel="Primary Supply"
                        yAxisLabel="Cost (USD)"
                        lineColor="hsl(var(--color-chart-success))"
                        gardientColor="hsl(var(--color-chart-success) / 0.3)"
                    />
                </div>

                {/* Cumulative USD Cost Chart */}
                <div className="bg-background-secondary p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4">Cumulative USD Cost</h3>
                    <LineChart
                        dataXaxis={cumulativeUsdCostData.xAxis}
                        dataYaxis={cumulativeUsdCostData.yAxis}
                        xAxisLabel="Primary Supply"
                        yAxisLabel="Total Cost (USD)"
                        lineColor="hsl(var(--color-chart-warning))"
                        gardientColor="hsl(var(--color-chart-warning) / 0.3)"
                    />
                </div>
            </div>
            
            {/* Copy Graph Data Button */}
            <div className=" bg-black border border-white/30 p-3 font-mono mt-8">
                <div className="flex justify-between items-center py-0.5 justify-end">
                    <button 
                        type="button"
                        onClick={copyToClipboard}
                        className="bg-black border border-white/30 text-white font-mono text-sm px-4 py-2 hover:bg-white/10 text-xs hover:bg-white/10 px-3 py-1 border border-white/30"
                    >
                        <span className="text-pink-500">&gt;</span> {copySuccess ? 'copied_to_clipboard' : 'copy_graph_data'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TokenomicsTab;