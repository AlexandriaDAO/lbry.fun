# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/lbryfun" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/lbryfun-tokenomics-validator"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/lbryfun-tokenomics-validator`
2. **Implement feature** - Follow plan sections below
3. **Build locally** (verification only - NEVER DEPLOY TO MAINNET):
   ```bash
   ./scripts/build.sh
   ```
   **⚠️ PRODUCTION WARNING**: This is a live financial application. Never deploy to mainnet.
4. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat: Add comprehensive tokenomics validation system with canister queries"
   git push -u origin feature/comprehensive-tokenomics-validation
   gh pr create --title "Feature: Comprehensive Tokenomics Validation System" --body "Implements COMPREHENSIVE_TOKENOMICS_VALIDATOR_PLAN.md

   ## Summary
   - Validates cumulative supply curve accuracy
   - Queries tokenomics canister for actual state
   - Compares projected vs actual epochs, thresholds, and rewards
   - Validates halving mechanics step-by-step
   - Produces detailed validation reports with pass/fail criteria

   ## Testing
   - Local build verification: ./scripts/build.sh
   - Manual testing with existing data files"
   ```
5. **Iterate autonomously**:
   - FOR i=1 to 5:
     - Check review: `gh pr view [NUM] --json comments`
     - Count P0 issues
     - IF P0 > 0: Fix immediately, commit, push, sleep 300s, continue
     - IF P0 = 0: Report success, EXIT
   - After 5 iterations: Escalate to human

## CRITICAL RULES
- ❌ NO questions ("should I?", "want me to?", "is it done?")
- ❌ NO skipping PR creation - it's MANDATORY
- ❌ NO stopping after implementation - create PR immediately
- ✅ After sleep: IMMEDIATELY continue (no pause)
- ✅ ONLY stop at: approved, max iterations, or error

**Branch:** `feature/comprehensive-tokenomics-validation`
**Worktree:** `/home/theseus/alexandria/lbryfun-tokenomics-validator`

---

# Implementation Plan: Comprehensive Tokenomics Validation System

## Problem Statement

Current validation has two major issues:

1. **Superficial Validation**: Only checks if final cumulative numbers match, doesn't verify the path taken
2. **False Deep Validation**: Attempted to detect epochs from hourly snapshots, which is fundamentally flawed

We need a proper validation system that:
- Validates cumulative accuracy (what we can prove from data files)
- Queries the actual tokenomics canister state
- Compares projected thresholds/rewards arrays vs actual canister arrays
- Validates halving mechanics step-by-step
- Provides clear pass/fail criteria with detailed reports

## Current State

### Existing Files

**Data Files** (in `/data/`):
- `zero_tokenomics_data.md` - Projection data from Tokenomics tab
  ```json
  {
    "poolId": "1",
    "graphs": {
      "cumulativeSupply": { xAxis: [secondary_burned], yAxis: [primary_minted] },
      "mintedPerEpoch": { xAxis: ["Epoch N"], yAxis: [minted] },
      "costToMint": { xAxis: [supply], yAxis: [cost_usd] },
      "cumulativeUsdCost": { xAxis: [supply], yAxis: [total_cost] }
    }
  }
  ```

- `zero_insights_data.md` - Actual blockchain data from Insights tab
  ```json
  {
    "poolId": "1",
    "timestamp": "ISO string",
    "graphs": {
      "time": ["MM/DD/YYYY", ...],
      "primaryTokenSupply": { xAxis: [time], yAxis: [supply] },
      "totalSecondaryBurned": { xAxis: [time], yAxis: [burned] },
      ...
    },
    "summary": {
      "primaryTokenSupply": number,
      "totalSecondaryBurned": number,
      ...
    }
  }
  ```

**Existing Validation Scripts** (in `/scripts/`):
- `compare_data.js` - Superficial cumulative validation (0.00% variance)
- `deep_validation.js` - Flawed epoch detection from hourly snapshots

**Tokenomics Canister** (in `/src/tokenomics/`):
- `queries.rs` - Available query methods:
  ```rust
  pub fn get_total_secondary_burn() -> u64
  pub fn get_current_threshold_index() -> u32
  pub fn get_current_primary_rate() -> Result<u64, String>
  pub fn get_current_secondary_threshold() -> Result<u64, String>
  pub fn get_tokenomics_schedule() -> Result<TokenomicsSchedule, String>
  ```

- `storage.rs` - Data structures:
  ```rust
  pub struct TokenomicsSchedule {
      pub thresholds: Vec<u64>,    // Secondary burn thresholds
      pub rewards: Vec<u64>,       // Primary rewards per threshold (4-decimal format)
  }
  ```

**Projection Generation** (in `/src/lbry_fun/`):
- `tokenomics_simple.rs` - Clean epoch simulation
- `simulation_new.rs` - Converts to graph format

### File Tree (Before)

```
/scripts/
├── compare_data.js              (KEEP - superficial validation useful)
├── deep_validation.js           (KEEP - but mark as unreliable)
└── [NEW validator files here]

/data/
├── zero_tokenomics_data.md      (projection data)
├── zero_insights_data.md        (actual data)
├── VALIDATION_REPORT.md         (superficial results)
├── CORRECTED_VALIDATION.md      (explanation of issues)
└── deep_validation_results.json (flawed results)

/src/tokenomics/src/
├── queries.rs                   (canister query methods)
├── storage.rs                   (data structures)
└── ...
```

### File Tree (After)

```
/scripts/
├── compare_data.js              (existing - superficial)
├── deep_validation.js           (existing - flawed)
├── tokenomics_validator.js      (NEW - comprehensive validator)
└── lib/
    ├── canister_client.js       (NEW - dfx canister query wrapper)
    ├── projection_analyzer.js   (NEW - analyze projection data)
    ├── insights_analyzer.js     (NEW - analyze insights data)
    ├── epoch_validator.js       (NEW - epoch-by-epoch validation)
    └── report_generator.js      (NEW - formatted reports)

/data/
├── [existing files unchanged]
└── comprehensive_validation_report.md  (NEW - detailed validation)
```

## Implementation Plan

### Phase 1: Canister Query Client

**File:** `scripts/lib/canister_client.js` (NEW)

```javascript
// PSEUDOCODE

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class TokenomicsCanisterClient {
  constructor(canisterId, network = 'ic') {
    // Store canister ID and network
    // Default to IC mainnet
  }

  async getCurrentThresholdIndex() {
    // Execute: dfx canister call --network {network} {canisterId} get_current_threshold_index
    // Parse result: extract u32 value from candid output
    // Return: number
  }

  async getTotalSecondaryBurn() {
    // Execute: dfx canister call --network {network} {canisterId} get_total_secondary_burn
    // Parse result: extract u64 value
    // Return: number
  }

  async getCurrentPrimaryRate() {
    // Execute: dfx canister call --network {network} {canisterId} get_current_primary_rate
    // Parse result: handle Result<u64, String>
    // Return: { ok: number } | { err: string }
  }

  async getCurrentSecondaryThreshold() {
    // Execute: dfx canister call --network {network} {canisterId} get_current_secondary_threshold
    // Parse result: handle Result<u64, String>
    // Return: { ok: number } | { err: string }
  }

  async getTokenomicsSchedule() {
    // Execute: dfx canister call --network {network} {canisterId} get_tokenomics_schedule
    // Parse result: extract TokenomicsSchedule { thresholds: Vec<u64>, rewards: Vec<u64> }
    // CRITICAL: Rewards are in 4-decimal format, multiply by 10,000 for E8S
    // Return: { thresholds: number[], rewards: number[] } in E8S format
  }

  _parseCandidOutput(output, expectedType) {
    // Parse candid output based on type
    // Handle: primitives (u32, u64), Result types, records (structs), vectors
    // Return: parsed JavaScript value
  }

  _executeQuery(method) {
    // Execute dfx command
    // Handle errors (canister not found, network issues, etc.)
    // Return: raw output string
  }
}

module.exports = TokenomicsCanisterClient;
```

### Phase 2: Projection Data Analyzer

**File:** `scripts/lib/projection_analyzer.js` (NEW)

```javascript
// PSEUDOCODE

class ProjectionAnalyzer {
  constructor(projectionData) {
    // Store projection data from zero_tokenomics_data.md
    // Extract: cumulativeSupply, mintedPerEpoch, etc.
  }

  getExpectedPrimaryAtBurn(secondaryBurned) {
    // Find position in cumulativeSupply.xAxis where secondaryBurned falls
    // Interpolate cumulativeSupply.yAxis at that position
    // Return: expected primary minted (E8S)
  }

  getProjectedEpochs() {
    // Extract epoch data from mintedPerEpoch graph
    // Return: array of { epochNumber, primaryMinted, secondaryBurnedStart, secondaryBurnedEnd }
    // Calculate burn ranges from cumulative data
  }

  calculateProjectedThresholds(config) {
    // Reconstruct threshold array based on:
    // - config.initial_secondary_burn (starting threshold)
    // - config.threshold_multiplier (e.g., 1.5x)
    // - Number of epochs from mintedPerEpoch
    // Return: thresholds array in E8S
  }

  calculateProjectedRewards(config) {
    // Reconstruct rewards array based on:
    // - config.initial_reward_per_burn_unit (starting reward)
    // - config.halving_step (e.g., 95%)
    // - Number of epochs
    // CRITICAL: Return in 4-decimal format (divide E8S by 10,000)
    // Return: rewards array in 4-decimal format (to match canister)
  }

  getCostCurve() {
    // Return costToMint graph data
    // Useful for validation but not critical path
  }
}

module.exports = ProjectionAnalyzer;
```

### Phase 3: Insights Data Analyzer

**File:** `scripts/lib/insights_analyzer.js` (NEW)

```javascript
// PSEUDOCODE

class InsightsAnalyzer {
  constructor(insightsData) {
    // Store insights data from zero_insights_data.md
    // Extract: summary, graphs
  }

  getCurrentState() {
    // Return summary data:
    // {
    //   primarySupply: number (E8S),
    //   secondarySupply: number (E8S),
    //   totalSecondaryBurned: number (E8S),
    //   stakedAmount: number (E8S),
    //   stakerCount: number,
    //   apy: number,
    //   hourlyIcpRewards: number
    // }
  }

  getTimeSeriesData() {
    // Return full time series from graphs
    // Useful for future analysis but not critical path
  }

  detectAnomalies() {
    // Check for suspicious patterns:
    // - APY showing 0 when it shouldn't
    // - Hourly rewards showing 0
    // - Supply decreasing (impossible)
    // Return: array of warnings
  }
}

module.exports = InsightsAnalyzer;
```

### Phase 4: Epoch Validator

**File:** `scripts/lib/epoch_validator.js` (NEW)

```javascript
// PSEUDOCODE

class EpochValidator {
  constructor(projectionAnalyzer, insightsAnalyzer, canisterClient) {
    // Store all three analyzers/clients
  }

  async validateCumulativeAccuracy() {
    // Get actual state from insights
    const actual = insightsAnalyzer.getCurrentState();

    // Get expected from projection
    const expected = projectionAnalyzer.getExpectedPrimaryAtBurn(actual.totalSecondaryBurned);

    // Calculate variance
    const variance = ((actual.primarySupply - expected) / expected) * 100;

    // Return: { passed: abs(variance) < 5%, variance, actual, expected }
  }

  async validateThresholdsArray(tokenConfig) {
    // Get actual thresholds from canister
    const canisterSchedule = await canisterClient.getTokenomicsSchedule();
    const actualThresholds = canisterSchedule.thresholds;

    // Get expected thresholds from projection
    const expectedThresholds = projectionAnalyzer.calculateProjectedThresholds(tokenConfig);

    // Compare arrays element by element
    const mismatches = [];
    for (let i = 0; i < Math.max(actual.length, expected.length); i++) {
      if (actual[i] !== expected[i]) {
        mismatches.push({ index: i, actual: actual[i], expected: expected[i] });
      }
    }

    // Return: { passed: mismatches.length === 0, mismatches, actualCount, expectedCount }
  }

  async validateRewardsArray(tokenConfig) {
    // Get actual rewards from canister (4-decimal format)
    const canisterSchedule = await canisterClient.getTokenomicsSchedule();
    const actualRewards = canisterSchedule.rewards; // Already in 4-decimal

    // Get expected rewards from projection (convert to 4-decimal)
    const expectedRewards = projectionAnalyzer.calculateProjectedRewards(tokenConfig);

    // Compare arrays element by element with tolerance for rounding
    const tolerance = 1; // Allow 1 unit difference in 4-decimal format
    const mismatches = [];
    for (let i = 0; i < Math.max(actual.length, expected.length); i++) {
      if (Math.abs(actual[i] - expected[i]) > tolerance) {
        mismatches.push({ index: i, actual: actual[i], expected: expected[i] });
      }
    }

    // Return: { passed: mismatches.length === 0, mismatches, actualCount, expectedCount }
  }

  async validateHalvingProgression(tokenConfig) {
    // Get actual rewards array
    const canisterSchedule = await canisterClient.getTokenomicsSchedule();
    const rewards = canisterSchedule.rewards;

    // Check each epoch transition
    const expectedRatio = tokenConfig.halving_step / 100; // e.g., 95% = 0.95
    const tolerance = 0.01; // 1% tolerance

    const violations = [];
    for (let i = 1; i < rewards.length; i++) {
      const actualRatio = rewards[i] / rewards[i-1];
      const variance = Math.abs(actualRatio - expectedRatio);

      if (variance > tolerance) {
        violations.push({
          fromEpoch: i-1,
          toEpoch: i,
          previousReward: rewards[i-1],
          currentReward: rewards[i],
          actualRatio,
          expectedRatio,
          variance
        });
      }
    }

    // Return: { passed: violations.length === 0, violations, expectedRatio }
  }

  async validateCurrentState() {
    // Get current threshold index from canister
    const currentIndex = await canisterClient.getCurrentThresholdIndex();

    // Get total secondary burned from canister
    const totalBurned = await canisterClient.getTotalSecondaryBurn();

    // Get actual state from insights
    const insightsState = insightsAnalyzer.getCurrentState();

    // Validate consistency
    const burnedMatch = totalBurned === insightsState.totalSecondaryBurned;

    // Get thresholds to check if current index makes sense
    const schedule = await canisterClient.getTokenomicsSchedule();
    const thresholds = schedule.thresholds;

    // Verify: thresholds[currentIndex-1] < totalBurned <= thresholds[currentIndex]
    let indexCorrect = true;
    if (currentIndex > 0 && totalBurned <= thresholds[currentIndex - 1]) {
      indexCorrect = false;
    }
    if (currentIndex < thresholds.length && totalBurned > thresholds[currentIndex]) {
      indexCorrect = false;
    }

    // Return: { passed: burnedMatch && indexCorrect, currentIndex, totalBurned, indexCorrect, burnedMatch }
  }

  async runFullValidation(tokenConfig) {
    // Run all validations
    const results = {
      cumulativeAccuracy: await this.validateCumulativeAccuracy(),
      thresholdsArray: await this.validateThresholdsArray(tokenConfig),
      rewardsArray: await this.validateRewardsArray(tokenConfig),
      halvingProgression: await this.validateHalvingProgression(tokenConfig),
      currentState: await this.validateCurrentState()
    };

    // Calculate overall pass/fail
    const allPassed = Object.values(results).every(r => r.passed);

    return { passed: allPassed, ...results };
  }
}

module.exports = EpochValidator;
```

### Phase 5: Report Generator

**File:** `scripts/lib/report_generator.js` (NEW)

```javascript
// PSEUDOCODE

class ReportGenerator {
  generateMarkdownReport(validationResults, metadata) {
    // metadata: { poolId, timestamp, tokenConfig }

    // Build markdown report with sections:

    // 1. Header with metadata
    let report = `# Comprehensive Tokenomics Validation Report\n`;
    report += `**Pool ID:** ${metadata.poolId}\n`;
    report += `**Validation Time:** ${metadata.timestamp}\n`;
    report += `**Overall Status:** ${validationResults.passed ? '✅ PASSED' : '❌ FAILED'}\n\n`;

    // 2. Executive Summary
    report += `## Executive Summary\n\n`;
    // Count passes/fails
    // Highlight critical issues

    // 3. Cumulative Accuracy
    report += `## 1. Cumulative Supply Accuracy\n\n`;
    report += this._formatCumulativeSection(validationResults.cumulativeAccuracy);

    // 4. Thresholds Array Validation
    report += `## 2. Thresholds Array Validation\n\n`;
    report += this._formatThresholdsSection(validationResults.thresholdsArray);

    // 5. Rewards Array Validation
    report += `## 3. Rewards Array Validation\n\n`;
    report += this._formatRewardsSection(validationResults.rewardsArray);

    // 6. Halving Progression
    report += `## 4. Halving Mechanics Validation\n\n`;
    report += this._formatHalvingSection(validationResults.halvingProgression, metadata.tokenConfig);

    // 7. Current State Consistency
    report += `## 5. Current State Consistency\n\n`;
    report += this._formatCurrentStateSection(validationResults.currentState);

    // 8. Recommendations
    report += `## Recommendations\n\n`;
    if (validationResults.passed) {
      report += `✅ All validations passed. The tokenomics implementation is working correctly.\n\n`;
    } else {
      report += `❌ Issues detected. Recommended actions:\n\n`;
      // List specific actions based on failures
    }

    return report;
  }

  generateConsoleReport(validationResults) {
    // Formatted console output with colors and boxes
    // Similar to existing compare_data.js but more comprehensive

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║      COMPREHENSIVE TOKENOMICS VALIDATION RESULTS              ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Output each section with appropriate formatting
    // Use colors: green for pass, red for fail, yellow for warnings
  }

  _formatCumulativeSection(data) {
    // Format cumulative accuracy section
    // Show actual vs expected, variance, pass/fail
  }

  _formatThresholdsSection(data) {
    // Format thresholds array comparison
    // Show array lengths, any mismatches
  }

  _formatRewardsSection(data) {
    // Format rewards array comparison
    // Show array lengths, any mismatches
    // Note 4-decimal format
  }

  _formatHalvingSection(data, config) {
    // Format halving progression results
    // Show expected ratio (e.g., 95%)
    // List any violations with details
  }

  _formatCurrentStateSection(data) {
    // Format current state consistency check
    // Show current threshold index, total burned
    // Validate index is correct for burn amount
  }
}

module.exports = ReportGenerator;
```

### Phase 6: Main Validator CLI

**File:** `scripts/tokenomics_validator.js` (NEW)

```javascript
#!/usr/bin/env node

// PSEUDOCODE

const fs = require('fs');
const path = require('path');
const TokenomicsCanisterClient = require('./lib/canister_client');
const ProjectionAnalyzer = require('./lib/projection_analyzer');
const InsightsAnalyzer = require('./lib/insights_analyzer');
const EpochValidator = require('./lib/epoch_validator');
const ReportGenerator = require('./lib/report_generator');

// Parse command line arguments
const args = process.argv.slice(2);

// Expected usage:
// node tokenomics_validator.js <canister-id> [network] [--projection <file>] [--insights <file>]

function parseArgs(args) {
  // Parse CLI arguments
  // canisterId: required
  // network: optional, default 'ic'
  // projectionFile: optional, default 'data/zero_tokenomics_data.md'
  // insightsFile: optional, default 'data/zero_insights_data.md'

  return {
    canisterId,
    network,
    projectionFile,
    insightsFile
  };
}

async function main() {
  try {
    // 1. Parse arguments
    const config = parseArgs(args);

    // 2. Load data files
    console.log('Loading data files...');
    const projectionData = JSON.parse(fs.readFileSync(config.projectionFile, 'utf8'));
    const insightsData = JSON.parse(fs.readFileSync(config.insightsFile, 'utf8'));

    // 3. Initialize components
    console.log(`Connecting to canister ${config.canisterId} on ${config.network}...`);
    const canisterClient = new TokenomicsCanisterClient(config.canisterId, config.network);
    const projectionAnalyzer = new ProjectionAnalyzer(projectionData);
    const insightsAnalyzer = new InsightsAnalyzer(insightsData);
    const epochValidator = new EpochValidator(projectionAnalyzer, insightsAnalyzer, canisterClient);
    const reportGenerator = new ReportGenerator();

    // 4. Get token configuration from insights or projection data
    // Need: halving_step, threshold_multiplier, initial_secondary_burn, initial_reward_per_burn_unit
    const tokenConfig = extractTokenConfig(projectionData, insightsData);

    // 5. Run validation
    console.log('Running comprehensive validation...\n');
    const results = await epochValidator.runFullValidation(tokenConfig);

    // 6. Generate reports
    const metadata = {
      poolId: insightsData.poolId,
      timestamp: new Date().toISOString(),
      tokenConfig
    };

    // Console output
    reportGenerator.generateConsoleReport(results);

    // Markdown file
    const markdownReport = reportGenerator.generateMarkdownReport(results, metadata);
    const reportPath = path.join(__dirname, '../data/comprehensive_validation_report.md');
    fs.writeFileSync(reportPath, markdownReport);
    console.log(`\n📝 Detailed report saved to: ${reportPath}\n`);

    // 7. Exit code
    process.exit(results.passed ? 0 : 1);

  } catch (error) {
    console.error('❌ Validation failed with error:', error.message);
    console.error(error.stack);
    process.exit(2);
  }
}

function extractTokenConfig(projectionData, insightsData) {
  // Extract token configuration from available data
  // May need to add this to the data export in frontend
  // For now, can be passed as CLI args or hardcoded from known pool

  // Return: {
  //   halving_step: 95,
  //   threshold_multiplier: 1.5,
  //   initial_secondary_burn: <E8S>,
  //   initial_reward_per_burn_unit: <E8S>
  // }
}

main();
```

### Phase 7: Update Package Scripts

**File:** `package.json` (MODIFY)

```json
// PSEUDOCODE

{
  "scripts": {
    // ... existing scripts ...
    "validate:tokenomics": "node scripts/tokenomics_validator.js",
    "validate:superficial": "node scripts/compare_data.js",
    "validate:legacy-deep": "node scripts/deep_validation.js"
  }
}
```

### Phase 8: Documentation

**File:** `scripts/README_VALIDATION.md` (NEW)

```markdown
# Tokenomics Validation Tools

## Overview

This directory contains three levels of tokenomics validation:

### 1. Superficial Validation (Cumulative Accuracy Only)

**File:** `compare_data.js`

**What it validates:**
- Final cumulative numbers match projection

**What it doesn't validate:**
- Individual epoch mechanics
- Halving progression
- Threshold transitions

**Usage:**
```bash
node scripts/compare_data.js
```

**When to use:** Quick sanity check that system arrived at correct destination

---

### 2. Legacy Deep Validation (UNRELIABLE)

**File:** `deep_validation.js`

**Status:** ⚠️ FLAWED - Do not rely on results

**Problem:** Attempts to detect epochs from hourly cumulative snapshots, which is fundamentally incorrect

**Usage:**
```bash
node scripts/deep_validation.js  # NOT RECOMMENDED
```

**When to use:** Never (kept for historical reference only)

---

### 3. Comprehensive Validation (RECOMMENDED)

**File:** `tokenomics_validator.js`

**What it validates:**
- ✅ Cumulative supply accuracy
- ✅ Thresholds array matches projection
- ✅ Rewards array matches projection
- ✅ Halving mechanics (95% step verification)
- ✅ Current canister state consistency

**Requirements:**
- `dfx` CLI installed and configured
- Access to IC network (or local replica)
- Canister ID for tokenomics canister

**Usage:**
```bash
# Validate against mainnet canister
node scripts/tokenomics_validator.js <canister-id>

# Validate against local replica
node scripts/tokenomics_validator.js <canister-id> local

# Custom data files
node scripts/tokenomics_validator.js <canister-id> ic \
  --projection data/my_tokenomics.md \
  --insights data/my_insights.md
```

**Output:**
- Console report with pass/fail results
- Detailed markdown report: `data/comprehensive_validation_report.md`
- Exit code: 0 (pass), 1 (fail), 2 (error)

**When to use:**
- After any tokenomics canister changes
- Periodic validation of live tokens
- Debugging halving mechanics issues
- Verifying projection accuracy

---

## Data File Format

### Projection Data (from Tokenomics tab)

Expected location: `data/zero_tokenomics_data.md`

```json
{
  "poolId": "1",
  "graphs": {
    "cumulativeSupply": {
      "xAxis": [0, 1000000, ...],  // Secondary burned (cumulative)
      "yAxis": [0, 1000000, ...]   // Primary minted (cumulative)
    },
    "mintedPerEpoch": {
      "xAxis": ["Epoch 1", "Epoch 2", ...],
      "yAxis": [1000000, 450000, ...]  // Primary minted per epoch
    },
    // ... other graphs
  }
}
```

### Insights Data (from Insights tab)

Expected location: `data/zero_insights_data.md`

```json
{
  "poolId": "1",
  "timestamp": "2025-11-08T12:17:42.199Z",
  "graphs": {
    "time": ["8/21/2025", ...],
    "primaryTokenSupply": { xAxis: [...], yAxis: [...] },
    "totalSecondaryBurned": { xAxis: [...], yAxis: [...] },
    // ... other metrics
  },
  "summary": {
    "primaryTokenSupply": 4339666.98,
    "totalSecondaryBurned": 5663571,
    // ... other summary stats
  }
}
```

---

## How to Export Data

### From Frontend (Analytics Terminal):

1. **Get Projection Data:**
   - Navigate to Analytics Terminal
   - Click "TOKENOMICS" tab
   - Click "copy_graph_data" button
   - Paste into `data/zero_tokenomics_data.md`

2. **Get Insights Data:**
   - Navigate to Analytics Terminal
   - Click "INSIGHTS" tab
   - Click "copy_graph_data" button
   - Paste into `data/zero_insights_data.md`

---

## Validation Pass Criteria

### Cumulative Accuracy
- **Pass:** Variance < 5% between actual and projected primary supply
- **Typical:** ~0.001% variance (nearly perfect)

### Thresholds Array
- **Pass:** All thresholds match projection exactly
- **Note:** Integer values, no tolerance

### Rewards Array
- **Pass:** All rewards match projection within ±1 unit (4-decimal format)
- **Note:** Small rounding tolerance due to format conversion

### Halving Progression
- **Pass:** Each epoch reward = previous × (halving_step / 100) ± 1%
- **Example:** With 95% halving, each epoch should be 95% of previous

### Current State
- **Pass:** Canister's total burned matches insights data
- **Pass:** Current threshold index is correct for burn amount

---

## Troubleshooting

### "Cannot connect to canister"
- Verify canister ID is correct
- Check network is accessible (IC mainnet or local replica running)
- Ensure `dfx` is installed and configured

### "Thresholds array mismatch"
- Projection may have been generated with different parameters
- Re-export projection data from frontend
- Check if token was created with custom parameters

### "Halving violations detected"
- May indicate bug in tokenomics canister
- Verify halving_step was set correctly at creation
- Check if rewards array was manually modified (shouldn't happen)

### "Current state inconsistency"
- Insights data may be stale (old snapshot)
- Re-export insights data
- Check if there's a synchronization delay
```

## Testing Strategy

### Local Build Verification

```bash
# Verify compilation (from worktree)
./scripts/build.sh
```

**⚠️ CRITICAL**: This is a production financial application. Never deploy to mainnet from worktrees.

### Manual Testing

1. **Test with existing data:**
   ```bash
   # Use the captured zero_tokenomics_data.md and zero_insights_data.md
   node scripts/tokenomics_validator.js <canister-id>

   # Should output comprehensive validation report
   # Should match expected results (cumulative accuracy ~0.001%)
   ```

2. **Test canister queries:**
   ```bash
   # Verify canister client works
   node -e "
   const Client = require('./scripts/lib/canister_client');
   const client = new Client('<canister-id>');
   client.getCurrentThresholdIndex().then(console.log);
   "
   ```

3. **Test error handling:**
   ```bash
   # Invalid canister ID
   node scripts/tokenomics_validator.js invalid-id
   # Should error gracefully

   # Missing data files
   mv data/zero_tokenomics_data.md data/backup.md
   node scripts/tokenomics_validator.js <canister-id>
   # Should error with clear message
   mv data/backup.md data/zero_tokenomics_data.md
   ```

4. **Test report generation:**
   ```bash
   # Run validator
   node scripts/tokenomics_validator.js <canister-id>

   # Check report was created
   cat data/comprehensive_validation_report.md

   # Verify it contains all sections:
   # - Executive Summary
   # - Cumulative Accuracy
   # - Thresholds Array
   # - Rewards Array
   # - Halving Progression
   # - Current State
   # - Recommendations
   ```

### Expected Results

With the existing zero pool data:

**Cumulative Accuracy:**
- ✅ Pass (~0.001% variance)

**Thresholds Array:**
- Need to query canister to verify
- Should match projection calculated thresholds

**Rewards Array:**
- Need to query canister to verify
- Should match projection with 95% halving

**Halving Progression:**
- Need to query canister to verify
- Each epoch should be 95% of previous

**Current State:**
- ✅ Total burned should match insights summary
- ✅ Threshold index should be correct for 5.66M burned

## Dependencies

No new npm packages required (uses Node.js built-ins):
- `fs` - File system operations
- `path` - Path manipulation
- `child_process` - Execute dfx commands
- `util` - Promisify exec

## Critical Implementation Notes

### E8S Format Conversions

**Understanding E8S:**
- 1 token = 100,000,000 E8S (8 decimals)
- All on-chain amounts are in E8S

**Tokenomics 4-Decimal Format:**
- Rewards stored as 4-decimal internally (space optimization)
- 1.0 token in rewards = 10,000 units
- Must multiply by 10,000 to get E8S
- Example: reward value 50,000 = 5.0 tokens = 500,000,000 E8S

**Conversion Functions Needed:**
```javascript
// E8S to natural
function e8sToNatural(e8s) {
  return e8s / 100_000_000;
}

// Natural to E8S
function naturalToE8s(natural) {
  return natural * 100_000_000;
}

// 4-decimal to E8S (for rewards)
function fourDecimalToE8s(fourDecimal) {
  return fourDecimal * 10_000;
}

// E8S to 4-decimal (for rewards)
function e8sToFourDecimal(e8s) {
  return e8s / 10_000;
}
```

### Candid Output Parsing

**Example outputs to parse:**

```candid
// u32 (threshold index)
(5 : nat32)

// u64 (total burned)
(5_663_571 : nat64)

// Result<u64, String> (current rate)
(variant { Ok = 123_456 : nat64 })
(variant { Err = "Error message" })

// TokenomicsSchedule
(record {
  thresholds = vec { 1_000_000 : nat64; 1_500_000 : nat64; 2_250_000 : nat64 };
  rewards = vec { 10_000 : nat64; 9_500 : nat64; 9_025 : nat64 };
})
```

**Parsing strategy:**
- Use regex to extract values
- Handle both numeric literals and underscores (1_000_000)
- Parse variant types for Result
- Parse record types for structs
- Parse vec for arrays

### Error Handling

**Canister Query Errors:**
- Network unavailable → Clear error message
- Canister not found → Verify canister ID
- Method not found → Check canister version
- Parsing failed → Show raw output for debugging

**Data File Errors:**
- File not found → Clear instructions to export data
- Invalid JSON → Validate and show parse error
- Missing fields → List required fields

**Validation Errors:**
- Array length mismatch → Show both lengths
- Value mismatch → Show index, actual, expected
- Variance too high → Show calculation details

## Success Criteria

### Must Have:
- ✅ Canister client successfully queries IC mainnet
- ✅ Thresholds array validation works
- ✅ Rewards array validation works (with 4-decimal conversion)
- ✅ Halving progression validation works
- ✅ Comprehensive markdown report generated
- ✅ Clear console output with pass/fail
- ✅ Exit codes work correctly

### Should Have:
- ✅ Detailed error messages for all failure modes
- ✅ Documentation in README
- ✅ Examples in documentation
- ✅ Proper E8S format handling throughout

### Nice to Have:
- Colored console output
- Progress indicators for slow queries
- Option to save raw canister responses
- Comparison table showing projected vs actual arrays side-by-side

## File Checklist

- [ ] `scripts/lib/canister_client.js` - Canister query wrapper
- [ ] `scripts/lib/projection_analyzer.js` - Projection data analysis
- [ ] `scripts/lib/insights_analyzer.js` - Insights data analysis
- [ ] `scripts/lib/epoch_validator.js` - Core validation logic
- [ ] `scripts/lib/report_generator.js` - Report formatting
- [ ] `scripts/tokenomics_validator.js` - Main CLI entry point
- [ ] `scripts/README_VALIDATION.md` - Documentation
- [ ] Update `package.json` with new scripts
- [ ] Mark `deep_validation.js` as unreliable in comments
