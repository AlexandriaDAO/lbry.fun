/// Analyze what the original formula actually does

#[test]
fn test_original_formula_analysis() {
    println!("\n=== Original Formula Analysis ===");
    
    const E8S: u128 = 100_000_000;
    
    // Let's trace through what happens with Quick Launch preset
    println!("Quick Launch Preset:");
    println!("- Frontend sends:");
    println!("  - max_supply: 1,000,000 tokens = {} E8S", 1_000_000 * E8S);
    println!("  - initial_burn: 1,000,000 tokens = {} E8S", 1_000_000 * E8S);  
    println!("  - reward_rate: 2000 = {} E8S", 2000 * E8S);
    
    let primary_per_threshold = 2000 * E8S;  // as u128
    let in_slot_burn = 1_000_000 * E8S;     // as u128
    
    println!("\nCalculation:");
    println!("reward_e8s = {} * {} * 10000", primary_per_threshold, in_slot_burn);
    let reward_e8s = primary_per_threshold * in_slot_burn * 10000;
    println!("reward_e8s = {}", reward_e8s);
    
    let reward = reward_e8s / E8S;
    println!("reward = {} / {} = {}", reward_e8s, E8S, reward);
    println!("reward = {} tokens", reward);
    
    // Check if this exceeds max supply
    let max_supply = 1_000_000u128;
    let percentage = (reward as f64 / max_supply as f64) * 100.0;
    println!("\nThis is {}% of max supply!", percentage);
    
    if reward > max_supply {
        println!("⚠️  OVERMINTING: First epoch alone mints {} tokens!", reward);
        println!("This is why the frontend shows 142% overminting!");
    }
    
    // Now let's see what happens if the parameters are interpreted differently
    println!("\n\nAlternative Interpretation:");
    println!("What if 'initial_reward_per_burn_unit' means tokens per burn unit?");
    println!("And we treat the * 10000 as converting from basis points?");
    
    // If reward_rate is 2000 basis points (20%) per burn unit
    let basis_points = 2000u128;
    let burn_units = 1_000_000u128;
    let alt_reward = (basis_points * burn_units) / 10000;
    println!("reward = ({} * {}) / 10000 = {} tokens", basis_points, burn_units, alt_reward);
    println!("This gives {} tokens ({}% of supply)", alt_reward, (alt_reward as f64 / max_supply as f64) * 100.0);
    
    println!("\nCONCLUSION:");
    println!("The 'bug' isn't really a bug - it's a parameter scaling issue!");
    println!("The frontend is sending E8S values, but the formula expects smaller numbers.");
}