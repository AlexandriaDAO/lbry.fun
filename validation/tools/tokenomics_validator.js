#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const TokenomicsCanisterClient = require('./lib/canister_client');
const ProjectionAnalyzer = require('./lib/projection_analyzer');
const InsightsAnalyzer = require('./lib/insights_analyzer');
const EpochValidator = require('./lib/epoch_validator');
const ReportGenerator = require('./lib/report_generator');

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    process.exit(0);
  }

  const config = {
    canisterId: args[0],
    network: 'ic',
    projectionFile: path.join(__dirname, '../data/zero_tokenomics_data.md'),
    insightsFile: path.join(__dirname, '../data/zero_insights_data.md'),
    // Token configuration (can be overridden via CLI)
    halvingStep: null,
    thresholdMultiplier: null,
    initialSecondaryBurn: null,
    initialRewardPerBurnUnit: null
  };

  // Parse optional arguments
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--network' && i + 1 < args.length) {
      config.network = args[i + 1];
      i++;
    } else if (args[i] === '--projection' && i + 1 < args.length) {
      config.projectionFile = args[i + 1];
      i++;
    } else if (args[i] === '--insights' && i + 1 < args.length) {
      config.insightsFile = args[i + 1];
      i++;
    } else if (args[i] === '--halving-step' && i + 1 < args.length) {
      config.halvingStep = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--threshold-multiplier' && i + 1 < args.length) {
      config.thresholdMultiplier = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--initial-secondary-burn' && i + 1 < args.length) {
      config.initialSecondaryBurn = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--initial-reward' && i + 1 < args.length) {
      config.initialRewardPerBurnUnit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === 'local' || args[i] === 'ic') {
      config.network = args[i];
    }
  }

  return config;
}

/**
 * Print usage instructions
 */
function printUsage() {
  console.log(`
Tokenomics Validator - Comprehensive validation of tokenomics implementation

Usage:
  node tokenomics_validator.js <canister-id> [options]

Arguments:
  canister-id        Tokenomics canister ID (required)

Options:
  --network <net>    Network to query (default: ic)
                     Options: ic, local
  --projection <file> Path to projection data file
                     Default: ../data/zero_tokenomics_data.md
  --insights <file>  Path to insights data file
                     Default: ../data/zero_insights_data.md

Token Configuration (optional, defaults to Pool 1):
  --halving-step <percent>          Halving percentage (e.g., 90 for 90%)
  --threshold-multiplier <mult>     Threshold growth multiplier (e.g., 1.5)
  --initial-secondary-burn <amount> Initial secondary burn threshold (E8S)
  --initial-reward <amount>         Initial reward per burn unit (E8S)

  -h, --help         Show this help message

Examples:
  # Validate against mainnet canister
  node tokenomics_validator.js abc123-cai

  # Validate against local replica
  node tokenomics_validator.js rrkah-fqaaa-aaaaa-aaaaq-cai local

  # Custom data files
  node tokenomics_validator.js abc123-cai --projection my_data.md

Exit Codes:
  0 - All validations passed
  1 - One or more validations failed
  2 - Error occurred during validation
`);
}

/**
 * Extract token configuration from CLI args or use defaults
 */
function extractTokenConfig(cliConfig, projectionData, insightsData) {
  // Use CLI values if provided, otherwise default to Pool 1 configuration
  return {
    halving_step: cliConfig.halvingStep || 90,                          // 90% halving per epoch (Pool 1)
    threshold_multiplier: cliConfig.thresholdMultiplier || 1.5,         // 1.5x threshold growth
    initial_secondary_burn: cliConfig.initialSecondaryBurn || 1000000,  // 1M tokens (E8S)
    initial_reward_per_burn_unit: cliConfig.initialRewardPerBurnUnit || 1000000  // 1M tokens (E8S)
  };
}

/**
 * Main function
 */
async function main() {
  try {
    // Parse arguments
    const config = parseArgs(process.argv.slice(2));

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║           TOKENOMICS COMPREHENSIVE VALIDATION                 ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Load data files
    console.log('📂 Loading data files...');
    console.log(`   Projection: ${path.basename(config.projectionFile)}`);
    console.log(`   Insights:   ${path.basename(config.insightsFile)}\n`);

    if (!fs.existsSync(config.projectionFile)) {
      throw new Error(`Projection file not found: ${config.projectionFile}`);
    }
    if (!fs.existsSync(config.insightsFile)) {
      throw new Error(`Insights file not found: ${config.insightsFile}`);
    }

    const projectionData = JSON.parse(fs.readFileSync(config.projectionFile, 'utf8'));
    const insightsData = JSON.parse(fs.readFileSync(config.insightsFile, 'utf8'));

    // Initialize components
    console.log(`🔗 Connecting to canister ${config.canisterId} on ${config.network}...\n`);
    const canisterClient = new TokenomicsCanisterClient(config.canisterId, config.network);
    const projectionAnalyzer = new ProjectionAnalyzer(projectionData);
    const insightsAnalyzer = new InsightsAnalyzer(insightsData);
    const epochValidator = new EpochValidator(projectionAnalyzer, insightsAnalyzer, canisterClient);
    const reportGenerator = new ReportGenerator();

    // Get token configuration
    const tokenConfig = extractTokenConfig(config, projectionData, insightsData);
    console.log('⚙️  Token Configuration:');
    console.log(`   Halving Step: ${tokenConfig.halving_step}%`);
    console.log(`   Threshold Multiplier: ${tokenConfig.threshold_multiplier}x`);
    console.log(`   Initial Secondary Burn: ${tokenConfig.initial_secondary_burn.toLocaleString()} E8S`);
    console.log(`   Initial Reward: ${tokenConfig.initial_reward_per_burn_unit.toLocaleString()} E8S`);
    console.log(`   ${config.halvingStep ? '(from CLI)' : '(defaults)'}\n`);

    // Run validation
    console.log('🔍 Running comprehensive validation...\n');
    const results = await epochValidator.runFullValidation(tokenConfig);

    // Generate reports
    const metadata = {
      poolId: insightsData.poolId,
      timestamp: new Date().toISOString(),
      tokenConfig
    };

    // Console output
    reportGenerator.generateConsoleReport(results);

    // Markdown file
    const markdownReport = reportGenerator.generateMarkdownReport(results, metadata);
    const reportDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    const reportFilename = `pool_${insightsData.poolId}_validation_${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
    const reportPath = path.join(reportDir, reportFilename);
    fs.writeFileSync(reportPath, markdownReport);
    console.log(`📝 Detailed report saved to: ${reportPath}\n`);

    // Exit code
    process.exit(results.passed ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Validation failed with error:\n');
    console.error(error.message);
    if (process.env.DEBUG) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    console.error('\nRun with DEBUG=1 for full stack trace\n');
    process.exit(2);
  }
}

// Run main function
main();
