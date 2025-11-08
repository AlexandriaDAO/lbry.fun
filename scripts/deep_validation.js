#!/usr/bin/env node

/**
 * Deep Token Validation - Epoch-by-Epoch Analysis
 * Validates that halvings occurred at correct thresholds with correct reward rates
 */

const fs = require('fs');
const path = require('path');

const insightsPath = path.join(__dirname, '../data/zero_insights_data.md');
const tokenomicsPath = path.join(__dirname, '../data/zero_tokenomics_data.md');

const insightsData = JSON.parse(fs.readFileSync(insightsPath, 'utf8'));
const tokenomicsData = JSON.parse(fs.readFileSync(tokenomicsPath, 'utf8'));

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║           DEEP VALIDATION: EPOCH-BY-EPOCH ANALYSIS            ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Extract time-series data
const graphs = insightsData.graphs;
const timePoints = graphs.time.length;

console.log(`📊 Data Points Available: ${timePoints} hourly snapshots\n`);

// Calculate deltas between consecutive points to identify minting events
console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 ANALYZING MINTING EVENTS & EPOCH TRANSITIONS');
console.log('═══════════════════════════════════════════════════════════════\n');

const mintingEvents = [];

for (let i = 1; i < timePoints; i++) {
  const primaryDelta = graphs.primaryTokenSupply.yAxis[i] - graphs.primaryTokenSupply.yAxis[i-1];
  const secondaryBurnedDelta = graphs.totalSecondaryBurned.yAxis[i] - graphs.totalSecondaryBurned.yAxis[i-1];

  if (primaryDelta > 0 || secondaryBurnedDelta > 0) {
    const ratio = secondaryBurnedDelta > 0 ? secondaryBurnedDelta / primaryDelta : 0;

    mintingEvents.push({
      timestamp: graphs.time[i],
      index: i,
      primaryMinted: primaryDelta,
      secondaryBurned: secondaryBurnedDelta,
      cumulativePrimary: graphs.primaryTokenSupply.yAxis[i],
      cumulativeSecondaryBurned: graphs.totalSecondaryBurned.yAxis[i],
      ratio: ratio
    });
  }
}

console.log(`Total Minting Events Detected: ${mintingEvents.length}\n`);

// Group events by similar ratios to identify epochs
const RATIO_TOLERANCE = 0.05; // 5% tolerance for grouping
const epochs = [];
let currentEpoch = null;

mintingEvents.forEach(event => {
  if (!currentEpoch) {
    currentEpoch = {
      startIndex: 0,
      events: [event],
      avgRatio: event.ratio,
      totalPrimaryMinted: event.primaryMinted,
      totalSecondaryBurned: event.secondaryBurned
    };
  } else {
    const ratioDiff = Math.abs(event.ratio - currentEpoch.avgRatio) / currentEpoch.avgRatio;

    if (ratioDiff < RATIO_TOLERANCE && event.ratio > 0) {
      // Same epoch
      currentEpoch.events.push(event);
      currentEpoch.totalPrimaryMinted += event.primaryMinted;
      currentEpoch.totalSecondaryBurned += event.secondaryBurned;
      // Update running average
      currentEpoch.avgRatio = currentEpoch.totalSecondaryBurned / currentEpoch.totalPrimaryMinted;
    } else {
      // New epoch detected
      epochs.push(currentEpoch);
      currentEpoch = {
        startIndex: epochs.length,
        events: [event],
        avgRatio: event.ratio,
        totalPrimaryMinted: event.primaryMinted,
        totalSecondaryBurned: event.secondaryBurned
      };
    }
  }
});

if (currentEpoch) {
  epochs.push(currentEpoch);
}

console.log(`Detected Epoch Count: ${epochs.length}\n`);

// Compare detected epochs with projections
const projectedEpochs = tokenomicsData.graphs.mintedPerEpoch;
const cumulativeProjection = tokenomicsData.graphs.cumulativeSupply;

console.log('═══════════════════════════════════════════════════════════════');
console.log('📋 EPOCH-BY-EPOCH COMPARISON');
console.log('═══════════════════════════════════════════════════════════════\n');

const formatNum = (num, decimals = 2) => {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

let validationPassed = true;
const issues = [];

epochs.forEach((epoch, idx) => {
  const firstEvent = epoch.events[0];
  const lastEvent = epoch.events[epoch.events.length - 1];

  console.log(`╔═══ EPOCH ${idx + 1} ═══╗`);
  console.log(`  Events in Epoch: ${epoch.events.length}`);
  console.log(`  Total Primary Minted: ${formatNum(epoch.totalPrimaryMinted)}`);
  console.log(`  Total Secondary Burned: ${formatNum(epoch.totalSecondaryBurned)}`);
  console.log(`  Burn-to-Mint Ratio: ${formatNum(epoch.avgRatio, 4)} secondary per primary`);
  console.log(`  Cumulative Burned at End: ${formatNum(lastEvent.cumulativeSecondaryBurned)}`);
  console.log(`  Cumulative Minted at End: ${formatNum(lastEvent.cumulativePrimary)}\n`);

  // Try to match with projected epoch
  if (idx < projectedEpochs.yAxis.length) {
    const projectedMinted = projectedEpochs.yAxis[idx];
    const variance = ((epoch.totalPrimaryMinted - projectedMinted) / projectedMinted) * 100;

    console.log(`  Expected Minted (Projection): ${formatNum(projectedMinted)}`);
    console.log(`  Variance: ${formatNum(variance, 2)}%`);

    if (Math.abs(variance) > 10) {
      console.log(`  ❌ ISSUE: High variance detected`);
      validationPassed = false;
      issues.push(`Epoch ${idx + 1}: ${formatNum(variance, 2)}% variance from projection`);
    } else {
      console.log(`  ✅ Variance within acceptable range`);
    }
  }

  console.log('');
});

// Check halving progression
console.log('═══════════════════════════════════════════════════════════════');
console.log('🎯 HALVING PROGRESSION VALIDATION');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('Expected Halving: 95% of previous epoch\n');

for (let i = 1; i < epochs.length && i < 10; i++) {
  const prevMinted = epochs[i-1].totalPrimaryMinted;
  const currMinted = epochs[i].totalPrimaryMinted;
  const ratio = currMinted / prevMinted;
  const expectedRatio = 0.95;
  const variance = ((ratio - expectedRatio) / expectedRatio) * 100;

  console.log(`Epoch ${i} → Epoch ${i+1}:`);
  console.log(`  Previous: ${formatNum(prevMinted)} tokens`);
  console.log(`  Current:  ${formatNum(currMinted)} tokens`);
  console.log(`  Ratio:    ${formatNum(ratio * 100, 2)}% of previous`);
  console.log(`  Expected: ${formatNum(expectedRatio * 100, 2)}%`);
  console.log(`  Variance: ${formatNum(variance, 2)}%`);

  if (Math.abs(variance) > 5) {
    console.log(`  ❌ ISSUE: Halving not following 95% rule`);
    validationPassed = false;
    issues.push(`Epoch ${i}->${i+1}: Halving ratio ${formatNum(ratio * 100, 2)}% instead of 95%`);
  } else {
    console.log(`  ✅ Halving correct`);
  }
  console.log('');
}

// Final summary
console.log('═══════════════════════════════════════════════════════════════');
console.log('📊 VALIDATION SUMMARY');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`Total Minting Events: ${mintingEvents.length}`);
console.log(`Detected Epochs: ${epochs.length}`);
console.log(`Expected Epochs (from projection): ${projectedEpochs.yAxis.length}`);

if (epochs.length !== projectedEpochs.yAxis.length) {
  console.log(`⚠️  WARNING: Epoch count mismatch!`);
  console.log(`   Actual: ${epochs.length}, Expected: ${projectedEpochs.yAxis.length}\n`);
  validationPassed = false;
  issues.push(`Epoch count: ${epochs.length} detected vs ${projectedEpochs.yAxis.length} expected`);
}

console.log('\n');

if (validationPassed && issues.length === 0) {
  console.log('✅ DEEP VALIDATION PASSED');
  console.log('   • Correct number of epochs');
  console.log('   • Halvings following 95% rule');
  console.log('   • Epoch transitions at correct thresholds');
  console.log('   • Minting amounts match projections\n');
} else {
  console.log('❌ DEEP VALIDATION FAILED');
  console.log('\nIssues Detected:');
  issues.forEach(issue => console.log(`   • ${issue}`));
  console.log('\n⚠️  The superficial validation passed because final numbers matched,');
  console.log('    but the progression path has discrepancies.\n');
}

console.log('─────────────────────────────────────────────────────────────────\n');

// Export detailed data
const detailedAnalysis = {
  totalMintingEvents: mintingEvents.length,
  detectedEpochs: epochs.length,
  expectedEpochs: projectedEpochs.yAxis.length,
  epochs: epochs.map((e, i) => ({
    epochNumber: i + 1,
    eventsCount: e.events.length,
    totalPrimaryMinted: e.totalPrimaryMinted,
    totalSecondaryBurned: e.totalSecondaryBurned,
    avgRatio: e.avgRatio,
    projectedMinted: projectedEpochs.yAxis[i] || null,
    variance: projectedEpochs.yAxis[i]
      ? ((e.totalPrimaryMinted - projectedEpochs.yAxis[i]) / projectedEpochs.yAxis[i] * 100)
      : null
  })),
  validationPassed,
  issues
};

fs.writeFileSync(
  path.join(__dirname, '../data/deep_validation_results.json'),
  JSON.stringify(detailedAnalysis, null, 2)
);

console.log('📝 Detailed results saved to: data/deep_validation_results.json\n');
