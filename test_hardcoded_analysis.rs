// Quick test to understand the hardcoded tokenomics values
use std::fs::File;
use std::io::Write;

const E8S: u128 = 100_000_000;

// Hardcoded thresholds from tokenomics canister (in natural units, not E8S)
const SECONDARY_THRESHOLDS: [u64; 18] = [
    21_000,         // 21,000.00
    42_000,         // 42,000.00
    84_000,         // 84,000.00
    168_000,        // 168,000.00
    336_000,        // 336,000.00
    672_000,        // 672,000.00
    1_344_000,      // 1,344,000.00
    2_688_000,      // 2,688,000.00
    5_376_000,      // 5,376,000.00
    10_752_000,     // 10,752,000.00
    21_504_000,     // 21,504,000.00
    43_008_000,     // 43,008,000.00
    86_016_000,     // 86,016,000.00
    172_032_000,    // 172,032,000.00
    344_064_000,    // 344,064,000.00
    688_128_000,    // 688,128,000.00
    1_376_256_000,  // 1,376,256,000.00
    61_632_592_000, // 61,632,592,000.00
];

// Hardcoded rewards from tokenomics canister (in 4-decimal format)
const PRIMARY_PER_THRESHOLD: [u64; 18] = [
    50_000, // 5.0000
    25_000, // 2.5000
    12_500, // 1.2500
    6_250,  // 0.6250
    3_125,  // 0.3125
    1_562,  // 0.1562
    781,    // 0.0781
    391,    // 0.0391
    195,    // 0.0195
    98,     // 0.0098
    49,     // 0.0049
    24,     // 0.0024
    12,     // 0.0012
    6,      // 0.0006
    3,      // 0.0003
    2,      // 0.0002
    1,      // 0.0001
    1,      // 0.0001
];

fn main() {
    let mut output = String::new();
    output.push_str("Analyzing hardcoded tokenomics values:\n\n");
    
    let mut cumulative_secondary = 0u128;
    let mut cumulative_primary = 0u128;
    let max_supply = 21_000_000u128 * E8S;
    
    output.push_str("Epoch | Secondary Burn | Reward Rate | Primary Minted | Cumulative Primary | % of Max\n");
    output.push_str("------|----------------|-------------|----------------|-------------------|----------\n");
    
    for i in 0..SECONDARY_THRESHOLDS.len() {
        // Calculate secondary burned in this epoch
        let target = SECONDARY_THRESHOLDS[i] as u128 * E8S;
        let burn_this_epoch = target.saturating_sub(cumulative_secondary);
        
        // Get reward rate (convert from 4-decimal to natural)
        let reward_4decimal = PRIMARY_PER_THRESHOLD[i] as f64;
        let reward_natural = reward_4decimal / 10_000.0;
        
        // Calculate primary minted (with 3x multiplier)
        let primary_minted = (burn_this_epoch as f64 / E8S as f64) * reward_natural * 3.0;
        let primary_minted_e8s = (primary_minted * E8S as f64) as u128;
        
        // Check if we'd exceed max supply
        let remaining = max_supply.saturating_sub(cumulative_primary);
        let actual_minted = primary_minted_e8s.min(remaining);
        
        cumulative_secondary = target;
        cumulative_primary = cumulative_primary.saturating_add(actual_minted);
        
        let percent = (cumulative_primary as f64 / max_supply as f64) * 100.0;
        
        output.push_str(&format!(
            "{:5} | {:14} | {:11.4} | {:14.0} | {:17.0} | {:8.2}%\n",
            i + 1,
            burn_this_epoch / E8S,
            reward_natural,
            actual_minted as f64 / E8S as f64,
            cumulative_primary as f64 / E8S as f64,
            percent
        ));
        
        if cumulative_primary >= max_supply {
            output.push_str("\nMax supply reached!\n");
            break;
        }
    }
    
    output.push_str(&format!("\nTotal epochs: {}\n", SECONDARY_THRESHOLDS.len()));
    output.push_str(&format!("Total primary minted: {:.0}\n", cumulative_primary as f64 / E8S as f64));
    output.push_str(&format!("Total secondary burned: {:.0}\n", cumulative_secondary as f64 / E8S as f64));
    
    // Write to file
    let mut file = File::create("hardcoded_analysis.txt").unwrap();
    file.write_all(output.as_bytes()).unwrap();
    
    println!("{}", output);
}