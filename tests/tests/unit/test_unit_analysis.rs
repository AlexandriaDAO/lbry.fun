/// Careful unit analysis to get this right

#[test]
fn test_unit_analysis() {
    println!("\n=== Unit Analysis ===");
    
    const E8S: u128 = 100_000_000;
    
    // All inputs are in E8S
    let max_primary_supply = 100_000_000_000_000u128;      // 1M * E8S (E8S units)
    let initial_burn = 100_000_000_000_000u128;            // 1M * E8S (E8S units)
    let reward_rate = 200_000_000_000u128;                 // 2000 * E8S (E8S units)
    
    println!("Inputs (all in E8S):");
    println!("  max_primary_supply: {} E8S = {} tokens", max_primary_supply, max_primary_supply / E8S);
    println!("  initial_burn: {} E8S = {} tokens", initial_burn, initial_burn / E8S);
    println!("  reward_rate: {} E8S = {} tokens", reward_rate, reward_rate / E8S);
    
    println!("\nWhat we want:");
    println!("  2000 tokens per 1M token burn, divided by 10000");
    println!("  = 0.2 tokens per token burned");
    println!("  = 200,000 tokens for 1M burn");
    
    println!("\nCalculation options:");
    
    println!("\nOption 1: Work in E8S throughout");
    let reward_e8s = (reward_rate * initial_burn) / (E8S * 10000);
    println!("  reward_e8s = ({} * {}) / ({} * 10000)", reward_rate, initial_burn, E8S);
    println!("  reward_e8s = {} / {}", reward_rate * initial_burn, E8S * 10000);
    println!("  reward_e8s = {} E8S", reward_e8s);
    println!("  reward_tokens = {} / {} = {} tokens", reward_e8s, E8S, reward_e8s / E8S);
    
    println!("\nOption 2: Convert to natural first");
    let rate_natural = reward_rate / E8S;
    let burn_natural = initial_burn / E8S;
    let reward_natural = (rate_natural * burn_natural) / 10000;
    let reward_e8s_2 = reward_natural * E8S;
    println!("  rate_natural = {} tokens", rate_natural);
    println!("  burn_natural = {} tokens", burn_natural);
    println!("  reward_natural = ({} * {}) / 10000 = {} tokens", rate_natural, burn_natural, reward_natural);
    println!("  reward_e8s = {} * {} = {} E8S", reward_natural, E8S, reward_e8s_2);
    
    println!("\nBoth give the same result: {} E8S = {} tokens", reward_e8s, reward_e8s / E8S);
    
    // Now check the loop condition
    println!("\nLoop condition:");
    println!("  total_minted < max_primary_supply");
    println!("  Both should be in same units (E8S)");
    println!("  After first epoch: {} < {} ? {}", reward_e8s, max_primary_supply, reward_e8s < max_primary_supply);
}