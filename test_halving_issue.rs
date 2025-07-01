// Test to identify the halving calculation issue

fn main() {
    println!("=== HALVING CALCULATION COMPARISON ===\n");
    
    // Hardcoded rates from tokenomics canister
    let hardcoded_rates = [50_000u64, 25_000, 12_500, 6_250, 3_125, 1_562, 781, 391, 195, 98, 49, 24, 12, 6, 3, 2, 1, 1];
    
    // Calculate rates using 50% halving
    let mut calculated_rates = vec![];
    let mut rate = 50_000u64;
    
    for i in 0..18 {
        calculated_rates.push(rate);
        if i < 17 {
            rate = rate * 50 / 100;
            if rate == 0 { rate = 1; }
        }
    }
    
    // Compare
    println!("Epoch | Hardcoded | Calculated | Match? | Ratio");
    println!("{}", "-".repeat(55));
    
    for i in 0..18 {
        let ratio = if i > 0 && hardcoded_rates[i-1] > 0 {
            hardcoded_rates[i] as f64 / hardcoded_rates[i-1] as f64
        } else {
            0.0
        };
        
        let matches = hardcoded_rates[i] == calculated_rates[i];
        println!("{:5} | {:9} | {:10} | {:6} | {:.4}", 
            i+1, 
            hardcoded_rates[i], 
            calculated_rates[i],
            if matches { "✓" } else { "✗" },
            ratio
        );
    }
    
    // The issue appears to be that hardcoded values don't follow exact 50% halving
    // Let's check what percentage they actually use
    println!("\n=== ACTUAL HALVING PERCENTAGES ===\n");
    
    for i in 1..hardcoded_rates.len() {
        let prev = hardcoded_rates[i-1] as f64;
        let curr = hardcoded_rates[i] as f64;
        let percentage = (curr / prev) * 100.0;
        println!("Epoch {}->{}: {:.2}%", i, i+1, percentage);
    }
    
    // Now let's see what happens with proper rounding
    println!("\n=== CHECKING INTEGER DIVISION ROUNDING ===\n");
    
    let values = [50_000, 25_000, 12_500, 6_250, 3_125, 1_562, 781, 391, 195, 98, 49, 24];
    for i in 0..values.len()-1 {
        let expected_next = values[i] / 2;
        let actual_next = values[i+1];
        let using_floor = values[i] / 2;
        let using_round = (values[i] + 1) / 2; // Round up
        
        println!("{}÷2: floor={}, round={}, actual={}, matches_floor={}", 
            values[i], using_floor, using_round, actual_next, using_floor == actual_next);
    }
}