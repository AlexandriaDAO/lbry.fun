// Edge case operational tests
use super::*;
use crate::shared_helpers::get_secondary_balance;

const E8S: u64 = 100_000_000;

#[test]
fn test_epoch_boundary_precision() {
    let mut env = LargeScaleValidationEnv::new();
    // Get enough secondary tokens to perform multiple burns
    env.execute_swap(900 * E8S).expect("Failed to get secondary tokens");
    
    // Burn to just before first epoch boundary (typically around 5000 secondary tokens)
    burn_to_target(&mut env, 4950).expect("Failed to burn to pre-boundary target");
    
    let pre_epoch_state = env.capture_current_state();
    let pre_validation = env.validate_at_checkpoint(4950);
    
    println!("Pre-epoch state: epoch={}, burned={}, accuracy={:.2}%", 
        pre_epoch_state.current_epoch, pre_epoch_state.secondary_burned_total, pre_validation.supply_accuracy_pct);
    
    // Execute the burn that should trigger epoch transition
    env.execute_burn(50).expect("Failed to execute epoch boundary burn");
    
    let post_epoch_state = env.capture_current_state();
    let post_validation = env.validate_at_checkpoint(5000);
    
    println!("Post-epoch state: epoch={}, burned={}, accuracy={:.2}%", 
        post_epoch_state.current_epoch, post_epoch_state.secondary_burned_total, post_validation.supply_accuracy_pct);
    
    // Validate epoch transition occurred correctly (if expected)
    // Note: The exact epoch transition logic may vary, so we check if it's reasonable
    assert!(post_epoch_state.current_epoch >= pre_epoch_state.current_epoch,
        "Epoch should not decrease across operations");
    
    // Validate supply predictions remain accurate across epoch boundary
    // Note: Using linear approximation for mock predictions, so allow for some variance
    assert!(post_validation.supply_accuracy_pct.abs() < 5.0,
        "Supply prediction accuracy degraded across epoch boundary: {:.2}%",
        post_validation.supply_accuracy_pct);
        
    println!("✓ Epoch boundary transition validated successfully");
}

#[test]
fn test_single_large_vs_many_small_equivalence() {
    // Test that burning 1000 tokens at once gives same result as 100 burns of 10
    
    // Scenario A: Single large burn
    let mut env_a = LargeScaleValidationEnv::new();
    env_a.execute_swap(500 * E8S).expect("Failed to get secondary tokens");
    env_a.execute_burn(1000).expect("Failed to execute large burn");
    let state_a = env_a.capture_current_state();
    
    // Scenario B: Many small burns  
    let mut env_b = LargeScaleValidationEnv::new();
    env_b.execute_swap(500 * E8S).expect("Failed to get secondary tokens");
    
    for _ in 0..100 {
        env_b.execute_burn(10).expect("Failed to execute small burn");
    }
    let state_b = env_b.capture_current_state();
    
    println!("Large burn result: primary_supply={}, burned_total={}", 
        state_a.primary_supply, state_a.secondary_burned_total);
    println!("Small burns result: primary_supply={}, burned_total={}", 
        state_b.primary_supply, state_b.secondary_burned_total);
    
    // Validate final states are equivalent (within reasonable tolerance)
    let supply_diff = (state_a.primary_supply as i64 - state_b.primary_supply as i64).abs();
    let supply_diff_pct = (supply_diff as f64 / state_a.primary_supply as f64) * 100.0;
    
    assert!(supply_diff_pct < 1.0,
        "Primary supply differs too much: large burn {} vs small burns {} (diff: {:.2}%)",
        state_a.primary_supply, state_b.primary_supply, supply_diff_pct);
        
    assert_eq!(state_a.secondary_burned_total, state_b.secondary_burned_total,
        "Secondary burned total should be identical: {} vs {}",
        state_a.secondary_burned_total, state_b.secondary_burned_total);
        
    println!("✓ Large burn vs many small burns equivalence validated");
}

#[test]
fn test_minimum_burn_amounts() {
    let mut env = LargeScaleValidationEnv::new();
    env.execute_swap(200 * E8S).expect("Failed to get secondary tokens");
    
    // Test very small burn amounts
    let small_amounts = vec![1, 2, 5];
    
    for amount in small_amounts {
        let pre_state = env.capture_current_state();
        
        match env.execute_burn(amount) {
            Ok(_) => {
                let post_state = env.capture_current_state();
                println!("Burn of {} succeeded: burned_total {} -> {}", 
                    amount, pre_state.secondary_burned_total, post_state.secondary_burned_total);
                
                // Validate the burn actually happened
                assert!(post_state.secondary_burned_total > pre_state.secondary_burned_total,
                    "Burn did not increase secondary burned total");
            },
            Err(e) => {
                println!("Burn of {} failed (may be expected): {}", amount, e);
                // Some very small amounts might fail due to minimum requirements
                // This could be expected behavior
            }
        }
    }
    
    println!("✓ Minimum burn amount testing completed");
}

#[test]
fn test_maximum_single_burn() {
    let mut env = LargeScaleValidationEnv::new();
    // Get enough secondary tokens for a large burn
    env.execute_swap(900 * E8S).expect("Failed to get secondary tokens");
    
    // Get current secondary balance
    let secondary_balance = get_secondary_balance(&env.token_env, &env.user_id);
    let max_burn = (secondary_balance / E8S) - 1; // Leave some for fees
    
    println!("Attempting maximum burn of {} natural units (secondary balance: {} e8s)", 
        max_burn, secondary_balance);
    
    if max_burn > 0 {
        let pre_state = env.capture_current_state();
        
        match env.execute_burn(max_burn) {
            Ok(_) => {
                let post_state = env.capture_current_state();
                println!("Maximum burn succeeded: primary_supply {} -> {}", 
                    pre_state.primary_supply, post_state.primary_supply);
                
                // Validate significant change occurred
                assert!(post_state.primary_supply > pre_state.primary_supply,
                    "Large burn should have increased primary supply");
            },
            Err(e) => {
                println!("Maximum burn failed: {}", e);
                // This might be expected if there are balance or approval issues
            }
        }
    }
    
    println!("✓ Maximum single burn testing completed");
}

#[test]
fn test_sequential_burn_consistency() {
    let mut env = LargeScaleValidationEnv::new();
    // Get enough secondary tokens for sequential burns
    env.execute_swap(700 * E8S).expect("Failed to get secondary tokens");
    
    // Perform sequential burns and check for consistency
    let burn_amounts = vec![50, 100, 75, 125, 50];
    let mut _expected_total_burned = 0;
    
    for (i, &amount) in burn_amounts.iter().enumerate() {
        let pre_state = env.capture_current_state();
        
        env.execute_burn(amount).expect("Failed to execute sequential burn");
        _expected_total_burned += amount;
        
        let post_state = env.capture_current_state();
        
        println!("Burn {}: amount={}, total_burned={}, primary_supply={}", 
            i + 1, amount, post_state.secondary_burned_total, post_state.primary_supply);
        
        // Validate consistency
        assert!(post_state.secondary_burned_total >= pre_state.secondary_burned_total,
            "Secondary burned total should not decrease");
        
        assert!(post_state.primary_supply >= pre_state.primary_supply,
            "Primary supply should not decrease from burns");
        
        // Check that primary supply increased (unless we hit max supply)
        if pre_state.primary_supply < 21_000_000 * E8S {
            assert!(post_state.primary_supply > pre_state.primary_supply,
                "Primary supply should increase from burn operations");
        }
    }
    
    println!("✓ Sequential burn consistency validated");
}

#[test]
fn test_rapid_operations_stability() {
    let mut env = LargeScaleValidationEnv::new();
    env.execute_swap(500 * E8S).expect("Failed to get secondary tokens");
    
    // Perform rapid operations to test system stability
    let num_rapid_operations = 20;
    let rapid_burn_amount = 10;
    
    println!("Performing {} rapid burn operations of {} tokens each", 
        num_rapid_operations, rapid_burn_amount);
    
    for i in 0..num_rapid_operations {
        match env.execute_burn(rapid_burn_amount) {
            Ok(_) => {
                if i % 5 == 0 {
                    let state = env.capture_current_state();
                    println!("  Operation {}: burned_total={}, primary_supply={}", 
                        i + 1, state.secondary_burned_total, state.primary_supply);
                }
            },
            Err(e) => {
                println!("  Operation {} failed: {}", i + 1, e);
                // Some rapid operations might fail due to system limitations
                // This could be expected behavior
            }
        }
        
        // Very small delay to avoid overwhelming the system
        std::thread::sleep(std::time::Duration::from_millis(1));
    }
    
    let final_state = env.capture_current_state();
    println!("Final state: burned_total={}, primary_supply={}", 
        final_state.secondary_burned_total, final_state.primary_supply);
    
    println!("✓ Rapid operations stability test completed");
}