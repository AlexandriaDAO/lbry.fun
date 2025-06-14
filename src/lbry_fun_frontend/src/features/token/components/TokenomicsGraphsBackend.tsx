import React, { useMemo, useState, useEffect } from 'react';
import LineChart from '../../swap/components/insights/chart';
import TooltipIcon from './TooltipIcon';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import previewTokenomics from '../thunk/previewTokenomics.thunk';
import { RootState } from '@/store';
import { TailSpin } from 'react-loader-spinner';
import { GraphData } from '../lbryFunSlice';

interface TokenomicsGraphsBackendProps {
  primaryMaxSupply: string;
  tgeAllocation: string;
  initialSecondaryBurn: string;
  halvingStep: string;
  initialRewardPerBurnUnit: string;
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


const TokenomicsGraphsBackend: React.FC<TokenomicsGraphsBackendProps> = ({
  primaryMaxSupply,
  tgeAllocation,
  initialSecondaryBurn,
  halvingStep,
  initialRewardPerBurnUnit,
}) => {
  const dispatch = useAppDispatch();
  const { previewGraphData, previewLoading, previewError } = useAppSelector((state: RootState) => state.lbryFun);
  const [copySuccess, setCopySuccess] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

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
  }, [primaryMaxSupply, tgeAllocation, initialSecondaryBurn, halvingStep]);

  useEffect(() => {
    const primary_max_supply = BigInt(primaryMaxSupply || '0');
    const tge_allocation = BigInt(tgeAllocation || '0');
    const initial_secondary_burn = BigInt(initialSecondaryBurn || '0');
    const halving_step = BigInt(halvingStep || '0');
    const initial_reward_per_burn_unit = BigInt(initialRewardPerBurnUnit || '0');

    if (primary_max_supply > 0 && initial_secondary_burn > 0 && halving_step > 0 && initial_reward_per_burn_unit > 0) {
        dispatch(previewTokenomics({args: {
            primary_max_supply,
            tge_allocation,
            initial_secondary_burn,
            halving_step,
            initial_reward_per_burn_unit,
        }}));
    }
  }, [primaryMaxSupply, tgeAllocation, initialSecondaryBurn, halvingStep, initialRewardPerBurnUnit, dispatch]);

  const {
    cumulativeSupplyData,
    mintedPerEpochData,
    costToMintData,
    cumulativeUsdCostData,
    cumulativePercentageSupplyData,
    summaryData
  } = useMemo(() => formatGraphData(previewGraphData), [previewGraphData]);

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
  
  const graphTitleBaseClass = "text-xl font-medium w-full";
  const isDarkMode = false;

  return (
    <>
      {warnings.length > 0 && (
        <div className="my-4 p-4 border border-yellow-400 bg-yellow-50 rounded-lg bg-yellow-900/20 border-yellow-600">
          <h3 className="font-bold text-yellow-800 text-yellow-300">Parameter Warnings</h3>
          <ul className="list-disc list-inside text-yellow-700 text-yellow-400 mt-2 space-y-1">
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="text-center my-4">
        <h2 className="text-2xl font-bold text-gray-800 text-white">Backend Simulation Results</h2>
        <p className="text-sm text-gray-500 text-gray-400">These graphs are generated by the on-chain canister logic.</p>
      </div>
      <div className="mb-8 p-4 border rounded-lg bg-gray-50 bg-gray-800">
        <h3 className="text-xl font-semibold mb-4 text-center text-gray-900 text-white">Key Metrics Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-center">
          <div className="p-2 bg-gray-100 bg-gray-700 rounded-md">
            <p className="text-sm text-gray-500 text-gray-400">Minting Epochs</p>
            <p className="text-lg font-bold text-gray-900 text-white">{summaryData?.epochs}</p>
          </div>
          <div className="p-2 bg-gray-100 bg-gray-700 rounded-md">
            <p className="text-sm text-gray-500 text-gray-400">TGE Allocation</p>
            <p className="text-lg font-bold text-gray-900 text-white">{summaryData?.tgePercentage}%</p>
          </div>
          <div className="p-2 bg-gray-100 bg-gray-700 rounded-md">
            <p className="text-sm text-gray-500 text-gray-400">Initial Mint Cost</p>
            <p className="text-lg font-bold text-gray-900 text-white">${summaryData?.initialMintCost?.toFixed(4)}</p>
          </div>
          <div className="p-2 bg-gray-100 bg-gray-700 rounded-md">
            <p className="text-sm text-gray-500 text-gray-400">Final Mint Cost</p>
            <p className="text-lg font-bold text-gray-900 text-white">${summaryData?.finalMintCost?.toFixed(4)}</p>
          </div>
          <div className="p-2 bg-gray-100 bg-gray-700 rounded-md col-span-2 md:col-span-1 lg:col-span-1">
            <p className="text-sm text-gray-500 text-gray-400">Total Minting Valuation</p>
            <p className="text-lg font-bold text-gray-900 text-white">${summaryData?.totalMintingValuation?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>
      <div className="space-y-8 mt-10 md:grid md:grid-cols-2 md:gap-x-8 md:space-y-0">
        <div className="md:mb-8">
          <div className="flex items-center mb-2">
            <h3 className={`${graphTitleBaseClass} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Cumulative Primary Supply vs. Burn</h3>
            <TooltipIcon text="This graph shows the total amount of Primary Token that will be minted as more Secondary Tokens are burned. Look for how quickly the supply hard cap is reached. A steeper curve means faster minting in early stages. The line flattens when the supply Hard Cap is hit." />
          </div>
          <LineChart
            dataXaxis={cumulativeSupplyData.xAxis}
            dataYaxis={cumulativeSupplyData.yAxis}
            xAxisLabel="Cumulative Secondary Tokens Burned"
            yAxisLabel="Cumulative Primary Tokens Minted"
            lineColor="hsl(var(--color-chart-primary))"
            gardientColor="hsl(var(--color-chart-primary) / 0.3)"
          />
        </div>
        <div className="md:mb-8">
          <div className="flex items-center mb-2">
              <h3 className={`${graphTitleBaseClass} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Primary Tokens Minted per Epoch</h3>
              <TooltipIcon text="This chart displays how many new Primary Tokens are created at each burn epoch. Typically, earlier epochs (left) will mint more tokens than later epochs (right), showing that early burners are rewarded more. A rapid decrease indicates a faster reduction in minting rewards per epoch." />
          </div>
          <LineChart
            dataXaxis={mintedPerEpochData.xAxis.length > 0 ? mintedPerEpochData.xAxis : ["N/A"]}
            dataYaxis={mintedPerEpochData.yAxis.length > 0 ? mintedPerEpochData.yAxis : [0]}
            xAxisLabel="Burn Epoch"
            yAxisLabel="Primary Tokens Minted in Epoch"
            lineColor="hsl(var(--color-chart-secondary))"
            gardientColor="hsl(var(--color-chart-secondary) / 0.3)"
          />
        </div>
        <div>
          <div className="flex items-center mb-2">
              <h3 className={`${graphTitleBaseClass} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Cost to Mint One Primary Token vs. Total Supply Minted</h3>
              <TooltipIcon text="This graph shows the 'price' to create one new Primary Token by burning Secondary Tokens. Notice how the cost jumps up at each stage (or 'epoch'). This increasing cost is what makes it more rewarding for early participants to mint tokens." />
          </div>
          <LineChart
            dataXaxis={costToMintData?.xAxis}
            dataYaxis={costToMintData?.yAxis}
            xAxisLabel="Cumulative Primary Tokens Minted"
            yAxisLabel="USD Cost per Primary Token ($)"
            lineColor="hsl(var(--color-chart-success))"
            gardientColor="hsl(var(--color-chart-success) / 0.3)"
          />
        </div>
        <div>
          <div className="flex items-center mb-2">
              <h3 className={`${graphTitleBaseClass} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Minting Valuation vs. Primary Minted</h3>
              <TooltipIcon text="Assuming each Secondary Token burned costs $0.005 (half a cent), this graph projects the total USD expenditure needed to mint a certain amount of Primary Tokens through the burning schedule. The cost of initially allocated Primary Tokens is considered $0 in this projection." />
          </div>
          <LineChart
            dataXaxis={cumulativeUsdCostData.xAxis}
            dataYaxis={cumulativeUsdCostData.yAxis}
            xAxisLabel="Cumulative Primary Tokens Minted"
            yAxisLabel="Minting Valuation ($)"
            lineColor="hsl(var(--color-chart-warning))"
            gardientColor="hsl(var(--color-chart-warning) / 0.3)"
            dataYaxis2={cumulativePercentageSupplyData.yAxis}
            yAxisLabel2="Supply Minted (%)"
            lineColor2="hsl(var(--color-chart-accent))"
            yAxis2format="percent"
          />
        </div>
      </div>
      <div className="text-center mt-8">
        <button 
          onClick={handleCopyData}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 bg-gray-700 text-gray-200 hover:bg-gray-600 transition"
        >
          Copy Backend Table Data
        </button>
        {copySuccess && <span className="ml-4 text-green-500 text-green-400">Copied!</span>}
      </div>
    </>
  );
};

export default TokenomicsGraphsBackend; 