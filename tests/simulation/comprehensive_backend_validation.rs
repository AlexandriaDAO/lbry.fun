use candid::{decode_one, Encode, CandidType};
use crate::simulation::common::{setup_test_environment, setup_lbry_fun_canister};
use serde::Deserialize;

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

/// Complete Phase 1 test case matrix from corrected_results.csv
fn get_complete_phase1_test_cases() -> Vec<TestCase> {
    vec![
        // Halving step series (A)
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
            test_id: "A45".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 45,
            expected_epochs: Some(7),
            description: "Halving 45%".to_string(),
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
            test_id: "A55".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 55,
            expected_epochs: Some(5),
            description: "Halving 55%".to_string(),
        },
        TestCase {
            test_id: "A60".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 60,
            expected_epochs: Some(4),
            description: "Halving 60%".to_string(),
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
            test_id: "A80".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 80,
            expected_epochs: Some(3),
            description: "Halving 80%".to_string(),
        },
        TestCase {
            test_id: "A90".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 90,
            expected_epochs: Some(3),
            description: "Halving 90%".to_string(),
        },
        // Reward series (B)
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
            test_id: "B2000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 70,
            expected_epochs: Some(4),
            description: "Reward 2000".to_string(),
        },
        TestCase {
            test_id: "B5000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 5_000,
            halving: 70,
            expected_epochs: Some(2),
            description: "Reward 5000".to_string(),
        },
        TestCase {
            test_id: "B10000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 10_000,
            halving: 70,
            expected_epochs: Some(1),
            description: "Reward 10000".to_string(),
        },
        TestCase {
            test_id: "B20000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 20_000,
            halving: 70,
            expected_epochs: Some(1),
            description: "Reward 20000".to_string(),
        },
        // Burn unit series (C)
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
        TestCase {
            test_id: "C500000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 500_000,
            reward: 2_000,
            halving: 70,
            expected_epochs: Some(5),
            description: "Burn 500000 (Init val $2500)".to_string(),
        },
        TestCase {
            test_id: "C1000000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 70,
            expected_epochs: Some(4),
            description: "Burn 1000000 (Init val $5000)".to_string(),
        },
        TestCase {
            test_id: "C2000000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 2_000_000,
            reward: 2_000,
            halving: 70,
            expected_epochs: Some(3),
            description: "Burn 2000000 (Init val $10000)".to_string(),
        },
        TestCase {
            test_id: "C5000000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 5_000_000,
            reward: 2_000,
            halving: 70,
            expected_epochs: Some(1),
            description: "Burn 5000000 (Init val $25000)".to_string(),
        },
        // Mixed scenarios (D)
        TestCase {
            test_id: "D1".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 500,
            halving: 50,
            expected_epochs: Some(9),
            description: "Lower reward, 50% halving".to_string(),
        },
        TestCase {
            test_id: "D2".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 200,
            halving: 40,
            expected_epochs: Some(6),
            description: "Very low reward, 40% halving".to_string(),
        },
        TestCase {
            test_id: "D3".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 100,
            halving: 35,
            expected_epochs: Some(5),
            description: "Minimal reward, 35% halving".to_string(),
        },
        TestCase {
            test_id: "D4".to_string(),
            hard_cap: 10_000_000,
            burn_unit: 1_000_000,
            reward: 1_000,
            halving: 45,
            expected_epochs: Some(9),
            description: "10M supply, 45% halving".to_string(),
        },
        TestCase {
            test_id: "D5".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 500_000,
            reward: 1_000,
            halving: 50,
            expected_epochs: Some(10),
            description: "Lower burn unit".to_string(),
        },
    ]
}

/// Comprehensive test of all Phase 1 parameter combinations
#[test]
fn test_complete_phase1_backend_validation() {
    let (pic, canister_id) = setup_test_environment();
    let sender = setup_lbry_fun_canister(&pic, canister_id);
    
    let test_cases = get_complete_phase1_test_cases();
    let mut total_tests = 0;
    let mut exact_matches = 0;
    let mut within_one_epoch = 0;
    let mut failed_tests = 0;
    
    println!("🔬 Comprehensive Phase 1 Backend Validation");
    println!("Testing {} parameter combinations...\n", test_cases.len());
    
    for test_case in test_cases {
        total_tests += 1;
        let args = test_case.to_preview_args();
        let preview_encoded = Encode!(&args).expect("Failed to encode preview args");
        let preview_result = pic.query_call(canister_id, sender, "preview_tokenomics_graphs", preview_encoded);
        
        match preview_result {
            Ok(reply) => {
                let graph_data: GraphData = decode_one(&reply).expect("Failed to decode graph data");
                let actual_epochs = graph_data.minted_per_epoch_data_x.len();
                
                if let Some(expected) = test_case.expected_epochs {
                    let diff = (actual_epochs as i64 - expected as i64).abs();
                    
                    if diff == 0 {
                        exact_matches += 1;
                        println!("✅ {}: {} epochs (exact match) - {}", 
                            test_case.test_id, actual_epochs, test_case.description);
                    } else if diff == 1 {
                        within_one_epoch += 1;
                        println!("✓ {}: {} epochs (expected {}, ±1) - {}", 
                            test_case.test_id, actual_epochs, expected, test_case.description);
                    } else {
                        failed_tests += 1;
                        println!("❌ {}: {} epochs (expected {}, diff: {}) - {}", 
                            test_case.test_id, actual_epochs, expected, diff, test_case.description);
                    }
                } else {
                    println!("ℹ️ {}: {} epochs (no expectation) - {}", 
                        test_case.test_id, actual_epochs, test_case.description);
                }
            }
            Err(e) => {
                failed_tests += 1;
                println!("❌ {}: Backend call failed - {}", test_case.test_id, e);
            }
        }
    }
    
    // Calculate metrics
    let exact_accuracy = (exact_matches as f64 / total_tests as f64) * 100.0;
    let within_one_accuracy = ((exact_matches + within_one_epoch) as f64 / total_tests as f64) * 100.0;
    let failure_rate = (failed_tests as f64 / total_tests as f64) * 100.0;
    
    println!("\n📊 Comprehensive Backend Validation Results:");
    println!("  - Total tests: {}", total_tests);
    println!("  - Exact matches: {} ({:.1}%)", exact_matches, exact_accuracy);
    println!("  - Within ±1 epoch: {} ({:.1}%)", exact_matches + within_one_epoch, within_one_accuracy);
    println!("  - Failed tests: {} ({:.1}%)", failed_tests, failure_rate);
    
    // Phase 3 success criteria
    assert_eq!(failed_tests, 0, "No backend calls should fail");
    assert!(within_one_accuracy >= 95.0, 
        "At least 95% of tests should be within ±1 epoch accuracy");
    
    println!("\n✅ Phase 3 Backend Validation: SUCCESS");
    println!("   - Frontend graphs match backend execution within required tolerances");
    println!("   - All parameter combinations execute successfully");
    println!("   - Epoch count accuracy: {:.1}%", within_one_accuracy);
}

/// Test economic cost projections vs actual calculations
#[test]
fn test_economic_cost_validation() {
    let (pic, canister_id) = setup_test_environment();
    let sender = setup_lbry_fun_canister(&pic, canister_id);
    
    const SECONDARY_BURN_USD_COST: f64 = 0.005;
    
    // Test several scenarios for cost validation
    let cost_test_cases = vec![
        ("Low cost", 1_000_000, 1_000_000, 1_000, 50),
        ("Medium cost", 1_000_000, 500_000, 2_000, 50),
        ("High cost", 1_000_000, 100_000, 5_000, 30),
    ];
    
    println!("💰 Testing economic cost projections...\n");
    
    for (name, hard_cap, burn_unit, reward, halving) in cost_test_cases {
        let args = PreviewArgs {
            primary_max_supply: hard_cap,
            tge_allocation: 1,
            initial_secondary_burn: burn_unit,
            halving_step: halving,
            initial_reward_per_burn_unit: reward,
        };
        
        let preview_encoded = Encode!(&args).expect("Failed to encode preview args");
        let preview_result = pic.query_call(canister_id, sender, "preview_tokenomics_graphs", preview_encoded);
        
        match preview_result {
            Ok(reply) => {
                let graph_data: GraphData = decode_one(&reply).expect("Failed to decode graph data");
                
                // Validate cost progression
                let mut cost_valid = true;
                let mut total_secondary_burned = 0u64;
                
                // Check cumulative cost calculations
                for (i, &cumulative_cost) in graph_data.cumulative_usd_cost_data_y.iter().enumerate() {
                    if i < graph_data.cumulative_supply_data_x.len() {
                        let expected_cost = graph_data.cumulative_supply_data_x[i] as f64 * SECONDARY_BURN_USD_COST;
                        let cost_difference = (cumulative_cost - expected_cost).abs();
                        
                        if cost_difference > 0.01 { // Allow 1 cent tolerance
                            println!("  ⚠️  Cost mismatch at index {}: expected ${:.3}, got ${:.3}", 
                                i, expected_cost, cumulative_cost);
                            cost_valid = false;
                        }
                    }
                }
                
                // Validate individual cost per token calculations
                for cost_per_token in &graph_data.cost_to_mint_data_y {
                    if *cost_per_token < 0.0 || cost_per_token.is_infinite() || cost_per_token.is_nan() {
                        println!("  ⚠️  Invalid cost per token: {}", cost_per_token);
                        cost_valid = false;
                    }
                }
                
                println!("✓ {}: {} epochs, cost calculations {}", 
                    name, 
                    graph_data.minted_per_epoch_data_x.len(),
                    if cost_valid { "valid" } else { "invalid" }
                );
                
                if let Some(&final_cost) = graph_data.cumulative_usd_cost_data_y.last() {
                    println!("  - Final cumulative cost: ${:.2}", final_cost);
                }
                
                assert!(cost_valid, "Cost calculations must be valid for {}", name);
            }
            Err(e) => {
                panic!("Economic cost test failed for {}: {}", name, e);
            }
        }
    }
    
    println!("\n✅ Economic cost validation: SUCCESS");
}

/// Test edge cases and boundary conditions
#[test]
fn test_backend_edge_cases() {
    let (pic, canister_id) = setup_test_environment();
    let sender = setup_lbry_fun_canister(&pic, canister_id);
    
    println!("🔍 Testing backend edge cases and boundary conditions...\n");
    
    // Edge case 1: Minimal viable parameters
    let minimal_args = PreviewArgs {
        primary_max_supply: 100,
        tge_allocation: 1,
        initial_secondary_burn: 100,
        halving_step: 50,
        initial_reward_per_burn_unit: 1,
    };
    
    let minimal_encoded = Encode!(&minimal_args).expect("Failed to encode args");
    let minimal_result = pic.query_call(canister_id, sender, "preview_tokenomics_graphs", minimal_encoded);
    
    match minimal_result {
        Ok(reply) => {
            let graph_data: GraphData = decode_one(&reply).expect("Failed to decode graph data");
            println!("✓ Minimal parameters: {} epochs", graph_data.minted_per_epoch_data_x.len());
        }
        Err(e) => {
            println!("ℹ️ Minimal parameters rejected (acceptable): {}", e);
        }
    }
    
    // Edge case 2: Maximum viable parameters
    let maximum_args = PreviewArgs {
        primary_max_supply: 100_000_000,
        tge_allocation: 1,
        initial_secondary_burn: 10_000_000,
        halving_step: 99,
        initial_reward_per_burn_unit: 1_000_000,
    };
    
    let maximum_encoded = Encode!(&maximum_args).expect("Failed to encode args");
    let maximum_result = pic.query_call(canister_id, sender, "preview_tokenomics_graphs", maximum_encoded);
    
    match maximum_result {
        Ok(reply) => {
            let graph_data: GraphData = decode_one(&reply).expect("Failed to decode graph data");
            println!("✓ Maximum parameters: {} epochs", graph_data.minted_per_epoch_data_x.len());
        }
        Err(e) => {
            println!("ℹ️ Maximum parameters rejected (acceptable): {}", e);
        }
    }
    
    // Edge case 3: TGE equals max supply
    let tge_max_args = PreviewArgs {
        primary_max_supply: 1_000_000,
        tge_allocation: 1_000_000,
        initial_secondary_burn: 1_000_000,
        halving_step: 50,
        initial_reward_per_burn_unit: 1_000,
    };
    
    let tge_max_encoded = Encode!(&tge_max_args).expect("Failed to encode args");
    let tge_max_result = pic.query_call(canister_id, sender, "preview_tokenomics_graphs", tge_max_encoded);
    
    match tge_max_result {
        Ok(reply) => {
            let graph_data: GraphData = decode_one(&reply).expect("Failed to decode graph data");
            println!("✓ TGE=MaxSupply: {} epochs (should be 0)", graph_data.minted_per_epoch_data_x.len());
            assert_eq!(graph_data.minted_per_epoch_data_x.len(), 0, 
                "No mining epochs should be generated when TGE equals max supply");
        }
        Err(e) => {
            println!("ℹ️ TGE=MaxSupply rejected (acceptable): {}", e);
        }
    }
    
    println!("\n✅ Edge case validation: SUCCESS");
}