#!/usr/bin/env node

/**
 * Autonomous Tokenomics Data Collection Script
 * Collects data from preview_tokenomics_graphs for all test scenarios
 */

const { Actor, HttpAgent } = require('@dfinity/agent');
const { Principal } = require('@dfinity/principal');
const fs = require('fs').promises;
const path = require('path');

// Import the candid interface
const { idlFactory } = require('./src/declarations/lbry_fun');

// Configuration
const LOCAL_HOST = 'http://localhost:4943';
const LBRY_FUN_CANISTER_ID = process.env.CANISTER_ID_LBRY_FUN || 'be2us-64aaa-aaaaa-qaabq-cai'; // Update after deployment

// E8S constant (1 token = 100,000,000 e8s)
const E8S = 100000000;

// Test configurations
const TEST_SETS = {
  A: {
    description: 'Halving Step Impact Analysis',
    fixed: {
      primary_max_supply: 1000000 * E8S,
      tge_allocation: 1 * E8S,
      initial_secondary_burn: 1000000 * E8S,
      initial_reward_per_burn_unit: 20000 * E8S,
    },
    variable: 'halving_step',
    values: [25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90]
  },
  B: {
    description: 'Burn Unit Scaling',
    fixed: {
      primary_max_supply: 1000000 * E8S,
      tge_allocation: 1 * E8S,
      halving_step: 50,
      initial_reward_per_burn_unit: 20000 * E8S,
    },
    variable: 'initial_secondary_burn',
    values: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000].map(v => v * E8S)
  },
  C: {
    description: 'Supply/Reward Ratio Testing',
    tests: [
      { id: 'C1', primary_max_supply: 100000 * E8S, initial_secondary_burn: 1000000 * E8S, initial_reward_per_burn_unit: 50000 * E8S, halving_step: 50, tge_allocation: 1 * E8S },
      { id: 'C2', primary_max_supply: 100000 * E8S, initial_secondary_burn: 1000000 * E8S, initial_reward_per_burn_unit: 1000 * E8S, halving_step: 50, tge_allocation: 1 * E8S },
      { id: 'C3', primary_max_supply: 10000000 * E8S, initial_secondary_burn: 1000000 * E8S, initial_reward_per_burn_unit: 1000 * E8S, halving_step: 50, tge_allocation: 1 * E8S },
      { id: 'C4', primary_max_supply: 10000000 * E8S, initial_secondary_burn: 1000000 * E8S, initial_reward_per_burn_unit: 100000 * E8S, halving_step: 50, tge_allocation: 1 * E8S },
      { id: 'C5', primary_max_supply: 1000000 * E8S, initial_secondary_burn: 1000000 * E8S, initial_reward_per_burn_unit: 1 * E8S, halving_step: 50, tge_allocation: 1 * E8S },
      { id: 'C6', primary_max_supply: 1000000 * E8S, initial_secondary_burn: 100 * E8S, initial_reward_per_burn_unit: 1000000 * E8S, halving_step: 50, tge_allocation: 1 * E8S },
    ]
  },
  D: {
    description: 'Edge Cases',
    tests: [
      { id: 'D1', primary_max_supply: 1000 * E8S, initial_secondary_burn: 100 * E8S, initial_reward_per_burn_unit: 1000 * E8S, halving_step: 25, tge_allocation: 1 * E8S },
      { id: 'D2', primary_max_supply: 10000000 * E8S, initial_secondary_burn: 10000000 * E8S, initial_reward_per_burn_unit: 1000000 * E8S, halving_step: 90, tge_allocation: 1 * E8S },
      { id: 'D3', primary_max_supply: 1000000 * E8S, initial_secondary_burn: 1000000 * E8S, initial_reward_per_burn_unit: 20000 * E8S, halving_step: 50, tge_allocation: 999999 * E8S },
      { id: 'D4', primary_max_supply: 1000000 * E8S, initial_secondary_burn: 100 * E8S, initial_reward_per_burn_unit: 20000 * E8S, halving_step: 99, tge_allocation: 1 * E8S },
      { id: 'D5', primary_max_supply: 1000000 * E8S, initial_secondary_burn: 20000000 * E8S, initial_reward_per_burn_unit: 100000 * E8S, halving_step: 25, tge_allocation: 1 * E8S },
    ]
  }
};

async function createActor() {
  const agent = new HttpAgent({ host: LOCAL_HOST });
  
  // Fetch root key for local development
  await agent.fetchRootKey();
  
  return Actor.createActor(idlFactory, {
    agent,
    canisterId: LBRY_FUN_CANISTER_ID,
  });
}

function processGraphData(graphData, testId, params) {
  const results = [];
  
  // Add TGE row
  const tgeAmount = Number(params.tge_allocation) / E8S;
  const tgePercentage = (tgeAmount / (Number(params.primary_max_supply) / E8S)) * 100;
  
  results.push({
    test_id: testId,
    epoch: 'TGE',
    cumulative_secondary_burned: 0,
    cumulative_primary_minted: tgeAmount,
    primary_minted_in_epoch: tgeAmount,
    usd_cost_per_token: graphData.cost_to_mint_data_y[0] || 0,
    cumulative_usd_cost: 0,
    supply_minted_pct: tgePercentage
  });
  
  // Process epoch data
  for (let i = 0; i < graphData.minted_per_epoch_data_x.length; i++) {
    const epochLabel = graphData.minted_per_epoch_data_x[i];
    const secondaryBurned = Number(graphData.cumulative_supply_data_x[i]) / E8S;
    const cumulativePrimary = Number(graphData.cumulative_supply_data_y[i]) / E8S;
    const mintedInEpoch = Number(graphData.minted_per_epoch_data_y[i]) / E8S;
    const costPerToken = graphData.cost_to_mint_data_y[i];
    const cumulativeUsdCost = graphData.cumulative_usd_cost_data_y[i];
    const supplyPercentage = (cumulativePrimary / (Number(params.primary_max_supply) / E8S)) * 100;
    
    results.push({
      test_id: testId,
      epoch: epochLabel,
      cumulative_secondary_burned: secondaryBurned,
      cumulative_primary_minted: cumulativePrimary,
      primary_minted_in_epoch: mintedInEpoch,
      usd_cost_per_token: costPerToken,
      cumulative_usd_cost: cumulativeUsdCost,
      supply_minted_pct: supplyPercentage
    });
  }
  
  return results;
}

async function collectTestSetA(actor) {
  console.log('Collecting Test Set A: Halving Step Impact...');
  const results = [];
  
  for (let i = 0; i < TEST_SETS.A.values.length; i++) {
    const halvingStep = TEST_SETS.A.values[i];
    const testId = `A${i + 1}`;
    
    const params = {
      ...TEST_SETS.A.fixed,
      halving_step: halvingStep
    };
    
    try {
      const graphData = await actor.preview_tokenomics_graphs(params);
      const processedData = processGraphData(graphData, testId, params);
      results.push(...processedData);
      console.log(`✓ ${testId}: Halving ${halvingStep}% - ${processedData.length - 1} epochs`);
    } catch (error) {
      console.error(`✗ ${testId}: Error - ${error.message}`);
    }
  }
  
  return results;
}

async function collectTestSetB(actor) {
  console.log('\\nCollecting Test Set B: Burn Unit Scaling...');
  const results = [];
  
  for (let i = 0; i < TEST_SETS.B.values.length; i++) {
    const burnUnit = TEST_SETS.B.values[i];
    const testId = `B${i + 1}`;
    
    const params = {
      ...TEST_SETS.B.fixed,
      initial_secondary_burn: burnUnit
    };
    
    try {
      const graphData = await actor.preview_tokenomics_graphs(params);
      const processedData = processGraphData(graphData, testId, params);
      const initialValuation = (burnUnit / E8S) * 0.005;
      results.push(...processedData);
      console.log(`✓ ${testId}: Burn ${burnUnit / E8S} - Initial valuation: $${initialValuation.toFixed(2)}`);
    } catch (error) {
      console.error(`✗ ${testId}: Error - ${error.message}`);
    }
  }
  
  return results;
}

async function collectTestSetC(actor) {
  console.log('\\nCollecting Test Set C: Supply/Reward Ratios...');
  const results = [];
  
  for (const test of TEST_SETS.C.tests) {
    try {
      const graphData = await actor.preview_tokenomics_graphs(test);
      const processedData = processGraphData(graphData, test.id, test);
      results.push(...processedData);
      console.log(`✓ ${test.id}: ${processedData.length - 1} epochs`);
    } catch (error) {
      console.error(`✗ ${test.id}: Error - ${error.message}`);
    }
  }
  
  return results;
}

async function collectTestSetD(actor) {
  console.log('\\nCollecting Test Set D: Edge Cases...');
  const results = [];
  
  for (const test of TEST_SETS.D.tests) {
    try {
      const graphData = await actor.preview_tokenomics_graphs(test);
      const processedData = processGraphData(graphData, test.id, test);
      results.push(...processedData);
      console.log(`✓ ${test.id}: ${processedData.length - 1} epochs`);
    } catch (error) {
      console.error(`✗ ${test.id}: Error - ${error.message}`);
    }
  }
  
  return results;
}

async function saveResults(results) {
  const outputDir = path.join(__dirname, 'tokenomics_data');
  await fs.mkdir(outputDir, { recursive: true });
  
  // Save as JSON
  const jsonPath = path.join(outputDir, 'collected_data.json');
  await fs.writeFile(jsonPath, JSON.stringify(results, null, 2));
  
  // Save as CSV
  const csvPath = path.join(outputDir, 'collected_data.csv');
  const headers = Object.keys(results[0]).join(',');
  const rows = results.map(row => Object.values(row).join(','));
  const csv = [headers, ...rows].join('\\n');
  await fs.writeFile(csvPath, csv);
  
  console.log(`\\nResults saved to:`);
  console.log(`- ${jsonPath}`);
  console.log(`- ${csvPath}`);
}

async function main() {
  console.log('Starting autonomous tokenomics data collection...');
  console.log(`Connecting to ${LOCAL_HOST}`);
  console.log(`Canister ID: ${LBRY_FUN_CANISTER_ID}`);
  
  try {
    const actor = await createActor();
    
    const allResults = [];
    
    // Collect all test sets
    allResults.push(...await collectTestSetA(actor));
    allResults.push(...await collectTestSetB(actor));
    allResults.push(...await collectTestSetC(actor));
    allResults.push(...await collectTestSetD(actor));
    
    // Save results
    await saveResults(allResults);
    
    console.log(`\\nTotal data points collected: ${allResults.length}`);
    console.log('Data collection complete!');
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}