#!/usr/bin/env node

/**
 * Token Data Comparison Script
 * Compares actual token performance vs. theoretical projections
 */

const fs = require('fs');
const path = require('path');

// Read data files
const insightsPath = path.join(__dirname, '../data/zero_insights_data.md');
const tokenomicsPath = path.join(__dirname, '../data/zero_tokenomics_data.md');

const insightsData = JSON.parse(fs.readFileSync(insightsPath, 'utf8'));
const tokenomicsData = JSON.parse(fs.readFileSync(tokenomicsPath, 'utf8'));

// Helper: Linear interpolation
function interpolate(x, x1, y1, x2, y2) {
  if (x <= x1) return y1;
  if (x >= x2) return y2;
  const ratio = (x - x1) / (x2 - x1);
  return y1 + ratio * (y2 - y1);
}

// Helper: Find interpolated value from projection curve
function getProjectedValue(actualX, projectionXArray, projectionYArray) {
  // Find the two points that bracket our actual value
  for (let i = 0; i < projectionXArray.length - 1; i++) {
    if (actualX >= projectionXArray[i] && actualX <= projectionXArray[i + 1]) {
      return interpolate(
        actualX,
        projectionXArray[i],
        projectionYArray[i],
        projectionXArray[i + 1],
        projectionYArray[i + 1]
      );
    }
  }
  // If outside range, return nearest endpoint
  if (actualX < projectionXArray[0]) return projectionYArray[0];
  return projectionYArray[projectionYArray.length - 1];
}

// Helper: Calculate variance percentage
function variance(actual, expected) {
  if (expected === 0) return actual === 0 ? 0 : Infinity;
  return ((actual - expected) / expected) * 100;
}

// Helper: Format number
function formatNum(num, decimals = 2) {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║         TOKEN SETUP VALIDATION: ACTUAL vs PROJECTED          ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Extract actual values from insights summary
const actual = insightsData.summary;

console.log('📊 ACTUAL VALUES (from blockchain data)');
console.log('─────────────────────────────────────────────────────────────────');
console.log(`Primary Token Supply:     ${formatNum(actual.primaryTokenSupply)} tokens`);
console.log(`Secondary Token Supply:   ${formatNum(actual.secondaryTokenSupply)} tokens`);
console.log(`Total Secondary Burned:   ${formatNum(actual.totalSecondaryBurned)} tokens`);
console.log(`Total Primary Staked:     ${formatNum(actual.totalPrimaryStaked)} tokens`);
console.log(`Staker Count:             ${actual.stakerCount}`);
console.log(`Hourly ICP Rewards:       ${formatNum(actual.hourlyIcpRewards, 6)} ICP\n`);

// COMPARISON 1: Cumulative Supply (Primary Minted at Current Burn Level)
console.log('═══════════════════════════════════════════════════════════════');
console.log('🎯 COMPARISON 1: CUMULATIVE SUPPLY CURVE');
console.log('═══════════════════════════════════════════════════════════════\n');

const projection = tokenomicsData.graphs.cumulativeSupply;
const actualBurned = actual.totalSecondaryBurned;
const actualMinted = actual.primaryTokenSupply;

const expectedMinted = getProjectedValue(
  actualBurned,
  projection.xAxis,
  projection.yAxis
);

const supplyVariance = variance(actualMinted, expectedMinted);

console.log(`Secondary Burned (Actual):    ${formatNum(actualBurned)} tokens`);
console.log(`Primary Minted (Actual):      ${formatNum(actualMinted)} tokens`);
console.log(`Primary Minted (Expected):    ${formatNum(expectedMinted)} tokens`);
console.log(`Variance:                     ${formatNum(supplyVariance, 2)}%`);

if (Math.abs(supplyVariance) < 5) {
  console.log(`✅ PASS: Variance within acceptable range (<5%)\n`);
} else {
  console.log(`❌ FAIL: Variance exceeds acceptable range (≥5%)\n`);
}

// COMPARISON 2: Burn-to-Mint Ratio
console.log('═══════════════════════════════════════════════════════════════');
console.log('🎯 COMPARISON 2: BURN-TO-MINT RATIO');
console.log('═══════════════════════════════════════════════════════════════\n');

const actualRatio = actualBurned / actualMinted;
const expectedRatio = expectedMinted > 0 ? actualBurned / expectedMinted : 0;

console.log(`Actual Ratio:    ${formatNum(actualRatio, 4)} secondary per primary`);
console.log(`Expected Ratio:  ${formatNum(expectedRatio, 4)} secondary per primary`);

const ratioVariance = variance(actualRatio, expectedRatio);
console.log(`Variance:        ${formatNum(ratioVariance, 2)}%`);

if (Math.abs(ratioVariance) < 5) {
  console.log(`✅ PASS: Ratio matches expected halving mechanics\n`);
} else {
  console.log(`❌ FAIL: Ratio deviates from expected halving mechanics\n`);
}

// COMPARISON 3: Staking Participation
console.log('═══════════════════════════════════════════════════════════════');
console.log('🎯 COMPARISON 3: STAKING PARTICIPATION');
console.log('═══════════════════════════════════════════════════════════════\n');

const stakingRatio = (actual.totalPrimaryStaked / actual.primaryTokenSupply) * 100;

console.log(`Total Staked:        ${formatNum(actual.totalPrimaryStaked)} tokens`);
console.log(`Total Supply:        ${formatNum(actual.primaryTokenSupply)} tokens`);
console.log(`Staking Ratio:       ${formatNum(stakingRatio, 2)}%`);
console.log(`Staker Count:        ${actual.stakerCount}`);
console.log(`Avg Stake per User:  ${formatNum(actual.totalPrimaryStaked / actual.stakerCount)} tokens\n`);

// COMPARISON 4: Cost Analysis
console.log('═══════════════════════════════════════════════════════════════');
console.log('🎯 COMPARISON 4: COST TO MINT ANALYSIS');
console.log('═══════════════════════════════════════════════════════════════\n');

const costProjection = tokenomicsData.graphs.costToMint;
const expectedCostPerToken = getProjectedValue(
  actualMinted,
  costProjection.xAxis,
  costProjection.yAxis
);

const cumulativeCostProjection = tokenomicsData.graphs.cumulativeUsdCost;
const expectedCumulativeCost = getProjectedValue(
  actualMinted,
  cumulativeCostProjection.xAxis,
  cumulativeCostProjection.yAxis
);

console.log(`Current Primary Supply:       ${formatNum(actualMinted)} tokens`);
console.log(`Expected Cost per Token:      $${formatNum(expectedCostPerToken, 6)}`);
console.log(`Expected Cumulative Cost:     $${formatNum(expectedCumulativeCost, 2)}`);
console.log(`Average Cost per Token:       $${formatNum(expectedCumulativeCost / actualMinted, 6)}\n`);

// SUMMARY
console.log('═══════════════════════════════════════════════════════════════');
console.log('📋 SUMMARY & RECOMMENDATIONS');
console.log('═══════════════════════════════════════════════════════════════\n');

const allTestsPassed = Math.abs(supplyVariance) < 5 && Math.abs(ratioVariance) < 5;

if (allTestsPassed) {
  console.log('✅ TOKEN SETUP VALIDATION: PASSED');
  console.log('\nYour dual-token system is working as designed:');
  console.log('  • Cumulative supply matches projection');
  console.log('  • Burn-to-mint ratio follows halving mechanics');
  console.log('  • Token distribution is functioning correctly');
  console.log('\n🎉 The tokenomics implementation appears accurate!\n');
} else {
  console.log('⚠️  TOKEN SETUP VALIDATION: NEEDS REVIEW');
  console.log('\nDiscrepancies detected:');
  if (Math.abs(supplyVariance) >= 5) {
    console.log(`  • Supply variance (${formatNum(supplyVariance, 2)}%) exceeds threshold`);
  }
  if (Math.abs(ratioVariance) >= 5) {
    console.log(`  • Ratio variance (${formatNum(ratioVariance, 2)}%) exceeds threshold`);
  }
  console.log('\n🔍 Recommended actions:');
  console.log('  • Review halving_step implementation in tokenomics canister');
  console.log('  • Verify epoch threshold calculations');
  console.log('  • Check burn unit progression logic');
  console.log('  • Examine initial_reward_per_burn_unit application\n');
}

console.log('─────────────────────────────────────────────────────────────────\n');
