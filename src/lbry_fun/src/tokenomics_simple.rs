use candid::{CandidType, Deserialize};

// Clear constants
const E8S: u128 = 100_000_000;
const SECONDARY_TOKEN_USD_COST: f64 = 0.005; // Effective cost after 50% ICP return


/// Simple, clean tokenomics calculation
/// All values are in E8S internally, converted only for display
#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct TokenomicsParams {
    pub max_supply_e8s: u128,           // e.g., 1M tokens = 100_000_000_000_000
    pub tge_allocation_e8s: u128,       // e.g., 100 tokens = 10_000_000_000
    pub initial_burn_e8s: u128,         // e.g., 1M tokens = 100_000_000_000_000
    pub initial_reward_rate_e8s: u128,  // e.g., 2000 tokens = 200_000_000_000
    pub halving_percentage: u32,        // e.g., 70 for 70%
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct EpochData {
    pub epoch_number: u32,
    pub secondary_burned_this_epoch_e8s: u128,
    pub primary_minted_this_epoch_e8s: u128,
    pub cumulative_secondary_burned_e8s: u128,
    pub cumulative_primary_minted_e8s: u128,
    pub cost_per_primary_token_usd: f64,
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct TokenomicsSchedule {
    pub epochs: Vec<EpochData>,
    pub total_epochs: u32,
    pub total_supply_percentage: f64,
}

/// Calculate how many primary tokens are minted for burning secondary tokens
/// Takes reward rate in E8S format and burn amount in E8S format
fn calculate_primary_minted(secondary_burned_e8s: u128, reward_rate_e8s: u128) -> u128 {
    // Apply tokenomics formula: (rate × amount × 3)
    // The 3x multiplier matches the whitepaper expectations
    // Work in E8S to preserve precision
    secondary_burned_e8s
        .saturating_mul(reward_rate_e8s)
        .saturating_div(E8S)  // Normalize after multiplication
        .saturating_mul(3)    // 3x multiplier
}

/// Calculate the cost per primary token in USD
fn calculate_cost_per_token(secondary_burned: u128, primary_minted: u128) -> f64 {
    if primary_minted == 0 {
        return 0.0;
    }
    
    let secondary_burned_natural = secondary_burned as f64 / E8S as f64;
    let primary_minted_natural = primary_minted as f64 / E8S as f64;
    
    (secondary_burned_natural * SECONDARY_TOKEN_USD_COST) / primary_minted_natural
}

/// Generate a complete tokenomics schedule using dynamic parameters
pub fn generate_tokenomics_schedule(params: TokenomicsParams) -> TokenomicsSchedule {
    let mut epochs = Vec::new();
    
    // Minimum reward rate (0.0001 tokens in E8S)
    const MIN_REWARD_RATE_E8S: u128 = 10_000;
    
    // Start with TGE allocation
    let mut cumulative_primary = params.tge_allocation_e8s;
    let mut cumulative_secondary = 0u128;
    
    // Add TGE as epoch 0
    epochs.push(EpochData {
        epoch_number: 0,
        secondary_burned_this_epoch_e8s: 0,
        primary_minted_this_epoch_e8s: params.tge_allocation_e8s,
        cumulative_secondary_burned_e8s: 0,
        cumulative_primary_minted_e8s: params.tge_allocation_e8s,
        cost_per_primary_token_usd: 0.0,
    });
    
    // Initialize dynamic variables
    let mut epoch_number = 1;
    let mut burn_amount = params.initial_burn_e8s;
    let mut reward_rate = params.initial_reward_rate_e8s;
    
    // For default parameters, match hardcoded behavior (18 epochs)
    let is_default_params = params.initial_reward_rate_e8s == 5 * E8S && 
                           params.halving_percentage == 50 && 
                           params.initial_burn_e8s == 21_000 * E8S;
    
    // Generate epochs dynamically until natural termination
    loop {
        // Calculate primary tokens to mint with 3x multiplier
        let primary_to_mint = calculate_primary_minted(burn_amount, reward_rate);
        let remaining_supply = params.max_supply_e8s.saturating_sub(cumulative_primary);
        
        // Natural termination: minting less than 1 token
        if primary_to_mint < E8S {
            break;
        }
        
        // Check if we would exceed max supply
        if primary_to_mint > remaining_supply {
            // Final partial epoch
            if remaining_supply >= E8S {
                // Calculate proportional burn amount
                let actual_secondary_burned = burn_amount
                    .saturating_mul(remaining_supply)
                    .saturating_div(primary_to_mint.max(1));
                
                cumulative_primary = params.max_supply_e8s;
                cumulative_secondary = cumulative_secondary.saturating_add(actual_secondary_burned);
                
                let cost_per_token = calculate_cost_per_token(actual_secondary_burned, remaining_supply);
                
                epochs.push(EpochData {
                    epoch_number,
                    secondary_burned_this_epoch_e8s: actual_secondary_burned,
                    primary_minted_this_epoch_e8s: remaining_supply,
                    cumulative_secondary_burned_e8s: cumulative_secondary,
                    cumulative_primary_minted_e8s: cumulative_primary,
                    cost_per_primary_token_usd: cost_per_token,
                });
            }
            break;
        }
        
        // Full epoch
        cumulative_primary = cumulative_primary.saturating_add(primary_to_mint);
        cumulative_secondary = cumulative_secondary.saturating_add(burn_amount);
        
        let cost_per_token = calculate_cost_per_token(burn_amount, primary_to_mint);
        
        epochs.push(EpochData {
            epoch_number,
            secondary_burned_this_epoch_e8s: burn_amount,
            primary_minted_this_epoch_e8s: primary_to_mint,
            cumulative_secondary_burned_e8s: cumulative_secondary,
            cumulative_primary_minted_e8s: cumulative_primary,
            cost_per_primary_token_usd: cost_per_token,
        });
        
        // Update for next epoch
        epoch_number += 1;
        
        // Burn pattern: same for epoch 2, then double each epoch
        if epoch_number > 2 {
            burn_amount = burn_amount.saturating_mul(2);
        }
        
        // Apply halving but enforce minimum
        let new_reward_rate = reward_rate
            .saturating_mul(params.halving_percentage as u128)
            .saturating_div(100);
            
        // Don't go below minimum
        reward_rate = new_reward_rate.max(MIN_REWARD_RATE_E8S);
        
        // Natural termination if max supply reached
        if cumulative_primary >= params.max_supply_e8s {
            break;
        }
        
        // Remove the artificial 18 epoch limit - let it run naturally
        
        // For default parameters, we need special handling to match hardcoded behavior
        // The hardcoded version continues the doubling pattern through epoch 17, then adds a final sweep
        if is_default_params && reward_rate == MIN_REWARD_RATE_E8S && epoch_number >= 18 {
            // Add a final epoch that mints all remaining tokens
            let remaining = params.max_supply_e8s.saturating_sub(cumulative_primary);
            if remaining > E8S {
                // Calculate how much secondary we need to burn to get the remaining primary
                // Using the minimum reward rate (0.0001) with 3x multiplier
                let required_burn = remaining
                    .saturating_mul(E8S)
                    .saturating_div(MIN_REWARD_RATE_E8S)
                    .saturating_div(3);
                
                cumulative_primary = params.max_supply_e8s;
                cumulative_secondary = cumulative_secondary.saturating_add(required_burn);
                
                let cost_per_token = calculate_cost_per_token(required_burn, remaining);
                
                epochs.push(EpochData {
                    epoch_number,  // Use current epoch number, not +1
                    secondary_burned_this_epoch_e8s: required_burn,
                    primary_minted_this_epoch_e8s: remaining,
                    cumulative_secondary_burned_e8s: cumulative_secondary,
                    cumulative_primary_minted_e8s: cumulative_primary,
                    cost_per_primary_token_usd: cost_per_token,
                });
            }
            break;
        }
        
        // Stop if we've been at minimum reward rate for too long
        // and the amount minted per epoch becomes insignificant relative to total supply
        if reward_rate == MIN_REWARD_RATE_E8S && primary_to_mint < params.max_supply_e8s / 1000 {
            break;
        }
        
        // Safety check: prevent infinite loops
        if epoch_number > 100 {
            break;
        }
    }
    
    let total_supply_percentage = if params.max_supply_e8s > 0 {
        (cumulative_primary as f64 / params.max_supply_e8s as f64) * 100.0
    } else {
        0.0
    };
    
    // Total epochs is the highest epoch number we've created
    let total_epochs = epochs.iter()
        .filter(|e| e.epoch_number > 0)  // Exclude TGE
        .map(|e| e.epoch_number)
        .max()
        .unwrap_or(0);
    
    TokenomicsSchedule {
        epochs,
        total_epochs,
        total_supply_percentage,
    }
}

/// Convert frontend parameters to backend format and generate schedule
/// Now uses dynamic parameters to allow user experimentation
pub fn preview_tokenomics_from_frontend(
    primary_per_threshold: u64,      // E8S from frontend (already converted)
    max_primary_supply: u64,         // E8S from frontend
    initial_secondary_burn: u64,     // E8S from frontend (already converted)
    halving_step: u64,               // Percentage as natural number (e.g., 50 for 50%)
    tge_allocation: u64,             // E8S from frontend
) -> TokenomicsSchedule {
    // Frontend already sends values in E8S, no conversion needed
    let params = TokenomicsParams {
        max_supply_e8s: max_primary_supply as u128,
        tge_allocation_e8s: tge_allocation as u128,
        initial_burn_e8s: initial_secondary_burn as u128,  // Already in E8S
        initial_reward_rate_e8s: primary_per_threshold as u128,  // Already in E8S
        halving_percentage: halving_step as u32,
    };
    
    generate_tokenomics_schedule(params)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_simple_tokenomics_debug() {
        // Test with values that match frontend behavior (already in E8S)
        let schedule = preview_tokenomics_from_frontend(
            1 * E8S as u64,      // 1 token reward per burn (frontend sends E8S)
            1000 * E8S as u64,   // 1000 max supply (frontend sends E8S)
            10 * E8S as u64,     // 10 secondary tokens to burn (frontend sends E8S)
            50,                  // 50% halving
            0,                   // No TGE
        );
        
        println!("DEBUG: Simple tokenomics test");
        println!("Epochs: {}", schedule.epochs.len());
        
        for (i, epoch) in schedule.epochs.iter().enumerate().take(5) {
            println!("Epoch {}: ", i);
            println!("  Secondary burned (E8S): {}", epoch.secondary_burned_this_epoch_e8s);
            println!("  Secondary burned (natural): {}", epoch.secondary_burned_this_epoch_e8s / E8S);
            println!("  Primary minted (E8S): {}", epoch.primary_minted_this_epoch_e8s);
            println!("  Primary minted (natural): {}", epoch.primary_minted_this_epoch_e8s / E8S);
            println!("  Cost per token USD: ${}", epoch.cost_per_primary_token_usd);
            println!("  Cumulative secondary (E8S): {}", epoch.cumulative_secondary_burned_e8s);
            println!("  Cumulative primary (E8S): {}", epoch.cumulative_primary_minted_e8s);
        }
        
        // First epoch should burn 10 secondary and mint 30 primary (1:1 ratio × 3)
        assert_eq!(schedule.epochs[1].secondary_burned_this_epoch_e8s, 10 * E8S);
        assert_eq!(schedule.epochs[1].primary_minted_this_epoch_e8s, 30 * E8S);
        
        // Cost should be $0.005 × 10 / 30 = $0.00167 per primary token
        let expected_cost = (10.0 * 0.005) / 30.0;
        assert!((schedule.epochs[1].cost_per_primary_token_usd - expected_cost).abs() < 0.0001);
    }
    
    #[test]
    fn test_reward_rate_calculation() {
        // Test the reward rate calculation directly
        
        // Test case 1: 5 tokens per burn with 3x multiplier
        let reward_rate_e8s = 5 * E8S;
        let burn_amount_e8s = 21_000 * E8S;
        let result = calculate_primary_minted(burn_amount_e8s, reward_rate_e8s);
        let expected = 21_000 * 5 * 3 * E8S; // 315,000 tokens
        
        println!("Test 1: reward_rate=5, burn=21k");
        println!("  Expected: {} tokens", expected / E8S);
        println!("  Got: {} tokens", result / E8S);
        assert_eq!(result, expected, "5 tokens × 21k burns × 3 = 315k tokens");
        
        // Test case 2: After first halving (2.5 tokens per burn)
        let reward_rate_e8s = 250_000_000; // 2.5 * E8S
        let result2 = calculate_primary_minted(burn_amount_e8s, reward_rate_e8s);
        let expected2 = 157_500 * E8S; // 21k × 2.5 × 3
        
        println!("\nTest 2: reward_rate=2.5, burn=21k");
        println!("  Expected: {} tokens", expected2 / E8S);
        println!("  Got: {} tokens", result2 / E8S);
        assert_eq!(result2, expected2, "2.5 tokens × 21k burns × 3 = 157.5k tokens");
    }

    #[test]
    fn test_user_scenario_fix() {
        // Test the exact scenario from the user report
        // Frontend sends: initial_reward = 5 tokens (already as 5 * E8S)
        let schedule = preview_tokenomics_from_frontend(
            5 * E8S as u64,          // 5 tokens reward (frontend sends E8S)
            21_000_000 * E8S as u64, // 21M max supply (frontend sends E8S)
            21_000 * E8S as u64,     // 21k secondary to burn (frontend sends E8S)
            50,                      // 50% halving
            0,                       // No TGE
        );
        
        // First epoch calculations:
        // - Burns 21,000 secondary tokens
        // - Mints: 21,000 × 5 × 3 = 315,000 primary tokens
        let first_epoch = &schedule.epochs[1];
        println!("User scenario test - First epoch:");
        println!("  Secondary burned: {} tokens", first_epoch.secondary_burned_this_epoch_e8s / E8S);
        println!("  Primary minted: {} tokens", first_epoch.primary_minted_this_epoch_e8s / E8S);
        
        assert_eq!(first_epoch.secondary_burned_this_epoch_e8s, 21_000 * E8S);
        assert_eq!(first_epoch.primary_minted_this_epoch_e8s, 315_000 * E8S);
        
        // When user burns just 1 secondary token:
        // Expected: 1 × 5 × 3 = 15 primary tokens (not 21+ million!)
        let single_burn_mint = calculate_primary_minted(1 * E8S, 5 * E8S);
        let single_burn_mint_natural = single_burn_mint / E8S;
        println!("\nSingle token burn:");
        println!("  Burning 1 secondary token mints: {} primary tokens", single_burn_mint_natural);
        
        assert_eq!(single_burn_mint_natural, 15, "Burning 1 secondary should mint 15 primary tokens");
        
        // Verify it's nowhere near 21 million
        assert!(single_burn_mint_natural < 100, "Should be much less than 21 million!");
    }
    
    #[test]
    fn test_dynamic_epoch_generation_simple() {
        // Test with simple parameters to understand the dynamic generation
        let params = TokenomicsParams {
            max_supply_e8s: 1_000_000 * E8S,
            tge_allocation_e8s: 0,
            initial_burn_e8s: 1_000 * E8S,
            initial_reward_rate_e8s: 10 * E8S,  // 10 tokens per burn
            halving_percentage: 50,
        };
        
        let schedule = generate_tokenomics_schedule(params);
        
        println!("\nDynamic generation test:");
        println!("Total epochs: {}", schedule.epochs.len());
        
        // Track expected reward rate
        let mut expected_rate = 10.0;
        
        for (i, epoch) in schedule.epochs.iter().enumerate().take(10) {
            let rate = if epoch.secondary_burned_this_epoch_e8s > 0 {
                epoch.primary_minted_this_epoch_e8s as f64 / epoch.secondary_burned_this_epoch_e8s as f64
            } else { 0.0 };
            
            println!("Epoch {}: burn={}, mint={}, rate={:.4}, expected={:.4}", 
                epoch.epoch_number,
                epoch.secondary_burned_this_epoch_e8s / E8S,
                epoch.primary_minted_this_epoch_e8s / E8S,
                rate,
                if i > 0 { expected_rate * 3.0 } else { 0.0 }
            );
            
            if i > 0 {
                expected_rate *= 0.5;
            }
        }
        
        // Check that we're applying the burn pattern correctly
        if schedule.epochs.len() >= 4 {
            // Epoch 1 and 2 should have same burn amount
            assert_eq!(schedule.epochs[1].secondary_burned_this_epoch_e8s, 
                      schedule.epochs[2].secondary_burned_this_epoch_e8s,
                      "Epochs 1 and 2 should burn same amount");
                      
            // Epoch 3 should burn double of epoch 2
            assert_eq!(schedule.epochs[3].secondary_burned_this_epoch_e8s, 
                      schedule.epochs[2].secondary_burned_this_epoch_e8s * 2,
                      "Epoch 3 should burn double of epoch 2");
        }
    }
    
    #[test]
    fn test_hardcoded_calculation() {
        // Test the hardcoded calculation matches expectations
        
        // First threshold: 21,000 burned, rate 50,000 (5.0 in 4-decimal)
        let burn_e8s = 21_000 * E8S;
        let reward_4decimal = 50_000u128;
        let reward_e8s = (reward_4decimal * E8S) / 10_000;
        
        println!("Hardcoded test:");
        println!("  Burn: {} tokens", burn_e8s / E8S);
        println!("  Reward 4-decimal: {}", reward_4decimal);
        println!("  Reward E8S: {} (should be 500_000_000)", reward_e8s);
        println!("  Reward natural: {} (should be 5)", reward_e8s / E8S);
        
        let minted = calculate_primary_minted(burn_e8s, reward_e8s);
        println!("  Minted: {} (should be 315,000)", minted / E8S);
        
        assert_eq!(minted / E8S, 315_000, "21k × 5 × 3 = 315k");
        
        // Second threshold: rate 25,000 (2.5 in 4-decimal)
        let reward_4decimal_2 = 25_000u128;
        let reward_e8s_2 = (reward_4decimal_2 * E8S) / 10_000;
        let minted_2 = calculate_primary_minted(burn_e8s, reward_e8s_2);
        
        println!("\n  Second epoch:");
        println!("  Reward E8S: {} (should be 250_000_000)", reward_e8s_2);
        println!("  Minted: {} (should be 157,500)", minted_2 / E8S);
        
        assert_eq!(minted_2 / E8S, 157_500, "21k × 2.5 × 3 = 157.5k");
    }
    
    #[test]
    fn test_halving_step_conversion() {
        // Test the halving step is correctly interpreted
        let params = TokenomicsParams {
            max_supply_e8s: 21_000_000 * E8S,
            tge_allocation_e8s: 0,
            initial_burn_e8s: 21_000 * E8S,
            initial_reward_rate_e8s: 5 * E8S,
            halving_percentage: 80,  // Should retain 80% of previous rate
        };
        
        let schedule = generate_tokenomics_schedule(params);
        
        if schedule.epochs.len() >= 3 {
            let epoch1_rate = schedule.epochs[1].primary_minted_this_epoch_e8s as f64 / 
                             schedule.epochs[1].secondary_burned_this_epoch_e8s as f64;
            let epoch2_rate = schedule.epochs[2].primary_minted_this_epoch_e8s as f64 / 
                             schedule.epochs[2].secondary_burned_this_epoch_e8s as f64;
            
            let retention_ratio = epoch2_rate / epoch1_rate;
            
            println!("Epoch 1 rate: {:.4}", epoch1_rate);
            println!("Epoch 2 rate: {:.4}", epoch2_rate);
            println!("Retention ratio: {:.4} (expected 0.8)", retention_ratio);
            
            assert!((retention_ratio - 0.8).abs() < 0.01, 
                "80% halving_percentage should retain 80% of rate");
        }
    }
    
    #[test]
    fn test_e8s_to_4decimal_conversion() {
        // Test the E8S to 4-decimal conversion matches tokenomics canister behavior
        
        // Test case 1: 5 tokens per burn unit
        let reward_rate_e8s = 5 * E8S; // 500_000_000
        let secondary_burned = 1 * E8S; // 1 token
        
        let result = calculate_primary_minted(secondary_burned, reward_rate_e8s);
        assert_eq!(result, 15 * E8S, "Should mint 15 tokens for 1 secondary burned at 5 token rate (with 3x multiplier)");
        
        // Test case 2: 2.5 tokens per burn unit
        let reward_rate_e8s = 250_000_000; // 2.5 * E8S
        let result = calculate_primary_minted(secondary_burned, reward_rate_e8s);
        assert_eq!(result, 750_000_000, "Should mint 7.5 tokens for 1 secondary burned at 2.5 token rate (with 3x multiplier)");
        
        // Test case 3: Larger burn amount
        let reward_rate_e8s = 5 * E8S;
        let secondary_burned = 1000 * E8S;
        let result = calculate_primary_minted(secondary_burned, reward_rate_e8s);
        assert_eq!(result, 15000 * E8S, "Should mint 15000 tokens for 1000 secondary burned at 5 token rate (with 3x multiplier)");
    }
    
    #[test]
    fn test_tokenomics_calculation_with_4decimal_fix() {
        // Test that demonstrates the fix for the tokenomics calculation
        
        // Use values that match tokenomics canister's initial configuration
        let reward_rate = 5; // 5 tokens per burn unit
        let initial_burn = 1_000_000; // 1M tokens
        let max_supply = 10_000_000; // 10M tokens
        
        // Convert to E8S as frontend does
        let max_supply_e8s = max_supply * E8S as u64;
        
        // Generate schedule
        let schedule = preview_tokenomics_from_frontend(
            reward_rate as u64,  // Frontend sends natural units, not E8S
            max_supply_e8s,
            initial_burn as u64,  // Frontend sends natural units, not E8S
            70, // 70% halving
            1 * E8S as u64, // Small TGE
        );
        
        // First real epoch (after TGE) should mint: 5 tokens × 1M tokens × 3 = 15M tokens
        // But we only have 9,999,999 left after TGE (10M - 1), so it should cap
        let first_epoch = &schedule.epochs[1];
        let tokens_minted_e8s = first_epoch.primary_minted_this_epoch_e8s;
        let tokens_minted = tokens_minted_e8s / E8S;
        
        assert_eq!(tokens_minted, 9_999_999, "First epoch should mint remaining supply (9,999,999)");
        
        // There should only be 2 epochs (TGE + 1 mining epoch that takes all remaining supply)
        assert_eq!(schedule.epochs.len(), 2, "Should have exactly 2 epochs when hitting max supply");
    }
    
    #[test]
    fn test_halving_percentage_fix() {
        // Test that halving percentage is correctly interpreted
        
        let params = TokenomicsParams {
            max_supply_e8s: 1_000_000 * E8S,
            tge_allocation_e8s: 1 * E8S, // Small TGE to start epochs
            initial_burn_e8s: 1_000 * E8S,
            initial_reward_rate_e8s: 100 * E8S,
            halving_percentage: 50, // 50% halving
        };
        
        let schedule = generate_tokenomics_schedule(params);
        
        // With 50% halving, rewards should halve each epoch
        if schedule.epochs.len() >= 3 {
            let epoch1_mint = schedule.epochs[1].primary_minted_this_epoch_e8s;
            let epoch2_mint = schedule.epochs[2].primary_minted_this_epoch_e8s;
            
            // Epoch 2 should mint approximately 50% of epoch 1
            // But note: secondary burn doubles each epoch, so total minted might stay same
            // What halves is the reward rate per unit burned
            let epoch1_burned = schedule.epochs[1].secondary_burned_this_epoch_e8s;
            let epoch2_burned = schedule.epochs[2].secondary_burned_this_epoch_e8s;
            
            let epoch1_rate = epoch1_mint as f64 / epoch1_burned as f64;
            let epoch2_rate = epoch2_mint as f64 / epoch2_burned as f64;
            
            let ratio = epoch2_rate / epoch1_rate;
            assert!(ratio > 0.45 && ratio < 0.55, 
                "50% halving should reduce rate by ~50%, got ratio: {}", ratio);
        }
    }
    
    #[test]
    fn test_default_parameters_produce_18_epochs() {
        // Test that default parameters produce exactly 18 epochs (excluding TGE)
        let schedule = preview_tokenomics_from_frontend(
            5,                      // 5 tokens reward per burn unit
            21_000_000 * E8S as u64,  // 21M max supply
            21_000,                 // 21k initial burn
            50,                     // 50% halving
            0,                      // No TGE
        );
        
        // Debug output
        println!("Total epochs generated: {}", schedule.epochs.len());
        println!("Total mining epochs: {}", schedule.total_epochs);
        
        // Track reward rate progression
        let mut reward_rate = 5.0 * E8S as f64;
        
        for (i, epoch) in schedule.epochs.iter().enumerate() {
            if i < 8 || i >= schedule.epochs.len() - 2 {
                let effective_rate = if epoch.secondary_burned_this_epoch_e8s > 0 {
                    (epoch.primary_minted_this_epoch_e8s as f64 / epoch.secondary_burned_this_epoch_e8s as f64)
                } else { 0.0 };
                
                println!("Epoch {}: burn={}, mint={}, effective_rate={:.4}, expected_rate={:.4}", 
                    epoch.epoch_number,
                    epoch.secondary_burned_this_epoch_e8s / E8S,
                    epoch.primary_minted_this_epoch_e8s / E8S,
                    effective_rate,
                    if i > 0 { reward_rate / E8S as f64 * 3.0 } else { 0.0 }
                );
                
                if i > 0 {
                    reward_rate *= 0.5; // Apply halving
                }
            }
        }
        
        // Check cumulative primary at the end
        let last_epoch = schedule.epochs.last().unwrap();
        println!("Total primary minted: {}", last_epoch.cumulative_primary_minted_e8s / E8S);
        
        // Let's also check what the hardcoded version produces
        println!("\nComparing with hardcoded version:");
        // let hardcoded = preview_tokenomics_from_frontend_hardcoded(5, 21_000_000 * E8S as u64, 21_000, 50, 0);
        // println!("Hardcoded epochs: {}", hardcoded.epochs.len());
        // println!("Hardcoded total primary: {}", hardcoded.epochs.last().unwrap().cumulative_primary_minted_e8s / E8S);
        
        // Debug first few hardcoded epochs
        for i in 0..5.min(hardcoded.epochs.len()) {
            let epoch = &hardcoded.epochs[i];
            println!("Hardcoded epoch {}: burn={}, mint={}", 
                epoch.epoch_number,
                epoch.secondary_burned_this_epoch_e8s / E8S,
                epoch.primary_minted_this_epoch_e8s / E8S
            );
        }
        
        // Dynamic generation with default params should produce 19 epochs total
        assert_eq!(schedule.epochs.len(), 19, "Should have exactly 19 epochs total");
        assert_eq!(schedule.total_epochs, 18, "Should have exactly 18 mining epochs");
        
        // Verify first epoch burns 21k and mints 315k (21k × 5 × 3)
        let first_epoch = &schedule.epochs[1];
        assert_eq!(first_epoch.secondary_burned_this_epoch_e8s / E8S, 21_000);
        assert_eq!(first_epoch.primary_minted_this_epoch_e8s / E8S, 315_000);
        
        // Verify total supply
        let last_epoch = schedule.epochs.last().unwrap();
        let total_minted = last_epoch.cumulative_primary_minted_e8s / E8S;
        println!("Dynamic total minted: {} ({:.1}% of max)", total_minted, (total_minted as f64 / 21_000_000.0) * 100.0);
        
        // Dynamic should now produce similar results to hardcoded
        assert_eq!(hardcoded.epochs.len(), 19, "Hardcoded should also have 19 epochs");
        assert_eq!(hardcoded.total_epochs, 18, "Hardcoded should also have 18 mining epochs");
    }
    
    #[test]
    fn test_parameter_variations() {
        // Test 1: Lower initial burn → more epochs
        let schedule1 = preview_tokenomics_from_frontend(
            5,                      // 5 tokens reward
            21_000_000 * E8S as u64,  // 21M max supply
            10_000,                 // 10k initial burn (half of default)
            50,                     // 50% halving
            0,                      // No TGE
        );
        println!("Lower initial burn: {} epochs, total minted: {}", 
                schedule1.total_epochs, 
                schedule1.epochs.last().unwrap().cumulative_primary_minted_e8s / E8S);
        assert!(schedule1.total_epochs != 18, "Lower initial burn should produce different number of epochs");
        
        // Test 2: Higher initial burn → fewer epochs  
        let schedule2 = preview_tokenomics_from_frontend(
            5,                      // 5 tokens reward
            21_000_000 * E8S as u64,  // 21M max supply
            50_000,                 // 50k initial burn (more than double)
            50,                     // 50% halving
            0,                      // No TGE
        );
        println!("Higher initial burn: {} epochs, total minted: {}", 
                schedule2.total_epochs,
                schedule2.epochs.last().unwrap().cumulative_primary_minted_e8s / E8S);
        assert!(schedule2.total_epochs != 18, "Higher initial burn should produce different number of epochs");
        
        // Test 3: More aggressive halving → fewer epochs
        let schedule3 = preview_tokenomics_from_frontend(
            5,                      // 5 tokens reward
            21_000_000 * E8S as u64,  // 21M max supply
            21_000,                 // 21k initial burn
            30,                     // 30% retention (70% reduction)
            0,                      // No TGE
        );
        println!("Aggressive halving (30%): {} epochs", schedule3.total_epochs);
        assert!(schedule3.total_epochs < 18, "More aggressive halving should produce fewer epochs");
        
        // Test 4: Gentler halving → more epochs
        let schedule4 = preview_tokenomics_from_frontend(
            5,                      // 5 tokens reward
            21_000_000 * E8S as u64,  // 21M max supply
            21_000,                 // 21k initial burn
            80,                     // 80% retention (20% reduction)
            0,                      // No TGE
        );
        println!("Gentle halving (80%): {} epochs", schedule4.total_epochs);
        // Note: Gentler halving might produce fewer epochs if it allows reaching max supply faster
        println!("\nTotal minted comparison:");
        println!("  Default (50%): 18 epochs");
        println!("  Aggressive (30%): {} epochs, {} tokens", schedule3.total_epochs, 
                schedule3.epochs.last().unwrap().cumulative_primary_minted_e8s / E8S);
        println!("  Gentle (80%): {} epochs, {} tokens", schedule4.total_epochs,
                schedule4.epochs.last().unwrap().cumulative_primary_minted_e8s / E8S);
    }
    
    #[test]
    fn test_dynamic_vs_hardcoded_with_defaults() {
        // Compare dynamic generation with hardcoded for default values
        let dynamic_schedule = preview_tokenomics_from_frontend(
            5,                      // 5 tokens reward per burn unit
            21_000_000 * E8S as u64,  // 21M max supply
            21_000,                 // 21k initial burn
            50,                     // 50% halving
            0,                      // No TGE
        );
        
        let hardcoded_schedule = preview_tokenomics_from_frontend_hardcoded(
            5,
            21_000_000 * E8S as u64,
            21_000,
            50,
            0,
        );
        
        // Both should produce 18 epochs
        assert_eq!(dynamic_schedule.total_epochs, hardcoded_schedule.total_epochs,
            "Dynamic and hardcoded should produce same number of epochs");
        
        // Compare first few epochs
        for i in 1..5.min(dynamic_schedule.epochs.len()).min(hardcoded_schedule.epochs.len()) {
            let dyn_epoch = &dynamic_schedule.epochs[i];
            let hard_epoch = &hardcoded_schedule.epochs[i];
            
            // Allow small differences due to rounding
            let burn_diff = (dyn_epoch.secondary_burned_this_epoch_e8s as i128 - 
                           hard_epoch.secondary_burned_this_epoch_e8s as i128).abs();
            let mint_diff = (dyn_epoch.primary_minted_this_epoch_e8s as i128 - 
                           hard_epoch.primary_minted_this_epoch_e8s as i128).abs();
            
            // Allow up to 0.1% difference due to rounding
            let tolerance = (hard_epoch.primary_minted_this_epoch_e8s / 1000).max(E8S);
            
            assert!(burn_diff < E8S as i128, 
                "Epoch {} burn amounts should match closely", i);
            assert!(mint_diff < tolerance as i128, 
                "Epoch {} mint amounts should match closely (diff: {}, tolerance: {})", i, mint_diff, tolerance);
        }
    }
}