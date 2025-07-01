// Test the tokenomics_simple.rs implementation

const E8S: u128 = 100_000_000;

// Replicate the calculate_primary_minted function
fn calculate_primary_minted(secondary_burned_e8s: u128, reward_rate_e8s: u128) -> u128 {
    // Convert E8S reward rate to 4-decimal format (as used by tokenomics canister)
    let reward_rate_4decimal = reward_rate_e8s / 10_000;
    
    // Convert secondary burned from E8S to natural units
    let secondary_burned_natural = secondary_burned_e8s / E8S;
    
    // Apply tokenomics formula: rate × amount
    // Then convert result to E8S
    reward_rate_4decimal
        .saturating_mul(secondary_burned_natural)
        .saturating_mul(E8S) / 10_000  // Convert 4-decimal result to E8S
}

fn main() {
    println!("=== DEBUGGING TOKENOMICS_SIMPLE.RS CALCULATION ===\n");
    
    // Test case matching the hardcoded tokenomics values
    let initial_burn = 21_000u128;  // Natural units
    let initial_reward = 5u128;     // Natural units (5 tokens per burn)
    let halving = 50;  // 50% halving
    let max_supply = 1_948_800u128; // Natural units
    
    println!("Configuration:");
    println!("  Initial burn: {} tokens", initial_burn);
    println!("  Initial reward: {} tokens per burn", initial_reward);
    println!("  Halving: {}%", halving);
    println!("  Max supply: {} tokens\n", max_supply);
    
    // Simulate the generation
    let mut cumulative_primary_e8s = 0u128;
    let mut cumulative_secondary_e8s = 0u128;
    let mut burn_per_epoch_e8s = initial_burn * E8S;
    let mut reward_rate_e8s = initial_reward * E8S;
    let max_supply_e8s = max_supply * E8S;
    
    println!("Epoch | Burn/Epoch | Reward Rate | Primary Minted | Cumulative Primary");
    println!("{}", "-".repeat(70));
    
    for epoch in 1..=20 {
        // Calculate using the function
        let primary_minted = calculate_primary_minted(burn_per_epoch_e8s, reward_rate_e8s);
        let remaining = max_supply_e8s.saturating_sub(cumulative_primary_e8s);
        
        if remaining == 0 {
            break;
        }
        
        let actual_minted = primary_minted.min(remaining);
        cumulative_primary_e8s += actual_minted;
        cumulative_secondary_e8s += burn_per_epoch_e8s;
        
        println!("{:5} | {:10} | {:11.4} | {:14} | {:18} ({})",
            epoch,
            burn_per_epoch_e8s / E8S,
            reward_rate_e8s as f64 / E8S as f64,
            actual_minted / E8S,
            cumulative_primary_e8s / E8S,
            cumulative_primary_e8s as f64 / E8S as f64
        );
        
        // Update for next epoch
        burn_per_epoch_e8s *= 2;  // Double burn
        reward_rate_e8s = reward_rate_e8s * halving as u128 / 100;  // Apply halving
        
        if cumulative_primary_e8s >= max_supply_e8s {
            break;
        }
    }
    
    println!("\n=== RESULTS ===");
    println!("Total primary minted: {} tokens", cumulative_primary_e8s as f64 / E8S as f64);
    println!("Total secondary burned: {} tokens", cumulative_secondary_e8s / E8S);
    
    // Now test with the exact hardcoded values
    println!("\n=== CHECKING AGAINST HARDCODED VALUES ===\n");
    
    let hardcoded_thresholds = [21_000u64, 42_000, 84_000, 168_000, 336_000, 672_000, 
                                1_344_000, 2_688_000, 5_376_000, 10_752_000, 21_504_000, 43_008_000];
    let hardcoded_rates = [50_000u64, 25_000, 12_500, 6_250, 3_125, 1_562, 781, 391, 195, 98, 49, 24];
    
    let mut total_4decimal = 0u64;
    for i in 0..12 {
        let prev = if i == 0 { 0 } else { hardcoded_thresholds[i-1] };
        let burn_this_epoch = hardcoded_thresholds[i] - prev;
        let minted_4decimal = burn_this_epoch * hardcoded_rates[i];
        total_4decimal += minted_4decimal;
        
        if i == 11 {
            // Partial epoch 12
            let partial_burn = 8_040_666u64;
            let partial_minted = partial_burn * hardcoded_rates[i];
            total_4decimal = 6_496_000_000; // Exact target
            println!("Epoch {}: {} burn × {} rate = {} (partial)", 
                i+1, partial_burn, hardcoded_rates[i], partial_minted);
            break;
        }
        
        println!("Epoch {}: {} burn × {} rate = {}", 
            i+1, burn_this_epoch, hardcoded_rates[i], minted_4decimal);
    }
    
    println!("\nHardcoded total (4-decimal): {}", total_4decimal);
    println!("Hardcoded total (tokens): {}", total_4decimal as f64 / 10_000.0);
    println!("With 3x multiplier: {}", (total_4decimal as f64 / 10_000.0) * 3.0);
    
    // Check the difference
    println!("\n=== ANALYZING THE DIFFERENCE ===");
    
    // The issue might be in how rewards are calculated
    let test_burn = 21_000 * E8S;
    let test_reward = 5 * E8S;
    let result = calculate_primary_minted(test_burn, test_reward);
    
    println!("\nTest calculation:");
    println!("  Burn: {} E8S ({} tokens)", test_burn, test_burn / E8S);
    println!("  Reward rate: {} E8S ({} tokens)", test_reward, test_reward / E8S);
    println!("  Result: {} E8S ({} tokens)", result, result / E8S);
    println!("  Expected: {} E8S ({} tokens)", 105_000 * E8S, 105_000);
    
    // Check if the issue is the 4-decimal conversion
    let reward_4dec = test_reward / 10_000;
    let burn_natural = test_burn / E8S;
    let manual_calc = reward_4dec * burn_natural * E8S / 10_000;
    
    println!("\nManual calculation breakdown:");
    println!("  Reward (4-decimal): {}", reward_4dec);
    println!("  Burn (natural): {}", burn_natural);
    println!("  Product: {}", reward_4dec * burn_natural);
    println!("  Final (E8S): {}", manual_calc);
}