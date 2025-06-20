/// Final verification test that shows exact table output

#[test]
fn test_final_verification() {
    println!("\n=== FINAL VERIFICATION ===");
    
    const E8S: u128 = 100_000_000;
    
    // Quick Launch simulation with fixed formula
    let max_supply_e8s = 100_000_000_000_000u128;  // 1M tokens
    let tge_e8s = 10_000_000_000u128;              // 100 tokens
    let initial_burn_e8s = 100_000_000_000_000u128; // 1M tokens
    let initial_reward_e8s = 200_000_000_000u128;   // 2000 tokens
    let halving = 70;
    
    let mut total_minted = tge_e8s;
    let mut burn_requirement = initial_burn_e8s;
    let mut reward_rate = initial_reward_e8s;
    let mut cumulative_burn = 0u128;
    
    println!("Expected Table Output:");
    println!("Epoch\tCumulative Secondary Burned\tCumulative Primary Minted\tPrimary Minted In Epoch\tSupply Minted (%)");
    
    // TGE
    let tge_tokens = tge_e8s as f64 / E8S as f64;
    let tge_percent = (tge_tokens / (max_supply_e8s as f64 / E8S as f64)) * 100.0;
    println!("TGE\t0\t{:.4}\t{:.4}\t{:.2}%", tge_tokens, tge_tokens, tge_percent);
    
    let mut epoch = 0;
    while total_minted < max_supply_e8s && epoch < 10 {
        // Fixed formula
        let reward_e8s = (reward_rate * burn_requirement) / (E8S * 10000);
        
        if reward_e8s == 0 {
            break;
        }
        
        // Check cap
        let actual_reward = if total_minted + reward_e8s > max_supply_e8s {
            max_supply_e8s - total_minted
        } else {
            reward_e8s
        };
        
        cumulative_burn += burn_requirement;
        total_minted += actual_reward;
        epoch += 1;
        
        let cumulative_burn_display = cumulative_burn / E8S;
        let cumulative_minted_tokens = total_minted as f64 / E8S as f64;
        let epoch_minted_tokens = actual_reward as f64 / E8S as f64;
        let percent = (cumulative_minted_tokens / (max_supply_e8s as f64 / E8S as f64)) * 100.0;
        
        println!("Epoch {}\t{}\t{:.4}\t{:.4}\t{:.2}%",
            epoch,
            cumulative_burn_display.to_string().chars()
                .collect::<Vec<char>>()
                .chunks(3)
                .rev()
                .map(|chunk| chunk.iter().collect::<String>())
                .collect::<Vec<String>>()
                .into_iter()
                .rev()
                .collect::<Vec<String>>()
                .join(","),
            cumulative_minted_tokens,
            epoch_minted_tokens,
            percent
        );
        
        if actual_reward != reward_e8s {
            println!("(Supply cap reached)");
            break;
        }
        
        // Next epoch
        burn_requirement *= 2;
        reward_rate = (reward_rate * halving) / 100;
    }
    
    println!("\nResult: {} epochs", epoch);
    
    if epoch == 1 {
        println!("❌ STILL ONLY 1 EPOCH - The issue persists!");
        
        // Debug first epoch
        let first_reward = (200_000_000_000u128 * 100_000_000_000_000u128) / (E8S * 10000);
        println!("\nFirst epoch calculation:");
        println!("  ({} * {}) / ({} * 10000)", 200_000_000_000u128, 100_000_000_000_000u128, E8S);
        println!("  = {} E8S", first_reward);
        println!("  = {} tokens", first_reward / E8S);
        
        if first_reward > max_supply_e8s {
            println!("  This exceeds max supply!");
        }
    } else {
        println!("✅ Multiple epochs achieved!");
    }
}