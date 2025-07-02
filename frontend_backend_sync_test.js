// Integration test to verify frontend and backend produce identical results
// Run this whenever you change parameters or calculation logic

const crypto = require('crypto');

// Import your frontend calculation function (adjust path as needed)
// const { calculateTokenomicsSchedule } = require('./frontend/tokenomics');

// Mock frontend calculation for demonstration
function calculateTokenomicsScheduleFrontend(params) {
    // This should be your actual frontend calculation
    // For now, returning a mock structure
    return {
        epochs: [],
        total_epochs: 0,
        total_supply_percentage: 0
    };
}

// Calculate checksum for a schedule (must match backend logic)
function calculateChecksum(schedule) {
    const hash = crypto.createHash('sha256');
    
    // Hash in same order as backend
    hash.update(Buffer.from(new Uint32Array([schedule.total_epochs]).buffer));
    hash.update(Buffer.from(new Float64Array([schedule.total_supply_percentage]).buffer));
    
    for (const epoch of schedule.epochs) {
        hash.update(Buffer.from(new Uint32Array([epoch.epoch_number]).buffer));
        hash.update(Buffer.from(new BigUint64Array([BigInt(epoch.secondary_burned_this_epoch_e8s)]).buffer));
        hash.update(Buffer.from(new BigUint64Array([BigInt(epoch.primary_minted_this_epoch_e8s)]).buffer));
        hash.update(Buffer.from(new BigUint64Array([BigInt(epoch.cumulative_secondary_burned_e8s)]).buffer));
        hash.update(Buffer.from(new BigUint64Array([BigInt(epoch.cumulative_primary_minted_e8s)]).buffer));
    }
    
    return hash.digest('hex');
}

// Test cases with various parameters
const testCases = [
    {
        name: "Default (hardcoded match)",
        params: {
            max_supply_e8s: 21_000_000n * 100_000_000n,
            tge_allocation_e8s: 0n,
            initial_burn_e8s: 21_000n * 100_000_000n,
            initial_reward_rate_e8s: 5n * 100_000_000n,
            halving_percentage: 50
        }
    },
    {
        name: "Small supply",
        params: {
            max_supply_e8s: 1_000_000n * 100_000_000n,
            tge_allocation_e8s: 10_000n * 100_000_000n,
            initial_burn_e8s: 10_000n * 100_000_000n,
            initial_reward_rate_e8s: 3n * 100_000_000n,
            halving_percentage: 70
        }
    },
    {
        name: "Large supply",
        params: {
            max_supply_e8s: 100_000_000n * 100_000_000n,
            tge_allocation_e8s: 1_000_000n * 100_000_000n,
            initial_burn_e8s: 100_000n * 100_000_000n,
            initial_reward_rate_e8s: 10n * 100_000_000n,
            halving_percentage: 40
        }
    }
];

async function runTests() {
    console.log("Running Frontend/Backend Synchronization Tests\n");
    
    for (const testCase of testCases) {
        console.log(`Test: ${testCase.name}`);
        console.log("Parameters:", testCase.params);
        
        // Calculate frontend schedule
        const frontendSchedule = calculateTokenomicsScheduleFrontend(testCase.params);
        const frontendChecksum = calculateChecksum(frontendSchedule);
        
        // TODO: Call backend canister to get backend schedule
        // const backendResult = await canister.get_tokenomics_preview(testCase.params);
        // const backendChecksum = backendResult.checksum;
        
        // For now, just show frontend results
        console.log(`Frontend checksum: ${frontendChecksum}`);
        console.log(`Frontend epochs: ${frontendSchedule.epochs.length}`);
        
        // TODO: Compare with backend
        // if (frontendChecksum !== backendChecksum) {
        //     console.error("❌ MISMATCH DETECTED!");
        //     // Call validation endpoint for detailed diff
        // } else {
        //     console.log("✅ Frontend and Backend match!");
        // }
        
        console.log("\n---\n");
    }
}

// Export for use in CI/CD
module.exports = { runTests, calculateChecksum, testCases };

// Run if called directly
if (require.main === module) {
    runTests().catch(console.error);
}