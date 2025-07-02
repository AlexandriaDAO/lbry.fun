fn main() {
    const SECONDARY_THRESHOLDS: [u64; 18] = [
        21_000, 42_000, 84_000, 168_000, 336_000, 672_000, 1_344_000, 2_688_000,
        5_376_000, 10_752_000, 21_504_000, 43_008_000, 86_016_000, 172_032_000,
        344_064_000, 688_128_000, 1_376_256_000, 61_632_592_000,
    ];
    
    println!("Analyzing threshold pattern:\n");
    
    let mut prev = 0u64;
    for (i, &threshold) in SECONDARY_THRESHOLDS.iter().enumerate() {
        let burn = threshold - prev;
        let multiplier = if prev > 0 { threshold as f64 / prev as f64 } else { 0.0 };
        
        println!("Epoch {}: cumulative={}, burn={}, multiplier={:.2}x", 
                 i + 1, threshold, burn, multiplier);
        
        prev = threshold;
    }
    
    println!("\nChecking the pattern:");
    println!("Expected epoch 18 cumulative (17 * 2): {}", SECONDARY_THRESHOLDS[16] * 2);
    println!("Actual epoch 18 cumulative: {}", SECONDARY_THRESHOLDS[17]);
    println!("Ratio: {:.2}x", SECONDARY_THRESHOLDS[17] as f64 / SECONDARY_THRESHOLDS[16] as f64);
    
    // Calculate what the total would be with normal doubling
    let normal_epoch_18 = SECONDARY_THRESHOLDS[16] * 2;
    let normal_burn = normal_epoch_18 - SECONDARY_THRESHOLDS[16];
    println!("\nIf epoch 18 followed the pattern:");
    println!("  Cumulative: {} tokens", normal_epoch_18);
    println!("  Burn: {} tokens", normal_burn);
    println!("  Primary minted (at 0.0001 rate): {} tokens", (normal_burn as u128 * 3 * 10_000) / 100_000_000);
}