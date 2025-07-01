// Test to find where 1,948,800 tokens comes from

const SECONDARY_THRESHOLDS: [u64; 18] = [
    21_000, 42_000, 84_000, 168_000, 336_000, 672_000, 1_344_000, 2_688_000,
    5_376_000, 10_752_000, 21_504_000, 43_008_000, 86_016_000, 172_032_000,
    344_064_000, 688_128_000, 1_376_256_000, 61_632_592_000,
];

const PRIMARY_PER_THRESHOLD: [u64; 18] = [
    50_000, 25_000, 12_500, 6_250, 3_125, 1_562, 781, 391,
    195, 98, 49, 24, 12, 6, 3, 2, 1, 1,
];

fn calculate_total_primary(target_tokens: f64) -> (u64, u64, usize) {
    let target_4decimal = (target_tokens * 10_000.0) as u64;
    let mut total_primary_4decimal: u64 = 0;
    let mut total_secondary: u64 = 0;
    let mut epochs_used = 0;
    
    for i in 0..SECONDARY_THRESHOLDS.len() {
        let prev_threshold = if i == 0 { 0 } else { SECONDARY_THRESHOLDS[i-1] };
        let curr_threshold = SECONDARY_THRESHOLDS[i];
        let secondary_in_epoch = curr_threshold - prev_threshold;
        let rate = PRIMARY_PER_THRESHOLD[i];
        let primary_in_epoch = rate * secondary_in_epoch;
        
        if total_primary_4decimal + primary_in_epoch > target_4decimal {
            // This epoch would exceed target, calculate partial
            let remaining = target_4decimal - total_primary_4decimal;
            let secondary_needed = remaining / rate;
            total_secondary += secondary_needed;
            total_primary_4decimal = target_4decimal;
            epochs_used = i + 1;
            break;
        }
        
        total_primary_4decimal += primary_in_epoch;
        total_secondary += secondary_in_epoch;
        epochs_used = i + 1;
    }
    
    (total_primary_4decimal, total_secondary, epochs_used)
}

fn main() {
    println!("=== SEARCHING FOR 1,948,800 TOKEN CONFIGURATION ===\n");
    
    // Test different scenarios
    let targets = vec![
        1_948_800.0,
        1_948_800.0 / 3.0,  // Without 3x multiplier
        (1_948_800.0 + 315_000.0), // With old TGE
        (1_948_800.0 + 315_000.0) / 3.0, // With old TGE, without 3x
    ];
    
    for target in targets {
        let (primary_4dec, secondary, epochs) = calculate_total_primary(target);
        println!("Target: {:.0} tokens", target);
        println!("  Primary (4-decimal): {}", primary_4dec);
        println!("  Primary (tokens): {:.4}", primary_4dec as f64 / 10_000.0);
        println!("  Secondary burned: {}", secondary);
        println!("  Epochs used: {}", epochs);
        println!("  With 3x multiplier: {:.0} tokens", (primary_4dec as f64 / 10_000.0) * 3.0);
        println!();
    }
    
    // Let's also check what happens if we stop at specific epochs
    println!("\n=== CHECKING SPECIFIC EPOCH CUTOFFS ===\n");
    
    for epochs_to_use in 15..=17 {
        let mut total_primary_4decimal: u64 = 0;
        let mut total_secondary: u64 = 0;
        
        for i in 0..epochs_to_use.min(SECONDARY_THRESHOLDS.len()) {
            let prev_threshold = if i == 0 { 0 } else { SECONDARY_THRESHOLDS[i-1] };
            let curr_threshold = SECONDARY_THRESHOLDS[i];
            let secondary_in_epoch = curr_threshold - prev_threshold;
            let rate = PRIMARY_PER_THRESHOLD[i];
            let primary_in_epoch = rate * secondary_in_epoch;
            
            total_primary_4decimal += primary_in_epoch;
            total_secondary += secondary_in_epoch;
        }
        
        let tokens = total_primary_4decimal as f64 / 10_000.0;
        let with_3x = tokens * 3.0;
        
        println!("After {} epochs:", epochs_to_use);
        println!("  Primary: {:.0} tokens", tokens);
        println!("  With 3x: {:.0} tokens", with_3x);
        println!("  Secondary burned: {}", total_secondary);
        
        // Check if this matches our target
        if (with_3x - 1_948_800.0).abs() < 1000.0 {
            println!("  ⭐ CLOSE MATCH! Difference: {:.0}", with_3x - 1_948_800.0);
        }
        println!();
    }
    
    // Calculate exact values for debugging
    println!("\n=== EXACT CALCULATION FOR ~649,600 BASE (×3 = 1,948,800) ===\n");
    
    let (primary_4dec, secondary, epochs) = calculate_total_primary(649_600.0);
    println!("Base amount: 649,600 tokens");
    println!("Secondary burned: {}", secondary);
    println!("Epochs used: {}", epochs);
    println!("With 3x multiplier: {:.0} tokens", (primary_4dec as f64 / 10_000.0) * 3.0);
    
    // Show the exact epoch breakdown
    println!("\nEpoch breakdown:");
    let mut total = 0u64;
    for i in 0..epochs {
        let prev_threshold = if i == 0 { 0 } else { SECONDARY_THRESHOLDS[i-1] };
        let curr_threshold = SECONDARY_THRESHOLDS[i];
        let secondary_in_epoch = curr_threshold - prev_threshold;
        let rate = PRIMARY_PER_THRESHOLD[i];
        let primary_in_epoch = rate * secondary_in_epoch;
        
        if i == epochs - 1 && total + primary_in_epoch > primary_4dec {
            // Last epoch, partial
            let remaining = primary_4dec - total;
            let secondary_used = remaining / rate;
            println!("  Epoch {}: {} secondary × {} rate = {} primary (partial: {} secondary)",
                i + 1, secondary_used, rate, remaining, secondary_used);
        } else {
            total += primary_in_epoch;
            println!("  Epoch {}: {} secondary × {} rate = {} primary",
                i + 1, secondary_in_epoch, rate, primary_in_epoch);
        }
    }
}