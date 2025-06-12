use candid::{decode_one, CandidType, Encode, Principal};
use pocket_ic::PocketIc;
use serde::Deserialize;
use std::collections::HashMap;
use std::env;
use std::path::PathBuf;

const ICP_SWAP_WASM: &[u8] =
    include_bytes!("../../target/wasm32-unknown-unknown/release/icp_swap.wasm");

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

#[test]
fn test_get_config() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let bin_path = manifest_dir.parent().unwrap().join("bin").join("pocket-ic");
    env::set_var("POCKET_IC_BIN", bin_path);

    let pic = PocketIc::new();
    let canister_id = pic.create_canister();
    pic.add_cycles(canister_id, 2_000_000_000_000);

    let sender = Principal::anonymous();

    let primary_token_id = Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap();
    let secondary_token_id = Principal::from_text("mxzaz-hqaaa-aaaar-qaada-cai").unwrap();
    let tokenomics_canister_id = Principal::from_text("ss2fx-dyaaa-aaaar-qacoq-cai").unwrap();

    let init_args = InitArgs {
        primary_token_id: Some(primary_token_id),
        secondary_token_id: Some(secondary_token_id),
        tokenomics_canister_id: Some(tokenomics_canister_id),
        ..Default::default()
    };

    let install_payload = Encode!(&Some(init_args)).expect("Failed to encode init args");

    pic.install_canister(
        canister_id,
        ICP_SWAP_WASM.to_vec(),
        install_payload,
        Some(sender),
    );

    let args = Encode!().expect("Failed to encode arguments");
    let result = pic.query_call(canister_id, sender, "get_config", args);

    match result {
        Ok(reply) => {
            let config = decode_one(&reply).expect("Failed to decode response");
            let _config: Configs = config; // type assertion
            println!(
                "Successfully called get_config and decoded the response: {:?}",
                _config
            );
            // We can also assert default values if we know them
            assert_eq!(_config.primary_token_id, primary_token_id);
            assert_eq!(_config.secondary_token_id, secondary_token_id);
            assert_eq!(_config.tokenomics_cansiter_id, tokenomics_canister_id);
        }
        Err(user_error) => {
            panic!("Error calling canister: {}", user_error)
        }
    }
}

const LBRY_FUN_WASM: &[u8] =
    include_bytes!("../../target/wasm32-unknown-unknown/release/lbry_fun.wasm");

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq)]
pub struct TokenRecord {
    id: u64,
    is_live: bool,
    secondary_token_symbol: String,
    liquidity_provided_at: u64,
    secondary_token_id: Principal,
    primary_token_name: String,
    tokenomics_canister_id: Principal,
    secondary_token_name: String,
    primary_token_symbol: String,
    icp_swap_canister_id: Principal,
    primary_max_phase_mint: u64,
    halving_step: u64,
    primary_max_supply: u64,
    initial_primary_mint: u64,
    primary_token_id: Principal,
    caller: Principal,
    created_time: u64,
    initial_secondary_burn: u64,
    logs_canister_id: Principal,
}

#[test]
fn test_get_all_token_record() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let bin_path = manifest_dir.parent().unwrap().join("bin").join("pocket-ic");
    env::set_var("POCKET_IC_BIN", bin_path);

    let pic = PocketIc::new();
    let canister_id = pic.create_canister();
    pic.add_cycles(canister_id, 2_000_000_000_000);

    let sender = Principal::anonymous();

    let install_payload = Encode!(&()).expect("Failed to encode init args");

    pic.install_canister(
        canister_id,
        LBRY_FUN_WASM.to_vec(),
        install_payload,
        Some(sender),
    );

    let args = Encode!().expect("Failed to encode arguments");
    let result = pic.query_call(canister_id, sender, "get_all_token_record", args);

    match result {
        Ok(reply) => {
            let records: Vec<(u64, TokenRecord)> =
                decode_one(&reply).expect("Failed to decode response");
            assert!(records.is_empty());
            println!(
                "Successfully called get_all_token_record and got an empty vec as expected."
            );
        }
        Err(user_error) => {
            panic!("Error calling canister: {}", user_error)
        }
    }
}
