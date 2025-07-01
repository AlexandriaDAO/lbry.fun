// Test to find the burn threshold calculation issue

fn main() {
    println!("=== BURN THRESHOLD ANALYSIS ===\n");
    
    // Hardcoded thresholds (cumulative)
    let hardcoded_thresholds = [
        21_000u64, 42_000, 84_000, 168_000, 336_000, 672_000, 
        1_344_000, 2_688_000, 5_376_000, 10_752_000, 21_504_000, 
        43_008_000, 86_016_000, 172_032_000, 344_064_000, 
        688_128_000, 1_376_256_000, 61_632_592_000
    ];
    
    // Calculate burn per epoch from cumulative thresholds
    println!("Epoch | Cumulative | Burn This Epoch | Expected (2x prev) | Match?");
    println!("{}", "-".repeat(70));
    
    let mut prev_cumulative = 0u64;
    let mut prev_epoch_burn = 0u64;
    
    for i in 0..hardcoded_thresholds.len() {
        let burn_this_epoch = hardcoded_thresholds[i] - prev_cumulative;
        let expected = if i == 0 { 21_000 } else { prev_epoch_burn * 2 };
        let matches = burn_this_epoch == expected;
        
        println!("{:5} | {:10} | {:15} | {:18} | {}",
            i+1,
            hardcoded_thresholds[i],
            burn_this_epoch,
            expected,
            if matches { "✓" } else { "✗" }
        );
        
        prev_cumulative = hardcoded_thresholds[i];
        prev_epoch_burn = burn_this_epoch;
    }
    
    // Now let's simulate what tokenomics_simple.rs does
    println!("\n=== TOKENOMICS_SIMPLE.RS SIMULATION ===\n");
    
    let initial_burn = 21_000u64;
    let mut burn_per_epoch = initial_burn;
    let mut cumulative = 0u64;
    
    println!("Epoch | Burn/Epoch | Cumulative | Hardcoded | Match?");
    println!("{}", "-".repeat(55));
    
    for i in 0..12 {
        cumulative += burn_per_epoch;
        let hardcoded = hardcoded_thresholds[i];
        let matches = cumulative == hardcoded;
        
        println!("{:5} | {:10} | {:10} | {:9} | {}",
            i+1,
            burn_per_epoch,
            cumulative,
            hardcoded,
            if matches { "✓" } else { "✗" }
        );
        
        burn_per_epoch *= 2; // Double for next epoch
    }
    
    // Calculate tokens minted with correct values
    println!("\n=== TOKEN CALCULATION WITH CORRECT VALUES ===\n");
    
    let rates = [50_000u64, 25_000, 12_500, 6_250, 3_125, 1_562, 781, 391, 195, 98, 49, 24];
    let target_4decimal = 6_496_000_000u64; // 649,600 tokens in 4-decimal
    
    let mut total_4decimal = 0u64;
    let mut total_secondary = 0u64;
    
    for i in 0..12 {
        let prev_threshold = if i == 0 { 0 } else { hardcoded_thresholds[i-1] };
        let curr_threshold = hardcoded_thresholds[i];
        let burn_this_epoch = curr_threshold - prev_threshold;
        let minted_this_epoch = burn_this_epoch * rates[i];
        
        if total_4decimal + minted_this_epoch > target_4decimal {
            // Partial epoch
            let remaining = target_4decimal - total_4decimal;
            let partial_burn = remaining / rates[i];
            total_secondary += partial_burn;
            total_4decimal = target_4decimal;
            
            println!("Epoch {:2}: {:8} burn × {:5} = {:10} (partial: {} burn)",
                i+1, partial_burn, rates[i], remaining, partial_burn);
            break;
        }
        
        total_4decimal += minted_this_epoch;
        total_secondary += burn_this_epoch;
        
        println!("Epoch {:2}: {:8} burn × {:5} = {:10} | Total: {:10} ({:.0} tokens)",
            i+1, burn_this_epoch, rates[i], minted_this_epoch, 
            total_4decimal, total_4decimal as f64 / 10_000.0);
    }
    
    println!("\nFinal total: {} 4-decimal ({} tokens)", total_4decimal, total_4decimal as f64 / 10_000.0);
    println!("With 3x multiplier: {} tokens", (total_4decimal as f64 / 10_000.0) * 3.0);
    println!("Secondary burned: {} tokens", total_secondary);
}