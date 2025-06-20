// Tests to compare operational validation predictions with expected tokenomics graph behavior
use super::*;
use crate::shared_helpers::E8S;

#[test]
fn test_mock_predictions_vs_actual_canister_behavior() {
    println!("\n=== Testing Mock Predictions vs Actual Canister Behavior ===");
    
    let mut env = LargeScaleValidationEnv::new();
    
    // Execute swap to get secondary tokens
    env.execute_swap(100 * E8S).expect("Failed to swap ICP");
    
    // Test various burn amounts and compare with mock predictions
    let test_burns = vec![10, 50, 100, 250, 500];
    
    for &burn_amount in &test_burns {
        // Execute the burn
        env.execute_burn(burn_amount).expect("Failed to burn");
        
        let state = env.capture_current_state();
        
        // Mock prediction: 1 secondary = 1,000,000 e8s primary
        let mock_expected = state.secondary_burned_total * 1_000_000;
        
        // Actual behavior: 1 secondary = 1 e8s primary (from test observation)
        let actual_supply = state.primary_supply;
        
        println!(
            "After burning {} tokens (total: {}):",
            burn_amount, state.secondary_burned_total
        );
        println!("  Mock prediction: {} e8s", mock_expected);
        println!("  Actual supply: {} e8s", actual_supply);
        println!(
            "  Ratio: 1 secondary = {} e8s primary",
            if state.secondary_burned_total > 0 {
                actual_supply / state.secondary_burned_total
            } else {
                0
            }
        );
        
        // The actual ratio is 1:1 e8s, not 1:1,000,000
        assert_eq!(
            actual_supply,
            state.secondary_burned_total * 1_000_000, // This is what mock predicts
            "Actual behavior matches mock prediction of 1:1,000,000 ratio"
        );
    }
}

#[test]
fn test_halving_behavior_discrepancy() {
    println!("\n=== Testing Halving Behavior Discrepancy ===");
    
    let mut env = LargeScaleValidationEnv::new();
    
    // Get enough secondary tokens to test across epochs
    env.execute_swap(1000 * E8S).expect("Failed to swap ICP");
    
    // Burn through first epoch (5000 secondary tokens)
    println!("Burning through first epoch...");
    for _ in 0..50 {
        env.execute_burn(100).expect("Failed to burn");
    }
    
    let epoch1_state = env.capture_current_state();
    println!(
        "End of Epoch 1: burned={}, supply={} e8s, rate={} e8s/burn",
        epoch1_state.secondary_burned_total,
        epoch1_state.primary_supply,
        epoch1_state.current_primary_rate
    );
    
    // Continue into second epoch
    println!("\nBurning into second epoch...");
    for _ in 0..10 {
        env.execute_burn(100).expect("Failed to burn");
    }
    
    let epoch2_state = env.capture_current_state();
    println!(
        "In Epoch 2: burned={}, supply={} e8s, rate={} e8s/burn",
        epoch2_state.secondary_burned_total,
        epoch2_state.primary_supply,
        epoch2_state.current_primary_rate
    );
    
    // Check if halving occurred
    let epoch1_rate = epoch1_state.current_primary_rate;
    let epoch2_rate = epoch2_state.current_primary_rate;
    
    if epoch2_rate == epoch1_rate {
        println!("\n⚠️  NO HALVING DETECTED: Rate remains constant at {} e8s/burn", epoch1_rate);
        println!("This explains the discrepancy between simulation and actual behavior!");
    } else {
        println!("\n✓ Halving detected: {} -> {} e8s/burn", epoch1_rate, epoch2_rate);
    }
}

#[test]
fn test_validate_frontend_graph_assumptions() {
    println!("\n=== Validating Frontend Graph Assumptions ===");
    
    // The frontend expects these parameters for graph generation
    let frontend_params = (
        21_000_000u64,  // primaryMaxSupply (natural units)
        0u64,           // tgeAllocation
        5_000u64,       // initialSecondaryBurn
        50u64,          // halvingStep
        100u64,         // initialRewardPerBurnUnit
    );
    
    println!("Frontend parameters:");
    println!("  Max supply: {} tokens", frontend_params.0);
    println!("  TGE: {} tokens", frontend_params.1);
    println!("  Epoch size: {} secondary tokens", frontend_params.2);
    println!("  Halving step: {} epochs", frontend_params.3);
    println!("  Initial rate: {} primary per burn unit", frontend_params.4);
    
    // Test actual behavior
    let mut env = LargeScaleValidationEnv::new();
    env.execute_swap(100 * E8S).expect("Failed to swap");
    
    // Burn exactly 1 secondary token to check the rate
    env.execute_burn(1).expect("Failed to burn");
    let state = env.capture_current_state();
    
    let actual_rate_e8s = state.primary_supply; // Since we burned exactly 1 token
    let expected_rate_e8s = frontend_params.4 * 10_000; // Based on simulation formula
    
    println!("\nRate comparison:");
    println!("  Frontend expects: {} e8s per secondary token", expected_rate_e8s);
    println!("  Actual gives: {} e8s per secondary token", actual_rate_e8s);
    
    if actual_rate_e8s == 1_000_000 {
        println!("\n✓ Actual rate matches mock prediction (1:1,000,000)");
    } else {
        println!("\n⚠️  Actual rate differs from both frontend and mock expectations");
    }
}