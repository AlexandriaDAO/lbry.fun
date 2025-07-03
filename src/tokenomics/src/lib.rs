use candid::{CandidType, Principal};
use serde::Deserialize;
use ic_cdk;
use ic_ledger_types::Subaccount;
mod storage;
pub use storage::*;
mod queries;
pub use queries::*;
mod update;
pub use update::*;
mod guard;
pub use guard::*;
mod utils;
pub use utils::*;
mod error;
pub use error::*;

#[derive(CandidType, Deserialize)]
pub struct InitArgs {
    pub primary_token_ledger: Principal,
    pub secondary_token_ledger: Principal,
    pub icp_swap_canister_id: Principal,     // NEW: For authorization
    pub max_primary_supply: u64,             // NEW: Configurable max supply
    pub secondary_thresholds: Vec<u64>,      // NEW: Dynamic thresholds array
    pub primary_rewards: Vec<u64>,           // NEW: Dynamic rewards array
}

#[derive(CandidType, Deserialize)]
pub struct TokenomicsSchedule {
    pub thresholds: Vec<u64>,
    pub rewards: Vec<u64>,
}

#[ic_cdk::init]
fn init(args: InitArgs) {
    // Validate arrays are non-empty and same length
    if args.secondary_thresholds.is_empty() {
        ic_cdk::trap("Secondary thresholds array cannot be empty");
    }
    if args.primary_rewards.is_empty() {
        ic_cdk::trap("Primary rewards array cannot be empty");
    }
    if args.secondary_thresholds.len() != args.primary_rewards.len() {
        ic_cdk::trap("Secondary thresholds and primary rewards arrays must have the same length");
    }
    if args.max_primary_supply == 0 {
        ic_cdk::trap("Max primary supply must be greater than 0");
    }
    
    // Initialize configuration
    let config = Config {
        primary_token_ledger: args.primary_token_ledger,
        secondary_token_ledger: args.secondary_token_ledger,
        icp_swap_canister_id: args.icp_swap_canister_id,
        max_primary_supply: args.max_primary_supply,
    };
    
    let mut config_store = get_config_mem();
    config_store.insert((), config);
    
    // Set the global token canister IDs
    unsafe {
        PRIMARY_TOKEN_CANISTER_ID = Box::leak(args.primary_token_ledger.to_string().into_boxed_str());
        SECONDARY_TOKEN_CANISTER_ID = Box::leak(args.secondary_token_ledger.to_string().into_boxed_str());
    }
    
    // Store dynamic arrays for configurable tokenomics
    set_thresholds(args.secondary_thresholds);
    set_rewards(args.primary_rewards);
    
    // Initialize threshold index to 0
    let mut threshold_store = get_current_threshold_index_mem();
    threshold_store.insert((), 0);
    
    // Initialize total burned to 0
    let mut burned_store = get_total_secondary_burned_mem();
    burned_store.insert((), 0);
}

#[ic_cdk::post_upgrade]
fn post_upgrade() {
    // Restore token canister IDs from configuration
    if let Some(config) = get_config() {
        unsafe {
            PRIMARY_TOKEN_CANISTER_ID = Box::leak(config.primary_token_ledger.to_string().into_boxed_str());
            SECONDARY_TOKEN_CANISTER_ID = Box::leak(config.secondary_token_ledger.to_string().into_boxed_str());
        }
        
        // Verify dynamic arrays are properly initialized
        match get_thresholds() {
            Err(e) => ic_cdk::trap(&format!("Post-upgrade validation failed: {}", e)),
            Ok(thresholds) => {
                if thresholds.is_empty() {
                    ic_cdk::trap("Post-upgrade validation failed: Thresholds array is empty");
                }
            }
        }
        match get_rewards() {
            Err(e) => ic_cdk::trap(&format!("Post-upgrade validation failed: {}", e)),
            Ok(rewards) => {
                if rewards.is_empty() {
                    ic_cdk::trap("Post-upgrade validation failed: Rewards array is empty");
                }
            }
        }
    } else {
        ic_cdk::trap("Post-upgrade validation failed: Configuration not found");
    }
}

ic_cdk::export_candid!();