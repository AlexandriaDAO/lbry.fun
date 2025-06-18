// Precision analysis for operational validation
use super::*;

const E8S: u64 = 100_000_000;

#[test]
fn test_precision_drift_detection() {
    let mut env = LargeScaleValidationEnv::new();
    
    // Setup with secondary tokens
    env.execute_swap(1000 * E8S).expect("Failed to get secondary tokens");
    
    let mut drift_measurements = Vec::new();
    let measurement_points = vec![50, 100, 200, 500, 1000];
    
    for point in measurement_points {
        burn_to_target(&mut env, point).expect("Failed to burn to target");
        
        let checkpoint = env.validate_at_checkpoint(point);
        drift_measurements.push((point, checkpoint.supply_accuracy_pct));
        
        println!("Point {}: drift = {:.4}%", point, checkpoint.supply_accuracy_pct);
    }
    
    // Analyze drift trend
    let mut increasing_drift = 0;
    for i in 1..drift_measurements.len() {
        let prev_drift = drift_measurements[i-1].1.abs();
        let curr_drift = drift_measurements[i].1.abs();
        
        if curr_drift > prev_drift + 0.1 {
            increasing_drift += 1;
        }
    }
    
    // Allow some drift increase but not too much
    assert!(increasing_drift < drift_measurements.len() / 2, 
        "Precision drift is increasing too rapidly across measurement points");
    
    println!("✓ Precision drift analysis completed - {} points showed increasing drift", increasing_drift);
}

#[test]
fn test_large_batch_vs_small_incremental_precision() {
    // Compare precision between large batch operations and small incremental ones
    
    // Scenario A: Large batch operations
    let mut env_batch = LargeScaleValidationEnv::new();
    env_batch.execute_swap(500 * E8S).expect("Failed to get secondary tokens");
    
    // Do 5 burns of 100 tokens each
    for _ in 0..5 {
        env_batch.execute_burn(100).expect("Failed to execute batch burn");
    }
    let batch_state = env_batch.capture_current_state();
    let batch_checkpoint = env_batch.validate_at_checkpoint(500);
    
    // Scenario B: Small incremental operations  
    let mut env_incremental = LargeScaleValidationEnv::new();
    env_incremental.execute_swap(500 * E8S).expect("Failed to get secondary tokens");
    
    // Do 50 burns of 10 tokens each
    for _ in 0..50 {
        env_incremental.execute_burn(10).expect("Failed to execute incremental burn");
    }
    let incremental_state = env_incremental.capture_current_state();
    let incremental_checkpoint = env_incremental.validate_at_checkpoint(500);
    
    // Compare results
    println!("Batch approach: supply = {}, accuracy = {:.4}%", 
        batch_state.primary_supply, batch_checkpoint.supply_accuracy_pct);
    println!("Incremental approach: supply = {}, accuracy = {:.4}%", 
        incremental_state.primary_supply, incremental_checkpoint.supply_accuracy_pct);
    
    // Both should achieve similar final supply
    let supply_difference = (batch_state.primary_supply as i64 - incremental_state.primary_supply as i64).abs();
    let supply_difference_pct = (supply_difference as f64 / batch_state.primary_supply as f64) * 100.0;
    
    assert!(supply_difference_pct < 1.0, 
        "Supply difference between batch and incremental approaches too large: {:.2}%", 
        supply_difference_pct);
    
    // Both should have reasonable accuracy
    assert!(batch_checkpoint.supply_accuracy_pct.abs() < 2.0,
        "Batch approach accuracy too poor: {:.2}%", batch_checkpoint.supply_accuracy_pct);
    assert!(incremental_checkpoint.supply_accuracy_pct.abs() < 2.0,
        "Incremental approach accuracy too poor: {:.2}%", incremental_checkpoint.supply_accuracy_pct);
    
    println!("✓ Both approaches achieved similar results within acceptable precision");
}

#[test]
fn test_precision_at_epoch_boundaries() {
    let mut env = LargeScaleValidationEnv::new();
    env.execute_swap(2000 * E8S).expect("Failed to get secondary tokens");
    
    // Test precision just before and after epoch boundaries
    // First epoch boundary should be around 5000 secondary burned
    let boundary_tests = vec![
        (4900, "Pre-boundary"),
        (5000, "At-boundary"), 
        (5100, "Post-boundary"),
    ];
    
    for (burn_target, description) in boundary_tests {
        burn_to_target(&mut env, burn_target).expect("Failed to burn to target");
        
        let state = env.capture_current_state();
        let checkpoint = env.validate_at_checkpoint(burn_target);
        
        println!("{}: burned={}, epoch={}, accuracy={:.4}%", 
            description, state.secondary_burned_total, state.current_epoch, checkpoint.supply_accuracy_pct);
        
        // Precision should remain reasonable at all boundary points
        assert!(checkpoint.supply_accuracy_pct.abs() < 2.0,
            "Precision at {} is too poor: {:.2}%", description, checkpoint.supply_accuracy_pct);
    }
    
    println!("✓ Precision maintained across epoch boundaries");
}

#[test]
fn test_accumulated_rounding_errors() {
    let mut env = LargeScaleValidationEnv::new();
    env.execute_swap(300 * E8S).expect("Failed to get secondary tokens");
    
    // Perform many small operations to test for accumulated rounding errors
    let small_burn_amount = 1; // Very small burns
    let num_operations = 100;
    
    for i in 1..=num_operations {
        env.execute_burn(small_burn_amount).expect("Failed to execute small burn");
        
        // Check precision every 20 operations
        if i % 20 == 0 {
            let checkpoint = env.validate_at_checkpoint(i * small_burn_amount);
            println!("After {} operations: accuracy = {:.4}%", i, checkpoint.supply_accuracy_pct);
            
            // Ensure rounding errors don't accumulate excessively
            assert!(checkpoint.supply_accuracy_pct.abs() < 1.0,
                "Accumulated rounding errors too large after {} operations: {:.4}%", 
                i, checkpoint.supply_accuracy_pct);
        }
    }
    
    println!("✓ Accumulated rounding errors remain within acceptable bounds");
}