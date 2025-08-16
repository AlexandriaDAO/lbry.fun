import React, { useMemo, useState, useEffect } from 'react';
import LineChart from '../../swap/components/Chart';
import TooltipIcon from './TooltipIcon';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import previewTokenomicsSchedule, { TokenomicsSchedule } from '../thunk/previewTokenomicsSchedule.thunk';
import { TailSpin } from 'react-loader-spinner';
import { TokenomicsCurrentState } from '@/features/swap/thunks/tokenomicsThunks';

interface UnifiedTokenomicsGraphsV2Props {
  // Direct parameters from form or tokenomics config
  primaryMaxSupply: string;           // Natural number (e.g., "1000000")
  tgeAllocation: string;              // Natural number (e.g., "100")
  initialSecondaryBurn: string;       // Natural number (e.g., "1000000")
  halvingStep: string;                // Percentage (e.g., "70" for 70%)
  initialRewardPerBurnUnit: string;   // Natural number (e.g., "2000")
  thresholdMultiplier?: string;       // Multiplier (e.g., "2" for 2x)
  
  // Optional: For deployed tokens, we might have the actual schedule
  deployedSchedule?: {
    primary_mint_per_threshold: string[];
    secondary_burn_per_threshold: string[];
  } | null;
  
  // Optional: Current state for deployed tokens
  currentState?: TokenomicsCurrentState | null;
  
  // Optional: Pre-calculated schedule data (to avoid duplicate preview calls)
  preCalculatedSchedule?: TokenomicsSchedule | null;
  
  // Display mode options
  compactMode?: boolean;              // Show only essential elements
  showGraphs?: boolean;                // Whether to show graphs section
  showMetricsOnly?: boolean;           // Show only metrics, no graphs
}

const E8S = 100_000_000;

const UnifiedTokenomicsGraphsV2: React.FC<UnifiedTokenomicsGraphsV2Props> = ({
  primaryMaxSupply,
  tgeAllocation,
  initialSecondaryBurn,
  halvingStep,
  initialRewardPerBurnUnit,
  thresholdMultiplier,
  deployedSchedule,
  currentState,
  preCalculatedSchedule,
  compactMode = false,
  showGraphs = true,
  showMetricsOnly = false,
}) => {
  const dispatch = useAppDispatch();
  const [scheduleData, setScheduleData] = useState<TokenomicsSchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showAdvancedWarnings, setShowAdvancedWarnings] = useState(false);
  const [showAllGraphs, setShowAllGraphs] = useState(!compactMode);

  // Validate parameters and generate warnings
  useEffect(() => {
    const newWarnings: string[] = [];
    if (initialSecondaryBurn && primaryMaxSupply && tgeAllocation && halvingStep) {
      try {
        // Removed initial valuation warning - let users decide their own risk tolerance
        
        const tge = parseFloat(tgeAllocation);
        const maxSupply = parseFloat(primaryMaxSupply);
        if (maxSupply > 0 && tge >= maxSupply) {
            newWarnings.push(`TGE Allocation must be less than the Primary Max Supply to allow for minting via burning.`);
        }

        const halving = parseInt(halvingStep, 10);
        if (halving <= 0 || halving > 100) {
            newWarnings.push(`The Halving Step must be between 1% and 100% to ensure a decaying reward structure.`);
        }
      } catch (error) {
        console.error("Error validating tokenomics parameters:", error);
      }
    }
    
    setWarnings(newWarnings);
  }, [primaryMaxSupply, tgeAllocation, initialSecondaryBurn, halvingStep, initialRewardPerBurnUnit]);

  // Fetch schedule data when parameters change
  useEffect(() => {
    // If we have pre-calculated schedule, use it directly
    if (preCalculatedSchedule) {
      setScheduleData(preCalculatedSchedule);
      setLoading(false);
      return;
    }
    
    // Convert parameters according to thunk interface expectations
    const E8S_MULTIPLIER = BigInt(100_000_000);
    const MAX_U64 = BigInt("18446744073709551615"); // 2^64 - 1
    
    // Parse values safely
    const primary_per_threshold = parseFloat(initialRewardPerBurnUnit || '0');
    const max_primary_supply = BigInt(primaryMaxSupply && primaryMaxSupply !== '' ? primaryMaxSupply : '0') * E8S_MULTIPLIER;
    const initial_secondary_burn = parseFloat(initialSecondaryBurn || '0');
    const halving_step = parseInt(halvingStep || '0');
    const tge_allocation = BigInt(tgeAllocation && tgeAllocation !== '' ? tgeAllocation : '0') * E8S_MULTIPLIER;
    const threshold_multiplier = parseFloat(thresholdMultiplier || '2');

    // Check for u64 overflow
    if (max_primary_supply > MAX_U64) {
        setError(`Primary max supply is too large. Maximum allowed is ${(MAX_U64 / E8S_MULTIPLIER).toString()} tokens.`);
        setLoading(false);
        return;
    }
    
    if (tge_allocation > MAX_U64) {
        setError(`TGE allocation is too large. Maximum allowed is ${(MAX_U64 / E8S_MULTIPLIER).toString()} tokens.`);
        setLoading(false);
        return;
    }

    if (primary_per_threshold > 0 && max_primary_supply > 0n && initial_secondary_burn > 0 && halving_step > 0) {
        setLoading(true);
        setError(null);
        
        dispatch(previewTokenomicsSchedule({
            primary_per_threshold,
            max_primary_supply,
            initial_secondary_burn,
            halving_step,
            tge_allocation,
            threshold_multiplier,
        }))
        .unwrap()
        .then((result) => {
            setScheduleData(result);
            setLoading(false);
        })
        .catch((error) => {
            console.error("Failed to fetch tokenomics schedule:", error);
            setError(error.message || "Failed to fetch tokenomics preview");
            setLoading(false);
        });
    }
  }, [primaryMaxSupply, tgeAllocation, initialSecondaryBurn, halvingStep, initialRewardPerBurnUnit, thresholdMultiplier, dispatch, preCalculatedSchedule]);

  // Convert schedule data to graph format
  const graphData = useMemo(() => {
    if (!scheduleData || !scheduleData.epochs || scheduleData.epochs.length === 0) {
      return {
        cumulativeSupplyData: { xAxis: [], yAxis: [] },
        mintedPerEpochData: { xAxis: [], yAxis: [] },
        costToMintData: { xAxis: [], yAxis: [] },
        cumulativeUsdCostData: { xAxis: [], yAxis: [] },
        cumulativePercentageSupplyData: { xAxis: [], yAxis: [] },
        summaryData: {},
      };
    }

    const epochs = scheduleData.epochs;
    const maxSupply = parseFloat(primaryMaxSupply) || 0;
    
    // Detect when floor rate is reached by looking for when minting amounts stop decreasing
    let floorRateEpoch = -1;
    let minMintRate = Infinity;
    
    for (let i = 1; i < epochs.length; i++) {
      const currentMinted = Number(epochs[i].primary_minted_this_epoch_e8s) / E8S;
      const prevMinted = Number(epochs[i-1].primary_minted_this_epoch_e8s) / E8S;
      const currentBurned = Number(epochs[i].secondary_burned_this_epoch_e8s) / E8S;
      const prevBurned = Number(epochs[i-1].secondary_burned_this_epoch_e8s) / E8S;
      
      // Calculate effective mint rate (primary minted per secondary burned)
      const currentRate = currentBurned > 0 ? currentMinted / currentBurned : 0;
      const prevRate = prevBurned > 0 ? prevMinted / prevBurned : 0;
      
      // Check if we've hit a floor (rate stops decreasing)
      if (currentRate > 0 && currentRate === prevRate && floorRateEpoch === -1) {
        floorRateEpoch = i;
        minMintRate = currentRate;
      }
    }

    // Cumulative Supply Chart Data
    const cumulativeSupplyData = {
      xAxis: epochs.map(e => Number(e.cumulative_secondary_burned_e8s) / E8S),
      yAxis: epochs.map(e => Number(e.cumulative_primary_minted_e8s) / E8S),
    };

    // Primary Tokens Minted per Epoch
    const mintedPerEpochData = {
      xAxis: epochs.map(e => `Epoch ${e.epoch_number}`),
      yAxis: epochs.map(e => Number(e.primary_minted_this_epoch_e8s) / E8S),
    };

    // Cost to Mint vs Supply
    // Handle the final epoch specially if supply cap is reached
    const isSupplyCapped = scheduleData.total_supply_percentage >= 99.9;
    const lastEpochIndex = epochs.length - 1;
    
    const costToMintData = {
      xAxis: epochs.filter(e => e.cost_per_primary_token_usd > 0)
                   .map(e => Number(e.cumulative_primary_minted_e8s) / E8S),
      yAxis: epochs.filter(e => e.cost_per_primary_token_usd > 0)
                   .map((e, index, filteredArray) => {
                     // If this is the last epoch and supply is capped, use the previous epoch's cost
                     // to avoid the misleading cliff caused by partial minting
                     if (isSupplyCapped && index === filteredArray.length - 1 && index > 0) {
                       return filteredArray[index - 1].cost_per_primary_token_usd;
                     }
                     return e.cost_per_primary_token_usd;
                   }),
    };

    // Cumulative USD Cost (Minting Valuation)
    let cumulativeUsdCost = 0;
    const cumulativeUsdCostData = {
      xAxis: [] as number[],
      yAxis: [] as number[],
    };
    
    epochs.forEach(epoch => {
      const primaryMinted = Number(epoch.primary_minted_this_epoch_e8s) / E8S;
      const usdCost = primaryMinted * epoch.cost_per_primary_token_usd;
      cumulativeUsdCost += usdCost;
      
      cumulativeUsdCostData.xAxis.push(Number(epoch.cumulative_primary_minted_e8s) / E8S);
      cumulativeUsdCostData.yAxis.push(cumulativeUsdCost);
    });

    // Percentage Supply Data
    const cumulativePercentageSupplyData = {
      xAxis: cumulativeUsdCostData.xAxis,
      yAxis: cumulativeUsdCostData.xAxis.map((minted) => {
        if (maxSupply > 0) {
          const percentage = (minted / maxSupply) * 100;
          // Use dynamic precision for very small percentages
          if (percentage < 0.01) {
            return parseFloat(percentage.toFixed(6));
          } else if (percentage < 1) {
            return parseFloat(percentage.toFixed(4));
          } else {
            return parseFloat(percentage.toFixed(2));
          }
        }
        return 0;
      }),
    };

    const summaryData = {
      epochs: scheduleData.total_epochs,
      totalMintingValuation: cumulativeUsdCost,
      initialMintCost: costToMintData.yAxis[0] || 0,
      finalMintCost: costToMintData.yAxis[costToMintData.yAxis.length - 1] || 0,
      tgePercentage: maxSupply > 0 ? parseFloat(((Number(epochs[0].primary_minted_this_epoch_e8s)/E8S / maxSupply) * 100).toFixed(2)) : 0,
      actualTotalMinted: cumulativeSupplyData.yAxis[cumulativeSupplyData.yAxis.length - 1] || 0,
      theoreticalOvermint: false,
      supplyCapped: scheduleData.total_supply_percentage >= 99.9,
      floorRateEpoch: floorRateEpoch,
      minMintRate: minMintRate,
    };

    return {
      cumulativeSupplyData,
      mintedPerEpochData,
      costToMintData,
      cumulativeUsdCostData,
      cumulativePercentageSupplyData,
      summaryData
    };
  }, [scheduleData, primaryMaxSupply]);
  
  // Removed "we are here" functionality for simplicity
  const currentPositions = null;

  const copyToClipboard = () => {
    const chartData = {
      parameters: {
        primaryMaxSupply,
        tgeAllocation,
        initialSecondaryBurn,
        halvingStep,
        initialRewardPerBurnUnit,
        thresholdMultiplier,
      },
      ...graphData
    };
    
    navigator.clipboard.writeText(JSON.stringify(chartData, null, 2));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <TailSpin height="50" width="50" color="white" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg">
        <h3 className="text-red-500 font-semibold mb-2">Preview Error</h3>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const hasData = graphData.cumulativeSupplyData.yAxis.length > 0;

  // Render metrics section (always shown)
  const renderMetrics = () => (
    <div className={`border border-white/30 ${compactMode ? 'p-2' : 'p-4'} font-mono ${!showMetricsOnly ? 'mb-6' : ''} overflow-hidden`}>
        <div className={`grid ${compactMode ? 'grid-cols-1 gap-y-1' : 'grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2'}`}>
          <div className="flex justify-between gap-x-2">
            <span className="text-gray-400 text-xs whitespace-nowrap">minting_epochs:</span>
            <span className="text-white text-xs sm:text-sm text-right">{graphData.summaryData?.epochs}</span>
          </div>
          <div className="flex justify-between gap-x-2">
            <span className="text-gray-400 text-xs whitespace-nowrap">initial_mint_cost:</span>
            <span className="text-lime-500 font-bold text-xs sm:text-sm text-right">${graphData.summaryData?.initialMintCost?.toFixed(4)}</span>
          </div>
          <div className="flex justify-between gap-x-2">
            <span className="text-gray-400 text-xs whitespace-nowrap">final_mint_cost:</span>
            <span className="text-lime-500 font-bold text-xs sm:text-sm text-right">${graphData.summaryData?.finalMintCost?.toFixed(4)}</span>
          </div>
          <div className="flex justify-between gap-x-2">
            <span className="text-gray-400 text-xs whitespace-nowrap">total_valuation:</span>
            <span className="text-lime-500 font-bold text-xs sm:text-sm text-right truncate">${graphData.summaryData?.totalMintingValuation?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex justify-between gap-x-2">
            <span className="text-gray-400 text-xs whitespace-nowrap">distribution_type:</span>
            <span className="text-white text-xs sm:text-sm text-right">
              {graphData.summaryData?.epochs <= 5 ? 'quick' : 
               graphData.summaryData?.epochs <= 12 ? 'balanced' : 
               'extended'}
            </span>
          </div>
          {graphData.summaryData?.floorRateEpoch && graphData.summaryData.floorRateEpoch > 0 && (
            <div className="flex justify-between gap-x-2">
              <span className="text-gray-400 text-xs whitespace-nowrap">floor_rate_at:</span>
              <span className="text-gray-600 text-xs text-right">epoch_{graphData.summaryData.floorRateEpoch}</span>
            </div>
          )}
        </div>
        
        {/* Advanced metrics section - collapsible */}
        {(graphData.summaryData?.supplyCapped || (graphData.summaryData?.floorRateEpoch && graphData.summaryData.floorRateEpoch > 0)) && (
          <div className="border border-white/10 p-3 font-mono mt-3">
            <button
              type="button"
              onClick={() => setShowAdvancedWarnings(!showAdvancedWarnings)}
              className="flex items-center justify-between w-full text-left text-xs text-gray-400 hover:text-white transition-colors"
            >
              <span>
                <span className="text-pink-500">&gt;</span> advanced_metrics
              </span>
              <span className="ml-2">{showAdvancedWarnings ? '[-]' : '[+]'}</span>
            </button>
            {showAdvancedWarnings && (
              <div className="mt-3 space-y-2">
                {graphData.summaryData?.supplyCapped && (
                  <div className="border border-cyan-400/30 p-3">
                    <div className="text-cyan-400 text-xs uppercase">[SUPPLY_CAP_REACHED]</div>
                    <div className="text-cyan-400 text-xs mt-1">
                      The maximum supply of <span className="text-white">{Number(primaryMaxSupply).toLocaleString()}</span> tokens will be reached. The final epoch may be partial to exactly hit this cap.
                    </div>
                  </div>
                )}
                {graphData.summaryData?.floorRateEpoch && graphData.summaryData.floorRateEpoch > 0 && (
                  <div className="border border-purple-500/30 p-3">
                    <div className="text-purple-400 text-xs uppercase">[MINT_RATE_FLOOR_REACHED]</div>
                    <div className="text-purple-400 text-xs mt-1">
                      The mint rate reaches its minimum floor at <span className="text-white">Epoch {graphData.summaryData.floorRateEpoch}</span>. After this point, tokens will continue minting at the floor rate of <span className="text-white">{graphData.summaryData.minMintRate.toFixed(6)}</span> primary per secondary. This causes the exponential growth visible in later epochs.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Copy button - integrated with metrics */}
        <div className="flex justify-end mt-3">
          <button 
            type="button"
            onClick={copyToClipboard}
            className="text-white font-mono text-xs px-3 py-1 border border-white/30 hover:bg-white/10 transition-colors"
          >
            <span className="text-pink-500">&gt;</span> {copySuccess ? 'copied_to_clipboard' : 'copy_graph_data'}
          </button>
        </div>
      </div>
  );

  // Render graphs section
  const renderGraphs = () => {
    if (!showGraphs || showMetricsOnly) return null;
    
    return (
      <div className="space-y-8 mt-10 md:grid md:grid-cols-2 md:gap-x-8 md:space-y-0">
        <div className="p-4 font-mono border border-white/10">
          <div className="text-white text-sm uppercase mb-2 mb-4">
            <span className="text-pink-500">&gt;</span> cumulative_primary_supply_vs_burn
            <TooltipIcon text="This graph shows the total amount of Primary Token that will be minted as more Secondary Tokens are burned. Look for how quickly the supply hard cap is reached. A steeper curve means faster minting in early stages. The line flattens when the supply Hard Cap is hit. Note: If you see a 'hockey stick' pattern with rapid growth in later epochs, this indicates the mint rate has reached its minimum floor while burn thresholds continue doubling." />
          </div>
          {hasData && graphData.cumulativeSupplyData ? (
            <LineChart
              dataXaxis={graphData.cumulativeSupplyData.xAxis}
              dataYaxis={graphData.cumulativeSupplyData.yAxis}
              xAxisLabel="Cumulative Secondary Tokens Burned"
              yAxisLabel="Cumulative Primary Tokens Minted (tokens)"
              lineColor="hsl(var(--color-chart-primary))"
              gardientColor="hsl(var(--color-chart-primary) / 0.3)"
              currentPositionX={currentPositions?.cumulativeSupply?.x}
              showCurrentPosition={!!currentPositions}
              currentPositionLabel={currentPositions ? "We are here" : undefined}
            />
          ) : (
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 text-xs">status:</span>
              <span className="text-gray-600 text-xs">awaiting_data</span>
            </div>
          )}
        </div>
        <div className="p-4 font-mono border border-white/10">
          <div className="text-white text-sm uppercase mb-2 mb-4">
              <span className="text-pink-500">&gt;</span> primary_tokens_minted_per_epoch
              <TooltipIcon text="This chart displays how many new Primary Tokens are created at each burn epoch. Typically, earlier epochs (left) will mint more tokens than later epochs (right), showing that early burners are rewarded more. A rapid decrease indicates a faster reduction in minting rewards per epoch." />
          </div>
          {hasData && graphData.mintedPerEpochData ? (
            <LineChart
              dataXaxis={graphData.mintedPerEpochData.xAxis}
              dataYaxis={graphData.mintedPerEpochData.yAxis}
              xAxisLabel="Burn Epoch"
              yAxisLabel="Primary Tokens Minted in Epoch (tokens)"
              lineColor="hsl(var(--color-chart-secondary))"
              gardientColor="hsl(var(--color-chart-secondary) / 0.3)"
              currentPositionX={currentPositions?.currentEpoch ? `Epoch ${currentPositions.currentEpoch}` : undefined}
              showCurrentPosition={!!currentPositions}
              currentPositionLabel={currentPositions ? "We are here" : undefined}
            />
          ) : (
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 text-xs">status:</span>
              <span className="text-gray-600 text-xs">awaiting_data</span>
            </div>
          )}
        </div>
        <div className="p-4 font-mono border border-white/10">
          <div className="text-white text-sm uppercase mb-2 mb-4">
              <span className="text-pink-500">&gt;</span> cost_to_mint_vs_supply
              <TooltipIcon text="This graph shows the 'price' to create one new Primary Token by burning Secondary Tokens. Notice how the cost jumps up at each stage (or 'epoch'). This increasing cost is what makes it more rewarding for early participants to mint tokens. When the supply cap is reached, the final epoch's cost is adjusted to avoid misleading drops caused by partial minting." />
          </div>
          {hasData && graphData.costToMintData ? (
            <LineChart
              dataXaxis={graphData.costToMintData.xAxis}
              dataYaxis={graphData.costToMintData.yAxis}
              xAxisLabel="Cumulative Primary Tokens Minted (tokens)"
              yAxisLabel="USD Cost per Primary Token ($)"
              lineColor="hsl(var(--color-chart-success))"
              gardientColor="hsl(var(--color-chart-success) / 0.3)"
              currentPositionX={currentPositions?.costToMint?.x}
              showCurrentPosition={!!currentPositions}
              currentPositionLabel={currentPositions ? "We are here" : undefined}
            />
          ) : (
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 text-xs">status:</span>
              <span className="text-gray-600 text-xs">awaiting_data</span>
            </div>
          )}
        </div>
        <div className="p-4 font-mono border border-white/10">
          <div className="text-white text-sm uppercase mb-2 mb-4">
              <span className="text-pink-500">&gt;</span> minting_valuation_vs_primary_percentage
              <TooltipIcon text="This combined graph shows the percentage of the max supply that's been minted (blue line) alongside the total USD cost to mint those tokens (green line). This illustrates how the cost grows exponentially as more of the supply is minted." />
          </div>
          {hasData && graphData.cumulativePercentageSupplyData ? (
            <LineChart
              dataXaxis={graphData.cumulativePercentageSupplyData.xAxis}
              dataYaxis={graphData.cumulativePercentageSupplyData.yAxis}
              xAxisLabel="Cumulative Primary Tokens Minted (tokens)"
              yAxisLabel="% of Max Supply Minted"
              dataYaxis2={graphData.cumulativeUsdCostData.yAxis}
              yAxisLabel2="Cumulative USD Cost ($)"
              lineColor="hsl(var(--color-chart-warning))"
              gardientColor="hsl(var(--color-chart-warning) / 0.3)"
              lineColor2="hsl(var(--color-chart-info))"
              currentPositionX={currentPositions?.cumulativeUsd?.x}
              showCurrentPosition={!!currentPositions}
              currentPositionLabel={currentPositions ? "We are here" : undefined}
            />
          ) : (
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 text-xs">status:</span>
              <span className="text-gray-600 text-xs">awaiting_data</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Status Messages */}
      {warnings.length > 0 && !compactMode && (
        <div className="space-y-3 mb-4">
          {warnings.map((warning, index) => (
            <div key={index} className="text-yellow-500 text-xs">
              <span className="text-pink-500">&gt;</span> [WARN] {warning}
            </div>
          ))}
        </div>
      )}
      
      {/* Render based on mode */}
      {renderMetrics()}
      {renderGraphs()}
    </>
  );
};

export default UnifiedTokenomicsGraphsV2;