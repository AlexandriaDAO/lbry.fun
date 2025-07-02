use std::fs::File;
use std::io::Write;

// Add the path to the library
#[path = "src/lbry_fun/src/tokenomics_simple.rs"]
mod tokenomics_simple;

use tokenomics_simple::{preview_tokenomics_from_frontend, preview_tokenomics_from_frontend_hardcoded};

const E8S: u64 = 100_000_000;

fn main() {
    let mut output = String::new();
    
    // Default parameters
    let primary_per_threshold = 5;  // 5 tokens reward
    let max_primary_supply = 21_000_000 * E8S;  // 21M tokens
    let initial_secondary_burn = 21_000;  // 21k tokens
    let halving_step = 50;  // 50% halving
    let tge_allocation = 0;  // No TGE
    
    output.push_str("Comparing Dynamic vs Hardcoded with default parameters:\n\n");
    
    // Get both schedules
    let dynamic = preview_tokenomics_from_frontend(
        primary_per_threshold,
        max_primary_supply,
        initial_secondary_burn,
        halving_step,
        tge_allocation,
    );
    
    let hardcoded = preview_tokenomics_from_frontend_hardcoded(
        primary_per_threshold,
        max_primary_supply,
        initial_secondary_burn,
        halving_step,
        tge_allocation,
    );
    
    output.push_str(&format!("Dynamic epochs: {}\n", dynamic.epochs.len()));
    output.push_str(&format!("Hardcoded epochs: {}\n\n", hardcoded.epochs.len()));
    
    output.push_str("Epoch | Dynamic Burn | Dynamic Mint | Hardcoded Burn | Hardcoded Mint | Match?\n");
    output.push_str("------|--------------|--------------|----------------|----------------|-------\n");
    
    let max_epochs = dynamic.epochs.len().max(hardcoded.epochs.len());
    
    for i in 0..max_epochs {
        let dyn_burn = dynamic.epochs.get(i).map(|e| e.secondary_burned_this_epoch_e8s / E8S as u128).unwrap_or(0);
        let dyn_mint = dynamic.epochs.get(i).map(|e| e.primary_minted_this_epoch_e8s / E8S as u128).unwrap_or(0);
        let hard_burn = hardcoded.epochs.get(i).map(|e| e.secondary_burned_this_epoch_e8s / E8S as u128).unwrap_or(0);
        let hard_mint = hardcoded.epochs.get(i).map(|e| e.primary_minted_this_epoch_e8s / E8S as u128).unwrap_or(0);
        
        let matches = dyn_burn == hard_burn && dyn_mint == hard_mint;
        
        output.push_str(&format!(
            "{:5} | {:12} | {:12} | {:14} | {:14} | {}\n",
            i,
            dyn_burn,
            dyn_mint,
            hard_burn,
            hard_mint,
            if matches { "✓" } else { "✗" }
        ));
    }
    
    output.push_str(&format!("\nDynamic total minted: {}\n", 
        dynamic.epochs.last().map(|e| e.cumulative_primary_minted_e8s / E8S as u128).unwrap_or(0)));
    output.push_str(&format!("Hardcoded total minted: {}\n", 
        hardcoded.epochs.last().map(|e| e.cumulative_primary_minted_e8s / E8S as u128).unwrap_or(0)));
    
    // Write to file
    let mut file = File::create("comparison_output.txt").unwrap();
    file.write_all(output.as_bytes()).unwrap();
    
    println!("{}", output);
}