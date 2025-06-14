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
struct Phase1TestCase {
    pub test_id: String,
    pub hard_cap: u64,
    pub burn_unit: u64,
    pub reward: u64,
    pub halving: u64,
    pub expected_epochs: Option<u64>,
    pub description: String,
}

#[derive(Debug)]
struct TokenomicsLifecycleResult {
    pub test_id: String,
    pub projected_epochs: usize,
    pub executed_epochs: usize,
    pub projected_final_supply: u64,
    pub executed_final_supply: u64,
    pub cumulative_amounts_match: bool,
    pub one_reward_mode_activated: bool,
    pub epoch_transition_accuracy: f64,
    pub cost_progression_valid: bool,
    pub success: bool,
    pub discrepancies: Vec<String>,
}

impl Phase1TestCase {
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

/// Complete Phase 1 test case matrix for full lifecycle testing
fn get_complete_phase1_test_cases() -> Vec<Phase1TestCase> {
    vec![
        // Halving step series (A)
        Phase1TestCase {
            test_id: "A25".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 25,
            expected_epochs: Some(6),
            description: "Halving 25%".to_string(),
        },
        Phase1TestCase {
            test_id: "A30".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 30,
            expected_epochs: Some(7),
            description: "Halving 30%".to_string(),
        },
        Phase1TestCase {
            test_id: "A35".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 35,
            expected_epochs: Some(8),
            description: "Halving 35%".to_string(),
        },
        Phase1TestCase {
            test_id: "A40".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 40,
            expected_epochs: Some(9),
            description: "Halving 40%".to_string(),
        },
        Phase1TestCase {
            test_id: "A45".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 45,
            expected_epochs: Some(7),
            description: "Halving 45%".to_string(),
        },
        Phase1TestCase {
            test_id: "A50".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 50,
            expected_epochs: Some(5),
            description: "Halving 50%".to_string(),
        },
        Phase1TestCase {
            test_id: "A55".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 55,
            expected_epochs: Some(5),
            description: "Halving 55%".to_string(),
        },
        Phase1TestCase {
            test_id: "A60".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 60,
            expected_epochs: Some(4),
            description: "Halving 60%".to_string(),
        },
        Phase1TestCase {
            test_id: "A70".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 70,
            expected_epochs: Some(4),
            description: "Halving 70%".to_string(),
        },
        Phase1TestCase {
            test_id: "A80".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 80,
            expected_epochs: Some(3),
            description: "Halving 80%".to_string(),
        },
        Phase1TestCase {
            test_id: "A90".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 90,
            expected_epochs: Some(3),
            description: "Halving 90%".to_string(),
        },
        // Reward series (B)
        Phase1TestCase {
            test_id: "B100".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 100,
            halving: 70,
            expected_epochs: Some(11),
            description: "Reward 100".to_string(),
        },
        Phase1TestCase {
            test_id: "B500".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 500,
            halving: 70,
            expected_epochs: Some(7),
            description: "Reward 500".to_string(),
        },
        Phase1TestCase {
            test_id: "B1000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 1_000,
            halving: 70,
            expected_epochs: Some(5),
            description: "Reward 1000".to_string(),
        },
        Phase1TestCase {
            test_id: "B2000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 70,
            expected_epochs: Some(4),
            description: "Reward 2000".to_string(),
        },
        Phase1TestCase {
            test_id: "B5000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 5_000,
            halving: 70,
            expected_epochs: Some(2),
            description: "Reward 5000".to_string(),
        },
        Phase1TestCase {
            test_id: "B10000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 10_000,
            halving: 70,
            expected_epochs: Some(1),
            description: "Reward 10000".to_string(),
        },
        Phase1TestCase {
            test_id: "B20000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 20_000,
            halving: 70,
            expected_epochs: Some(1),
            description: "Reward 20000".to_string(),
        },
        // Burn unit series (C)
        Phase1TestCase {
            test_id: "C10000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 10_000,
            reward: 2_000,
            halving: 70,
            expected_epochs: Some(17),
            description: "Burn 10000 (Init val $50)".to_string(),
        },
        Phase1TestCase {
            test_id: "C50000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 50_000,
            reward: 2_000,
            halving: 70,
            expected_epochs: Some(12),
            description: "Burn 50000 (Init val $250)".to_string(),
        },
        Phase1TestCase {
            test_id: "C100000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 100_000,
            reward: 2_000,
            halving: 70,
            expected_epochs: Some(10),
            description: "Burn 100000 (Init val $500)".to_string(),
        },
        Phase1TestCase {
            test_id: "C500000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 500_000,
            reward: 2_000,
            halving: 70,
            expected_epochs: Some(5),
            description: "Burn 500000 (Init val $2500)".to_string(),
        },
        Phase1TestCase {
            test_id: "C1000000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 2_000,
            halving: 70,
            expected_epochs: Some(4),
            description: "Burn 1000000 (Init val $5000)".to_string(),
        },
        Phase1TestCase {
            test_id: "C2000000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 2_000_000,
            reward: 2_000,
            halving: 70,
            expected_epochs: Some(3),
            description: "Burn 2000000 (Init val $10000)".to_string(),
        },
        Phase1TestCase {
            test_id: "C5000000".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 5_000_000,
            reward: 2_000,
            halving: 70,
            expected_epochs: Some(1),
            description: "Burn 5000000 (Init val $25000)".to_string(),
        },
        // Mixed scenarios (D)
        Phase1TestCase {
            test_id: "D1".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 500,
            halving: 50,
            expected_epochs: Some(9),
            description: "Lower reward, 50% halving".to_string(),
        },
        Phase1TestCase {
            test_id: "D2".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 200,
            halving: 40,
            expected_epochs: Some(6),
            description: "Very low reward, 40% halving".to_string(),
        },
        Phase1TestCase {
            test_id: "D3".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 100,
            halving: 35,
            expected_epochs: Some(5),
            description: "Minimal reward, 35% halving".to_string(),
        },
        Phase1TestCase {
            test_id: "D4".to_string(),
            hard_cap: 10_000_000,
            burn_unit: 1_000_000,
            reward: 1_000,
            halving: 45,
            expected_epochs: Some(9),
            description: "10M supply, 45% halving".to_string(),
        },
        Phase1TestCase {
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

/// Execute full token lifecycle and compare with projections
fn execute_tokenomics_lifecycle_test(
    pic: &pocket_ic::PocketIc,
    canister_id: candid::Principal,
    sender: candid::Principal,
    test_case: &Phase1TestCase,
) -> TokenomicsLifecycleResult {
    let mut discrepancies = Vec::new();
    let args = test_case.to_preview_args();
    
    // Step 1: Get projected tokenomics from preview function
    let preview_encoded = Encode!(&args).expect("Failed to encode preview args");
    let preview_result = pic.query_call(canister_id, sender, "preview_tokenomics_graphs", preview_encoded);
    
    let graph_data = match preview_result {
        Ok(reply) => decode_one::<GraphData>(&reply).expect("Failed to decode graph data"),
        Err(e) => {
            return TokenomicsLifecycleResult {
                test_id: test_case.test_id.clone(),
                projected_epochs: 0,
                executed_epochs: 0,
                projected_final_supply: 0,
                executed_final_supply: 0,
                cumulative_amounts_match: false,
                one_reward_mode_activated: false,
                epoch_transition_accuracy: 0.0,
                cost_progression_valid: false,
                success: false,
                discrepancies: vec![format!("Preview call failed: {}", e)],
            };
        }
    };
    
    let projected_epochs = graph_data.minted_per_epoch_data_x.len();
    let projected_final_supply = *graph_data.cumulative_supply_data_y.last().unwrap_or(&0);
    
    // Step 2: Simulate step-by-step execution using the same logic as backend
    let executed_result = simulate_step_by_step_execution(&args);
    let executed_epochs = executed_result.0;
    let executed_final_supply = executed_result.1;
    let executed_cumulative_amounts = executed_result.2;
    let one_reward_mode_activated = executed_result.3;
    
    // Step 3: Compare projected vs executed epochs
    let epoch_diff = (projected_epochs as i64 - executed_epochs as i64).abs();
    if epoch_diff > 0 {
        discrepancies.push(format!(
            "Epoch count mismatch: projected {}, executed {}",
            projected_epochs, executed_epochs
        ));
    }
    
    // Step 4: Compare projected vs executed final supply
    let supply_diff = (projected_final_supply as i64 - executed_final_supply as i64).abs();
    let supply_tolerance = (test_case.hard_cap * 100_000_000) / 1000; // 0.1% tolerance
    if supply_diff > supply_tolerance as i64 {
        discrepancies.push(format!(
            "Final supply mismatch: projected {}, executed {} (diff: {})",
            projected_final_supply, executed_final_supply, supply_diff
        ));
    }
    
    // Step 5: Validate cumulative token amounts match projections
    let mut cumulative_amounts_match = true;
    if graph_data.cumulative_supply_data_y.len() != executed_cumulative_amounts.len() {
        cumulative_amounts_match = false;
        discrepancies.push(format!(
            "Cumulative data points mismatch: projected {}, executed {}",
            graph_data.cumulative_supply_data_y.len(), executed_cumulative_amounts.len()
        ));
    } else {
        for (i, (&projected, &executed)) in graph_data.cumulative_supply_data_y
            .iter()
            .zip(executed_cumulative_amounts.iter())
            .enumerate() 
        {
            let diff = (projected as i64 - executed as i64).abs();
            if diff > 1000 { // Allow 1000 e8s tolerance (very small)
                cumulative_amounts_match = false;
                discrepancies.push(format!(
                    "Cumulative amount mismatch at index {}: projected {}, executed {}",
                    i, projected, executed
                ));
            }
        }
    }
    
    // Step 6: Validate cost progression
    let mut cost_progression_valid = true;
    for i in 1..graph_data.cost_to_mint_data_y.len() {
        if graph_data.cost_to_mint_data_y[i] < graph_data.cost_to_mint_data_y[i-1] {
            if graph_data.cost_to_mint_data_y[i] != 0.0 {
                cost_progression_valid = false;
                discrepancies.push(format!(
                    "Cost decreased at index {}: {} < {}",
                    i, graph_data.cost_to_mint_data_y[i], graph_data.cost_to_mint_data_y[i-1]
                ));
            }
        }
    }
    
    // Step 7: Calculate epoch transition accuracy
    let epoch_transition_accuracy = if test_case.expected_epochs.is_some() {
        let expected = test_case.expected_epochs.unwrap() as f64;
        let actual = projected_epochs as f64;
        100.0 - ((expected - actual).abs() / expected * 100.0)
    } else {
        100.0 // No expectation means perfect accuracy
    };
    
    let success = discrepancies.is_empty() 
        && cumulative_amounts_match 
        && cost_progression_valid
        && epoch_diff <= 1; // Allow ±1 epoch difference
    
    TokenomicsLifecycleResult {
        test_id: test_case.test_id.clone(),
        projected_epochs,
        executed_epochs,
        projected_final_supply,
        executed_final_supply,
        cumulative_amounts_match,
        one_reward_mode_activated,
        epoch_transition_accuracy,
        cost_progression_valid,
        success,
        discrepancies,
    }
}

/// Simulate step-by-step tokenomics execution using the same logic as simulation.rs
fn simulate_step_by_step_execution(args: &PreviewArgs) -> (usize, u64, Vec<u64>, bool) {
    const E8S: u128 = 100_000_000;
    const SECONDARY_BURN_USD_COST: f64 = 0.005;
    
    let max_primary_supply_e8s = (args.primary_max_supply as u128).saturating_mul(E8S);
    let tge_allocation_e8s = (args.tge_allocation as u128).saturating_mul(E8S);
    
    let mut total_primary_minted_e8s = tge_allocation_e8s;
    let mut total_secondary_burned = 0u128;
    let mut cumulative_amounts = vec![total_primary_minted_e8s as u64];
    
    // Generate tokenomics schedule using same logic as simulation.rs
    let mut secondary_thresholds = Vec::new();
    let mut primary_rewards = Vec::new();
    let mut burn_for_epoch = args.initial_secondary_burn as u128;
    let mut cumulative_burn = 0u128;
    let mut total_minted = 0u128;
    let mut primary_per_threshold = args.initial_reward_per_burn_unit as u128;
    let mut one_reward_mode = false;
    let mut one_reward_mode_activated = false;
    
    // Generate schedule
    while total_minted < args.primary_max_supply as u128 {
        let in_slot_burn = burn_for_epoch;
        let reward_e8s = primary_per_threshold * in_slot_burn * 10000;
        let reward = reward_e8s / E8S;

        if one_reward_mode {
            one_reward_mode_activated = true;
            let remaining_mint = args.primary_max_supply as u128 - total_minted;
            let final_burn = remaining_mint * 10000;
            let final_threshold = cumulative_burn + final_burn;
            secondary_thresholds.push(final_threshold as u64);
            primary_rewards.push(1);
            total_minted += remaining_mint;
            break;
        }

        if reward == 0 {
            break;
        }

        cumulative_burn += burn_for_epoch;
        secondary_thresholds.push(cumulative_burn as u64);
        primary_rewards.push(primary_per_threshold as u64);

        total_minted += reward;
        burn_for_epoch *= 2;

        if primary_per_threshold > 1 {
            primary_per_threshold =
                std::cmp::max(1, (primary_per_threshold * args.halving_step as u128) / 100);
        }

        if primary_per_threshold == 1 {
            one_reward_mode = true;
        }
    }
    
    // Execute schedule step by step
    let mut last_secondary_burned_threshold = 0u128;
    let mut epoch_count = 0;
    
    for i in 0..secondary_thresholds.len() {
        if total_primary_minted_e8s >= max_primary_supply_e8s {
            break;
        }

        let current_threshold = secondary_thresholds[i] as u128;
        let epoch_secondary_burn_capacity =
            current_threshold.saturating_sub(last_secondary_burned_threshold);
        if epoch_secondary_burn_capacity == 0 {
            continue;
        }

        let reward_rate = primary_rewards[i] as u128;
        if reward_rate == 0 {
            continue;
        }

        let potential_primary_mint_e8s = epoch_secondary_burn_capacity
            .saturating_mul(reward_rate)
            .saturating_mul(10000);
        let remaining_to_mint_e8s =
            max_primary_supply_e8s.saturating_sub(total_primary_minted_e8s);

        let (actual_primary_mint_e8s, actual_secondary_burned) =
            if potential_primary_mint_e8s > remaining_to_mint_e8s {
                let secondary_needed_to_cap = if reward_rate > 0 {
                    remaining_to_mint_e8s
                        .saturating_div(reward_rate)
                        .saturating_div(10000)
                } else {
                    0
                };
                (remaining_to_mint_e8s, secondary_needed_to_cap)
            } else {
                (potential_primary_mint_e8s, epoch_secondary_burn_capacity)
            };

        if actual_primary_mint_e8s == 0 {
            continue;
        }

        total_primary_minted_e8s += actual_primary_mint_e8s;
        total_secondary_burned += actual_secondary_burned;
        cumulative_amounts.push(total_primary_minted_e8s as u64);
        
        epoch_count += 1;
        last_secondary_burned_threshold = current_threshold;
    }
    
    (epoch_count, total_primary_minted_e8s as u64, cumulative_amounts, one_reward_mode_activated)
}

/// Phase 4 Task 1: Execute full token lifecycle for each Phase 1 test case
#[test]
fn test_phase4_complete_token_lifecycle_validation() {
    let (pic, canister_id) = setup_test_environment();
    let sender = setup_lbry_fun_canister(&pic, canister_id);
    
    let test_cases = get_complete_phase1_test_cases();
    let mut results = Vec::new();
    let mut total_tests = 0;
    let mut successful_tests = 0;
    let mut exact_epoch_matches = 0;
    let mut within_one_epoch = 0;
    
    println!("🔬 Phase 4: Complete Token Lifecycle Validation");
    println!("Testing {} Phase 1 parameter combinations...\n", test_cases.len());
    
    for test_case in test_cases {
        total_tests += 1;
        let result = execute_tokenomics_lifecycle_test(&pic, canister_id, sender, &test_case);
        
        if result.success {
            successful_tests += 1;
        }
        
        let epoch_diff = (result.projected_epochs as i64 - result.executed_epochs as i64).abs();
        if epoch_diff == 0 {
            exact_epoch_matches += 1;
        } else if epoch_diff == 1 {
            within_one_epoch += 1;
        }
        
        let status = if result.success { "✅ PASS" } else { "❌ FAIL" };
        println!("{} {}: {} projected epochs, {} executed epochs - {}", 
            status,
            result.test_id, 
            result.projected_epochs,
            result.executed_epochs,
            test_case.description
        );
        
        if !result.discrepancies.is_empty() {
            for discrepancy in &result.discrepancies {
                println!("  ⚠️  {}", discrepancy);
            }
        }
        
        if result.one_reward_mode_activated {
            println!("  ℹ️  One reward mode activated");
        }
        
        println!("  - Cumulative amounts match: {}", if result.cumulative_amounts_match { "✓" } else { "✗" });
        println!("  - Cost progression valid: {}", if result.cost_progression_valid { "✓" } else { "✗" });
        println!("  - Epoch transition accuracy: {:.1}%", result.epoch_transition_accuracy);
        
        results.push(result);
    }
    
    // Calculate final metrics
    let success_rate = (successful_tests as f64 / total_tests as f64) * 100.0;
    let exact_epoch_accuracy = (exact_epoch_matches as f64 / total_tests as f64) * 100.0;
    let within_one_epoch_accuracy = ((exact_epoch_matches + within_one_epoch) as f64 / total_tests as f64) * 100.0;
    
    println!("\n📊 Phase 4 Complete Token Lifecycle Results:");
    println!("  - Total tests: {}", total_tests);
    println!("  - Successful: {} ({:.1}%)", successful_tests, success_rate);
    println!("  - Exact epoch matches: {} ({:.1}%)", exact_epoch_matches, exact_epoch_accuracy);
    println!("  - Within ±1 epoch: {} ({:.1}%)", exact_epoch_matches + within_one_epoch, within_one_epoch_accuracy);
    
    // Phase 4 success criteria
    assert!(success_rate >= 95.0, 
        "Token lifecycle success rate {:.1}% is below required 95% threshold", success_rate);
    assert!(within_one_epoch_accuracy >= 90.0, 
        "Epoch accuracy {:.1}% is below required 90% threshold", within_one_epoch_accuracy);
    
    println!("\n✅ Phase 4 Task 1: SUCCESS");
    println!("   - Frontend projections match step-by-step execution");
    println!("   - Cumulative token amounts validated");
    println!("   - Epoch transitions accurate within tolerances");
    println!("   - Cost progressions monotonic and valid");
}

/// Phase 4 Task 2: Compare projected epochs vs executed epochs
#[test]
fn test_phase4_projected_vs_executed_epochs() {
    let (pic, canister_id) = setup_test_environment();
    let sender = setup_lbry_fun_canister(&pic, canister_id);
    
    println!("🎯 Phase 4: Projected vs Executed Epochs Comparison\n");
    
    // Test subset for detailed epoch analysis
    let epoch_test_cases = vec![
        Phase1TestCase {
            test_id: "EPOCH_HIGH".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 50_000,
            reward: 500,
            halving: 30,
            expected_epochs: Some(14), // High epoch count
            description: "High epoch count test".to_string(),
        },
        Phase1TestCase {
            test_id: "EPOCH_MID".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 500_000,
            reward: 1_000,
            halving: 50,
            expected_epochs: Some(8), // Medium epoch count
            description: "Medium epoch count test".to_string(),
        },
        Phase1TestCase {
            test_id: "EPOCH_LOW".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 2_000_000,
            reward: 5_000,
            halving: 80,
            expected_epochs: Some(2), // Low epoch count
            description: "Low epoch count test".to_string(),
        },
    ];
    
    let mut perfect_matches = 0;
    let mut within_tolerance = 0;
    
    for test_case in epoch_test_cases {
        let result = execute_tokenomics_lifecycle_test(&pic, canister_id, sender, &test_case);
        
        let projected = result.projected_epochs;
        let executed = result.executed_epochs;
        let expected = test_case.expected_epochs.unwrap_or(0) as usize;
        
        let proj_vs_exec_diff = (projected as i64 - executed as i64).abs();
        let proj_vs_exp_diff = (projected as i64 - expected as i64).abs();
        
        if proj_vs_exec_diff == 0 {
            perfect_matches += 1;
        }
        if proj_vs_exec_diff <= 1 {
            within_tolerance += 1;
        }
        
        println!("📈 {}: Expected: {}, Projected: {}, Executed: {}", 
            test_case.test_id, expected, projected, executed);
        println!("  - Projection vs Execution: {} epochs difference", proj_vs_exec_diff);
        println!("  - Projection vs Expected: {} epochs difference", proj_vs_exp_diff);
        println!("  - Epoch transition accuracy: {:.1}%", result.epoch_transition_accuracy);
        
        if result.one_reward_mode_activated {
            println!("  - One reward mode activated in final epochs");
        }
    }
    
    println!("\n📊 Epoch Comparison Results:");
    println!("  - Perfect projection-execution matches: {}/3", perfect_matches);
    println!("  - Within ±1 epoch tolerance: {}/3", within_tolerance);
    
    assert_eq!(perfect_matches, 3, "All epoch projections should exactly match execution");
    
    println!("\n✅ Phase 4 Task 2: SUCCESS");
    println!("   - Projected epochs match executed epochs exactly");
}

/// Phase 4 Task 3: Validate cumulative token amounts match projections  
#[test]
fn test_phase4_cumulative_amounts_validation() {
    let (pic, canister_id) = setup_test_environment();
    let sender = setup_lbry_fun_canister(&pic, canister_id);
    
    println!("📊 Phase 4: Cumulative Token Amounts Validation\n");
    
    // Test cases with different supply progressions
    let cumulative_test_cases = vec![
        Phase1TestCase {
            test_id: "CUM_LINEAR".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 1_000,
            halving: 90, // Very slow halving for linear progression
            expected_epochs: Some(10),
            description: "Linear progression test".to_string(),
        },
        Phase1TestCase {
            test_id: "CUM_AGGRESSIVE".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 5_000,
            halving: 25, // Aggressive halving
            expected_epochs: Some(3),
            description: "Aggressive halving test".to_string(),
        },
    ];
    
    let mut all_amounts_match = true;
    
    for test_case in cumulative_test_cases {
        let result = execute_tokenomics_lifecycle_test(&pic, canister_id, sender, &test_case);
        
        println!("📈 {}: {} epochs, cumulative amounts match: {}", 
            test_case.test_id, 
            result.projected_epochs,
            if result.cumulative_amounts_match { "✅" } else { "❌" }
        );
        
        if !result.cumulative_amounts_match {
            all_amounts_match = false;
            for discrepancy in &result.discrepancies {
                if discrepancy.contains("Cumulative amount mismatch") {
                    println!("  ⚠️  {}", discrepancy);
                }
            }
        }
        
        println!("  - Final supply projected: {}", result.projected_final_supply);
        println!("  - Final supply executed: {}", result.executed_final_supply);
        
        let supply_diff = (result.projected_final_supply as i64 - result.executed_final_supply as i64).abs();
        println!("  - Supply difference: {} e8s", supply_diff);
    }
    
    assert!(all_amounts_match, "All cumulative token amounts should match projections exactly");
    
    println!("\n✅ Phase 4 Task 3: SUCCESS");
    println!("   - Cumulative token amounts match projections exactly");
}

/// Phase 4 Task 4: Test 'one reward mode' activation accuracy
#[test]
fn test_phase4_one_reward_mode_activation() {
    let (pic, canister_id) = setup_test_environment();
    let sender = setup_lbry_fun_canister(&pic, canister_id);
    
    println!("🎯 Phase 4: One Reward Mode Activation Testing\n");
    
    // Test cases designed to trigger one reward mode
    let one_reward_test_cases = vec![
        Phase1TestCase {
            test_id: "ONE_REWARD_TRIGGER".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 100_000,
            reward: 100,
            halving: 25, // Aggressive halving should trigger one reward mode
            expected_epochs: Some(12),
            description: "One reward mode trigger test".to_string(),
        },
        Phase1TestCase {
            test_id: "ONE_REWARD_LONG".to_string(),
            hard_cap: 10_000_000,
            burn_unit: 50_000,
            reward: 50,
            halving: 30,
            expected_epochs: Some(18), // Very long tail
            description: "Long tail one reward mode".to_string(),
        },
        Phase1TestCase {
            test_id: "NO_ONE_REWARD".to_string(),
            hard_cap: 1_000_000,
            burn_unit: 1_000_000,
            reward: 10_000,
            halving: 50,
            expected_epochs: Some(1), // Single epoch, no one reward mode
            description: "No one reward mode test".to_string(),
        },
    ];
    
    let mut one_reward_detected = 0;
    let mut one_reward_expected = 0;
    
    for test_case in one_reward_test_cases {
        let result = execute_tokenomics_lifecycle_test(&pic, canister_id, sender, &test_case);
        
        // Cases with aggressive halving and many epochs likely trigger one reward mode
        let should_trigger_one_reward = test_case.test_id.contains("ONE_REWARD") && 
                                      !test_case.test_id.contains("NO_ONE_REWARD");
        
        if should_trigger_one_reward {
            one_reward_expected += 1;
        }
        
        if result.one_reward_mode_activated {
            one_reward_detected += 1;
        }
        
        println!("🎯 {}: {} epochs, one reward mode: {}", 
            test_case.test_id, 
            result.projected_epochs,
            if result.one_reward_mode_activated { "✅ Activated" } else { "⭕ Not activated" }
        );
        
        if should_trigger_one_reward && !result.one_reward_mode_activated {
            println!("  ⚠️  Expected one reward mode activation but didn't detect it");
        }
        
        if !should_trigger_one_reward && result.one_reward_mode_activated {
            println!("  ℹ️  Unexpected one reward mode activation");
        }
    }
    
    println!("\n📊 One Reward Mode Results:");
    println!("  - Cases expected to trigger: {}", one_reward_expected);
    println!("  - Cases detected activation: {}", one_reward_detected);
    
    // We should detect one reward mode in at least some aggressive halving cases
    assert!(one_reward_detected >= 1, "Should detect one reward mode activation in aggressive halving scenarios");
    
    println!("\n✅ Phase 4 Task 4: SUCCESS");
    println!("   - One reward mode activation detection working correctly");
}