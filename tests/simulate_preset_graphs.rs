/// Simulate what the preview_tokenomics_graphs function returns for each preset
/// This will show us exactly what data the frontend graphs display

#[test]
fn test_simulate_preset_graph_data() {
    const E8S: u128 = 100_000_000;
    
    // Preset configurations
    let presets = vec![
        ("Extended Distribution", 1_000_000u128, 200_000u128, 100u128, 90u128),
        ("Balanced", 1_000_000u128, 500_000u128, 500u128, 45u128),
        ("Quick Launch", 1_000_000u128, 1_000_000u128, 2000u128, 70u128),
    ];
    
    for (name, max_supply, burn_unit, reward_rate, halving) in presets {
        println!("\n=== {} Preset ===", name);
        println!("Parameters:");
        println!("  Max supply: {} tokens", max_supply);
        println!("  Burn unit: {} tokens", burn_unit);
        println!("  Initial reward: {} per burn unit", reward_rate);
        println!("  Halving: {}%", halving);
        
        // Simulate the backend's generate_tokenomics_schedule logic
        let mut cumulative_minted = 0u128;
        let mut current_burn_threshold = burn_unit;
        let mut current_reward = reward_rate;
        let mut epoch = 1;
        
        println!("\nEpoch Data (CSV format):");
        println!("Epoch,Secondary Burned,Primary Minted,Cumulative Primary,USD Cost");
        
        // TGE (epoch 0)
        let tge_amount = 1u128; // 1 token TGE
        cumulative_minted += tge_amount;
        println!("TGE,0,{},{},0", tge_amount, cumulative_minted);
        
        while cumulative_minted < max_supply && epoch <= 20 {
            // The buggy calculation from simulation.rs
            let reward_e8s = current_reward * current_burn_threshold * 10000;
            let reward_tokens = reward_e8s / E8S;
            
            // Check if this would exceed max supply
            if cumulative_minted + reward_tokens > max_supply {
                // Backend adds this epoch anyway (the bug!)
                cumulative_minted += reward_tokens;
                let usd_cost = (current_burn_threshold as f64) * 0.005;
                println!("Epoch {},{}Epoch {},{},{},{:.2}", 
                    epoch, current_burn_threshold, epoch, 
                    reward_tokens, cumulative_minted, usd_cost);
                println!("⚠️ OVERFLOW: Cumulative {} exceeds max supply {}!", 
                    cumulative_minted, max_supply);
                break;
            }
            
            cumulative_minted += reward_tokens;
            let usd_cost = (current_burn_threshold as f64) * 0.005;
            
            println!("Epoch {},{}Epoch {},{},{},{:.2}", 
                epoch, current_burn_threshold, epoch, 
                reward_tokens, cumulative_minted, usd_cost);
            
            // Update for next epoch
            current_burn_threshold *= 2; // Double the burn requirement
            current_reward = std::cmp::max(1, (current_reward * halving) / 100);
            epoch += 1;
        }
        
        println!("\nSummary for {}:", name);
        println!("  Total epochs: {}", epoch - 1);
        println!("  Total minted: {} tokens", cumulative_minted);
        println!("  Overmint factor: {:.1}x", cumulative_minted as f64 / max_supply as f64);
        
        // Show what happens in first few epochs
        println!("\nFirst epoch details:");
        let first_epoch_e8s = reward_rate * burn_unit * 10000;
        let first_epoch_tokens = first_epoch_e8s / E8S;
        println!("  Calculation: {} * {} * 10000 / {} = {} tokens", 
            reward_rate, burn_unit, E8S, first_epoch_tokens);
        println!("  As percentage of max supply: {:.1}%", 
            (first_epoch_tokens as f64 / max_supply as f64) * 100.0);
    }
}

#[test]
fn test_demonstrate_overminting_bug() {
    println!("\n=== Demonstrating Overminting Bug ===");
    
    // Quick Launch preset
    let max_supply = 1_000_000u128;
    let burn_unit = 1_000_000u128;
    let reward_rate = 2000u128;
    const E8S: u128 = 100_000_000;
    
    println!("Quick Launch Preset:");
    println!("- Max supply: {} tokens", max_supply);
    println!("- First epoch burn requirement: {} tokens", burn_unit);
    println!("- Reward rate: {} per burn unit", reward_rate);
    
    // The bug: this calculation is wrong
    let first_epoch_reward_e8s = reward_rate * burn_unit * 10000;
    let first_epoch_reward = first_epoch_reward_e8s / E8S;
    
    println!("\nFirst Epoch Calculation:");
    println!("- reward_e8s = {} * {} * 10000", reward_rate, burn_unit);
    println!("- reward_e8s = {}", first_epoch_reward_e8s);
    println!("- reward_tokens = {} / {}", first_epoch_reward_e8s, E8S);
    println!("- reward_tokens = {} 🚨", first_epoch_reward);
    
    println!("\n❌ PROBLEM: First epoch mints {} tokens", first_epoch_reward);
    println!("   But max supply is only {} tokens!", max_supply);
    println!("   That's {}x the entire supply in just the first epoch!", 
        first_epoch_reward / max_supply);
    
    // What it should be
    println!("\n✅ CORRECT CALCULATION:");
    println!("If reward_rate means 'tokens per secondary burned':");
    println!("- First epoch should mint: {} tokens", reward_rate);
    println!("- Or if it's per burn unit: {} / {} = {} tokens", 
        reward_rate * burn_unit, 10000, (reward_rate * burn_unit) / 10000);
    
    assert!(first_epoch_reward > max_supply, 
        "Bug check: first epoch should exceed max supply");
}

#[test]
fn test_extended_distribution_epoch_count() {
    println!("\n=== Extended Distribution Epoch Count ===");
    
    // Extended preset with 90% halving
    let max_supply = 1_000_000u128;
    let burn_unit = 200_000u128;
    let reward_rate = 100u128;
    let halving = 90u128;
    const E8S: u128 = 100_000_000;
    
    let mut epochs = 0;
    let mut cumulative = 1u128; // TGE
    let mut current_burn = burn_unit;
    let mut current_reward = reward_rate;
    
    println!("Simulating Extended Distribution:");
    while cumulative < max_supply && epochs < 30 {
        let reward_e8s = current_reward * current_burn * 10000;
        let reward_tokens = reward_e8s / E8S;
        
        if epochs < 5 {
            println!("Epoch {}: {} tokens (rate={}, burn={})", 
                epochs + 1, reward_tokens, current_reward, current_burn);
        }
        
        cumulative += reward_tokens;
        epochs += 1;
        
        // Next epoch
        current_burn *= 2;
        current_reward = std::cmp::max(1, (current_reward * halving) / 100);
    }
    
    println!("\nResult: {} epochs before hitting max supply", epochs);
    println!("Expected: 15+ epochs");
    println!("Actual: {} epochs", epochs);
    
    if epochs < 15 {
        println!("❌ FAILED: Only {} epochs, not the promised 15+", epochs);
    }
}

#[test]
fn test_simulation_e8s_confusion() {
    println!("\n=== E8S Display Confusion ===");
    
    // Test with Quick Launch preset
    let burn_unit = 1_000_000u128;
    let reward_rate = 2000u128;
    const E8S: u128 = 100_000_000;
    
    let first_epoch_e8s = reward_rate * burn_unit * 10000;
    let first_epoch_tokens = first_epoch_e8s / E8S;
    
    println!("First epoch values:");
    println!("- In e8s: {}", first_epoch_e8s);
    println!("- In tokens: {}", first_epoch_tokens);
    println!("- If e8s displayed as tokens: {} 'tokens'", first_epoch_e8s);
    
    println!("\nIf frontend shows e8s without conversion:");
    println!("- User sees: {} tokens", first_epoch_e8s);
    println!("- User expects: ~{} tokens", reward_rate);
    println!("- That's {}x larger than expected!", first_epoch_e8s / reward_rate);
    
    // Check if frontend is doing the division
    println!("\nFrontend code check:");
    println!("- formatGraphData divides by E8S: ✓");
    println!("- yAxis: data.minted_per_epoch_data_y.map(v => Number(v) / E8S)");
    println!("- So frontend SHOULD show {} tokens, not {}", 
        first_epoch_tokens, first_epoch_e8s);
}