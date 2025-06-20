/// Debug test to understand the calculation issue

#[test]
fn test_debug_calculation() {
    println!("\n=== Debug Calculation Test ===");
    
    const E8S: u128 = 100_000_000;
    
    // Quick Launch parameters (as sent by frontend)
    let max_supply_e8s = 100_000_000_000_000u128;  // 1M * E8S
    let initial_burn_e8s = 100_000_000_000_000u128; // 1M * E8S  
    let reward_rate_e8s = 200_000_000_000u128;      // 2000 * E8S
    let halving = 70u128;
    
    println!("Quick Launch Parameters (in E8S):");
    println!("  max_supply: {} ({}M tokens)", max_supply_e8s, max_supply_e8s / E8S / 1_000_000);
    println!("  initial_burn: {} ({}M tokens)", initial_burn_e8s, initial_burn_e8s / E8S / 1_000_000);
    println!("  reward_rate: {} ({} per burn unit)", reward_rate_e8s, reward_rate_e8s / E8S);
    
    // Original buggy calculation
    println!("\n1. ORIGINAL BUGGY FORMULA:");
    let buggy_reward_e8s = reward_rate_e8s * initial_burn_e8s * 10000;
    let buggy_reward = buggy_reward_e8s / E8S;
    println!("   reward_e8s = {} * {} * 10000", reward_rate_e8s, initial_burn_e8s);
    println!("   reward_e8s = {}", buggy_reward_e8s);
    println!("   reward_tokens = {} / {} = {}", buggy_reward_e8s, E8S, buggy_reward);
    println!("   Result: {} tokens ({}% of max supply)", buggy_reward, (buggy_reward as f64 / (max_supply_e8s as f64 / E8S as f64)) * 100.0);
    
    // My "fixed" calculation
    println!("\n2. MY 'FIXED' FORMULA:");
    let fixed_reward_e8s = (reward_rate_e8s * initial_burn_e8s) / E8S / 10000;
    let fixed_reward = fixed_reward_e8s / E8S;
    println!("   reward_e8s = ({} * {}) / {} / 10000", reward_rate_e8s, initial_burn_e8s, E8S);
    println!("   reward_e8s = {}", fixed_reward_e8s);
    println!("   reward_tokens = {} / {} = {}", fixed_reward_e8s, E8S, fixed_reward);
    println!("   Result: {} tokens", fixed_reward);
    
    if fixed_reward == 0 {
        println!("   ⚠️  WARNING: This would mint 0 tokens! That's why we only get 1 epoch!");
    }
    
    // What if the parameters aren't in E8S?
    println!("\n3. IF PARAMETERS WERE NATURAL UNITS:");
    let natural_burn = 1_000_000u128;
    let natural_rate = 2000u128;
    let natural_reward = (natural_rate * natural_burn) / 10000;
    println!("   reward = ({} * {}) / 10000 = {}", natural_rate, natural_burn, natural_reward);
    println!("   Result: {} tokens", natural_reward);
    
    // What if we need to handle E8S differently?
    println!("\n4. ALTERNATIVE INTERPRETATION:");
    println!("   If initial_burn is in E8S but represents burn units (not tokens):");
    let burn_units = initial_burn_e8s / E8S;  // Convert to natural units
    let reward_per_unit = reward_rate_e8s / E8S;  // Convert to natural units
    let alt_reward = (reward_per_unit * burn_units) / 10000;
    println!("   burn_units = {} / {} = {}", initial_burn_e8s, E8S, burn_units);
    println!("   reward_per_unit = {} / {} = {}", reward_rate_e8s, E8S, reward_per_unit);
    println!("   reward = ({} * {}) / 10000 = {}", reward_per_unit, burn_units, alt_reward);
    println!("   Result: {} tokens", alt_reward);
    
    println!("\nCONCLUSION:");
    println!("The issue is that my 'fix' divides by E8S twice, resulting in tiny numbers.");
    println!("This causes the reward to round down to 0, stopping after 1 epoch.");
}