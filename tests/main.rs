// Simulation tests - economic model validation
mod simulation {
    pub mod common;
    pub mod icp_swap_tests;
    pub mod token_management_tests;
    pub mod canister_management_tests;
    pub mod backend_validation_tests;
    pub mod comprehensive_backend_validation;
    pub mod phase4_tokenomics_lifecycle_tests;
    pub mod phase5_stress_testing;
}

// Test categories organized by folder structure
#[path = "tests/unit/individual_canister_tests.rs"]
mod individual_canister_tests;

#[path = "tests/unit/test_principals.rs"]
mod test_principals;

#[path = "tests/unit/test_tokenomics_validation.rs"]
mod test_tokenomics_validation;

// #[path = "tests/unit/test_tokenomics_realworld_validation_v2.rs"]
// mod test_tokenomics_realworld_validation_v2;

#[path = "tests/unit/test_tokenomics_edge_cases.rs"]
mod test_tokenomics_edge_cases;

#[path = "tests/unit/test_tokenomics_adversarial.rs"]
mod test_tokenomics_adversarial;

#[path = "tests/unit/test_burn_unit_exploit.rs"]
mod test_burn_unit_exploit;

#[path = "tests/unit/test_tokenomics_configurations.rs"]
mod test_tokenomics_configurations;

#[path = "tests/unit/test_burn_unit_one_exact.rs"]
mod test_burn_unit_one_exact;

#[path = "tests/unit/test_burn_cost_analysis.rs"]
mod test_burn_cost_analysis;

#[path = "tests/unit/test_graph_vs_reality.rs"]
mod test_graph_vs_reality;

#[path = "tests/unit/test_graph_data_interpretation.rs"]
mod test_graph_data_interpretation;

#[path = "tests/unit/test_simulation_calculation.rs"]
mod test_simulation_calculation;

#[path = "tests/unit/test_simple_fix_verification.rs"]
mod test_simple_fix_verification;

#[path = "tests/unit/test_backend_fix_validation.rs"]
mod test_backend_fix_validation;

#[path = "tests/unit/test_backend_table_data.rs"]
mod test_backend_table_data;

#[path = "tests/unit/test_backend_raw_data.rs"]
mod test_backend_raw_data;

#[path = "tests/unit/test_actual_backend_response.rs"]
mod test_actual_backend_response;

#[path = "tests/unit/test_debug_calculation.rs"]
mod test_debug_calculation;

#[path = "tests/unit/test_original_formula_analysis.rs"]
mod test_original_formula_analysis;

#[path = "tests/unit/test_verify_correct_fix.rs"]
mod test_verify_correct_fix;

#[path = "tests/unit/test_exact_backend_output.rs"]
mod test_exact_backend_output;

#[path = "tests/unit/test_trace_calculation.rs"]
mod test_trace_calculation;

#[path = "tests/unit/test_unit_analysis.rs"]
mod test_unit_analysis;

#[path = "tests/unit/test_fixed_simulation.rs"]
mod test_fixed_simulation;

#[path = "tests/unit/test_final_verification.rs"]
mod test_final_verification;

#[path = "tests/unit/test_tokenomics_bug_demonstration.rs"]
mod test_tokenomics_bug_demonstration;

#[path = "tests/unit/test_simulation_e8s_bug.rs"]
mod test_simulation_e8s_bug;

#[path = "tests/unit/test_tokenomics_schedule_generation.rs"]
mod test_tokenomics_schedule_generation;

// #[path = "tests/unit/test_simulation_fix_validation.rs"]
// mod test_simulation_fix_validation;

#[path = "tests/unit/test_tokenomics_bug_simple_demo.rs"]
mod test_tokenomics_bug_simple_demo;

#[path = "tests/integration/integrated_token_tests.rs"]
mod integrated_token_tests;

#[path = "tests/integration/phase1_environment_tests.rs"]
mod phase1_environment_tests;

#[path = "tests/integration/phase2_token_operations.rs"]
mod phase2_token_operations;

#[path = "tests/integration/test_kong_pool_creation.rs"]
mod test_kong_pool_creation;

#[path = "tests/integration/phase3_distribution.rs"]
mod phase3_distribution;

#[path = "tests/integration/phase3_simple_distribution.rs"]
mod phase3_simple_distribution;

#[path = "tests/integration/phase3_timer_distribution.rs"]
mod phase3_timer_distribution;

#[path = "tests/integration/phase3_comprehensive_distribution.rs"]
mod phase3_comprehensive_distribution;

#[path = "tests/integration/phase3_test_staking_only.rs"]
mod phase3_test_staking_only;

#[path = "tests/integration/phase3_debug_stake.rs"]
mod phase3_debug_stake;

#[path = "tests/integration/real_execution.rs"]
mod real_execution;

#[path = "tests/integration/real_execution_v2.rs"]
mod real_execution_v2;

#[path = "tests/helpers/shared_helpers.rs"]
mod shared_helpers;

#[path = "tests/helpers/token_testing/mod.rs"]
mod token_testing;

#[path = "tests/helpers/mock_root_icp_swap.rs"]
mod mock_root_icp_swap;

// Operational validation tests - large-scale real operations
mod operational_validation;

fn main() {
    println!("\n=== Running Token Environment Tests ===");
    
    // Create and test the integrated token environment
    let env = integrated_token_tests::TokenTestEnvironment::new();
    
    println!("\nEnvironment created successfully!");
    println!("Primary token: {}", env.primary_token);
    println!("Secondary token: {}", env.secondary_token);
    println!("Tokenomics: {}", env.tokenomics);
    println!("ICP Swap: {}", env.icp_swap);
    println!("Logs: {}", env.logs);
    println!("ICP Ledger: {}", env.icp_ledger);
    
    println!("\n=== Tests Complete ===");
}