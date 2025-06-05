use candid::Principal;
use ic_cdk;
use ic_ledger_types::Subaccount;
mod script;
pub use script::*;
mod storage;
pub use storage::*;
mod queries;
pub use queries::*;
mod update;
pub use update::*;
mod guard;
pub use guard::*;
mod utils;
use ic_cdk::api::call::CallResult;
pub use utils::*;
mod error;
pub use error::*;

ic_cdk::export_candid!();

#[derive(CandidType, Deserialize, Clone)]
pub struct Configs {
    pub primary_token_id: Principal,
    pub secondary_token_id: Principal,
    pub swap_canister_id: Principal,
    pub frontend_canister_id: Principal,
    pub max_primary_supply: u64,
    pub initial_primary_mint: u64,
    pub initial_secondary_burn: u64,
    pub max_primary_phase: u64,
    pub halving_step: u64,
}

impl Default for Configs {
    fn default() -> Self {
        Self {
            primary_token_id: Principal::anonymous(),
            secondary_token_id: Principal::anonymous(),
            swap_canister_id: Principal::anonymous(),
            frontend_canister_id: Principal::anonymous(),
            max_primary_supply: 0,
            initial_primary_mint: 0,
            initial_secondary_burn: 0,
            max_primary_phase: 0,
            halving_step: 50, // Default to halving
        }
    }
}

pub type MyStableBTreeMap = StableBTreeMap<u64, TokenomicsData, Memory>;
