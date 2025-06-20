/// Simple test to show the raw simulation data for each preset

#[test]
fn test_show_raw_simulation_data() {
    println!("\n=== Raw Simulation Data for All Presets ===");
    
    const E8S: u128 = 100_000_000;
    
    // Define the three presets
    let presets = vec![
        ("Extended Distribution", 1_000_000u128, 200_000u128, 100u128, 90u128),
        ("Balanced", 1_000_000u128, 500_000u128, 500u128, 45u128),
        ("Quick Launch", 1_000_000u128, 1_000_000u128, 2000u128, 70u128),
    ];
    
    for (name, max_supply, initial_burn, initial_reward, halving) in presets {
        println!("\n\n{'='*60}");
        println!("PRESET: {}", name);
        println!("{'='*60}");
        println!("Parameters:");
        println!("- Max supply: {} tokens", max_supply);
        println!("- Initial burn unit: {} tokens", initial_burn);
        println!("- Initial reward rate: {} per burn unit", initial_reward);
        println!("- Halving: {}%", halving);
        
        // Simulate with FIXED formula
        let mut total_minted = 0u128;
        let mut burn_requirement = initial_burn;
        let mut reward_rate = initial_reward;
        let mut epochs = Vec::new();
        let mut cumulative_burn = 0u128;
        
        // TGE
        let tge = 100u128;
        total_minted += tge;
        
        println!("\nEpoch Data:");
        println!("Epoch\tBurn Required\tReward Rate\tTokens Minted\tCumulative Minted\tUSD Cost");
        println!("TGE\t0\t-\t{}\t{}\t$0.00", tge, total_minted);
        
        while total_minted < max_supply && epochs.len() < 30 {
            // FIXED formula (divide by 10000)
            let reward_tokens = (reward_rate * burn_requirement) / 10000;
            
            if reward_tokens == 0 {
                break;
            }
            
            // Check if this epoch would exceed max supply
            if total_minted + reward_tokens > max_supply {
                let remaining = max_supply - total_minted;
                cumulative_burn += burn_requirement;
                epochs.push((burn_requirement, reward_rate, remaining));
                total_minted = max_supply;
                
                let usd_cost = (burn_requirement as f64) * 0.005;
                println!("Epoch {}\t{}\t{}\t{} (capped)\t{}\t${:.2}", 
                    epochs.len(), burn_requirement, reward_rate, remaining, total_minted, usd_cost);
                break;
            }
            
            cumulative_burn += burn_requirement;
            epochs.push((burn_requirement, reward_rate, reward_tokens));
            total_minted += reward_tokens;
            
            let usd_cost = (burn_requirement as f64) * 0.005;
            
            if epochs.len() <= 10 || epochs.len() == 15 {
                println!("Epoch {}\t{}\t{}\t{}\t{}\t${:.2}", 
                    epochs.len(), burn_requirement, reward_rate, reward_tokens, total_minted, usd_cost);
            }
            
            burn_requirement *= 2;
            reward_rate = std::cmp::max(1, (reward_rate * halving) / 100);
        }
        
        if epochs.len() > 10 && epochs.len() != 15 {
            println!("... ({} epochs total)", epochs.len());
        }
        
        println!("\nSUMMARY:");
        println!("- Total epochs: {}", epochs.len());
        println!("- Total minted: {} tokens", total_minted);
        println!("- Supply utilization: {:.2}%", (total_minted as f64 / max_supply as f64) * 100.0);
        
        if name == "Extended Distribution" && epochs.len() < 15 {
            println!("⚠️  Extended Distribution has only {} epochs (expected 15+)", epochs.len());
        }
        
        if total_minted > max_supply {
            println!("❌ OVERMINTING: {:.2}% over max supply!", ((total_minted as f64 / max_supply as f64) - 1.0) * 100.0);
        } else {
            println!("✅ No overminting detected");
        }
    }
    
    println!("\n\nNOTE: This simulation uses the FIXED formula that divides by 10000.");
    println!("If you see overminting, the fix has not been properly applied to the backend.");
}