/// Test to understand why tokenomics schedule generation produces wrong number of epochs

#[test]
fn test_tokenomics_schedule_generation_default() {
    println!("\n=== Tokenomics Schedule Generation - Default Preset ===");
    
    // Default preset parameters
    let initial_secondary_burn = 1_000_000u128;
    let initial_reward_per_burn_unit = 2000u128;
    let max_primary_supply = 1_000_000u128;
    let halving_step = 70u128;
    const E8S: u128 = 100_000_000;
    
    // Simulate the generate_tokenomics_schedule function
    let mut secondary_thresholds = Vec::new();
    let mut primary_rewards = Vec::new();
    
    let mut burn_for_epoch = initial_secondary_burn;
    let mut cumulative_burn = 0u128;
    let mut total_minted = 0u128;
    let mut primary_per_threshold = initial_reward_per_burn_unit;
    let mut epoch_count = 0;
    
    println!("Starting generation:");
    println!("- Max supply: {} tokens", max_primary_supply);
    println!("- Initial burn: {} secondary", initial_secondary_burn);
    println!("- Initial reward: {} per burn unit", initial_reward_per_burn_unit);
    
    while total_minted < max_primary_supply && epoch_count < 20 {
        let in_slot_burn = burn_for_epoch;
        let reward_e8s = primary_per_threshold * in_slot_burn * 10000;
        let reward = reward_e8s / E8S;
        
        epoch_count += 1;
        println!("\nEpoch {}:", epoch_count);
        println!("- Burn requirement: {} secondary", burn_for_epoch);
        println!("- Reward rate: {} per burn unit", primary_per_threshold);
        println!("- Tokens minted: {} (e8s: {})", reward, reward_e8s);
        println!("- Total minted so far: {} + {} = {}", total_minted, reward, total_minted + reward);
        
        if reward == 0 {
            println!("- STOPPING: Reward is 0");
            break;
        }
        
        cumulative_burn += burn_for_epoch;
        secondary_thresholds.push(cumulative_burn);
        primary_rewards.push(primary_per_threshold);
        
        total_minted += reward;
        
        if total_minted >= max_primary_supply {
            println!("- STOPPING: Reached max supply ({} >= {})", total_minted, max_primary_supply);
            break;
        }
        
        burn_for_epoch *= 2;
        primary_per_threshold = std::cmp::max(1, (primary_per_threshold * halving_step) / 100);
    }
    
    println!("\nFinal schedule:");
    println!("- Total epochs: {}", secondary_thresholds.len());
    println!("- Total minted: {} tokens", total_minted);
    println!("- Secondary thresholds: {:?}", secondary_thresholds);
    println!("- Primary rewards: {:?}", primary_rewards);
    
    // The issue: With default preset, first epoch mints 200,000 tokens
    // But max supply is 1,000,000, so we should have ~5 epochs, not 1
    assert!(
        secondary_thresholds.len() >= 3,
        "Should have at least 3 epochs, got {}",
        secondary_thresholds.len()
    );
}

#[test]
fn test_tokenomics_schedule_generation_extended() {
    println!("\n=== Tokenomics Schedule Generation - Extended Preset ===");
    
    // Extended preset parameters
    let initial_secondary_burn = 200_000u128;
    let initial_reward_per_burn_unit = 100u128;
    let max_primary_supply = 1_000_000u128;
    let halving_step = 90u128;
    const E8S: u128 = 100_000_000;
    
    // Simulate the generate_tokenomics_schedule function
    let mut secondary_thresholds = Vec::new();
    let mut primary_rewards = Vec::new();
    
    let mut burn_for_epoch = initial_secondary_burn;
    let mut cumulative_burn = 0u128;
    let mut total_minted = 0u128;
    let mut primary_per_threshold = initial_reward_per_burn_unit;
    let mut epoch_count = 0;
    
    while total_minted < max_primary_supply && epoch_count < 30 {
        let in_slot_burn = burn_for_epoch;
        let reward_e8s = primary_per_threshold * in_slot_burn * 10000;
        let reward = reward_e8s / E8S;
        
        epoch_count += 1;
        
        if reward == 0 {
            break;
        }
        
        cumulative_burn += burn_for_epoch;
        secondary_thresholds.push(cumulative_burn);
        primary_rewards.push(primary_per_threshold);
        
        total_minted += reward;
        
        if total_minted >= max_primary_supply {
            break;
        }
        
        burn_for_epoch *= 2;
        primary_per_threshold = std::cmp::max(1, (primary_per_threshold * halving_step) / 100);
    }
    
    println!("Extended distribution results:");
    println!("- Total epochs: {}", secondary_thresholds.len());
    println!("- Total minted: {} tokens", total_minted);
    
    // First few epochs for debugging
    for i in 0..std::cmp::min(5, secondary_thresholds.len()) {
        let burn = if i == 0 { secondary_thresholds[i] } else { secondary_thresholds[i] - secondary_thresholds[i-1] };
        let reward_e8s = primary_rewards[i] * burn * 10000;
        let reward_tokens = reward_e8s / E8S;
        println!("- Epoch {}: burn {} secondary, reward rate {}, mints {} tokens", 
            i + 1, burn, primary_rewards[i], reward_tokens);
    }
    
    assert!(
        secondary_thresholds.len() >= 15,
        "Should have at least 15 epochs, got {}",
        secondary_thresholds.len()
    );
}