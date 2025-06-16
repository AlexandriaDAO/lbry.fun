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

#[path = "tests/integration/integrated_token_tests.rs"]
mod integrated_token_tests;

#[path = "tests/integration/phase1_environment_tests.rs"]
mod phase1_environment_tests;

#[path = "tests/integration/phase2_token_operations.rs"]
mod phase2_token_operations;

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