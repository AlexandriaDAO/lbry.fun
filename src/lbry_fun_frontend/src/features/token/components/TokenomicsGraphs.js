import React, { useMemo, useState } from 'react';
import LineChart from '../../swap/components/insights/chart';
import TooltipIcon from './TooltipIcon';
const SECONDARY_BURN_USD_COST = 0.005; // Cost per secondary token burned in USD
// Note on simulation logic vs. on-chain reality:
// This function simulates the tokenomics schedule based on user-provided parameters,
// including a `tgeAllocation`. This simulation correctly reflects the math of the
// on-chain tokenomics canister.
// It's important to know that for actual deployment, a single, negligible primary token
// is minted first to seed the liquidity pool. This seed token is separate from the TGE
// and is not included in these graphing calculations, as its impact on the overall
// supply and schedule is virtually zero.
const generateTokenomicsScheduleData = (primaryMaxSupplyStr, tgeAllocationStr, initialSecondaryBurnStr, halvingStepStr, initialRewardPerBurnUnitStr) => {
    const maxPrimarySupply = parseFloat(primaryMaxSupplyStr) || 0;
    const tgeAllocation = parseFloat(tgeAllocationStr) || 0;
    const initialSecondaryBurn = parseFloat(initialSecondaryBurnStr) || 0;
    const halvingStep = parseFloat(halvingStepStr) / 100 || 0.5;
    const initialRewardPerBurnUnit = parseFloat(initialRewardPerBurnUnitStr) || 0;
    const maxPrimaryFromSchedule = Math.max(0, maxPrimarySupply - tgeAllocation);
    // Handle cases where schedule might not run or inputs are invalid
    if (maxPrimaryFromSchedule <= 0 || initialRewardPerBurnUnit === 0 || initialSecondaryBurn === 0) {
        const finalSupplyAtTGE = Math.min(tgeAllocation, maxPrimarySupply);
        // X-axis for Cost and Percentage graph: Cumulative Primary Minted
        const mintedXAxis = [0, finalSupplyAtTGE > 0 ? finalSupplyAtTGE : (maxPrimarySupply > 0 ? 0.00001 : 1)];
        if (finalSupplyAtTGE === 0 && mintedXAxis[1] === 0.00001 && maxPrimarySupply === 0)
            mintedXAxis[1] = 1; // Avoid 0/0
        if (mintedXAxis.length === 2 && mintedXAxis[0] === mintedXAxis[1] && mintedXAxis[1] === 0)
            mintedXAxis[1] = (maxPrimarySupply > 0 ? maxPrimarySupply : 1) / 1000 || 1;
        if (mintedXAxis.length === 2 && mintedXAxis[0] === mintedXAxis[1] && mintedXAxis[1] !== 0)
            mintedXAxis.push(mintedXAxis[1] * 1.01);
        const costYAxis = mintedXAxis.map(_ => 0);
        let percentageYAxis = mintedXAxis.map(_ => 0);
        if (maxPrimarySupply > 0) {
            percentageYAxis = mintedXAxis.map(minted => parseFloat(((minted / maxPrimarySupply) * 100).toFixed(2)));
        }
        else if (finalSupplyAtTGE > 0) {
            percentageYAxis = mintedXAxis.map(minted => minted > 0 ? 100 : 0);
        }
        else {
            percentageYAxis = mintedXAxis.map(_ => 0);
        }
        const displayThresholdSecondary = initialSecondaryBurn > 0 ? initialSecondaryBurn : (maxPrimarySupply > 0 ? maxPrimarySupply / 10 : 1000);
        const cumulativeSupplyData = { xAxis: [0, displayThresholdSecondary], yAxis: [finalSupplyAtTGE, finalSupplyAtTGE] };
        const mintedPerEpochData = { xAxis: ["No Scheduled Minting"], yAxis: [0] };
        const effectiveMintRate = initialSecondaryBurn > 0 ? initialRewardPerBurnUnit / initialSecondaryBurn : 0;
        const effectiveMintRateData = { xAxis: [0, displayThresholdSecondary], yAxis: [effectiveMintRate, 0] };
        return {
            cumulativeSupplyData,
            mintedPerEpochData,
            effectiveMintRateData,
            cumulativeUsdCostData: { xAxis: mintedXAxis, yAxis: costYAxis },
            cumulativePercentageSupplyData: { xAxis: mintedXAxis, yAxis: percentageYAxis }
        };
    }
    const cumulativeSx = [0];
    const cumulativePy = [tgeAllocation];
    const epochLabels = [];
    const primaryMintedInEpochY = [];
    // This is the rate of primary tokens per secondary token for the first epoch.
    const initialEffectiveRate = initialSecondaryBurn > 0 ? initialRewardPerBurnUnit / initialSecondaryBurn : 0;
    const effectiveRateY = [initialEffectiveRate];
    const cumulativeCostY = [0];
    let currentCumulativeSecondaryBurn = 0;
    let currentTotalPrimaryMintedFromSchedule = 0;
    let epochTargetCumulativeBurn = initialSecondaryBurn;
    let primaryRewardForUnit = initialRewardPerBurnUnit; // This is the variable that will halve.
    let epoch = 1;
    // Use BigInts for precision to match backend Rust canister logic
    const E8S = 100000000n;
    let primaryRewardForUnit_e8s = BigInt(Math.round(initialRewardPerBurnUnit * Number(E8S)));
    const initialSecondaryBurn_e8s = BigInt(Math.round(initialSecondaryBurn * Number(E8S)));
    const halvingStep_e8s = BigInt(Math.round(parseFloat(halvingStepStr)));
    const maxPrimaryFromSchedule_e8s = BigInt(Math.round(maxPrimaryFromSchedule * Number(E8S)));
    let currentTotalPrimaryMintedFromSchedule_e8s = 0n;
    while (currentTotalPrimaryMintedFromSchedule_e8s < maxPrimaryFromSchedule_e8s && primaryRewardForUnit_e8s >= 1 && epoch <= 50) {
        const secondaryToBurnThisEpoch = epochTargetCumulativeBurn - currentCumulativeSecondaryBurn;
        if (secondaryToBurnThisEpoch <= 0)
            break;
        const secondaryToBurnThisEpoch_e8s = BigInt(Math.round(secondaryToBurnThisEpoch * Number(E8S)));
        let potentialPrimaryMintThisEpoch_e8s = (secondaryToBurnThisEpoch_e8s * primaryRewardForUnit_e8s) / initialSecondaryBurn_e8s;
        const remainingForSchedule_e8s = maxPrimaryFromSchedule_e8s - currentTotalPrimaryMintedFromSchedule_e8s;
        if (potentialPrimaryMintThisEpoch_e8s > remainingForSchedule_e8s) {
            potentialPrimaryMintThisEpoch_e8s = remainingForSchedule_e8s;
        }
        const actualPrimaryMintThisEpoch = Number(potentialPrimaryMintThisEpoch_e8s) / Number(E8S);
        if (actualPrimaryMintThisEpoch < 0)
            break;
        currentCumulativeSecondaryBurn = epochTargetCumulativeBurn;
        currentTotalPrimaryMintedFromSchedule_e8s += potentialPrimaryMintThisEpoch_e8s;
        currentTotalPrimaryMintedFromSchedule = Number(currentTotalPrimaryMintedFromSchedule_e8s) / Number(E8S);
        cumulativeSx.push(currentCumulativeSecondaryBurn);
        const currentTotalPrimary = Math.min(maxPrimarySupply, tgeAllocation + currentTotalPrimaryMintedFromSchedule);
        cumulativePy.push(currentTotalPrimary);
        cumulativeCostY.push(currentCumulativeSecondaryBurn * SECONDARY_BURN_USD_COST);
        epochLabels.push(`Epoch ${epoch}`);
        primaryMintedInEpochY.push(actualPrimaryMintThisEpoch);
        const nextPrimaryRewardForUnit_e8s = (primaryRewardForUnit_e8s * halvingStep_e8s) / 100n;
        primaryRewardForUnit_e8s = nextPrimaryRewardForUnit_e8s > 1n ? nextPrimaryRewardForUnit_e8s : 1n; // max(1, ...)
        const nextBurnUnitAmount = epochTargetCumulativeBurn * 2 - epochTargetCumulativeBurn; // This is the amount for the next epoch burn
        const nextEffectiveRate = (Number(primaryRewardForUnit_e8s) / Number(E8S)) / nextBurnUnitAmount;
        if (currentTotalPrimaryMintedFromSchedule >= maxPrimaryFromSchedule) {
            effectiveRateY.push(0);
        }
        else {
            effectiveRateY.push(initialSecondaryBurn > 0 ? (Number(primaryRewardForUnit_e8s) / Number(E8S)) / initialSecondaryBurn : 0);
        }
        epochTargetCumulativeBurn *= 2;
        epoch++;
        if (actualPrimaryMintThisEpoch === 0 && Number(potentialPrimaryMintThisEpoch_e8s) > 0) {
            if (cumulativePy[cumulativePy.length - 1] < maxPrimarySupply && cumulativeSx[cumulativeSx.length - 1] > 0) {
                const finalSecondaryBurnPoint = currentCumulativeSecondaryBurn + secondaryToBurnThisEpoch;
                cumulativeSx.push(finalSecondaryBurnPoint);
                cumulativePy.push(cumulativePy[cumulativePy.length - 1]);
                cumulativeCostY.push(finalSecondaryBurnPoint * SECONDARY_BURN_USD_COST);
                effectiveRateY.push(0);
            }
            break;
        }
    }
    const effectiveRateX = [...cumulativeSx];
    // The effective rate is how many primary you get PER secondary.
    // rate = reward_for_unit / unit_size
    const effectiveRateY_calc = [initialRewardPerBurnUnit / initialSecondaryBurn];
    let tempReward = initialRewardPerBurnUnit;
    for (let i = 0; i < epochLabels.length; i++) {
        const nextReward = Math.max(1 / Number(E8S), tempReward * halvingStep);
        const effectiveRate = initialSecondaryBurn > 0 ? nextReward / initialSecondaryBurn : 0;
        effectiveRateY_calc.push(effectiveRate);
        tempReward = nextReward;
    }
    while (effectiveRateY_calc.length < effectiveRateX.length)
        effectiveRateY_calc.push(effectiveRateY_calc[effectiveRateY_calc.length - 1] ?? 0);
    while (effectiveRateY_calc.length > effectiveRateX.length)
        effectiveRateY_calc.pop();
    if (cumulativeSx.length === 1 && cumulativePy.length === 1 && tgeAllocation > 0) {
        const placeholderSecondary = initialSecondaryBurn > 0 ? initialSecondaryBurn : 1000;
        cumulativeSx.push(placeholderSecondary);
        cumulativePy.push(cumulativePy[0]);
        cumulativeCostY.push(placeholderSecondary * SECONDARY_BURN_USD_COST);
        if (effectiveRateX.length === 1) {
            effectiveRateX.push(placeholderSecondary);
            effectiveRateY_calc.push(effectiveRateY_calc[0]);
        }
    }
    let finalCumulativePyForCost = [...cumulativePy];
    let finalCumulativeCostY = [...cumulativeCostY];
    if (tgeAllocation > 0 && cumulativePy[0] === tgeAllocation && cumulativeCostY[0] === 0 && cumulativePy.length > 1) {
    }
    else if (tgeAllocation > 0 && cumulativePy.length === 1) {
        finalCumulativePyForCost = [0, tgeAllocation];
        finalCumulativeCostY = [0, 0];
    }
    else if (tgeAllocation === 0 && cumulativePy.length === 1) {
        finalCumulativePyForCost = finalCumulativePyForCost.length === 1 ? [0, 1] : finalCumulativePyForCost;
        finalCumulativePyForCost = finalCumulativePyForCost.length === 0 ? [0, 1] : finalCumulativePyForCost;
        finalCumulativeCostY = finalCumulativePyForCost.map(_ => 0);
    }
    let cumulativePercentageSupplyY = [];
    if (maxPrimarySupply > 0) {
        cumulativePercentageSupplyY = finalCumulativePyForCost.map(minted => parseFloat(((minted / maxPrimarySupply) * 100).toFixed(2)));
    }
    else {
        cumulativePercentageSupplyY = finalCumulativePyForCost.map(_ => 0);
    }
    const costPerPrimaryTokenY = effectiveRateY_calc.map(rate => rate > 0 ? (SECONDARY_BURN_USD_COST / rate) : null);
    const costToMintXAxis = [];
    const costToMintYAxis = [];
    if (cumulativePy && cumulativePy.length > 0) {
        // TGE part has zero cost
        costToMintXAxis.push(0);
        costToMintYAxis.push(0);
        costToMintXAxis.push(cumulativePy[0]);
        costToMintYAxis.push(0);
        for (let i = 0; i < cumulativePy.length - 1; i++) {
            const cost = costPerPrimaryTokenY[i];
            // Step up to new cost
            costToMintXAxis.push(cumulativePy[i]);
            costToMintYAxis.push(cost);
            // Horizontal line at new cost for the duration of the epoch
            costToMintXAxis.push(cumulativePy[i + 1]);
            costToMintYAxis.push(cost);
        }
    }
    return {
        cumulativeSupplyData: { xAxis: cumulativeSx, yAxis: cumulativePy.map(v => Math.min(v, maxPrimarySupply)) },
        mintedPerEpochData: { xAxis: epochLabels, yAxis: primaryMintedInEpochY },
        effectiveMintRateData: { xAxis: effectiveRateX, yAxis: effectiveRateY_calc },
        cumulativeUsdCostData: { xAxis: finalCumulativePyForCost, yAxis: finalCumulativeCostY },
        cumulativePercentageSupplyData: { xAxis: finalCumulativePyForCost, yAxis: cumulativePercentageSupplyY },
        costToMintData: { xAxis: costToMintXAxis, yAxis: costToMintYAxis },
    };
};
const TokenomicsGraphs = ({ primaryMaxSupply, tgeAllocation, initialSecondaryBurn, halvingStep, initialRewardPerBurnUnit, }) => {
    const { cumulativeSupplyData, mintedPerEpochData, effectiveMintRateData, cumulativeUsdCostData, cumulativePercentageSupplyData, costToMintData, summaryData, } = useMemo(() => {
        const data = generateTokenomicsScheduleData(primaryMaxSupply, tgeAllocation, initialSecondaryBurn.toString(), halvingStep, initialRewardPerBurnUnit.toString());
        const summary = {
            epochs: data.mintedPerEpochData.yAxis.length,
            totalMintingValuation: data.cumulativeUsdCostData.yAxis[data.cumulativeUsdCostData.yAxis.length - 1] || 0,
            initialMintCost: data.costToMintData?.yAxis.find(cost => cost && cost > 0) || 0,
            finalMintCost: [...(data.costToMintData?.yAxis || [])].reverse().find(cost => cost && cost > 0) || 0,
            tgePercentage: parseFloat(primaryMaxSupply) > 0 ? parseFloat(((parseFloat(tgeAllocation) / parseFloat(primaryMaxSupply)) * 100).toFixed(2)) : 0,
        };
        return { ...data, summaryData: summary };
    }, [primaryMaxSupply, tgeAllocation, initialSecondaryBurn, halvingStep, initialRewardPerBurnUnit]);
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
            const effectiveRate = effectiveMintRateData.yAxis[i + 1] || 0;
            const costPerToken = effectiveRate > 0 ? (SECONDARY_BURN_USD_COST / effectiveRate) : 0;
            const cumulativeCost = (cumulativeSupplyData.xAxis[i + 1] || 0) * SECONDARY_BURN_USD_COST;
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
    const hasMeaningfulInput = parseFloat(primaryMaxSupply) > 0 || parseFloat(tgeAllocation) > 0 || parseFloat(initialSecondaryBurn) > 0;
    if (!hasMeaningfulInput) {
        return React.createElement("div", { className: "text-center p-4 text-gray-500" }, "Enter tokenomic parameters above to see the projected graphs.");
    }
    const graphTitleBaseClass = "text-xl font-medium w-full";
    const isDarkMode = false;
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "mb-8 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800" },
            React.createElement("h3", { className: "text-xl font-semibold mb-4 text-center text-gray-900 dark:text-white" }, "Key Metrics Summary"),
            React.createElement("div", { className: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-center" },
                React.createElement("div", { className: "p-2 bg-gray-100 dark:bg-gray-700 rounded-md" },
                    React.createElement("p", { className: "text-sm text-gray-500 dark:text-gray-400" }, "Minting Epochs"),
                    React.createElement("p", { className: "text-lg font-bold text-gray-900 dark:text-white" }, summaryData?.epochs)),
                React.createElement("div", { className: "p-2 bg-gray-100 dark:bg-gray-700 rounded-md" },
                    React.createElement("p", { className: "text-sm text-gray-500 dark:text-gray-400" }, "TGE Allocation"),
                    React.createElement("p", { className: "text-lg font-bold text-gray-900 dark:text-white" },
                        summaryData?.tgePercentage,
                        "%")),
                React.createElement("div", { className: "p-2 bg-gray-100 dark:bg-gray-700 rounded-md" },
                    React.createElement("p", { className: "text-sm text-gray-500 dark:text-gray-400" }, "Initial Mint Cost"),
                    React.createElement("p", { className: "text-lg font-bold text-gray-900 dark:text-white" },
                        "$",
                        summaryData?.initialMintCost?.toFixed(4))),
                React.createElement("div", { className: "p-2 bg-gray-100 dark:bg-gray-700 rounded-md" },
                    React.createElement("p", { className: "text-sm text-gray-500 dark:text-gray-400" }, "Final Mint Cost"),
                    React.createElement("p", { className: "text-lg font-bold text-gray-900 dark:text-white" },
                        "$",
                        summaryData?.finalMintCost?.toFixed(4))),
                React.createElement("div", { className: "p-2 bg-gray-100 dark:bg-gray-700 rounded-md col-span-2 md:col-span-1 lg:col-span-1" },
                    React.createElement("p", { className: "text-sm text-gray-500 dark:text-gray-400" }, "Total Minting Valuation"),
                    React.createElement("p", { className: "text-lg font-bold text-gray-900 dark:text-white" },
                        "$",
                        summaryData?.totalMintingValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))))),
        React.createElement("div", { className: "space-y-8 mt-10 md:grid md:grid-cols-2 md:gap-x-8 md:space-y-0" },
            React.createElement("div", { className: "md:mb-8" },
                React.createElement("div", { className: "flex items-center mb-2" },
                    React.createElement("h3", { className: `${graphTitleBaseClass} ${isDarkMode ? 'text-white' : 'text-gray-900'}` }, "Cumulative Primary Supply vs. Burn"),
                    React.createElement(TooltipIcon, { text: "This graph shows the total amount of Primary Token that will be minted as more Secondary Tokens are burned. Look for how quickly the supply hard cap is reached. A steeper curve means faster minting in early stages. The line flattens when the supply Hard Cap is hit." })),
                React.createElement(LineChart, { dataXaxis: cumulativeSupplyData.xAxis, dataYaxis: cumulativeSupplyData.yAxis, xAxisLabel: "Cumulative Secondary Tokens Burned", yAxisLabel: "Cumulative Primary Tokens Minted", lineColor: "#8884d8", gardientColor: "rgba(136, 132, 216, 0.3)", dataYaxis2: effectiveMintRateData?.yAxis, yAxisLabel2: "Effective Mint Rate", lineColor2: "#ffc658" })),
            React.createElement("div", { className: "md:mb-8" },
                React.createElement("div", { className: "flex items-center mb-2" },
                    React.createElement("h3", { className: `${graphTitleBaseClass} ${isDarkMode ? 'text-white' : 'text-gray-900'}` }, "Primary Tokens Minted per Epoch"),
                    React.createElement(TooltipIcon, { text: "This chart displays how many new Primary Tokens are created at each burn epoch. Typically, earlier epochs (left) will mint more tokens than later epochs (right), showing that early burners are rewarded more. A rapid decrease indicates a faster reduction in minting rewards per epoch." })),
                React.createElement(LineChart, { dataXaxis: mintedPerEpochData.xAxis.length > 0 ? mintedPerEpochData.xAxis : ["N/A"], dataYaxis: mintedPerEpochData.yAxis.length > 0 ? mintedPerEpochData.yAxis : [0], xAxisLabel: "Burn Epoch", yAxisLabel: "Primary Tokens Minted in Epoch", lineColor: "#82ca9d", gardientColor: "rgba(130, 202, 157, 0.3)" })),
            React.createElement("div", null,
                React.createElement("div", { className: "flex items-center mb-2" },
                    React.createElement("h3", { className: `${graphTitleBaseClass} ${isDarkMode ? 'text-white' : 'text-gray-900'}` }, "Cost to Mint One Primary Token vs. Total Supply Minted"),
                    React.createElement(TooltipIcon, { text: "This graph shows the 'price' to create one new Primary Token by burning Secondary Tokens. Notice how the cost jumps up at each stage (or 'epoch'). This increasing cost is what makes it more rewarding for early participants to mint tokens." })),
                React.createElement(LineChart, { dataXaxis: costToMintData?.xAxis, dataYaxis: costToMintData?.yAxis, xAxisLabel: "Cumulative Primary Tokens Minted", yAxisLabel: "USD Cost per Primary Token ($)", lineColor: "#4CAF50", gardientColor: "rgba(76, 175, 80, 0.3)" })),
            React.createElement("div", null,
                React.createElement("div", { className: "flex items-center mb-2" },
                    React.createElement("h3", { className: `${graphTitleBaseClass} ${isDarkMode ? 'text-white' : 'text-gray-900'}` }, "Minting Valuation vs. Primary Minted"),
                    React.createElement(TooltipIcon, { text: "Assuming each Secondary Token burned costs $0.005 (half a cent), this graph projects the total USD expenditure needed to mint a certain amount of Primary Tokens through the burning schedule. The cost of initially allocated Primary Tokens is considered $0 in this projection." })),
                React.createElement(LineChart, { dataXaxis: cumulativeUsdCostData.xAxis, dataYaxis: cumulativeUsdCostData.yAxis, xAxisLabel: "Cumulative Primary Tokens Minted", yAxisLabel: "Minting Valuation ($)", lineColor: "#FA8072", gardientColor: "rgba(250, 128, 114, 0.3)", dataYaxis2: cumulativePercentageSupplyData.yAxis, yAxisLabel2: "Supply Minted (%)", lineColor2: "#00BCD4", yAxis2format: "percent" }))),
        React.createElement("div", { className: "text-center mt-8" },
            React.createElement("button", { onClick: handleCopyData, className: "px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition" }, "Copy Table Data"),
            copySuccess && React.createElement("span", { className: "ml-4 text-green-500 dark:text-green-400" }, "Copied!"))));
};
export default TokenomicsGraphs;
