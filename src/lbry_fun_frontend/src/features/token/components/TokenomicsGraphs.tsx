import React, { useMemo } from 'react';
import LineChart from '../../swap/components/insights/chart';
import TooltipIcon from './TooltipIcon';

interface TokenomicsGraphsProps {
  primaryMaxSupply: string;
  initialPrimaryMint: string; // Represents both initial allocation and initial rate for the schedule
  initialSecondaryBurn: string;
}

const SECONDARY_BURN_USD_COST = 0.005; // Cost per secondary token burned in USD

const generateTokenomicsScheduleData = (
  primaryMaxSupplyStr: string,
  initialPrimaryMintStr: string,
  initialSecondaryBurnStr: string
) => {
  const maxPrimarySupply = parseFloat(primaryMaxSupplyStr) || 0;
  // initialPrimaryMintStr is used for TGE allocation AND as the starting rate for the schedule generation.
  const initialPrimaryMintAllocation = parseFloat(initialPrimaryMintStr) || 0;
  const initialPrimaryMintRateForSchedule = parseFloat(initialPrimaryMintStr) || 0;
  const firstBurnThreshold = parseFloat(initialSecondaryBurnStr) || 0;

  const maxPrimaryFromSchedule = Math.max(0, maxPrimarySupply - initialPrimaryMintAllocation);

  const cumulativeUsdCostData = { xAxis: [0], yAxis: [0] };

  // Handle cases where schedule might not run or inputs are invalid
  if (maxPrimaryFromSchedule <= 0 || initialPrimaryMintRateForSchedule === 0 || firstBurnThreshold === 0) {
    const finalSupply = Math.min(initialPrimaryMintAllocation, maxPrimarySupply);
    const displayThresholdPrimary = finalSupply > 0 ? finalSupply : (maxPrimarySupply > 0 ? maxPrimarySupply : 1000);
    const displayThresholdSecondary = firstBurnThreshold > 0 ? firstBurnThreshold : (maxPrimarySupply > 0 ? maxPrimarySupply/10 : 1000);

    const cumulativeSupplyData = { xAxis: [0, displayThresholdSecondary], yAxis: [finalSupply, finalSupply] };
    const mintedPerTierData = { xAxis: ["No Scheduled Minting"], yAxis: [0] };
    
    let initialRate = 0;
    if (initialPrimaryMintRateForSchedule > 0 && firstBurnThreshold > 0 && maxPrimaryFromSchedule > 0) {
        initialRate = initialPrimaryMintRateForSchedule / 10000;
    }
    const effectiveMintRateData = { xAxis: [0, displayThresholdSecondary], yAxis: [initialRate, initialRate] };
    if (maxPrimaryFromSchedule <= 0) { // If allocation meets/exceeds supply, or no room for schedule
        effectiveMintRateData.yAxis = [0,0];
    }
    // For USD cost graph, if only allocation, cost is 0 for scheduled mints
    cumulativeUsdCostData.xAxis = [0, displayThresholdPrimary];
    cumulativeUsdCostData.yAxis = [0, 0];

    return { cumulativeSupplyData, mintedPerTierData, effectiveMintRateData, cumulativeUsdCostData };
  }

  const cumulativeSx = [0];
  const cumulativePy = [initialPrimaryMintAllocation];
  const tierLabels: string[] = [];
  const primaryMintedInTierY: number[] = [];
  const effectiveRateY = [initialPrimaryMintRateForSchedule / 10000];
  const cumulativeCostY: number[] = [0]; // USD cost starts at 0

  let currentCumulativeSecondaryBurn = 0;
  let currentTotalPrimaryMintedFromSchedule = 0;
  let tierTargetCumulativeBurn = firstBurnThreshold;
  let primaryPerThresholdRate = initialPrimaryMintRateForSchedule;
  let tier = 1;

  while (currentTotalPrimaryMintedFromSchedule < maxPrimaryFromSchedule && primaryPerThresholdRate >= 1 && tier <= 50) { // Safety break at 50 tiers
    const secondaryToBurnThisTier = tierTargetCumulativeBurn - currentCumulativeSecondaryBurn;
    if (secondaryToBurnThisTier <= 0) break;

    let potentialPrimaryMintThisTier = (secondaryToBurnThisTier * primaryPerThresholdRate) / 10000;
    const remainingForSchedule = maxPrimaryFromSchedule - currentTotalPrimaryMintedFromSchedule;
    const actualPrimaryMintThisTier = Math.min(potentialPrimaryMintThisTier, remainingForSchedule);

    if (actualPrimaryMintThisTier < 0) break; // Should not happen

    currentCumulativeSecondaryBurn = tierTargetCumulativeBurn;
    currentTotalPrimaryMintedFromSchedule += actualPrimaryMintThisTier;
    
    cumulativeSx.push(currentCumulativeSecondaryBurn);
    const currentTotalPrimary = Math.min(maxPrimarySupply, initialPrimaryMintAllocation + currentTotalPrimaryMintedFromSchedule);
    cumulativePy.push(currentTotalPrimary);
    cumulativeCostY.push(currentCumulativeSecondaryBurn * SECONDARY_BURN_USD_COST);
    
    tierLabels.push(`Tier ${tier}`);
    primaryMintedInTierY.push(actualPrimaryMintThisTier);

    // effectiveRateY already has the rate for the *start* of this segment (pushed from previous tier or initial)
    // Now prepare rate for *next* tier. If this is the last mint, the rate effectively goes to 0.
    
    let nextPrimaryPerThresholdRate = Math.max(1, Math.floor(primaryPerThresholdRate / 2));
    if (currentTotalPrimaryMintedFromSchedule >= maxPrimaryFromSchedule) {
        effectiveRateY.push(0); // Minting capped, rate is 0 effectively for future burns beyond this point
    } else {
        effectiveRateY.push(nextPrimaryPerThresholdRate / 10000);
    }
    
    primaryPerThresholdRate = nextPrimaryPerThresholdRate;
    tierTargetCumulativeBurn *= 2;
    tier++;

    if (actualPrimaryMintThisTier === 0 && potentialPrimaryMintThisTier > 0) {
        // This implies remainingForSchedule was 0, loop should terminate.
        // Added check to ensure cumulativePy doesn't exceed max.
        if (cumulativePy[cumulativePy.length -1] < maxPrimarySupply && cumulativeSx[cumulativeSx.length-1] > 0) {
             // Ensure the graph extends flat if max supply hit mid-tier calculation conceptually
            const finalSecondaryBurnPoint = currentCumulativeSecondaryBurn + secondaryToBurnThisTier;
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
    const placeholderSecondary = firstBurnThreshold > 0 ? firstBurnThreshold : 1000;
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
    finalCumulativePyForCost = [0,1]; // Placeholder to draw an empty line for cost
    finalCumulativeCostY = [0,0];
  }

  return {
    cumulativeSupplyData: { xAxis: cumulativeSx, yAxis: cumulativePy.map(v => Math.min(v,maxPrimarySupply)) },
    mintedPerTierData: { xAxis: tierLabels, yAxis: primaryMintedInTierY },
    effectiveMintRateData: { xAxis: effectiveRateX, yAxis: effectiveRateY },
    cumulativeUsdCostData: { xAxis: finalCumulativePyForCost, yAxis: finalCumulativeCostY },
  };
};

const TokenomicsGraphs: React.FC<TokenomicsGraphsProps> = ({
  primaryMaxSupply,
  initialPrimaryMint,
  initialSecondaryBurn,
}) => {
  const {
    cumulativeSupplyData,
    mintedPerTierData,
    effectiveMintRateData,
    cumulativeUsdCostData,
  } = useMemo(() => generateTokenomicsScheduleData(
    primaryMaxSupply,
    initialPrimaryMint,
    initialSecondaryBurn
  ), [primaryMaxSupply, initialPrimaryMint, initialSecondaryBurn]);

  // Basic check to render graphs only if there's some input.
  const hasMeaningfulInput = parseFloat(primaryMaxSupply) > 0 || parseFloat(initialPrimaryMint) > 0 || parseFloat(initialSecondaryBurn) > 0;

  if (!hasMeaningfulInput) {
    return <div className="text-center p-4 text-gray-500">Enter tokenomic parameters above to see the projected graphs.</div>;
  }
  
  const graphTitleBaseClass = "text-xl font-medium w-full";
  const isDarkMode = false;

  return (
    <div className="space-y-8 mt-10">
      <div>
        <div className="flex items-center mb-2">
          <h3 className={`${graphTitleBaseClass} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Cumulative Primary Supply vs. Burn</h3>
          <TooltipIcon text="This graph shows the total amount of Primary Token that will be minted as more Secondary Tokens are burned. Look for how quickly the supply cap is reached. A steeper curve means faster minting in early stages. The line flattens when the Primary Max Supply is hit." />
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
      <div>
        <div className="flex items-center mb-2">
            <h3 className={`${graphTitleBaseClass} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Primary Tokens Minted per Tier</h3>
            <TooltipIcon text="This chart displays how many new Primary Tokens are created at each burn tier. Typically, earlier tiers (left) will mint more tokens than later tiers (right), showing that early burners are rewarded more. A rapid decrease indicates a faster reduction in minting rewards per tier." />
        </div>
        <LineChart
          dataXaxis={mintedPerTierData.xAxis.length > 0 ? mintedPerTierData.xAxis : ["N/A"]}
          dataYaxis={mintedPerTierData.yAxis.length > 0 ? mintedPerTierData.yAxis : [0]}
          xAxisLabel="Burn Tier"
          yAxisLabel="Primary Tokens Minted in Tier"
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
        />
      </div>
    </div>
  );
};

export default TokenomicsGraphs; 