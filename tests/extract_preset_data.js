// Script to extract graph data for each preset
// Run this in the browser console on the token creation page

async function extractPresetData() {
    const presets = [
        {
            name: 'Extended Distribution',
            initial_secondary_burn: '200000',
            initial_reward_per_burn_unit: '100',
            halving_step: '90'
        },
        {
            name: 'Balanced',
            initial_secondary_burn: '500000',
            initial_reward_per_burn_unit: '500',
            halving_step: '45'
        },
        {
            name: 'Quick Launch',
            initial_secondary_burn: '1000000',
            initial_reward_per_burn_unit: '2000',
            halving_step: '70'
        }
    ];

    // Function to wait for graph data to load
    const waitForGraphData = () => new Promise(resolve => setTimeout(resolve, 2000));

    // Function to click the copy button and get clipboard data
    const getCopiedData = async () => {
        const copyButton = document.querySelector('button:has-text("Copy Backend Table Data")') || 
                          Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('Copy Backend Table Data'));
        
        if (!copyButton) {
            console.error('Copy button not found');
            return null;
        }

        copyButton.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
            const text = await navigator.clipboard.readText();
            return text;
        } catch (e) {
            console.error('Failed to read clipboard:', e);
            return null;
        }
    };

    // Set form values programmatically
    const setFormValues = (preset) => {
        // Find input fields
        const inputs = document.querySelectorAll('input');
        
        // Set primary_max_supply (Hard Cap)
        const hardCapInput = Array.from(inputs).find(input => 
            input.placeholder && input.placeholder.includes('10000000')) ||
            Array.from(inputs).find(input => input.name === 'primary_max_supply');
        if (hardCapInput) hardCapInput.value = '1000000';

        // Set initial_secondary_burn (Burn Unit)
        const burnUnitInput = Array.from(inputs).find(input => 
            input.placeholder && input.placeholder.includes('50000 tokens')) ||
            Array.from(inputs).find(input => input.name === 'initial_secondary_burn');
        if (burnUnitInput) burnUnitInput.value = preset.initial_secondary_burn;

        // Set initial_reward_per_burn_unit
        const rewardInput = Array.from(inputs).find(input => 
            input.placeholder && input.placeholder.includes('20000')) ||
            Array.from(inputs).find(input => input.name === 'initial_reward_per_burn_unit');
        if (rewardInput) rewardInput.value = preset.initial_reward_per_burn_unit;

        // Set halving_step
        const halvingInput = Array.from(inputs).find(input => 
            input.placeholder && input.placeholder.includes('50')) ||
            Array.from(inputs).find(input => input.name === 'halving_step');
        if (halvingInput) halvingInput.value = preset.halving_step;

        // Trigger change events
        [hardCapInput, burnUnitInput, rewardInput, halvingInput].forEach(input => {
            if (input) {
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    };

    console.log('Starting preset data extraction...\n');

    for (const preset of presets) {
        console.log(`\n=== ${preset.name} Preset ===`);
        console.log(`Parameters: burn_unit=${preset.initial_secondary_burn}, reward=${preset.initial_reward_per_burn_unit}, halving=${preset.halving_step}%`);
        
        // Set the form values
        setFormValues(preset);
        
        // Wait for graphs to update
        await waitForGraphData();
        
        // Get the data
        const tableData = await getCopiedData();
        
        if (tableData) {
            console.log('\nTable Data:');
            console.log(tableData);
            
            // Parse and analyze the data
            const lines = tableData.split('\n').filter(line => line.trim());
            const dataLines = lines.slice(1); // Skip header
            
            let totalMinted = 0;
            let maxSupply = 1000000;
            
            console.log('\nAnalysis:');
            dataLines.forEach((line, index) => {
                const parts = line.split('\t');
                if (parts.length >= 4) {
                    const epoch = parts[0];
                    const cumulativePrimary = parseFloat(parts[2].replace(/,/g, ''));
                    const mintedInEpoch = parseFloat(parts[3].replace(/,/g, ''));
                    
                    if (!isNaN(mintedInEpoch) && mintedInEpoch > 0) {
                        totalMinted += mintedInEpoch;
                        console.log(`${epoch}: ${mintedInEpoch.toLocaleString()} tokens minted (cumulative: ${cumulativePrimary.toLocaleString()})`);
                        
                        if (index === 1 && mintedInEpoch > maxSupply) {
                            console.log(`⚠️ FIRST EPOCH MINTS ${(mintedInEpoch/maxSupply).toFixed(1)}x THE ENTIRE MAX SUPPLY!`);
                        }
                    }
                }
            });
            
            console.log(`\nTotal epochs: ${dataLines.length - 1}`); // -1 for TGE
            console.log(`Total minted: ${totalMinted.toLocaleString()} tokens`);
            if (totalMinted > maxSupply) {
                console.log(`❌ OVERMINTING: ${(totalMinted/maxSupply).toFixed(1)}x max supply!`);
            }
        }
        
        // Small delay between presets
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n=== Extraction Complete ===');
}

// Instructions
console.log('Token Creation Graph Data Extractor');
console.log('-----------------------------------');
console.log('1. Make sure you are on the token creation page');
console.log('2. Run: extractPresetData()');
console.log('3. The script will cycle through each preset and extract the data');