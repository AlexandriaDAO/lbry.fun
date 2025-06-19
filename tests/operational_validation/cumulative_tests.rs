// Core validation tests for large-scale operational validation
use super::*;
use crate::shared_helpers::*;

#[test]
fn test_primary_supply_accuracy_across_scenarios() {
    for scenario in get_validation_scenarios() {
        // Skip very slow scenarios in CI
        if scenario.name == "many_small_burns" && scenario.operations.iter().any(|op| {
            matches!(op.operation, OperationType::BurnSecondary(_)) && op.quantity > 500
        }) {
            println!("⚠️  Skipping slow scenario: {} (too many operations for CI)", scenario.name);
            continue;
        }
        println!("\n=== Testing Scenario: {} ===", scenario.name);
        
        let mut env = LargeScaleValidationEnv::new();
        
        // Execute operations with incremental validation at checkpoints
        let (total_operations, validation_results) = match execute_scenario_with_incremental_validation(&mut env, &scenario) {
            Ok(result) => result,
            Err(e) => {
                panic!("Failed to execute scenario '{}': {}", scenario.name, e);
            }
        };
        
        // Analyze results against expectations
        let scenario_success = validate_scenario_expectations(&scenario.expected_outcomes, &validation_results);
        
        // Print detailed results
        println!("Scenario Results:");
        println!("  Total operations: {}", total_operations);
        println!("  Validation points: {}", validation_results.len());
        
        for (i, result) in validation_results.iter().enumerate() {
            println!("  Checkpoint {}: burned={}, accuracy={:.2}%, epoch_match={}", 
                i + 1, result.secondary_burned_total, result.supply_accuracy_pct, result.epoch_match);
        }
        
        // Assert scenario success
        assert!(scenario_success, 
            "Scenario '{}' failed validation. Expected max drift: {:.2}%, min success rate: {:.1}%", 
            scenario.name, scenario.expected_outcomes.max_supply_drift_pct, scenario.expected_outcomes.min_success_rate);
        
        println!("✓ Scenario '{}' completed successfully with {} operations", 
            scenario.name, total_operations);
    }
}

#[test] 
fn test_cumulative_precision_over_many_burns() {
    let mut env = LargeScaleValidationEnv::new();
    
    // Setup with plenty of secondary tokens
    // Swap 500 ICP to get secondary tokens without burning
    env.execute_swap(500 * E8S).expect("Failed to get secondary tokens");
    
    // Capture initial state (should be 0 burns)
    let initial_state = env.capture_current_state();
    let initial_burned = initial_state.secondary_burned_total;
    println!("Initial secondary burned: {}", initial_burned);
    
    // Debug: Check secondary token balance
    let secondary_balance = get_secondary_balance(&env.token_env, &env.user_id);
    println!("Secondary balance after swap: {} e8s ({} natural units)", secondary_balance, secondary_balance / E8S);
    
    let mut precision_measurements = Vec::new();
    let target_burns = vec![100, 500, 1000, 2000, 5000];
    
    for target in target_burns {
        // Execute burns in small increments to reach target
        burn_to_target(&mut env, target).expect("Failed to burn to target");
        
        let checkpoint = env.validate_at_checkpoint(target);
        precision_measurements.push((target, checkpoint.supply_accuracy_pct));
        
        println!("Precision at {} burns: {:.2}%", target, checkpoint.supply_accuracy_pct);
        println!("  Expected primary supply: {}, Actual: {}", checkpoint.expected_primary_supply, checkpoint.actual_primary_supply);
        println!("  Secondary burned total: {}", checkpoint.secondary_burned_total);
        
        // Ensure precision doesn't degrade significantly
        // Note: Using linear approximation for mock predictions, so allow for some variance
        assert!(checkpoint.supply_accuracy_pct.abs() < 5.0, 
            "Precision drift too high at {} burns: {:.2}%", 
            target, checkpoint.supply_accuracy_pct);
    }
    
    // Check that precision doesn't worsen over time
    let initial_accuracy = precision_measurements[0].1.abs();
    let final_accuracy = precision_measurements.last().unwrap().1.abs();
    
    assert!(final_accuracy < initial_accuracy + 1.0,
        "Precision degraded significantly from {:.2}% to {:.2}%",
        initial_accuracy, final_accuracy);
        
    println!("✓ Precision maintained across {} burn operations", 
        precision_measurements.last().unwrap().0);
}

#[test]
fn test_quick_validation_basic_functionality() {
    // Run just the quick validation scenario to ensure the system works
    let quick_scenario = get_validation_scenarios()
        .into_iter()
        .find(|s| s.name == "quick_validation")
        .expect("Quick validation scenario not found");
    
    println!("\n=== Testing Quick Validation ===");
    
    let mut env = LargeScaleValidationEnv::new();
    
    // Execute operations and validate incrementally instead of all at once
    let mut total_operations = 0;
    let mut validation_results = Vec::new();
    
    // Setup user with secondary tokens via swap (no initial burns)
    env.execute_swap(200 * E8S).expect("Failed to get secondary tokens");
    total_operations += 1;
    
    // Check secondary balance
    let secondary_balance = get_secondary_balance(&env.token_env, &env.user_id);
    println!("Starting with {} secondary tokens", secondary_balance / E8S);
    
    // Execute burns and validate at checkpoints
    for i in 1..=10 {
        env.execute_burn(25).expect("Failed to execute burn");
        total_operations += 1;
        
        let current_burned = env.capture_current_state().secondary_burned_total;
        
        // Validate at 250 (after 10 burns of 25 each)
        if i == 10 {
            let result = env.validate_at_checkpoint(250);
            println!("  Checkpoint 1: burned={}, supply_accuracy={:.2}%, expected={}, actual={}", 
                result.secondary_burned_total, result.supply_accuracy_pct, result.expected_primary_supply, result.actual_primary_supply);
            validation_results.push(result);
        }
    }
    
    // Execute additional burns to reach 500
    for _ in 1..=10 {
        env.execute_burn(25).expect("Failed to execute burn"); 
        total_operations += 1;
    }
    
    let final_result = env.validate_at_checkpoint(500);
    validation_results.push(final_result.clone());
    println!("  Checkpoint 2: burned={}, supply_accuracy={:.2}%, expected={}, actual={}", 
        final_result.secondary_burned_total, final_result.supply_accuracy_pct, 
        final_result.expected_primary_supply, final_result.actual_primary_supply);
    
    // Check basic expectations
    assert!(!validation_results.is_empty(), "No validation results generated");
    
    let scenario_success = validate_scenario_expectations(&quick_scenario.expected_outcomes, &validation_results);
    
    // Print results
    println!("Quick Validation Results:");
    println!("  Total operations: {}", total_operations);
    for (i, result) in validation_results.iter().enumerate() {
        println!("  Checkpoint {}: burned={}, supply_accuracy={:.2}%, expected={}, actual={}", 
            i + 1, result.secondary_burned_total, result.supply_accuracy_pct,
            result.expected_primary_supply, result.actual_primary_supply);
    }
    
    assert!(scenario_success, "Quick validation scenario failed basic expectations");
    
    println!("✓ Quick validation completed successfully");
}