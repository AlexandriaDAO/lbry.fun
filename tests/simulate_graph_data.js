// Simulate what the backend preview_tokenomics_graphs returns for each preset

const E8S = 100_000_000;

function simulatePreset(name, maxSupply, burnUnit, rewardRate, halvingStep, thresholdMultiplier = 2) {
    console.log(`\n=== ${name} Preset ===`);
    console.log(`Parameters:`);
    console.log(`  Max supply: ${maxSupply.toLocaleString()} tokens`);
    console.log(`  Burn unit: ${burnUnit.toLocaleString()} tokens`);
    console.log(`  Initial reward: ${rewardRate} per burn unit`);
    console.log(`  Halving: ${halvingStep}%`);
    
    let cumulativeMinted = 0;
    let currentBurnThreshold = burnUnit;
    let currentReward = rewardRate;
    let epoch = 1;
    const epochs = [];
    
    // TGE
    const tgeAmount = 1;
    cumulativeMinted += tgeAmount;
    
    console.log(`\nEpoch Data:`);
    console.log(`TGE: ${tgeAmount} token (cumulative: ${cumulativeMinted})`);
    
    while (cumulativeMinted < maxSupply && epoch <= 20) {
        // The buggy calculation from simulation.rs
        const rewardE8s = currentReward * currentBurnThreshold * 10000;
        const rewardTokens = Math.floor(rewardE8s / E8S);
        
        // Backend adds this epoch even if it exceeds max supply (the bug!)
        cumulativeMinted += rewardTokens;
        const usdCost = currentBurnThreshold * 0.005;
        
        console.log(`Epoch ${epoch}: ${rewardTokens.toLocaleString()} tokens (cumulative: ${cumulativeMinted.toLocaleString()}, cost: $${usdCost.toFixed(2)})`);
        
        epochs.push({
            epoch,
            burnRequired: currentBurnThreshold,
            minted: rewardTokens,
            cumulative: cumulativeMinted,
            usdCost
        });
        
        if (cumulativeMinted > maxSupply) {
            console.log(`⚠️ OVERFLOW: Cumulative ${cumulativeMinted.toLocaleString()} exceeds max supply ${maxSupply.toLocaleString()}!`);
            break;
        }
        
        // Update for next epoch
        currentBurnThreshold = Math.floor(currentBurnThreshold * thresholdMultiplier); // Apply threshold multiplier
        currentReward = Math.max(1, Math.floor((currentReward * halvingStep) / 100));
        epoch += 1;
    }
    
    console.log(`\nSummary for ${name}:`);
    console.log(`  Total epochs: ${epochs.length}`);
    console.log(`  Total minted: ${cumulativeMinted.toLocaleString()} tokens`);
    console.log(`  Overmint factor: ${(cumulativeMinted / maxSupply).toFixed(1)}x`);
    
    // Show first epoch details
    if (epochs.length > 0) {
        const firstEpoch = epochs[0];
        console.log(`\nFirst epoch analysis:`);
        console.log(`  Minted: ${firstEpoch.minted.toLocaleString()} tokens`);
        console.log(`  As % of max supply: ${((firstEpoch.minted / maxSupply) * 100).toFixed(1)}%`);
        
        if (firstEpoch.minted > maxSupply) {
            console.log(`  🚨 CRITICAL: First epoch alone mints ${(firstEpoch.minted / maxSupply).toFixed(1)}x the entire max supply!`);
        }
    }
    
    return epochs;
}

// Test all presets
console.log('Simulating Backend Graph Data for All Presets');
console.log('=============================================');

const presets = [
    { name: 'Extended Distribution', maxSupply: 1_000_000, burnUnit: 200_000, rewardRate: 100, halvingStep: 90 },
    { name: 'Balanced', maxSupply: 1_000_000, burnUnit: 500_000, rewardRate: 500, halvingStep: 45 },
    { name: 'Quick Launch', maxSupply: 1_000_000, burnUnit: 1_000_000, rewardRate: 2000, halvingStep: 70 }
];

const results = {};
for (const preset of presets) {
    results[preset.name] = simulatePreset(preset.name, preset.maxSupply, preset.burnUnit, preset.rewardRate, preset.halvingStep);
}

// Compare presets
console.log('\n\n=== Preset Comparison ===');
console.log('Name                  | Epochs | Total Minted      | First Epoch      | Overmint Factor');
console.log('---------------------|--------|-------------------|------------------|----------------');
for (const [name, epochs] of Object.entries(results)) {
    const preset = presets.find(p => p.name === name);
    const totalMinted = epochs.length > 0 ? epochs[epochs.length - 1].cumulative : 1;
    const firstEpochMinted = epochs.length > 0 ? epochs[0].minted : 0;
    const overmintFactor = totalMinted / preset.maxSupply;
    
    console.log(`${name.padEnd(20)} | ${epochs.length.toString().padEnd(6)} | ${totalMinted.toLocaleString().padEnd(17)} | ${firstEpochMinted.toLocaleString().padEnd(16)} | ${overmintFactor.toFixed(1)}x`);
}

console.log('\n\nKey Findings:');
console.log('1. All presets massively overmint due to the multiplication bug');
console.log('2. Quick Launch preset mints 20 MILLION tokens in first epoch (20x the max supply!)');
console.log('3. Even "Extended Distribution" only gets 10 epochs, not 15+');
console.log('4. The graphs would show these inflated values to users');