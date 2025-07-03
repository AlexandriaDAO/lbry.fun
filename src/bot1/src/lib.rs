use ic_cdk_macros::*;

mod types;
mod storage;
mod utils;
mod execute;
mod queries;
mod validation;
mod errors;

use types::{ValidationTable, PoolLogs};
use validation::PoolValidation;

// Initialize the canister
#[init]
fn init() {
    ic_cdk::println!("Bot1 canister initialized");
}

// Post-upgrade hook
#[post_upgrade]
fn post_upgrade() {
    ic_cdk::println!("Bot1 canister upgraded");
}

// Execute loops update call (icp_amount in natural units: 1 = 1 ICP)
#[update]
async fn execute_loops(pool_id: u64, icp_amount: u64, number_of_loops: u32) -> Result<String, String> {
    ic_cdk::println!("Executing {} loops for pool {} with {} ICP per loop", number_of_loops, pool_id, icp_amount);
    // Convert natural units to E8S
    let icp_amount_e8s = icp_amount * 100_000_000;
    execute::execute_loops_impl(pool_id, icp_amount_e8s, number_of_loops).await
}

// Get validation table query call
#[query]
fn get_table(pool_id: u64) -> Result<ValidationTable, String> {
    queries::get_table_impl(pool_id)
}

// Validate pool before execution
#[update]
async fn validate_pool(pool_id: u64) -> Result<PoolValidation, String> {
    validation::validate_pool_ready(pool_id, 100_000_000).await // Default 1 ICP per loop (in E8S)
}

// Additional query methods for debugging
#[query]
fn get_pool_summary(pool_id: u64) -> Result<String, String> {
    queries::get_pool_summary(pool_id)
}

// Clear pool data (useful for testing)
#[update]
fn clear_pool_data(pool_id: u64) -> Result<String, String> {
    queries::clear_pool_data_impl(pool_id)
}

// Get canister principal
#[query]
fn get_bot_principal() -> String {
    ic_cdk::id().to_string()
}

// Get logs from both tokenomics and icp_swap canisters for a pool
#[update]
async fn get_pool_logs(pool_id: u64, page: Option<u64>, page_size: Option<u64>) -> Result<PoolLogs, String> {
    queries::get_pool_logs_impl(pool_id, page, page_size).await
}

// Export candid interface
ic_cdk::export_candid!();