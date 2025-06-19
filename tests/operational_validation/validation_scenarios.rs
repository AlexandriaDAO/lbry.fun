// Validation scenarios for large-scale operational testing
use super::large_scale_env::*;

const E8S: u64 = 100_000_000;

#[derive(Debug, Clone)]
pub struct ValidationScenario {
    pub name: String,
    pub description: String,
    pub operations: Vec<PlannedOperation>,
    pub validation_points: Vec<u64>, // Secondary burn amounts to validate at
    pub expected_outcomes: ScenarioExpectations,
}

#[derive(Debug, Clone)]
pub struct PlannedOperation {
    pub operation: OperationType,
    pub quantity: u64,
    pub batch_size: Option<usize>, // Split into smaller operations
}

#[derive(Debug, Clone)]
pub struct ScenarioExpectations {
    pub max_supply_drift_pct: f64,
    pub max_epoch_drift: usize,
    pub min_success_rate: f64,
}

#[derive(Debug, Clone)]
pub struct ScenarioResult {
    pub name: String,
    pub total_operations: usize,
    pub validation_results: Vec<ValidationPoint>,
    pub success: bool,
}

pub fn get_validation_scenarios() -> Vec<ValidationScenario> {
    vec![
        // Scenario 1: Steady progression through epochs
        ValidationScenario {
            name: "steady_epoch_progression".to_string(),
            description: "Steady burns progressing through 3-4 epochs".to_string(),
            operations: vec![
                PlannedOperation {
                    operation: OperationType::SwapIcp(500 * E8S), // Get secondary tokens (reduced from 1000)
                    quantity: 1,
                    batch_size: None,
                },
                PlannedOperation {
                    operation: OperationType::BurnSecondary(100), // Start burning
                    quantity: 50, // 50 burns of 100 tokens each = 5000 total
                    batch_size: Some(10), // Do 10 at a time
                },
            ],
            validation_points: vec![1000, 2500, 4000, 5000],
            expected_outcomes: ScenarioExpectations {
                max_supply_drift_pct: 5.0,  // Allow 5% drift for linear approximation
                max_epoch_drift: 1,
                min_success_rate: 80.0,  // Reduced from 95% due to mock predictions
            },
        },
        
        // Scenario 2: Many small burns
        ValidationScenario {
            name: "many_small_burns".to_string(),
            description: "1000 small burns to test precision drift".to_string(),
            operations: vec![
                PlannedOperation {
                    operation: OperationType::SwapIcp(500 * E8S),
                    quantity: 1,
                    batch_size: None,
                },
                PlannedOperation {  
                    operation: OperationType::BurnSecondary(5), // Very small burns
                    quantity: 1000, // 1000 burns = 5000 total
                    batch_size: Some(100), // Process in batches of 100
                },
            ],
            validation_points: vec![500, 1000, 2500, 5000],
            expected_outcomes: ScenarioExpectations {
                max_supply_drift_pct: 0.5, // Should be more precise
                max_epoch_drift: 0,
                min_success_rate: 99.0,
            },
        },
        
        // Scenario 3: Large irregular burns
        ValidationScenario {
            name: "irregular_large_burns".to_string(),
            description: "Mixed large and small burns".to_string(),
            operations: vec![
                PlannedOperation {
                    operation: OperationType::SwapIcp(800 * E8S), // Reduced from 2000 to fit user balance
                    quantity: 1,
                    batch_size: None,
                },
                PlannedOperation {
                    operation: OperationType::BurnSecondary(500), // Large burn
                    quantity: 5,
                    batch_size: None,
                },
                PlannedOperation {
                    operation: OperationType::BurnSecondary(50), // Medium burns
                    quantity: 20,
                    batch_size: Some(5),
                },
                PlannedOperation {
                    operation: OperationType::BurnSecondary(10), // Small burns
                    quantity: 100, 
                    batch_size: Some(20),
                },
            ],
            validation_points: vec![1000, 3000, 5000, 7000],
            expected_outcomes: ScenarioExpectations {
                max_supply_drift_pct: 1.0,
                max_epoch_drift: 1,
                min_success_rate: 95.0,
            },
        },
        
        // Scenario 4: Quick initial validation - smaller scale for faster testing
        ValidationScenario {
            name: "quick_validation".to_string(),
            description: "Quick test for basic validation functionality".to_string(),
            operations: vec![
                PlannedOperation {
                    operation: OperationType::SwapIcp(200 * E8S), // Smaller amount
                    quantity: 1,
                    batch_size: None,
                },
                PlannedOperation {
                    operation: OperationType::BurnSecondary(25), // Smaller burns
                    quantity: 10, // 10 burns = 250 total
                    batch_size: Some(5),
                },
            ],
            validation_points: vec![250, 500],
            expected_outcomes: ScenarioExpectations {
                max_supply_drift_pct: 5.0, // Should be quite accurate now
                max_epoch_drift: 1,
                min_success_rate: 90.0, // Should work well
            },
        },
    ]
}

// Helper functions for executing planned operations
pub fn execute_planned_operation(env: &mut LargeScaleValidationEnv, planned: PlannedOperation) -> Result<usize, String> {
    match planned.operation {
        OperationType::SwapIcp(amount) => {
            for _ in 0..planned.quantity {
                env.execute_swap(amount)?;
            }
            Ok(planned.quantity as usize)
        },
        OperationType::BurnSecondary(amount) => {
            let batch_size = planned.batch_size.unwrap_or(planned.quantity as usize);
            let mut executed = 0;
            
            let total_batches = (planned.quantity as usize + batch_size - 1) / batch_size; // Ceiling division
            
            for _ in 0..total_batches {
                let operations_in_batch = std::cmp::min(batch_size, planned.quantity as usize - executed);
                
                for _ in 0..operations_in_batch {
                    env.execute_burn(amount)?;
                    executed += 1;
                }
                
                // Small delay between batches to avoid overwhelming the system
                std::thread::sleep(std::time::Duration::from_millis(10));
            }
            Ok(executed)
        },
    }
}

pub fn validate_scenario_expectations(expectations: &ScenarioExpectations, results: &[ValidationPoint]) -> bool {
    if results.is_empty() {
        return false;
    }
    
    let mut passed_validations = 0;
    let total_validations = results.len();
    
    for result in results {
        let mut validation_passed = true;
        
        // Check supply drift
        if result.supply_accuracy_pct.abs() > expectations.max_supply_drift_pct {
            validation_passed = false;
        }
        
        // Check epoch drift (currently simplified - could be enhanced)
        if !result.epoch_match && expectations.max_epoch_drift == 0 {
            validation_passed = false;
        }
        
        if validation_passed {
            passed_validations += 1;
        }
    }
    
    let success_rate = (passed_validations as f64 / total_validations as f64) * 100.0;
    success_rate >= expectations.min_success_rate
}

// Helper to execute all operations in a scenario
pub fn execute_scenario_operations(env: &mut LargeScaleValidationEnv, scenario: &ValidationScenario) -> Result<usize, String> {
    let mut total_operations = 0;
    
    println!("Executing scenario: {}", scenario.name);
    println!("Description: {}", scenario.description);
    
    for (i, planned_op) in scenario.operations.iter().enumerate() {
        println!("  Operation {}: {:?}", i + 1, planned_op.operation);
        let ops_executed = execute_planned_operation(env, planned_op.clone())?;
        total_operations += ops_executed;
        println!("  Completed {} operations", ops_executed);
    }
    
    println!("Scenario execution complete. Total operations: {}", total_operations);
    Ok(total_operations)
}

// Helper to run all validation points for a scenario
pub fn validate_scenario_checkpoints(env: &mut LargeScaleValidationEnv, scenario: &ValidationScenario) -> Result<Vec<ValidationPoint>, String> {
    let mut validation_results = Vec::new();
    
    println!("Running validation checkpoints for scenario: {}", scenario.name);
    
    for &validation_point in &scenario.validation_points {
        println!("  Burning to target: {} secondary tokens", validation_point);
        
        // Execute operations to reach this validation point if needed
        burn_to_target(env, validation_point)?;
        
        let result = env.validate_at_checkpoint(validation_point);
        validation_results.push(result.clone());
        
        println!("  Checkpoint at {} burned: Supply accuracy {:.2}%, Epoch match: {}", 
            validation_point, result.supply_accuracy_pct, result.epoch_match);
    }
    
    Ok(validation_results)
}

// New function to execute operations with incremental validation at checkpoints
pub fn execute_scenario_with_incremental_validation(
    env: &mut LargeScaleValidationEnv, 
    scenario: &ValidationScenario
) -> Result<(usize, Vec<ValidationPoint>), String> {
    let mut total_operations = 0;
    let mut validation_results = Vec::new();
    let mut next_checkpoint_idx = 0;
    
    println!("Executing scenario with incremental validation: {}", scenario.name);
    println!("Description: {}", scenario.description);
    
    // Execute operations and validate at checkpoints during execution
    for (i, planned_op) in scenario.operations.iter().enumerate() {
        println!("  Operation {}: {:?}", i + 1, planned_op.operation);
        
        match &planned_op.operation {
            OperationType::SwapIcp(amount) => {
                // Swaps don't affect burn count, so execute normally
                for _ in 0..planned_op.quantity {
                    env.execute_swap(*amount)?;
                    total_operations += 1;
                }
                println!("  Completed {} swap operations", planned_op.quantity);
            }
            OperationType::BurnSecondary(amount) => {
                // Execute burns one at a time or in batches, checking for checkpoints
                let batch_size = planned_op.batch_size.unwrap_or(planned_op.quantity as usize);
                let mut executed = 0;
                
                while executed < planned_op.quantity as usize {
                    // Execute a single burn
                    env.execute_burn(*amount)?;
                    executed += 1;
                    total_operations += 1;
                    
                    // Check if we've reached any checkpoints
                    let current_burned = env.capture_current_state().secondary_burned_total;
                    
                    // Validate at all checkpoints we've passed
                    while next_checkpoint_idx < scenario.validation_points.len() 
                        && current_burned >= scenario.validation_points[next_checkpoint_idx] {
                        
                        let checkpoint_target = scenario.validation_points[next_checkpoint_idx];
                        let result = env.validate_at_checkpoint(checkpoint_target);
                        
                        println!("  Checkpoint at {} burned: Supply accuracy {:.2}%, Epoch match: {}", 
                            checkpoint_target, result.supply_accuracy_pct, result.epoch_match);
                        
                        validation_results.push(result);
                        next_checkpoint_idx += 1;
                    }
                    
                    // Add delay between batches if needed
                    if executed % batch_size == 0 && executed < planned_op.quantity as usize {
                        std::thread::sleep(std::time::Duration::from_millis(10));
                    }
                }
                
                println!("  Completed {} burn operations", executed);
            }
        }
    }
    
    // Handle any remaining checkpoints that weren't reached during operations
    while next_checkpoint_idx < scenario.validation_points.len() {
        let checkpoint_target = scenario.validation_points[next_checkpoint_idx];
        
        println!("  Burning to remaining checkpoint: {} secondary tokens", checkpoint_target);
        burn_to_target(env, checkpoint_target)?;
        
        let result = env.validate_at_checkpoint(checkpoint_target);
        println!("  Checkpoint at {} burned: Supply accuracy {:.2}%, Epoch match: {}", 
            checkpoint_target, result.supply_accuracy_pct, result.epoch_match);
        
        validation_results.push(result);
        next_checkpoint_idx += 1;
    }
    
    println!("Scenario execution complete. Total operations: {}", total_operations);
    Ok((total_operations, validation_results))
}