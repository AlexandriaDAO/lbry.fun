/// Direct test of the simulation logic to understand what graphs would show
#[test]
fn test_simulation_calculation() {
    println!("\n=== Simulation Calculation Test ===");
    
    // Test parameters matching our test environment
    let initial_secondary_burn = 5_000; // tokens
    let initial_reward_per_burn_unit = 100;
    let max_primary_supply = 21_000_000;
    let halving_step = 50;
    
    println!("Parameters:");
    println!("- Burn unit: {} secondary tokens", initial_secondary_burn);
    println!("- Initial reward: {} per burn unit", initial_reward_per_burn_unit);
    println!("- Halving: {}%", halving_step);
    
    // Simulate what the schedule generation would do
    let mut current_reward = initial_reward_per_burn_unit;
    let mut epoch = 1;
    
    println!("\nSimulated epochs:");
    while current_reward > 0 && epoch <= 10 {
        // Calculate tokens per burn for this epoch
        // Based on: reward_e8s = primary_per_threshold * in_slot_burn * 10000
        let tokens_per_burn = (current_reward as u128 * initial_secondary_burn as u128 * 10000) / 100_000_000;
        
        println!("Epoch {}: {} tokens per burn (rate={})", 
                 epoch, tokens_per_burn, current_reward);
        
        // Apply halving
        current_reward = std::cmp::max(1, (current_reward * halving_step) / 100);
        epoch += 1;
    }
    
    println!("\nConclusion:");
    println!("The SIMULATION would show: 50→25→12→6→3... tokens per burn");
    println!("But ACTUAL implementation gives: 50→50→50→50... tokens per burn");
    println!("This confirms a mismatch IF the graphs use simulation data.");
}