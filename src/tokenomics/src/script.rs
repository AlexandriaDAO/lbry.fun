use candid::{CandidType, Principal};
use serde::Deserialize;


#[derive(CandidType, Deserialize, Clone, Default)]
pub struct InitArgs {

    pub primary_token_id: Option<Principal>,
    pub secondary_token_id: Option<Principal>,
    pub tokenomics_canister_id: Option<Principal>,
    pub max_primary_supply:u64,
    pub intial_primary_mint:u64,
    pub intial_secondary_burn:u64
}
