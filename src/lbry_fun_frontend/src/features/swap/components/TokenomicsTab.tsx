import React, { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import getTokenomicsGraphs, { ProcessedGraphData } from '@/features/token/thunk/getTokenomicsGraphs.thunk';
import LineChart from './Chart';

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
            <div className="terminal-pure">
                <div className="terminal-header">
                    <span className="terminal-prompt">&gt;&gt;</span> tokenomics
                </div>
                <div className="terminal-row">
                    <span className="terminal-label">status:</span>
                    <span className="terminal-accent">no_active_pool_selected</span>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="terminal-pure">
                <div className="terminal-header">
                    <span className="terminal-prompt">&gt;&gt;</span> tokenomics
                </div>
                <div className="terminal-row">
                    <span className="terminal-label">status:</span>
                    <span className="terminal-primary">loading...</span>
                    <LoaderCircle className="w-4 h-4 animate-spin inline-block ml-2" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="terminal-pure">
                <div className="terminal-header">
                    <span className="terminal-prompt">&gt;&gt;</span> tokenomics
                </div>
                <div className="terminal-row">
                    <span className="terminal-label">error:</span>
                    <span className="terminal-error">{error}</span>
                </div>
            </div>
        );
    }

    if (!graphData) {
        return (
            <div className="terminal-pure">
                <div className="terminal-header">
                    <span className="terminal-prompt">&gt;&gt;</span> tokenomics
                </div>
                <div className="terminal-row">
                    <span className="terminal-label">status:</span>
                    <span className="terminal-accent">no_data_available</span>
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

    return (
        <div className="w-full">
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
            <div className="terminal-section bg-black border border-white/30 p-3 font-mono mt-8">
                <div className="terminal-row justify-end">
                    <button 
                        type="button"
                        onClick={copyToClipboard}
                        className="terminal-button text-xs hover:bg-white/10 px-3 py-1 border border-white/30"
                    >
                        <span className="terminal-prompt">&gt;</span> {copySuccess ? 'copied_to_clipboard' : 'copy_graph_data'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TokenomicsTab;