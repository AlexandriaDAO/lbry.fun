// Copy the necessary types and functions from tokenomics_simple.rs
const E8S: u128 = 100_000_000;
const SECONDARY_TOKEN_USD_COST: f64 = 0.005;

const SECONDARY_THRESHOLDS: [u64; 18] = [
    21_000, 42_000, 84_000, 168_000, 336_000, 672_000, 1_344_000, 2_688_000,
    5_376_000, 10_752_000, 21_504_000, 43_008_000, 86_016_000, 172_032_000,
    344_064_000, 688_128_000, 1_376_256_000, 61_632_592_000,
];

const PRIMARY_PER_THRESHOLD: [u64; 18] = [
    50_000, 25_000, 12_500, 6_250, 3_125, 1_562, 781, 391,
    195, 98, 49, 24, 12, 6, 3, 2, 1, 1,
];

#[derive(Debug)]
struct EpochData {
    epoch_number: u32,
    secondary_burned_this_epoch_e8s: u128,
    primary_minted_this_epoch_e8s: u128,
    cumulative_secondary_burned_e8s: u128,
    cumulative_primary_minted_e8s: u128,
}

fn calculate_primary_minted(secondary_burned_e8s: u128, reward_rate_e8s: u128) -> u128 {
    secondary_burned_e8s
        .saturating_mul(reward_rate_e8s)
        .saturating_div(E8S)
        .saturating_mul(3)
}

fn main() {
    println!("Analyzing epochs 17-18 discrepancy\n");
    
    // Analyze hardcoded values
    println!("=== HARDCODED VALUES ===");
    println!("Epoch 17 (index 16):");
    println!("  Threshold: {} tokens", SECONDARY_THRESHOLDS[16]);
    println!("  Reward (4-decimal): {} = {} tokens", PRIMARY_PER_THRESHOLD[16], PRIMARY_PER_THRESHOLD[16] as f64 / 10_000.0);
    
    println!("\nEpoch 18 (index 17):");
    println!("  Threshold: {} tokens", SECONDARY_THRESHOLDS[17]);
    println!("  Reward (4-decimal): {} = {} tokens", PRIMARY_PER_THRESHOLD[17], PRIMARY_PER_THRESHOLD[17] as f64 / 10_000.0);
    
    // Calculate burns for each epoch
    println!("\n=== HARDCODED BURN CALCULATIONS ===");
    
    // Epoch 17 burn
    let epoch17_cumulative = SECONDARY_THRESHOLDS[16] as u128 * E8S;
    let epoch16_cumulative = if 16 > 0 { SECONDARY_THRESHOLDS[15] as u128 * E8S } else { 0 };
    let epoch17_burn = epoch17_cumulative - epoch16_cumulative;
    
    println!("Epoch 17:");
    println!("  Cumulative target: {} tokens", SECONDARY_THRESHOLDS[16]);
    println!("  Previous cumulative: {} tokens", if 16 > 0 { SECONDARY_THRESHOLDS[15] } else { 0 });
    println!("  Burn this epoch: {} tokens", epoch17_burn / E8S);
    
    // Calculate primary minted for epoch 17
    let reward17_e8s = (PRIMARY_PER_THRESHOLD[16] as u128 * E8S) / 10_000;
    let primary17 = calculate_primary_minted(epoch17_burn, reward17_e8s);
    println!("  Primary minted: {} tokens", primary17 / E8S);
    
    // Epoch 18 burn
    let epoch18_cumulative = SECONDARY_THRESHOLDS[17] as u128 * E8S;
    let epoch17_cumulative_end = SECONDARY_THRESHOLDS[16] as u128 * E8S;
    let epoch18_burn = epoch18_cumulative - epoch17_cumulative_end;
    
    println!("\nEpoch 18:");
    println!("  Cumulative target: {} tokens", SECONDARY_THRESHOLDS[17]);
    println!("  Previous cumulative: {} tokens", SECONDARY_THRESHOLDS[16]);
    println!("  Burn this epoch: {} tokens", epoch18_burn / E8S);
    
    // Calculate primary minted for epoch 18
    let reward18_e8s = (PRIMARY_PER_THRESHOLD[17] as u128 * E8S) / 10_000;
    let primary18 = calculate_primary_minted(epoch18_burn, reward18_e8s);
    println!("  Primary minted: {} tokens", primary18 / E8S);
    
    // Now analyze dynamic generation
    println!("\n=== DYNAMIC GENERATION ===");
    
    // Simulate dynamic generation for epochs 17-18
    let mut burn_amount = 21_000 * E8S;
    let mut reward_rate = 5 * E8S;
    
    // Apply burn pattern
    for i in 1..=18 {
        if i > 2 {
            burn_amount = burn_amount.saturating_mul(2);
        }
        
        if i < 18 {
            // Apply halving
            reward_rate = reward_rate.saturating_mul(50).saturating_div(100);
            
            // Minimum reward rate
            const MIN_REWARD_RATE_E8S: u128 = 10_000;
            reward_rate = reward_rate.max(MIN_REWARD_RATE_E8S);
        }
        
        if i == 17 {
            println!("Epoch 17:");
            println!("  Burn amount: {} tokens", burn_amount / E8S);
            println!("  Reward rate: {} tokens (E8S: {})", reward_rate as f64 / E8S as f64, reward_rate);
            let primary = calculate_primary_minted(burn_amount, reward_rate);
            println!("  Primary minted: {} tokens", primary / E8S);
        }
        
        if i == 18 {
            println!("\nEpoch 18:");
            println!("  Burn amount: {} tokens", burn_amount / E8S);
            println!("  Reward rate: {} tokens (E8S: {})", reward_rate as f64 / E8S as f64, reward_rate);
            let primary = calculate_primary_minted(burn_amount, reward_rate);
            println!("  Primary minted: {} tokens", primary / E8S);
        }
    }
    
    println!("\n=== KEY OBSERVATIONS ===");
    println!("1. Hardcoded epoch 18 has a massive jump in threshold: 61B vs 1.3B");
    println!("2. This causes epoch 18 to burn ~60B secondary tokens");
    println!("3. Dynamic generation uses doubling pattern, resulting in smaller burns");
    println!("4. Both use same reward rate (0.0001) but different burn amounts");
}