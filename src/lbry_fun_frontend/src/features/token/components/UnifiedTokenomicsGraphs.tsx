import React, { useMemo, useState, useEffect } from 'react';
import LineChart from '../../swap/components/Chart';
import TooltipIcon from './TooltipIcon';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import previewTokenomics from '../thunk/previewTokenomics.thunk';
import { RootState } from '@/store';
import { TailSpin } from 'react-loader-spinner';
import { GraphData, clearPreviewError } from '../lbryFunSlice';
import { TokenomicsCurrentState } from '@/features/swap/thunks/tokenomicsThunks';

interface UnifiedTokenomicsGraphsProps {
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
}

const E8S = 100_000_000;

const formatGraphData = (data: GraphData | null): any => {
  if (!data || !data.cumulative_supply_data_y || data.cumulative_supply_data_y.length === 0) {
    return {
      cumulativeSupplyData: { xAxis: [], yAxis: [] },
      mintedPerEpochData: { xAxis: [], yAxis: [] },
      costToMintData: { xAxis: [], yAxis: [] },
      cumulativeUsdCostData: { xAxis: [], yAxis: [] },
      cumulativePercentageSupplyData: { xAxis: [], yAxis: [] },
      summaryData: {},
    };
  }

  const primaryMaxSupply = Number(data.cumulative_supply_data_y[data.cumulative_supply_data_y.length - 1]) / E8S;

  const cumulativeSupplyData = {
    xAxis: data.cumulative_supply_data_x.map((v: string) => Number(v)),
    yAxis: data.cumulative_supply_data_y.map((v: string) => Number(v) / E8S),
  };

  const mintedPerEpochData = {
    xAxis: data.minted_per_epoch_data_x,
    yAxis: data.minted_per_epoch_data_y.map((v: string) => Number(v) / E8S),
  };

  const costToMintData = {
    xAxis: data.cost_to_mint_data_x.map((v: string) => Number(v) / E8S),
    yAxis: data.cost_to_mint_data_y,
  };

  const cumulativeUsdCostData = {
    xAxis: data.cumulative_usd_cost_data_x.map((v: string) => Number(v) / E8S),
    yAxis: data.cumulative_usd_cost_data_y,
  };

  const cumulativePercentageSupplyData = {
    xAxis: cumulativeUsdCostData.xAxis,
    yAxis: cumulativeUsdCostData.yAxis.map((_: number, i: number) => {
      const minted = cumulativeUsdCostData.xAxis[i];
      if (primaryMaxSupply > 0) {
        return parseFloat(((minted / primaryMaxSupply) * 100).toFixed(2));
      }
      return 0;
    }),
  };

  const summaryData = {
      epochs: mintedPerEpochData.yAxis.length,
      totalMintingValuation: cumulativeUsdCostData.yAxis[cumulativeUsdCostData.yAxis.length - 1] || 0,
      initialMintCost: costToMintData?.yAxis.find(cost => cost && cost > 0) || 0,
      finalMintCost: [...(costToMintData?.yAxis || [])].reverse().find(cost => cost && cost > 0) || 0,
      tgePercentage: primaryMaxSupply > 0 ? parseFloat(((Number(data.cumulative_supply_data_y[0])/E8S / primaryMaxSupply) * 100).toFixed(2)) : 0,
      
      // Supply cap detection
      actualTotalMinted: cumulativeSupplyData.yAxis[cumulativeSupplyData.yAxis.length - 1] || 0,
      theoreticalOvermint: false, // Backend now caps properly
      supplyCapped: cumulativeSupplyData.yAxis[cumulativeSupplyData.yAxis.length - 1] >= (primaryMaxSupply * 0.999), // Within 0.1%
  };

  return {
    cumulativeSupplyData,
    mintedPerEpochData,
    costToMintData,
    cumulativeUsdCostData,
    cumulativePercentageSupplyData,
    summaryData
  };
};

const UnifiedTokenomicsGraphs: React.FC<UnifiedTokenomicsGraphsProps> = ({
  primaryMaxSupply,
  tgeAllocation,
  initialSecondaryBurn,
  halvingStep,
  initialRewardPerBurnUnit,
  deployedSchedule,
  currentState,
}) => {
  const dispatch = useAppDispatch();
  const { previewGraphData, previewLoading, previewError } = useAppSelector((state: RootState) => state.lbryFun);
  const [copySuccess, setCopySuccess] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Clear any previous errors when component mounts
  useEffect(() => {
    dispatch(clearPreviewError());
  }, [dispatch]);

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
  }, [primaryMaxSupply, tgeAllocation, initialSecondaryBurn, halvingStep, initialRewardPerBurnUnit, previewGraphData]);

  // Fetch preview data when parameters change
  useEffect(() => {
    console.log('UnifiedTokenomicsGraphs input parameters:', {
      primaryMaxSupply,
      tgeAllocation,
      initialSecondaryBurn,
      halvingStep,
      initialRewardPerBurnUnit,
      deployedSchedule,
      hasCurrentState: !!currentState
    });
    
    // Convert natural numbers to E8S for backend
    const E8S_MULTIPLIER = BigInt(100_000_000);
    
    const primary_max_supply = BigInt(primaryMaxSupply || '0') * E8S_MULTIPLIER;
    const tge_allocation = BigInt(tgeAllocation || '0') * E8S_MULTIPLIER;
    const initial_secondary_burn = BigInt(initialSecondaryBurn || '0') * E8S_MULTIPLIER;
    const halving_step = BigInt(halvingStep || '0');
    // Handle decimal values for initialRewardPerBurnUnit
    const initial_reward_per_burn_unit = BigInt(Math.floor(parseFloat(initialRewardPerBurnUnit || '0') * Number(E8S_MULTIPLIER)));

    console.log('UnifiedTokenomicsGraphs converted values:', {
      primary_max_supply: primary_max_supply.toString(),
      tge_allocation: tge_allocation.toString(),
      initial_secondary_burn: initial_secondary_burn.toString(),
      halving_step: halving_step.toString(),
      initial_reward_per_burn_unit: initial_reward_per_burn_unit.toString()
    });

    if (primary_max_supply > 0 && initial_secondary_burn > 0 && halving_step > 0 && initial_reward_per_burn_unit > 0) {
        console.log('UnifiedTokenomicsGraphs: Dispatching previewTokenomics');
        dispatch(previewTokenomics({args: {
            primary_max_supply: primary_max_supply.toString(),
            tge_allocation: tge_allocation.toString(),
            initial_secondary_burn: initial_secondary_burn.toString(),
            halving_step: halving_step.toString(),
            initial_reward_per_burn_unit: initial_reward_per_burn_unit.toString(),
        }})).catch((error) => {
            console.error("Failed to dispatch previewTokenomics:", error);
        });
    } else {
        console.log('UnifiedTokenomicsGraphs: Skipping dispatch due to invalid params');
    }
  }, [primaryMaxSupply, tgeAllocation, initialSecondaryBurn, halvingStep, initialRewardPerBurnUnit, dispatch]);

  const {
    cumulativeSupplyData,
    mintedPerEpochData,
    costToMintData,
    cumulativeUsdCostData,
    cumulativePercentageSupplyData,
    summaryData
  } = useMemo(() => {
    console.log('formatGraphData called with:', {
      hasData: !!previewGraphData,
      dataFields: previewGraphData ? Object.keys(previewGraphData) : [],
      cumulativeSupplyLength: previewGraphData?.cumulative_supply_data_y?.length || 0
    });
    const result = formatGraphData(previewGraphData);
    console.log('formatGraphData result:', {
      cumulativeSupplyData: {
        xLength: result.cumulativeSupplyData?.xAxis?.length || 0,
        yLength: result.cumulativeSupplyData?.yAxis?.length || 0,
        firstX: result.cumulativeSupplyData?.xAxis?.[0],
        firstY: result.cumulativeSupplyData?.yAxis?.[0]
      },
      mintedPerEpochData: {
        xLength: result.mintedPerEpochData?.xAxis?.length || 0,
        yLength: result.mintedPerEpochData?.yAxis?.length || 0
      }
    });
    return result;
  }, [previewGraphData]);
  
  // Debug log the actual data right before render
  useEffect(() => {
    console.log('UnifiedTokenomicsGraphs render data check:', {
      hasCumulativeData: !!cumulativeSupplyData,
      cumulativeXLength: cumulativeSupplyData?.xAxis?.length || 0,
      cumulativeYLength: cumulativeSupplyData?.yAxis?.length || 0,
      cumulativeXType: Array.isArray(cumulativeSupplyData?.xAxis) ? 'array' : typeof cumulativeSupplyData?.xAxis,
      cumulativeYType: Array.isArray(cumulativeSupplyData?.yAxis) ? 'array' : typeof cumulativeSupplyData?.yAxis,
      firstThreeX: cumulativeSupplyData?.xAxis?.slice(0, 3),
      firstThreeY: cumulativeSupplyData?.yAxis?.slice(0, 3),
      lastThreeY: cumulativeSupplyData?.yAxis?.slice(-3),
      mintedPerEpochFirstThree: mintedPerEpochData?.yAxis?.slice(0, 3)
    });
  }, [cumulativeSupplyData]);
  
  // Calculate current positions for "we are here" indicators
  const currentPositions = useMemo(() => {
    if (!currentState) {
      return null;
    }
    
    
    // IMPORTANT: totalSecondaryBurned is in raw units, NOT E8S
    const totalBurned = Number(currentState.totalSecondaryBurned); // No division by E8S!
    
    // totalPrimaryMinted IS in E8S units
    const totalMinted = Number(currentState.totalPrimaryMinted) / E8S;
    const currentEpoch = currentState.currentThresholdIndex;
    
    // Use circulating supply if available, otherwise fall back to total minted
    const circulatingSupply = currentState.circulatingSupply 
      ? Number(currentState.circulatingSupply) / E8S 
      : totalMinted;
    
    // For the cumulative supply vs burn graph, the x-axis is already in raw units
    // (see line 47: data.cumulative_supply_data_x.map((v: string) => Number(v)))
    // so we use totalBurned directly without conversion
    const burnedPositionForGraph = totalBurned;
    
    const result = {
      burnedPosition: burnedPositionForGraph,
      burnedLabel: `▼ ${totalBurned.toLocaleString()} burned`,
      mintedPosition: totalMinted,
      mintedLabel: `▼ ${totalMinted.toLocaleString()} minted`,
      circulatingPosition: circulatingSupply,
      circulatingLabel: `▼ ${circulatingSupply.toLocaleString()} circulating`,
      epochPosition: currentEpoch,
      epochLabel: currentEpoch > 0 ? `▼ Epoch ${currentEpoch}` : '▼ TGE'
    };
    
    console.log('Current positions calculated:', {
      burnedPosition: result.burnedPosition,
      mintedPosition: result.mintedPosition,
      circulatingPosition: result.circulatingPosition,
      epochPosition: result.epochPosition,
      currentState: {
        totalSecondaryBurned: currentState.totalSecondaryBurned,
        totalPrimaryMinted: currentState.totalPrimaryMinted,
        circulatingSupply: currentState.circulatingSupply,
        currentThresholdIndex: currentState.currentThresholdIndex
      },
      dataRanges: {
        cumulativeSupplyX: {
          min: Math.min(...(cumulativeSupplyData?.xAxis || [0])),
          max: Math.max(...(cumulativeSupplyData?.xAxis || [0])),
          first: cumulativeSupplyData?.xAxis?.[0],
          second: cumulativeSupplyData?.xAxis?.[1]
        },
        costToMintX: {
          min: Math.min(...(costToMintData?.xAxis || [0])),
          max: Math.max(...(costToMintData?.xAxis || [0])),
          first: costToMintData?.xAxis?.[0]
        }
      }
    });
    
    return result;
  }, [currentState, cumulativeSupplyData, mintedPerEpochData, costToMintData, cumulativeUsdCostData]);

  const handleCopyData = () => {
    if (!previewGraphData) return;

    const maxSupply = Number(previewGraphData.cumulative_supply_data_y[previewGraphData.cumulative_supply_data_y.length - 1] || '0') / E8S;
    
    let tableString = 'Epoch\tCumulative Secondary Burned\tCumulative Primary Minted\tPrimary Minted In Epoch\tUSD Cost per Primary Token ($)\tCumulative USD Cost ($)\tSupply Minted (%)\n';

    // TGE Data (Epoch 0)
    const tgePrimary = Number(previewGraphData.cumulative_supply_data_y[0] || '0') / E8S;
    const tgePercentage = maxSupply > 0 ? (tgePrimary / maxSupply) * 100 : 0;
    const tgeCostPerToken = previewGraphData.cost_to_mint_data_y[1] || 0; // First cost after TGE

    tableString += `TGE\t0\t${tgePrimary.toFixed(4)}\t${tgePrimary.toFixed(4)}\t$${tgeCostPerToken.toFixed(6)}\t$0.00\t${tgePercentage.toFixed(2)}%\n`;

    // Epoch Data
    const numEpochs = previewGraphData.minted_per_epoch_data_x.length;
    for (let i = 0; i < numEpochs; i++) {
        const epochLabel = previewGraphData.minted_per_epoch_data_x[i];
        
        const cumulativeSecondary = Number(previewGraphData.cumulative_supply_data_x[i + 1] || '0');
        const cumulativePrimary = Number(previewGraphData.cumulative_supply_data_y[i + 1] || '0') / E8S;
        const mintedThisEpoch = Number(previewGraphData.minted_per_epoch_data_y[i] || '0') / E8S;
        
        const costPerToken = previewGraphData.cost_to_mint_data_y[(i * 2) + 3] || 0;
        const cumulativeCost = Number(previewGraphData.cumulative_usd_cost_data_y[i + 1] || '0');
        const percentageMinted = maxSupply > 0 ? (cumulativePrimary / maxSupply) * 100 : 0;
        
        tableString += `${epochLabel}\t${cumulativeSecondary.toLocaleString()}\t${cumulativePrimary.toFixed(4)}\t${mintedThisEpoch.toFixed(4)}\t$${costPerToken.toFixed(6)}\t$${cumulativeCost.toFixed(2)}\t${percentageMinted.toFixed(2)}%\n`;
    }

    navigator.clipboard.writeText(tableString).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    }, () => {
        console.error('Failed to copy graph data to clipboard.');
    });
  };

  if (previewLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <TailSpin color="hsl(var(--interactive-primary))" height={50} width={50} />
      </div>
    );
  }

  if (previewError) {
    return <div className="text-center p-4 text-red-500">Error loading graph data: {previewError}</div>;
  }
  
  const hasMeaningfulInput = parseFloat(primaryMaxSupply) > 0 || parseFloat(tgeAllocation) > 0 || parseFloat(initialSecondaryBurn) > 0;
  if (!hasMeaningfulInput) {
    return <div className="text-center p-4 text-gray-500">Enter tokenomic parameters above to see the projected graphs.</div>;
  }
  
  // Check if we have actual graph data
  const hasGraphData = cumulativeSupplyData?.xAxis?.length > 0 && cumulativeSupplyData?.yAxis?.length > 0;
  
  console.log('UnifiedTokenomicsGraphs final render check:', {
    hasGraphData,
    previewLoading,
    hasMeaningfulInput,
    cumulativeSupplyDataExists: !!cumulativeSupplyData,
    xAxisLength: cumulativeSupplyData?.xAxis?.length,
    yAxisLength: cumulativeSupplyData?.yAxis?.length
  });
  

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
      {summaryData?.supplyCapped && (
        <div className="terminal-section bg-black border border-cyan-400/30 p-3 font-mono mb-4">
          <div className="terminal-status text-cyan-400">[SUPPLY_CAP_REACHED]</div>
          <div className="text-cyan-400 text-xs mt-2">
            The maximum supply of <span className="terminal-value">{Number(primaryMaxSupply).toLocaleString()}</span> tokens will be reached.
            The final epoch may be partial to exactly hit this cap.
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
            <span className="terminal-value">{summaryData?.epochs}</span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">tge_allocation:</span>
            <span className="terminal-value">{summaryData?.tgePercentage}%</span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">initial_mint_cost:</span>
            <span className="terminal-primary">${summaryData?.initialMintCost?.toFixed(4)}</span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">final_mint_cost:</span>
            <span className="terminal-primary">${summaryData?.finalMintCost?.toFixed(4)}</span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">total_minting_valuation:</span>
            <span className="terminal-primary">${summaryData?.totalMintingValuation?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">distribution_type:</span>
            <span className="terminal-value">
              {summaryData?.epochs <= 5 ? 'quick' : 
               summaryData?.epochs <= 12 ? 'balanced' : 
               'extended'}
            </span>
          </div>
        </div>
        {summaryData?.supplyCapped && (
          <div className="mt-3 pt-3 border-t border-white/30">
            <div className="text-cyan-400 text-xs">
              <span className="terminal-status">[INFO]</span> Distribution capped at max supply. Last epoch will mint only 
              <span className="terminal-value ml-1">{(summaryData.actualTotalMinted % summaryData.epochs).toLocaleString()}</span> tokens
              to exactly reach the <span className="terminal-value">{Number(primaryMaxSupply).toLocaleString()}</span> token cap.
            </div>
          </div>
        )}
      </div>
      <div className="space-y-8 mt-10 md:grid md:grid-cols-2 md:gap-x-8 md:space-y-0">
        <div className="terminal-graph">
          <div className="terminal-section-header mb-4">
            <span className="terminal-prompt">&gt;</span> cumulative_primary_supply_vs_burn
            <TooltipIcon text="This graph shows the total amount of Primary Token that will be minted as more Secondary Tokens are burned. Look for how quickly the supply hard cap is reached. A steeper curve means faster minting in early stages. The line flattens when the supply Hard Cap is hit." />
          </div>
          {cumulativeSupplyData && cumulativeSupplyData.xAxis && cumulativeSupplyData.yAxis && cumulativeSupplyData.xAxis.length > 0 && cumulativeSupplyData.yAxis.length > 0 ? (
            <LineChart
              dataXaxis={cumulativeSupplyData.xAxis}
              dataYaxis={cumulativeSupplyData.yAxis}
              xAxisLabel="Cumulative Secondary Tokens Burned"
              yAxisLabel="Cumulative Primary Tokens Minted (tokens)"
              lineColor="hsl(var(--color-chart-primary))"
              gardientColor="hsl(var(--color-chart-primary) / 0.3)"
              currentPositionX={currentPositions?.burnedPosition}
              showCurrentPosition={!!currentPositions}
              currentPositionLabel={currentPositions?.burnedLabel}
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
          {mintedPerEpochData && mintedPerEpochData.xAxis && mintedPerEpochData.yAxis && mintedPerEpochData.xAxis.length > 0 && mintedPerEpochData.yAxis.length > 0 ? (
            <LineChart
              dataXaxis={mintedPerEpochData.xAxis}
              dataYaxis={mintedPerEpochData.yAxis}
              xAxisLabel="Burn Epoch"
              yAxisLabel="Primary Tokens Minted in Epoch (tokens)"
              lineColor="hsl(var(--color-chart-secondary))"
              gardientColor="hsl(var(--color-chart-secondary) / 0.3)"
              currentPositionX={currentPositions?.epochPosition}
              showCurrentPosition={!!currentPositions}
              currentPositionLabel={currentPositions?.epochLabel}
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
              <TooltipIcon text="This graph shows the 'price' to create one new Primary Token by burning Secondary Tokens. Notice how the cost jumps up at each stage (or 'epoch'). This increasing cost is what makes it more rewarding for early participants to mint tokens." />
          </div>
          {costToMintData && costToMintData.xAxis && costToMintData.yAxis && costToMintData.xAxis.length > 0 && costToMintData.yAxis.length > 0 ? (
            <LineChart
              dataXaxis={costToMintData.xAxis}
              dataYaxis={costToMintData.yAxis}
              xAxisLabel="Cumulative Primary Tokens Minted (tokens)"
              yAxisLabel="USD Cost per Primary Token ($)"
              lineColor="hsl(var(--color-chart-success))"
              gardientColor="hsl(var(--color-chart-success) / 0.3)"
              currentPositionX={currentPositions?.circulatingPosition}
              showCurrentPosition={!!currentPositions}
              currentPositionLabel={currentPositions?.circulatingLabel}
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
              <span className="terminal-prompt">&gt;</span> minting_valuation_vs_primary
              <TooltipIcon text="Assuming each Secondary Token burned costs $0.005 (half a cent), this graph projects the total USD expenditure needed to mint a certain amount of Primary Tokens through the burning schedule. The cost of initially allocated Primary Tokens is considered $0 in this projection." />
          </div>
          {cumulativeUsdCostData && cumulativeUsdCostData.xAxis && cumulativeUsdCostData.yAxis && cumulativeUsdCostData.xAxis.length > 0 && cumulativeUsdCostData.yAxis.length > 0 ? (
            <LineChart
              dataXaxis={cumulativeUsdCostData.xAxis}
              dataYaxis={cumulativeUsdCostData.yAxis}
              xAxisLabel="Cumulative Primary Tokens Minted (tokens)"
              yAxisLabel="Minting Valuation ($)"
              lineColor="hsl(var(--color-chart-warning))"
              gardientColor="hsl(var(--color-chart-warning) / 0.3)"
              dataYaxis2={cumulativePercentageSupplyData.yAxis}
              yAxisLabel2="Supply Minted (%)"
              lineColor2="hsl(var(--color-chart-accent))"
              yAxis2format="percent"
            currentPositionX={currentPositions?.circulatingPosition}
            showCurrentPosition={!!currentPositions}
            currentPositionLabel={currentPositions?.circulatingLabel}
          />
          ) : (
            <div className="terminal-row">
              <span className="terminal-label">status:</span>
              <span className="terminal-accent">awaiting_data</span>
            </div>
          )}
        </div>
      </div>
      <div className="terminal-section p-4 font-mono text-center mt-8">
        <button 
          onClick={handleCopyData}
          className="terminal-command"
        >
          &gt; copy_table_data
        </button>
        {copySuccess && <span className="ml-4 terminal-success">[COPIED]</span>}
      </div>
    </>
  );
};

export default UnifiedTokenomicsGraphs;