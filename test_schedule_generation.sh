#!/bin/bash

echo "Testing tokenomics schedule generation directly..."

# Create a simple Rust test program
cat > test_schedule.rs << 'EOF'
fn main() {
    const E8S: u128 = 100_000_000;
    
    // Quick Launch parameters
    let initial_reward_per_burn_unit = 200_000_000_000u128; // 2000 * E8S
    let max_primary_supply = 100_000_000_000_000u128; // 1M * E8S
    let initial_secondary_burn = 100_000_000_000_000u128; // 1M * E8S
    let halving_step = 7_000_000_000_000u128; // 70k * E8S
    
    println!("Parameters:");
    println!("  initial_reward: {} ({})", initial_reward_per_burn_unit, initial_reward_per_burn_unit / E8S);
    println!("  max_supply: {} ({})", max_primary_supply, max_primary_supply / E8S);
    println!("  initial_burn: {} ({})", initial_secondary_burn, initial_secondary_burn / E8S);
    println!("  halving: {} ({})", halving_step, halving_step / E8S);
    
    let mut total_minted = 0u128;
    let mut burn_for_epoch = initial_secondary_burn;
    let mut cumulative_burn = 0u128;
    let mut primary_per_threshold = initial_reward_per_burn_unit;
    let mut epoch = 0;
    
    println!("\nSimulating epochs:");
    
    while total_minted < max_primary_supply {
        epoch += 1;
        let in_slot_burn = burn_for_epoch;
        
        // Apply the fix
        let reward_e8s = (primary_per_threshold * in_slot_burn) / (E8S * 10000);
        
        println!("\nEpoch {}:", epoch);
        println!("  burn_for_epoch: {} ({})", burn_for_epoch, burn_for_epoch / E8S);
        println!("  primary_per_threshold: {} ({})", primary_per_threshold, primary_per_threshold / E8S);
        println!("  reward calculation: ({} * {}) / ({} * 10000)", primary_per_threshold, in_slot_burn, E8S);
        println!("  reward_e8s: {} ({})", reward_e8s, reward_e8s / E8S);
        
        if total_minted + reward_e8s > max_primary_supply {
            let remaining = max_primary_supply - total_minted;
            println!("  Would exceed max supply. Remaining: {} ({})", remaining, remaining / E8S);
            break;
        }
        
        total_minted += reward_e8s;
        cumulative_burn += burn_for_epoch;
        burn_for_epoch *= 2;
        
        if primary_per_threshold > 1 {
            primary_per_threshold = std::cmp::max(1, (primary_per_threshold * halving_step) / E8S);
        }
        
        println!("  total_minted: {} ({})", total_minted, total_minted / E8S);
        println!("  Next burn_for_epoch: {} ({})", burn_for_epoch, burn_for_epoch / E8S);
        println!("  Next primary_per_threshold: {} ({})", primary_per_threshold, primary_per_threshold / E8S);
        
        if epoch > 10 {
            println!("\nStopping after 10 epochs for safety");
            break;
        }
    }
    
    println!("\nFinal total_minted: {} ({}) - {}% of max supply", 
        total_minted, total_minted / E8S, (total_minted * 100) / max_primary_supply);
}
EOF

rustc test_schedule.rs && ./test_schedule