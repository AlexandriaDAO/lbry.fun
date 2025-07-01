// Constants from the tokenomics canister
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

const E8S: u128 = 100_000_000;

fn main() {
    // Analyze the tokenomics calculation manually
    println!("=== TOKENOMICS CALCULATION ANALYSIS ===\n");
    
    // Assume max supply of ~2M tokens
    let max_supply_e8s: u128 = 2_000_000 * E8S;
    let max_supply_4decimal: u64 = 20_000_000_000; // 2M * 10,000
    
    println!("Max Supply: 2,000,000 tokens");
    println!("Max Supply (E8S): {}", max_supply_e8s);
    println!("Max Supply (4-decimal): {}\n", max_supply_4decimal);
    
    let mut total_primary_minted_4decimal: u64 = 0;
    let mut total_secondary_burned: u64 = 0;
    
    println!("Epoch | Secondary Burn Range | Burn This Epoch | Rate (4-dec) | Primary Minted (4-dec) | Primary Minted (tokens) | Total Primary (tokens)");
    println!("{}", "-".repeat(140));
    
    for i in 0..SECONDARY_THRESHOLDS.len() {
        let prev_threshold = if i == 0 { 0 } else { SECONDARY_THRESHOLDS[i-1] };
        let curr_threshold = SECONDARY_THRESHOLDS[i];
        let secondary_in_epoch = curr_threshold - prev_threshold;
        let rate = PRIMARY_PER_THRESHOLD[i];
        
        // Calculate primary minted in 4-decimal format
        let primary_minted_4decimal = rate * secondary_in_epoch;
        
        // Check if we'd exceed max supply
        if total_primary_minted_4decimal + primary_minted_4decimal > max_supply_4decimal {
            let remaining = max_supply_4decimal - total_primary_minted_4decimal;
            let actual_secondary = remaining / rate;
            
            println!("{:5} | {:>20} | {:>15} | {:>12} | {:>22} | {:>23.4} | {:>22.4} | CAPPED",
                i + 1,
                format!("{}-{}", prev_threshold, curr_threshold),
                actual_secondary,
                rate,
                remaining,
                remaining as f64 / 10_000.0,
                (total_primary_minted_4decimal + remaining) as f64 / 10_000.0
            );
            
            total_primary_minted_4decimal += remaining;
            total_secondary_burned += actual_secondary;
            break;
        }
        
        total_primary_minted_4decimal += primary_minted_4decimal;
        total_secondary_burned += secondary_in_epoch;
        
        println!("{:5} | {:>20} | {:>15} | {:>12} | {:>22} | {:>23.4} | {:>22.4}",
            i + 1,
            format!("{}-{}", prev_threshold, curr_threshold),
            secondary_in_epoch,
            rate,
            primary_minted_4decimal,
            primary_minted_4decimal as f64 / 10_000.0,
            total_primary_minted_4decimal as f64 / 10_000.0
        );
    }
    
    println!("\n=== SUMMARY ===");
    println!("Total Primary Minted (4-decimal): {}", total_primary_minted_4decimal);
    println!("Total Primary Minted (tokens): {:.4}", total_primary_minted_4decimal as f64 / 10_000.0);
    println!("Total Secondary Burned: {}", total_secondary_burned);
    
    // Now let's see what the tokenomics canister would mint with 3x multiplier
    let total_with_3x = (total_primary_minted_4decimal as u128 * 3 * 10000).min(max_supply_e8s);
    println!("\nWith 3x multiplier (line 333 in update.rs):");
    println!("Total Primary (E8S): {}", total_with_3x);
    println!("Total Primary (tokens): {:.4}", total_with_3x as f64 / E8S as f64);
    
    // Calculate the missing amount
    let expected = 1_948_800.0;
    let actual = total_with_3x as f64 / E8S as f64;
    let difference = expected - actual;
    
    println!("\n=== DIFFERENCE ANALYSIS ===");
    println!("Expected: {:.0} tokens", expected);
    println!("Actual: {:.0} tokens", actual);
    println!("Difference: {:.0} tokens", difference);
    
    // Check if TGE was 315,000
    if difference.abs() > 314_000.0 && difference.abs() < 316_000.0 {
        println!("\n⚠️  The difference (~315,000) matches the old TGE allocation!");
        println!("This suggests the expected value might include TGE that's no longer allocated.");
    }
}