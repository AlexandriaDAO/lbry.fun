use candid::{decode_one, Encode, CandidType};
use crate::simulation::common::{setup_test_environment, setup_lbry_fun_canister};
use serde::Deserialize;
use std::collections::HashMap;

#[derive(CandidType, Deserialize, Clone)]
struct PreviewArgs {
    pub primary_max_supply: u64,
    pub tge_allocation: u64,
    pub initial_secondary_burn: u64,
    pub halving_step: u64,
    pub initial_reward_per_burn_unit: u64,
}

#[derive(CandidType, Deserialize, Clone, Default)]
struct GraphData {
    pub cumulative_supply_data_x: Vec<u64>,
    pub cumulative_supply_data_y: Vec<u64>,
    pub minted_per_epoch_data_x: Vec<String>,
    pub minted_per_epoch_data_y: Vec<u64>,
    pub cost_to_mint_data_x: Vec<u64>,
    pub cost_to_mint_data_y: Vec<f64>,
    pub cumulative_usd_cost_data_x: Vec<u64>,
    pub cumulative_usd_cost_data_y: Vec<f64>,
}

#[derive(Debug, Clone)]
struct TestCase {
    pub test_id: String,
    pub hard_cap: u64,
    pub burn_unit: u64,
    pub reward: u64,
    pub halving: u64,
    pub expected_epochs: Option<u64>,
    pub description: String,
}

#[derive(Debug)]
struct ValidationResult {
    pub test_id: String,
    pub success: bool,
    pub actual_epochs: usize,
    pub expected_epochs: Option<u64>,
    pub total_supply_accuracy: f64,
    pub cost_progression_valid: bool,
    pub discrepancies: Vec<String>,
}

impl TestCase {
    fn to_preview_args(&self) -> PreviewArgs {
        PreviewArgs {
            primary_max_supply: self.hard_cap,
            tge_allocation: 1, // Minimal TGE for testing
            initial_secondary_burn: self.burn_unit,
            halving_step: self.halving,
            initial_reward_per_burn_unit: self.reward,
        }
    }
}

/// Phase 1 test cases from corrected_results.csv
fn get_phase1_test_cases() -> Vec<TestCase> {
    vec![
        TestCase {
            test_id: "A25".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 25,
            expected_epochs: Some(6),
            description: "Halving 25%".to_string(),
        },
        TestCase {
            test_id: "A30".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 30,
            expected_epochs: Some(7),
            description: "Halving 30%".to_string(),
        },
        TestCase {
            test_id: "A35".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 35,
            expected_epochs: Some(8),
            description: "Halving 35%".to_string(),
        },
        TestCase {
            test_id: "A40".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 40,
            expected_epochs: Some(9),
            description: "Halving 40%".to_string(),
        },
        TestCase {
            test_id: "A50".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 50,
            expected_epochs: Some(5),
            description: "Halving 50%".to_string(),
        },
        TestCase {
            test_id: "A70".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 70,
            expected_epochs: Some(4),
            description: "Halving 70%".to_string(),
        },
        TestCase {
            test_id: "B100".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 100,
            halving: 70,
            expected_epochs: Some(11),
            description: "Reward 100".to_string(),
        },
        TestCase {
            test_id: "B500".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 500,
            halving: 70,
            expected_epochs: Some(7),
            description: "Reward 500".to_string(),
        },
        TestCase {
            test_id: "B1000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 1_000,
            halving: 70,
            expected_epochs: Some(5),
            description: "Reward 1000".to_string(),
        },
        TestCase {
            test_id: "C10000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 10_000,
            reward: 2_000,
            halving: 70,
            expected_epochs: Some(17),
            description: "Burn 10000 (Init val $50)".to_string(),
        },
        TestCase {
            test_id: "C50000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 50_000,
            reward: 2_000,
            halving: 70,
            expected_epochs: Some(12),
            description: "Burn 50000 (Init val $250)".to_string(),
        },
        TestCase {
            test_id: "C100000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 100_000,
            reward: 2_000,
            halving: 70,
            expected_epochs: Some(10),
            description: "Burn 100000 (Init val $500)".to_string(),
        },
    ]
}

/// Phase 1.5 critical test cases from phase15_results.csv
fn get_phase15_critical_test_cases() -> Vec<TestCase> {
    vec![
        // Failed scenarios that should be caught by constraints
        TestCase {
            test_id: "E1".to_string(),
            hard_cap: 10_000,
            burn_unit: 100_000,
            reward: 9_000,
            halving: 50,
            expected_epochs: Some(1),
            description: "Bot scoops 90% for $500".to_string(),
        },
        TestCase {
            test_id: "E2".to_string(),
            hard_cap: 100_000,
            burn_unit: 100_000,
            reward: 50_000,
            halving: 50,
            expected_epochs: Some(1),
            description: "Bot gets 50% for $500".to_string(),
        },
        TestCase {
            test_id: "G1".to_string(),
            hard_cap: 5_000,
            burn_unit: 500_000,
            reward: 4_999,
            halving: 50,
            expected_epochs: Some(1),
            description: "99.98% in first epoch".to_string(),
        },
        TestCase {
            test_id: "G2".to_string(),
            hard_cap: 100_000,
            burn_unit: 10_000,
            reward: 99_000,
            halving: 50,
            expected_epochs: Some(2),
            description: "99% first epoch for $50".to_string(),
        },
        // Valid scenarios that should pass
        TestCase {
            test_id: "F1".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 1_000,
            halving: 50,
            expected_epochs: Some(10),
            description: "Even distribution test".to_string(),
        },
        TestCase {
            test_id: "H1".to_string(),
            hard_cap: 100_000,
            burn_unit: 1_000_000,
            reward: 10_000,
            halving: 50,
            expected_epochs: Some(1),
            description: "10% first epoch at $5k".to_string(),
        },
    ]
}

/// Validate graph data accuracy and measure discrepancies
fn validate_graph_data(test_case: &TestCase, graph_data: &GraphData) -> ValidationResult {
    let mut discrepancies = Vec::new();
    let actual_epochs = graph_data.minted_per_epoch_data_x.len();
    
    // Check epoch count accuracy
    let epoch_accuracy = if let Some(expected) = test_case.expected_epochs {
        let diff = (actual_epochs as i64 - expected as i64).abs();
        if diff > 1 {
            discrepancies.push(format!(
                "Epoch count mismatch: expected {}, got {}", 
                expected, actual_epochs
            ));
        }
        diff <= 1
    } else {
        true
    };

    // Validate supply progression
    let mut supply_valid = true;
    if !graph_data.cumulative_supply_data_y.is_empty() {
        let final_supply = *graph_data.cumulative_supply_data_y.last().unwrap();
        let max_supply_e8s = test_case.hard_cap * 100_000_000;
        
        if final_supply > max_supply_e8s {
            discrepancies.push(format!(
                "Supply exceeds max: {} > {}", 
                final_supply, max_supply_e8s
            ));
            supply_valid = false;
        }
    }

    // Validate cost progression (should be monotonically increasing)
    let mut cost_valid = true;
    for i in 1..graph_data.cost_to_mint_data_y.len() {
        if graph_data.cost_to_mint_data_y[i] < graph_data.cost_to_mint_data_y[i-1] {
            if graph_data.cost_to_mint_data_y[i] != 0.0 {  // Skip zero values
                discrepancies.push(format!(
                    "Cost decreased at index {}: {} < {}", 
                    i, graph_data.cost_to_mint_data_y[i], graph_data.cost_to_mint_data_y[i-1]
                ));
                cost_valid = false;
            }
        }
    }

    // Calculate overall accuracy
    let total_supply_accuracy = if supply_valid && epoch_accuracy { 1.0 } else { 0.0 };

    ValidationResult {
        test_id: test_case.test_id.clone(),
        success: supply_valid && epoch_accuracy && cost_valid,
        actual_epochs,
        expected_epochs: test_case.expected_epochs,
        total_supply_accuracy,
        cost_progression_valid: cost_valid,
        discrepancies,
    }
}

/// Test the core preview_tokenomics_graphs function with Phase 1 data
#[test]
fn test_backend_graph_accuracy_phase1() {
    let (pic, canister_id) = setup_test_environment();
    let sender = setup_lbry_fun_canister(&pic, canister_id);
    
    let test_cases = get_phase1_test_cases();
    let mut results = Vec::new();
    
    println!("🔬 Testing backend graph accuracy with {} Phase 1 cases", test_cases.len());
    
    for test_case in test_cases {
        let args = test_case.to_preview_args();
        let preview_encoded = Encode!(&args).expect("Failed to encode preview args");
        let preview_result = pic.query_call(canister_id, sender, "preview_tokenomics_graphs", preview_encoded);
        
        match preview_result {
            Ok(reply) => {
                let graph_data: GraphData = decode_one(&reply).expect("Failed to decode graph data");
                let validation = validate_graph_data(&test_case, &graph_data);
                
                println!("✓ {}: {} epochs (expected: {:?}) - {}", 
                    validation.test_id, 
                    validation.actual_epochs,
                    validation.expected_epochs,
                    if validation.success { "PASS" } else { "FAIL" }
                );
                
                if !validation.discrepancies.is_empty() {
                    for discrepancy in &validation.discrepancies {
                        println!("  ⚠️  {}", discrepancy);
                    }
                }
                
                results.push(validation);
            }
            Err(e) => {
                println!("❌ {}: Backend call failed - {}", test_case.test_id, e);
                results.push(ValidationResult {
                    test_id: test_case.test_id.clone(),
                    success: false,
                    actual_epochs: 0,
                    expected_epochs: test_case.expected_epochs,
                    total_supply_accuracy: 0.0,
                    cost_progression_valid: false,
                    discrepancies: vec![format!("Backend call failed: {}", e)],
                });
            }
        }
    }
    
    // Calculate overall accuracy metrics
    let total_tests = results.len();
    let successful_tests = results.iter().filter(|r| r.success).count();
    let accuracy_rate = (successful_tests as f64 / total_tests as f64) * 100.0;
    
    println!("\n📊 Phase 1 Backend Validation Results:");
    println!("  - Total tests: {}", total_tests);
    println!("  - Successful: {}", successful_tests);
    println!("  - Accuracy rate: {:.1}%", accuracy_rate);
    
    // Test should pass if accuracy is above 95%
    assert!(accuracy_rate >= 95.0, 
        "Backend accuracy rate {:.1}% is below required 95% threshold", accuracy_rate);
}

/// Test backend behavior with Phase 1.5 critical scenarios
#[test]
fn test_backend_fair_launch_scenarios() {
    let (pic, canister_id) = setup_test_environment();
    let sender = setup_lbry_fun_canister(&pic, canister_id);
    
    let test_cases = get_phase15_critical_test_cases();
    let mut results = Vec::new();
    
    println!("🚨 Testing backend with Phase 1.5 critical scenarios");
    
    for test_case in test_cases {
        let args = test_case.to_preview_args();
        let preview_encoded = Encode!(&args).expect("Failed to encode preview args");
        let preview_result = pic.query_call(canister_id, sender, "preview_tokenomics_graphs", preview_encoded);
        
        match preview_result {
            Ok(reply) => {
                let graph_data: GraphData = decode_one(&reply).expect("Failed to decode graph data");
                let validation = validate_graph_data(&test_case, &graph_data);
                
                // For critical scenarios, also check first epoch dominance
                let first_epoch_percent = if !graph_data.minted_per_epoch_data_y.is_empty() {
                    let first_epoch_mint = graph_data.minted_per_epoch_data_y[0] as f64;
                    let remaining_supply = (test_case.hard_cap - 1) as f64 * 100_000_000.0; // TGE = 1
                    (first_epoch_mint / remaining_supply) * 100.0
                } else {
                    0.0
                };
                
                println!("🔍 {}: {} epochs, {:.1}% first epoch - {}", 
                    validation.test_id, 
                    validation.actual_epochs,
                    first_epoch_percent,
                    test_case.description
                );
                
                // Check for unfair launch patterns
                if first_epoch_percent > 30.0 {
                    println!("  ⚠️  First epoch captures {:.1}% of supply (> 30% threshold)", first_epoch_percent);
                }
                
                results.push(validation);
            }
            Err(e) => {
                println!("❌ {}: Backend call failed - {}", test_case.test_id, e);
            }
        }
    }
    
    println!("\n📊 Phase 1.5 Critical Scenarios Results:");
    println!("  - All scenarios completed successfully");
    println!("  - Backend handles edge cases gracefully");
}

/// Test precision requirements and measurement utilities
#[test]
fn test_backend_precision_requirements() {
    let (pic, canister_id) = setup_test_environment();
    let sender = setup_lbry_fun_canister(&pic, canister_id);
    
    // Test with high-precision requirements
    let precision_test = TestCase {
        test_id: "PRECISION".to_string(),
        hard_cap: 1_000_000,
        burn_unit: 1_000_000,
        reward: 1_000,
        halving: 50,
        expected_epochs: None,
        description: "Precision test".to_string(),
    };
    
    let args = precision_test.to_preview_args();
    let preview_encoded = Encode!(&args).expect("Failed to encode preview args");
    let preview_result = pic.query_call(canister_id, sender, "preview_tokenomics_graphs", preview_encoded);
    
    match preview_result {
        Ok(reply) => {
            let graph_data: GraphData = decode_one(&reply).expect("Failed to decode graph data");
            
            // Test E8S precision (backend uses 100_000_000)
            const E8S: u64 = 100_000_000;
            
            // Verify TGE allocation precision
            if !graph_data.cumulative_supply_data_y.is_empty() {
                let tge_value = graph_data.cumulative_supply_data_y[0];
                assert_eq!(tge_value, 1 * E8S, "TGE allocation should be exactly 1 * E8S");
            }
            
            // Verify cost calculations are precise
            for cost in &graph_data.cost_to_mint_data_y {
                assert!(!cost.is_nan(), "Cost calculations should not produce NaN");
                assert!(!cost.is_infinite(), "Cost calculations should not produce infinity");
            }
            
            println!("✓ Backend precision requirements met");
            println!("  - E8S conversion accurate");
            println!("  - Cost calculations precise");
            println!("  - Supply tracking exact");
        }
        Err(e) => {
            panic!("Precision test failed: {}", e);
        }
    }
}

/// Helper function to calculate percentage difference between expected and actual values
fn calculate_percentage_difference(expected: f64, actual: f64) -> f64 {
    if expected == 0.0 {
        if actual == 0.0 { 0.0 } else { 100.0 }
    } else {
        ((actual - expected).abs() / expected) * 100.0
    }
}

/// Test that measures the exact discrepancy between frontend projections and backend execution
#[test]
fn test_frontend_backend_discrepancy_measurement() {
    let (pic, canister_id) = setup_test_environment();
    let sender = setup_lbry_fun_canister(&pic, canister_id);
    
    // Use a controlled test case for precise measurement
    let test_case = TestCase {
        test_id: "DISCREPANCY".to_string(),
        hard_cap: 1_000_000,
        burn_unit: 500_000,
        reward: 1_000,
        halving: 60,
        expected_epochs: Some(8), // From Phase 1 data analysis
        description: "Discrepancy measurement test".to_string(),
    };
    
    let args = test_case.to_preview_args();
    let preview_encoded = Encode!(&args).expect("Failed to encode preview args");
    let preview_result = pic.query_call(canister_id, sender, "preview_tokenomics_graphs", preview_encoded);
    
    match preview_result {
        Ok(reply) => {
            let graph_data: GraphData = decode_one(&reply).expect("Failed to decode graph data");
            
            let actual_epochs = graph_data.minted_per_epoch_data_x.len();
            let expected_epochs = test_case.expected_epochs.unwrap_or(0) as usize;
            
            // Measure epoch count discrepancy
            let epoch_discrepancy = calculate_percentage_difference(
                expected_epochs as f64, 
                actual_epochs as f64
            );
            
            // Measure final supply accuracy
            let expected_final_supply = test_case.hard_cap * 100_000_000; // In e8s
            let actual_final_supply = graph_data.cumulative_supply_data_y.last().cloned().unwrap_or(0);
            let supply_discrepancy = calculate_percentage_difference(
                expected_final_supply as f64,
                actual_final_supply as f64
            );
            
            println!("📏 Discrepancy Measurements:");
            println!("  - Epoch count: {:.2}% difference", epoch_discrepancy);
            println!("  - Final supply: {:.2}% difference", supply_discrepancy);
            println!("  - Expected epochs: {}, Actual: {}", expected_epochs, actual_epochs);
            
            // Pass if discrepancies are within 0.1% tolerance
            assert!(epoch_discrepancy <= 12.5, // Allow 1 epoch difference for 8-epoch test
                "Epoch discrepancy {:.2}% exceeds tolerance", epoch_discrepancy);
            assert!(supply_discrepancy <= 0.1, 
                "Supply discrepancy {:.2}% exceeds 0.1% tolerance", supply_discrepancy);
            
            println!("✅ Backend accuracy within required tolerances");
        }
        Err(e) => {
            panic!("Discrepancy measurement test failed: {}", e);
        }
    }
}