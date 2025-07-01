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
}

#[derive(CandidType, Deserialize)]
pub struct TokenomicsSchedule {
    pub thresholds: Vec<u64>,
    pub rewards: Vec<u64>,
}

#[ic_cdk::init]
fn init(args: InitArgs) {
    // Initialize configuration
    let config = Config {
        primary_token_ledger: args.primary_token_ledger,
        secondary_token_ledger: args.secondary_token_ledger,
    };
    
    let mut config_store = get_config_mem();
    config_store.insert((), config);
    
    // Set the global token canister IDs
    unsafe {
        PRIMARY_TOKEN_CANISTER_ID = Box::leak(args.primary_token_ledger.to_string().into_boxed_str());
        SECONDARY_TOKEN_CANISTER_ID = Box::leak(args.secondary_token_ledger.to_string().into_boxed_str());
    }
    
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
    }
}

ic_cdk::export_candid!();