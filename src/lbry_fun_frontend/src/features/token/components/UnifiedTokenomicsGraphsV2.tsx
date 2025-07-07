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
  
  // Optional: For deployed tokens, we might have the actual schedule
  deployedSchedule?: {
    primary_mint_per_threshold: string[];
    secondary_burn_per_threshold: string[];
  } | null;
  
  // Optional: Current state for deployed tokens
  currentState?: TokenomicsCurrentState | null;
  
  // Optional: Pre-calculated schedule data (to avoid duplicate preview calls)
  preCalculatedSchedule?: TokenomicsSchedule | null;
}

const E8S = 100_000_000;

const UnifiedTokenomicsGraphsV2: React.FC<UnifiedTokenomicsGraphsV2Props> = ({
  primaryMaxSupply,
  tgeAllocation,
  initialSecondaryBurn,
  halvingStep,
  initialRewardPerBurnUnit,
  deployedSchedule,
  currentState,
  preCalculatedSchedule,
}) => {
  const dispatch = useAppDispatch();
  const [scheduleData, setScheduleData] = useState<TokenomicsSchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);

  // Validate parameters and generate warnings
  useEffect(() => {
    const newWarnings: string[] = [];
    if (initialSecondaryBurn && primaryMaxSupply && tgeAllocation && halvingStep) {
      try {
        const initialBurn = parseFloat(initialSecondaryBurn);
        if (initialBurn > 0) {
          const secondaryTokenPrice = 0.005; // Corresponds to SECONDARY_BURN_USD_COST in backend
          if ((initialBurn * secondaryTokenPrice) < 5000) {
            newWarnings.push(`Initial valuation for the first epoch is less than $5,000. A low initial valuation can make the critical initial phase susceptible to manipulation or a single-actor buyout.`);
          }
        }
        
        const tge = parseFloat(tgeAllocation);
        const maxSupply = parseFloat(primaryMaxSupply);
        if (maxSupply > 0 && tge >= maxSupply) {
            newWarnings.push(`TGE Allocation must be less than the Primary Max Supply to allow for minting via burning.`);
        }

        const halving = parseInt(halvingStep, 10);
        if (halving <= 0 || halving > 100) {
            newWarnings.push(`The Halving Step must be between 1% and 100% to ensure a decaying reward structure.`);
        } else if (halving < 25 || halving > 90) {
            newWarnings.push(`A Halving Step between 25% and 90% is generally recommended for a balanced decay curve.`);
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
  }, [primaryMaxSupply, tgeAllocation, initialSecondaryBurn, halvingStep, initialRewardPerBurnUnit, dispatch, preCalculatedSchedule]);

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
          return parseFloat(((minted / maxSupply) * 100).toFixed(2));
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

  return (
    <>
      {warnings.length > 0 && (
        <div className="terminal-section bg-black border border-yellow-500/30 p-3 font-mono mb-4">
          <div className="terminal-warning mb-2">[PARAMETER_WARNINGS]</div>
          <div className="space-y-1">
            {warnings.map((warning, index) => (
              <div key={index} className="text-yellow-500 text-xs pl-4">
                <span className="terminal-prompt">&gt;</span> {warning}
              </div>
            ))}
          </div>
        </div>
      )}
      {graphData.summaryData?.supplyCapped && (
        <div className="terminal-section bg-black border border-cyan-400/30 p-3 font-mono mb-4">
          <div className="terminal-status text-cyan-400">[SUPPLY_CAP_REACHED]</div>
          <div className="text-cyan-400 text-xs mt-2">
            The maximum supply of <span className="terminal-value">{Number(primaryMaxSupply).toLocaleString()}</span> tokens will be reached.
            The final epoch may be partial to exactly hit this cap.
          </div>
        </div>
      )}
      {graphData.summaryData?.floorRateEpoch && graphData.summaryData.floorRateEpoch > 0 && (
        <div className="terminal-section bg-black border border-purple-500/30 p-3 font-mono mb-4">
          <div className="terminal-status text-purple-400">[MINT_RATE_FLOOR_REACHED]</div>
          <div className="text-purple-400 text-xs mt-2">
            The mint rate reaches its minimum floor at <span className="terminal-value">Epoch {graphData.summaryData.floorRateEpoch}</span>.
            After this point, tokens will continue minting at the floor rate of <span className="terminal-value">{graphData.summaryData.minMintRate.toFixed(6)}</span> primary per secondary.
            This causes the exponential growth visible in later epochs.
          </div>
        </div>
      )}
      <div className="terminal-section text-center my-4">
        <div className="terminal-header font-mono">
          <span className="terminal-prompt">&gt;&gt;</span> tokenomics_simulation
          <div className="text-xs text-gray-600 mt-1">These graphs show how your token distribution will work over time.</div>
        </div>
      </div>
      <div className="terminal-section bg-black border border-white/30 p-4 font-mono mb-8">
        <div className="terminal-section-header mb-4">
          <span className="terminal-prompt">&gt;</span> key_metrics_summary
        </div>
        <div className="space-y-1">
          <div className="terminal-row">
            <span className="terminal-label">minting_epochs:</span>
            <span className="terminal-value">{graphData.summaryData?.epochs}</span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">initial_mint_cost:</span>
            <span className="terminal-primary">${graphData.summaryData?.initialMintCost?.toFixed(4)}</span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">final_mint_cost:</span>
            <span className="terminal-primary">${graphData.summaryData?.finalMintCost?.toFixed(4)}</span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">total_minting_valuation:</span>
            <span className="terminal-primary">${graphData.summaryData?.totalMintingValuation?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">distribution_type:</span>
            <span className="terminal-value">
              {graphData.summaryData?.epochs <= 5 ? 'quick' : 
               graphData.summaryData?.epochs <= 12 ? 'balanced' : 
               'extended'}
            </span>
          </div>
          {graphData.summaryData?.floorRateEpoch && graphData.summaryData.floorRateEpoch > 0 && (
            <div className="terminal-row">
              <span className="terminal-label">floor_rate_reached_at:</span>
              <span className="terminal-accent">epoch_{graphData.summaryData.floorRateEpoch}</span>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-8 mt-10 md:grid md:grid-cols-2 md:gap-x-8 md:space-y-0">
        <div className="terminal-graph">
          <div className="terminal-section-header mb-4">
            <span className="terminal-prompt">&gt;</span> cumulative_primary_supply_vs_burn
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
            <div className="terminal-row">
              <span className="terminal-label">status:</span>
              <span className="terminal-accent">awaiting_data</span>
            </div>
          )}
        </div>
        <div className="terminal-graph">
          <div className="terminal-section-header mb-4">
              <span className="terminal-prompt">&gt;</span> primary_tokens_minted_per_epoch
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
            <div className="terminal-row">
              <span className="terminal-label">status:</span>
              <span className="terminal-accent">awaiting_data</span>
            </div>
          )}
        </div>
        <div className="terminal-graph">
          <div className="terminal-section-header mb-4">
              <span className="terminal-prompt">&gt;</span> cost_to_mint_vs_supply
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
            <div className="terminal-row">
              <span className="terminal-label">status:</span>
              <span className="terminal-accent">awaiting_data</span>
            </div>
          )}
        </div>
        <div className="terminal-graph">
          <div className="terminal-section-header mb-4">
              <span className="terminal-prompt">&gt;</span> minting_valuation_vs_primary_percentage
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
            <div className="terminal-row">
              <span className="terminal-label">status:</span>
              <span className="terminal-accent">awaiting_data</span>
            </div>
          )}
        </div>
      </div>
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
    </>
  );
};

export default UnifiedTokenomicsGraphsV2;