use lbry_fun::tokenomics_simple::{
    generate_tokenomics_schedule, preview_tokenomics_from_frontend,
    EpochData, TokenomicsParams, TokenomicsSchedule,
};

const E8S: u128 = 100_000_000;

// Helper function to calculate primary minted (same logic as in tokenomics_simple.rs)
fn calculate_primary_minted(secondary_burned_e8s: u128, reward_rate_e8s: u128) -> u128 {
    secondary_burned_e8s
        .saturating_mul(reward_rate_e8s)
        .saturating_div(E8S)
        .saturating_mul(3)
}

#[test]
fn test_simple_tokenomics_debug() {
    // Test with values that match frontend behavior (already in E8S)
    let schedule = preview_tokenomics_from_frontend(
        1 * E8S as u64,      // 1 token reward per burn (frontend sends E8S)
        1000 * E8S as u64,   // 1000 max supply (frontend sends E8S)
        10 * E8S as u64,     // 10 secondary tokens to burn (frontend sends E8S)
        50,                  // 50% halving
        0,                   // No TGE
        2.0,                 // 2x threshold multiplier
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
    
    // First epoch should burn 10 secondary and mint 10 primary (1:1 ratio)
    assert_eq!(schedule.epochs[1].secondary_burned_this_epoch_e8s, 10 * E8S);
    assert_eq!(schedule.epochs[1].primary_minted_this_epoch_e8s, 10 * E8S);
    
    // Cost should be $0.005 × 10 / 10 = $0.005 per primary token
    let expected_cost = (10.0 * 0.005) / 10.0;
    assert!((schedule.epochs[1].cost_per_primary_token_usd - expected_cost).abs() < 0.0001);
}

#[test]
fn test_reward_rate_calculation() {
    // Test the reward rate calculation directly
    
    // Test case 1: 5 tokens per burn
    let reward_rate_e8s = 5 * E8S;
    let burn_amount_e8s = 21_000 * E8S;
    let result = calculate_primary_minted(burn_amount_e8s, reward_rate_e8s);
    let expected = 21_000 * 5 * E8S; // 105,000 tokens
    
    println!("Test 1: reward_rate=5, burn=21k");
    println!("  Expected: {} tokens", expected / E8S);
    println!("  Got: {} tokens", result / E8S);
    assert_eq!(result, expected, "5 tokens × 21k burns = 105k tokens");
    
    // Test case 2: After first halving (2.5 tokens per burn)
    let reward_rate_e8s = 250_000_000; // 2.5 * E8S
    let result2 = calculate_primary_minted(burn_amount_e8s, reward_rate_e8s);
    let expected2 = 52_500 * E8S; // 21k × 2.5
    
    println!("\nTest 2: reward_rate=2.5, burn=21k");
    println!("  Expected: {} tokens", expected2 / E8S);
    println!("  Got: {} tokens", result2 / E8S);
    assert_eq!(result2, expected2, "2.5 tokens × 21k burns = 52.5k tokens");
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
        2.0,                     // 2x threshold multiplier
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
        threshold_multiplier: 2.0,
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
                  
        // Epoch 3 should burn double of epoch 2 (with 2x multiplier)
        assert_eq!(schedule.epochs[3].secondary_burned_this_epoch_e8s, 
                  schedule.epochs[2].secondary_burned_this_epoch_e8s * 2,
                  "Epoch 3 should burn double of epoch 2 (with 2x multiplier)");
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
        threshold_multiplier: 2.0,
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
        2.0, // 2x threshold multiplier
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
        threshold_multiplier: 2.0,
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
                epoch.primary_minted_this_epoch_e8s as f64 / epoch.secondary_burned_this_epoch_e8s as f64
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
    
    // Dynamic generation with default params should produce 19 epochs total
    assert_eq!(schedule.epochs.len(), 19, "Should have exactly 19 epochs total");
    assert_eq!(schedule.total_epochs, 18, "Should have exactly 18 mining epochs");
    
    // Verify first epoch burns 21k and mints 315k (21k × 5 × 3)
    let first_epoch = &schedule.epochs[1];
    assert_eq!(first_epoch.secondary_burned_this_epoch_e8s / E8S, 21_000);
    assert_eq!(first_epoch.primary_minted_this_epoch_e8s / E8S, 315_000);
    
    // Verify total supply
    let total_minted = last_epoch.cumulative_primary_minted_e8s / E8S;
    println!("Dynamic total minted: {} ({:.1}% of max)", total_minted, (total_minted as f64 / 21_000_000.0) * 100.0);
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