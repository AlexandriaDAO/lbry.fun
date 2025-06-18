// Large-scale operational validation module
// Tests that TokenomicsGraphsBackend.tsx predictions match actual canister state
// after thousands of real swap/burn operations

pub mod large_scale_env;
pub mod validation_scenarios; 
pub mod cumulative_tests;
pub mod precision_analysis;
pub mod edge_case_ops;

// Re-export commonly used types
pub use large_scale_env::*;
pub use validation_scenarios::*;