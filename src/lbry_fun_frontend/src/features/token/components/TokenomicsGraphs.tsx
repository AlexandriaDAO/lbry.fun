import React, { useMemo, useState } from 'react';
import LineChart from '../../swap/components/insights/chart';
import TooltipIcon from './TooltipIcon';

interface TokenomicsGraphsProps {
  primaryMaxSupply: string;
  initialPrimaryMint: string; // Represents both initial allocation and initial rate for the schedule
  initialSecondaryBurn: string;
  halvingStep: string;
}

const SECONDARY_BURN_USD_COST = 0.005; // Cost per secondary token burned in USD

const generateTokenomicsScheduleData = (
  primaryMaxSupplyStr: string,
  initialPrimaryMintStr: string,
  initialSecondaryBurnStr: string,
  halvingStepStr: string
) => {
  const maxPrimarySupply = parseFloat(primaryMaxSupplyStr) || 0;
  const initialPrimaryMintAllocation = parseFloat(initialPrimaryMintStr) || 0;
  const firstBurnThresholdVal = parseFloat(initialSecondaryBurnStr) || 0;
  const halvingStep = parseFloat(halvingStepStr) / 100 || 0.5;

  let baseRateFromBackendLogic = 0;
  if (firstBurnThresholdVal > 0) {
    // Use floating point division to correctly model the intended rate, bypassing backend integer division issue for the graph.
    baseRateFromBackendLogic = initialPrimaryMintAllocation / firstBurnThresholdVal;
  }
  // The backend scales this rate by 10000 during minting.
  const effectiveStartingRateForSchedule = baseRateFromBackendLogic * 10000;

  const maxPrimaryFromSchedule = Math.max(0, maxPrimarySupply - initialPrimaryMintAllocation);

  // Handle cases where schedule might not run or inputs are invalid
  if (maxPrimaryFromSchedule <= 0 || effectiveStartingRateForSchedule === 0 || firstBurnThresholdVal === 0) {
    const finalSupplyAtTGE = Math.min(initialPrimaryMintAllocation, maxPrimarySupply);
    
    // X-axis for Cost and Percentage graph: Cumulative Primary Minted
    // Ensure at least two points for a line if only TGE or no minting.
    const mintedXAxis: number[] = [0, finalSupplyAtTGE > 0 ? finalSupplyAtTGE : (maxPrimarySupply > 0 ? 0.00001 : 1)]; 
    if (finalSupplyAtTGE === 0 && mintedXAxis[1] === 0.00001 && maxPrimarySupply ===0) mintedXAxis[1] =1; // Avoid 0/0 for percentage if no actual minting and no max supply
    if (mintedXAxis.length === 2 && mintedXAxis[0] === mintedXAxis[1] && mintedXAxis[1] === 0) mintedXAxis[1] = (maxPrimarySupply > 0 ? maxPrimarySupply : 1) / 1000 || 1; // Ensure a small spread if 0,0 to draw a line
    if (mintedXAxis.length === 2 && mintedXAxis[0] === mintedXAxis[1] && mintedXAxis[1] !== 0) mintedXAxis.push(mintedXAxis[1] * 1.01); // if single point > 0, extend slightly to draw line
    

    const costYAxis: number[] = mintedXAxis.map(_ => 0); // Cost is 0 for TGE or no scheduled minting

    let percentageYAxis: number[] = mintedXAxis.map(_ => 0);
    if (maxPrimarySupply > 0) {
      percentageYAxis = mintedXAxis.map(minted => parseFloat(((minted / maxPrimarySupply) * 100).toFixed(2)));
    } else if (finalSupplyAtTGE > 0) { // Minted something but max supply is 0 (edge case)
      percentageYAxis = mintedXAxis.map(minted => minted > 0 ? 100 : 0); 
    } else { // No TGE, no max supply
      percentageYAxis = mintedXAxis.map(_ => 0);
    }

    const displayThresholdSecondary = firstBurnThresholdVal > 0 ? firstBurnThresholdVal : (maxPrimarySupply > 0 ? maxPrimarySupply/10 : 1000);
    const cumulativeSupplyData = { xAxis: [0, displayThresholdSecondary], yAxis: [finalSupplyAtTGE, finalSupplyAtTGE] };
    const mintedPerEpochData = { xAxis: ["No Scheduled Minting"], yAxis: [0] };
    
    let initialRate = 0;
    // This condition (maxPrimaryFromSchedule > 0) would mean this block isn't hit for rate calculation for schedule.
    // So, effective rate of scheduled minting is 0 if we are in this block.
    const effectiveMintRateData = { xAxis: [0, displayThresholdSecondary], yAxis: [0, 0] }; 

    return {
        cumulativeSupplyData,
        mintedPerEpochData,
        effectiveMintRateData,
        cumulativeUsdCostData: { xAxis: mintedXAxis, yAxis: costYAxis },
        cumulativePercentageSupplyData: { xAxis: mintedXAxis, yAxis: percentageYAxis }
    };
  }

  const cumulativeSx = [0];
  const cumulativePy = [initialPrimaryMintAllocation];
  const epochLabels: string[] = [];
  const primaryMintedInEpochY: number[] = [];
  const effectiveRateY = [effectiveStartingRateForSchedule];
  const cumulativeCostY: number[] = [0]; // USD cost starts at 0

  let currentCumulativeSecondaryBurn = 0;
  let currentTotalPrimaryMintedFromSchedule = 0;
  let epochTargetCumulativeBurn = firstBurnThresholdVal;
  let primaryPerThresholdRate = effectiveStartingRateForSchedule;
  let epoch = 1;

  while (currentTotalPrimaryMintedFromSchedule < maxPrimaryFromSchedule && primaryPerThresholdRate >= 1 && epoch <= 50) { // Safety break at 50 epochs
    const secondaryToBurnThisEpoch = epochTargetCumulativeBurn - currentCumulativeSecondaryBurn;
    if (secondaryToBurnThisEpoch <= 0) break;

    let potentialPrimaryMintThisEpoch = secondaryToBurnThisEpoch * primaryPerThresholdRate;
    const remainingForSchedule = maxPrimaryFromSchedule - currentTotalPrimaryMintedFromSchedule;
    const actualPrimaryMintThisEpoch = Math.min(potentialPrimaryMintThisEpoch, remainingForSchedule);

    if (actualPrimaryMintThisEpoch < 0) break; // Should not happen

    currentCumulativeSecondaryBurn = epochTargetCumulativeBurn;
    currentTotalPrimaryMintedFromSchedule += actualPrimaryMintThisEpoch;
    
    cumulativeSx.push(currentCumulativeSecondaryBurn);
    const currentTotalPrimary = Math.min(maxPrimarySupply, initialPrimaryMintAllocation + currentTotalPrimaryMintedFromSchedule);
    cumulativePy.push(currentTotalPrimary);
    cumulativeCostY.push(currentCumulativeSecondaryBurn * SECONDARY_BURN_USD_COST);
    
    epochLabels.push(`Epoch ${epoch}`);
    primaryMintedInEpochY.push(actualPrimaryMintThisEpoch);

    // effectiveRateY already has the rate for the *start* of this segment (pushed from previous epoch or initial)
    // Now prepare rate for *next* epoch. If this is the last mint, the rate effectively goes to 0.
    
    let nextPrimaryPerThresholdRate = Math.max(1, Math.floor(primaryPerThresholdRate * halvingStep));
    if (currentTotalPrimaryMintedFromSchedule >= maxPrimaryFromSchedule) {
        effectiveRateY.push(0); // Minting capped, rate is 0 effectively for future burns beyond this point
    } else {
        effectiveRateY.push(nextPrimaryPerThresholdRate);
    }
    
    primaryPerThresholdRate = nextPrimaryPerThresholdRate;
    epochTargetCumulativeBurn *= 2;
    epoch++;

    if (actualPrimaryMintThisEpoch === 0 && potentialPrimaryMintThisEpoch > 0) {
        // This implies remainingForSchedule was 0, loop should terminate.
        // Added check to ensure cumulativePy doesn't exceed max.
        if (cumulativePy[cumulativePy.length -1] < maxPrimarySupply && cumulativeSx[cumulativeSx.length-1] > 0) {
             // Ensure the graph extends flat if max supply hit mid-epoch calculation conceptually
            const finalSecondaryBurnPoint = currentCumulativeSecondaryBurn + secondaryToBurnThisEpoch;
            cumulativeSx.push(finalSecondaryBurnPoint); 
            cumulativePy.push(cumulativePy[cumulativePy.length -1]);
            cumulativeCostY.push(finalSecondaryBurnPoint * SECONDARY_BURN_USD_COST);
            effectiveRateY.push(0);
        }
        break;
    }
  }
  
  // Ensure xAxis and yAxis for effective rate graph are aligned and sensible
   const effectiveRateX = [...cumulativeSx];
   while(effectiveRateY.length < effectiveRateX.length) effectiveRateY.push(effectiveRateY[effectiveRateY.length-1] ?? 0);
   while(effectiveRateY.length > effectiveRateX.length) effectiveRateY.pop();


  // If the schedule didn't mint anything but there was an allocation.
  if (cumulativeSx.length === 1 && cumulativePy.length === 1 && initialPrimaryMintAllocation > 0) {
    const placeholderSecondary = firstBurnThresholdVal > 0 ? firstBurnThresholdVal : 1000;
    cumulativeSx.push(placeholderSecondary);
    cumulativePy.push(cumulativePy[0]);
    cumulativeCostY.push(placeholderSecondary * SECONDARY_BURN_USD_COST); // Cost would apply if these were burned
    if (effectiveRateX.length ===1) {
        effectiveRateX.push(placeholderSecondary);
        effectiveRateY.push(effectiveRateY[0]);
    }
  }

  // Ensure cost graph starts with initial primary allocation at 0 cost from schedule
  let finalCumulativePyForCost = [...cumulativePy];
  let finalCumulativeCostY = [...cumulativeCostY];

  if (initialPrimaryMintAllocation > 0 && cumulativePy[0] === initialPrimaryMintAllocation && cumulativeCostY[0] === 0 && cumulativePy.length > 1) {
    // Data is fine if schedule runs
  } else if (initialPrimaryMintAllocation > 0 && cumulativePy.length === 1) {
    // Only allocation, no schedule ran for cost graph
    finalCumulativePyForCost = [0, initialPrimaryMintAllocation];
    finalCumulativeCostY = [0, 0]; // Cost is 0 as it's from allocation
  } else if (initialPrimaryMintAllocation === 0 && cumulativePy.length === 1){
    // No allocation, no schedule (empty graph essentially for cost)
    // Ensure there's at least two points for a line for finalCumulativePyForCost if it was [0]
    finalCumulativePyForCost = finalCumulativePyForCost.length === 1 ? [0, 1] : finalCumulativePyForCost;
    finalCumulativePyForCost = finalCumulativePyForCost.length === 0 ? [0,1] : finalCumulativePyForCost; // Handle empty array
    finalCumulativeCostY = finalCumulativePyForCost.map(_ => 0); // Match length with 0s
  }

  // Calculate percentage of total supply data
  let cumulativePercentageSupplyY: number[] = [];
  if (maxPrimarySupply > 0) {
    cumulativePercentageSupplyY = finalCumulativePyForCost.map(minted => 
      parseFloat(((minted / maxPrimarySupply) * 100).toFixed(2))
    );
  } else {
    cumulativePercentageSupplyY = finalCumulativePyForCost.map(_ => 0);
  }

  const costPerPrimaryTokenY = effectiveRateY.map(rate => rate > 0 ? (SECONDARY_BURN_USD_COST / rate) : null);

  return {
    cumulativeSupplyData: { xAxis: cumulativeSx, yAxis: cumulativePy.map(v => Math.min(v,maxPrimarySupply)) },
    mintedPerEpochData: { xAxis: epochLabels, yAxis: primaryMintedInEpochY },
    effectiveMintRateData: { xAxis: effectiveRateX, yAxis: effectiveRateY },
    cumulativeUsdCostData: { xAxis: finalCumulativePyForCost, yAxis: finalCumulativeCostY },
    cumulativePercentageSupplyData: { xAxis: finalCumulativePyForCost, yAxis: cumulativePercentageSupplyY },
    costPerTokenData: { xAxis: effectiveRateX, yAxis: costPerPrimaryTokenY },
  };
};

const TokenomicsGraphs: React.FC<TokenomicsGraphsProps> = ({
  primaryMaxSupply,
  initialPrimaryMint,
  initialSecondaryBurn,
  halvingStep,
}) => {
  const {
    cumulativeSupplyData,
    mintedPerEpochData,
    effectiveMintRateData,
    cumulativeUsdCostData,
    cumulativePercentageSupplyData,
    costPerTokenData,
  } = useMemo(() => generateTokenomicsScheduleData(
    primaryMaxSupply,
    initialPrimaryMint,
    initialSecondaryBurn,
    halvingStep
  ), [primaryMaxSupply, initialPrimaryMint, initialSecondaryBurn, halvingStep]);

  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopyData = () => {
    let tableString = 'Epoch\tCumulative Secondary Burned\tCumulative Primary Minted\tPrimary Minted In Epoch\tEffective Mint Rate (Primary per Secondary)\tUSD Cost per Primary Token ($)\tCumulative USD Cost ($)\tSupply Minted (%)\n';

    // TGE Data (Epoch 0)
    const tgePrimary = cumulativeSupplyData.yAxis[0] || 0;
    const maxSupply = parseFloat(primaryMaxSupply) || 0;
    const tgePercentage = maxSupply > 0 ? (tgePrimary / maxSupply) * 100 : 0;
    const startingRate = effectiveMintRateData.yAxis[0] || 0;
    const tgeCostPerToken = startingRate > 0 ? (SECONDARY_BURN_USD_COST / startingRate) : 0;

    tableString += `TGE\t0\t${tgePrimary.toFixed(4)}\t${tgePrimary.toFixed(4)}\t${startingRate.toFixed(4)}\t$${tgeCostPerToken.toFixed(6)}\t$0.00\t${tgePercentage.toFixed(2)}%\n`;

    // Epoch Data
    const numEpochs = mintedPerEpochData.yAxis.length;
    for (let i = 0; i < numEpochs; i++) {
        const epochLabel = mintedPerEpochData.xAxis[i]; // "Epoch 1", "Epoch 2", ...
        
        // Data points correspond to the *end* of the epoch, so index i+1 in cumulative arrays
        const cumulativeSecondary = cumulativeSupplyData.xAxis[i + 1] || 0;
        const cumulativePrimary = cumulativeSupplyData.yAxis[i + 1] || 0;
        const mintedThisEpoch = mintedPerEpochData.yAxis[i] || 0;
        
        const effectiveRate = effectiveMintRateData.yAxis[i] || 0; 
        const costPerToken = effectiveRate > 0 ? (SECONDARY_BURN_USD_COST / effectiveRate) : 0;
        
        const cumulativeCost = (cumulativeSupplyData.xAxis[i+1] || 0) * SECONDARY_BURN_USD_COST;

        const percentageMinted = maxSupply > 0 ? (cumulativePrimary / maxSupply) * 100 : 0;
        
        tableString += `${epochLabel}\t${cumulativeSecondary.toLocaleString()}\t${cumulativePrimary.toFixed(4)}\t${mintedThisEpoch.toFixed(4)}\t${effectiveRate.toFixed(4)}\t$${costPerToken.toFixed(6)}\t$${cumulativeCost.toFixed(2)}\t${percentageMinted.toFixed(2)}%\n`;
    }

    if (cumulativeSupplyData.xAxis.length > numEpochs + 1) {
        const lastIndex = cumulativeSupplyData.xAxis.length - 1;
        const cumulativeSecondary = cumulativeSupplyData.xAxis[lastIndex] || 0;
        const cumulativePrimary = cumulativeSupplyData.yAxis[lastIndex] || 0;
        const cumulativeCost = cumulativeSecondary * SECONDARY_BURN_USD_COST;
        const percentageMinted = maxSupply > 0 ? (cumulativePrimary / maxSupply) * 100 : 0;

        tableString += `Capped\t${cumulativeSecondary.toLocaleString()}\t${cumulativePrimary.toFixed(4)}\t0.0000\t0.00000000\t$0.000000\t$${cumulativeCost.toFixed(2)}\t${percentageMinted.toFixed(2)}%\n`;
    }

    navigator.clipboard.writeText(tableString).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    }, () => {
        console.error('Failed to copy graph data to clipboard.');
    });
  };

  // Basic check to render graphs only if there's some input.
  const hasMeaningfulInput = parseFloat(primaryMaxSupply) > 0 || parseFloat(initialPrimaryMint) > 0 || parseFloat(initialSecondaryBurn) > 0;

  if (!hasMeaningfulInput) {
    return <div className="text-center p-4 text-gray-500">Enter tokenomic parameters above to see the projected graphs.</div>;
  }
  
  const graphTitleBaseClass = "text-xl font-medium w-full";
  const isDarkMode = false;

  return (
    <>
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
            lineColor="#8884d8"
            gardientColor="rgba(136, 132, 216, 0.3)"
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
            lineColor="#82ca9d"
            gardientColor="rgba(130, 202, 157, 0.3)"
          />
        </div>
        <div>
          <div className="flex items-center mb-2">
              <h3 className={`${graphTitleBaseClass} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Effective Mint Rate vs. Burn</h3>
              <TooltipIcon text="This graph illustrates the 'bang for your buck' when burning Secondary Tokens. It shows how many Primary Tokens you get for each Secondary Token burned. The rate typically decreases in steps as more total Secondary Tokens are burned, making early burning more efficient. A sharper drop means incentives for early burning are stronger." />
          </div>
          <LineChart
            dataXaxis={effectiveMintRateData.xAxis}
            dataYaxis={effectiveMintRateData.yAxis}
            xAxisLabel="Cumulative Secondary Tokens Burned"
            yAxisLabel="Primary Tokens Minted per Secondary Burned"
            lineColor="#ffc658"
            gardientColor="rgba(255, 198, 88, 0.3)"
            dataYaxis2={costPerTokenData?.yAxis}
            yAxisLabel2="USD Cost per Primary Token ($)"
            lineColor2="#4CAF50"
          />
        </div>
        <div>
          <div className="flex items-center mb-2">
              <h3 className={`${graphTitleBaseClass} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Cumulative USD Cost vs. Primary Minted</h3>
              <TooltipIcon text="Assuming each Secondary Token burned costs $0.005 (half a cent), this graph projects the total USD expenditure needed to mint a certain amount of Primary Tokens through the burning schedule. The cost of initially allocated Primary Tokens is considered $0 in this projection." />
          </div>
          <LineChart
            dataXaxis={cumulativeUsdCostData.xAxis}
            dataYaxis={cumulativeUsdCostData.yAxis}
            xAxisLabel="Cumulative Primary Tokens Minted"
            yAxisLabel="Cumulative USD Cost ($)"
            lineColor="#FA8072"
            gardientColor="rgba(250, 128, 114, 0.3)"
            dataYaxis2={cumulativePercentageSupplyData.yAxis}
            yAxisLabel2="Supply Minted (%)"
            lineColor2="#00BCD4"
          />
        </div>
      </div>
      <div className="text-center mt-8">
        <button 
          onClick={handleCopyData}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition"
        >
          Copy Table Data
        </button>
        {copySuccess && <span className="ml-4 text-green-500 dark:text-green-400">Copied!</span>}
      </div>
    </>
  );
};

export default TokenomicsGraphs; 