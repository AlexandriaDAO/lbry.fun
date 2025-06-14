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

mod real_execution;
mod real_execution_v2;
mod token_testing;
mod individual_canister_tests;
mod integrated_token_tests;
mod phase1_environment_tests;
mod phase2_token_operations;

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