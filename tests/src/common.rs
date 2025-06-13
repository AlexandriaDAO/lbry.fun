use candid::{CandidType, Encode, Principal};
use pocket_ic::PocketIc;
use serde::Deserialize;
use std::collections::HashMap;
use std::env;
use std::path::PathBuf;

pub const ICP_SWAP_WASM: &[u8] =
    include_bytes!("../../target/wasm32-unknown-unknown/release/icp_swap.wasm");

pub const LBRY_FUN_WASM: &[u8] =
    include_bytes!("../../target/wasm32-unknown-unknown/release/lbry_fun.wasm");

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct Configs {
    pub primary_token_id: Principal,
    pub secondary_token_id: Principal,
    pub tokenomics_cansiter_id: Principal,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct Stake {
    pub amount: u64,
    pub time: u64,
    pub reward_icp: u64,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct SecondaryRatio {
    pub ratio: u64,
    pub time: u64,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct ArchiveBalance {
    pub icp: u64,
}

#[derive(CandidType, Deserialize, Clone, Default)]
pub struct DailyValues {
    pub values: HashMap<u32, u128>,
}

#[derive(CandidType, Deserialize, Clone, Default)]
pub struct InitArgs {
    pub stakes: Option<Vec<(Principal, Stake)>>,
    pub archived_transaction_log: Option<Vec<(Principal, ArchiveBalance)>>,
    pub total_unclaimed_icp_reward: Option<u64>,
    pub secondary_ratio: Option<SecondaryRatio>,
    pub total_archived_balance: Option<u64>,
    pub apy: Option<Vec<(u32, DailyValues)>>,
    pub distribution_intervals: Option<u32>,
    pub primary_token_id: Option<Principal>,
    pub secondary_token_id: Option<Principal>,
    pub tokenomics_canister_id: Option<Principal>,
}

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq)]
pub struct TokenRecord {
    pub id: u64,
    pub is_live: bool,
    pub secondary_token_symbol: String,
    pub liquidity_provided_at: u64,
    pub secondary_token_id: Principal,
    pub primary_token_name: String,
    pub tokenomics_canister_id: Principal,
    pub secondary_token_name: String,
    pub primary_token_symbol: String,
    pub icp_swap_canister_id: Principal,
    pub primary_max_phase_mint: u64,
    pub halving_step: u64,
    pub primary_max_supply: u64,
    pub initial_primary_mint: u64,
    pub primary_token_id: Principal,
    pub caller: Principal,
    pub created_time: u64,
    pub initial_secondary_burn: u64,
    pub logs_canister_id: Principal,
}

pub fn setup_test_environment() -> (PocketIc, candid::Principal) {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let bin_path = manifest_dir.parent().unwrap().join("bin").join("pocket-ic");
    env::set_var("POCKET_IC_BIN", bin_path);

    let pic = PocketIc::new();
    let canister_id = pic.create_canister();
    pic.add_cycles(canister_id, 2_000_000_000_000);

    (pic, canister_id)
}

pub fn setup_lbry_fun_canister(pic: &PocketIc, canister_id: Principal) -> Principal {
    let sender = Principal::anonymous();
    let install_payload = candid::Encode!(&()).expect("Failed to encode init args");

    pic.install_canister(
        canister_id,
        LBRY_FUN_WASM.to_vec(),
        install_payload,
        Some(sender),
    );

    sender
}