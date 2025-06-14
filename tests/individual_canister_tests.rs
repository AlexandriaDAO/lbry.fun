use candid::{decode_one, Encode, Principal, Nat, CandidType, Deserialize};
use pocket_ic::PocketIc;

// Include WASM files
const TOKENOMICS_WASM: &[u8] = include_bytes!("../target/wasm32-unknown-unknown/release/tokenomics.wasm");
const ICP_SWAP_WASM: &[u8] = include_bytes!("../target/wasm32-unknown-unknown/release/icp_swap.wasm");
const LOGS_WASM: &[u8] = include_bytes!("../target/wasm32-unknown-unknown/release/logs.wasm");
const ICRC1_LEDGER_WASM: &[u8] = include_bytes!("../src/lbry_fun/src/ic-icrc1-ledger.wasm");

// Test constants
const E8S: u64 = 100_000_000;

#[derive(CandidType, Deserialize)]
pub struct TokenomicsInitArgs {
    pub primary_token_id: Option<Principal>,
    pub secondary_token_id: Option<Principal>,
    pub swap_canister_id: Option<Principal>,
    pub frontend_canister_id: Option<Principal>,
    pub max_primary_supply: u64,
    pub initial_primary_mint: u64,
    pub initial_secondary_burn: u64,
    pub max_primary_phase: u64,
    pub halving_step: u64,
    pub initial_reward_per_burn_unit: u64,
}

#[derive(CandidType, Deserialize)]
pub struct IcpSwapInitArgs {
    pub primary_token_id: Option<Principal>,
    pub secondary_token_id: Option<Principal>,
    pub tokenomics_canister_id: Option<Principal>,
}

#[derive(CandidType, Deserialize)]
pub struct LogsInitArgs {
    pub primary_token_id: Principal,
    pub secondary_token_id: Principal,
    pub icp_swap_id: Principal,
    pub tokenomics_id: Principal,
}

#[derive(CandidType, Deserialize)]
pub struct MetadataValue {
    #[serde(rename = "Int")]
    pub int: Option<i128>,
    #[serde(rename = "Nat")]
    pub nat: Option<Nat>,
    #[serde(rename = "Blob")]
    pub blob: Option<Vec<u8>>,
    #[serde(rename = "Text")]
    pub text: Option<String>,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct Account {
    pub owner: Principal,
    pub subaccount: Option<[u8; 32]>,
}

#[derive(CandidType, Deserialize)]
pub struct FeatureFlags {
    pub icrc2: bool,
}

#[derive(CandidType, Deserialize)]
pub struct ArchiveOptions {
    pub num_blocks_to_archive: u64,
    pub max_transactions_per_response: Option<u64>,
    pub trigger_threshold: u64,
    pub max_message_size_bytes: Option<u64>,
    pub cycles_for_archive_creation: Option<u64>,
    pub node_max_memory_size_bytes: Option<u64>,
    pub controller_id: Principal,
}

#[derive(CandidType, Deserialize)]
pub struct InitArgs {
    pub decimals: Option<u8>,
    pub token_symbol: String,
    pub token_name: String,
    pub minting_account: Account,
    pub initial_balances: Vec<(Account, Nat)>,
    pub metadata: Vec<(String, MetadataValue)>,
    pub maximum_number_of_accounts: Option<u64>,
    pub accounts_overflow_trim_quantity: Option<u64>,
    pub fee_collector_account: Option<Account>,
    pub transfer_fee: Nat,
    pub feature_flags: Option<FeatureFlags>,
    pub max_memo_length: Option<u16>,
    pub archive_options: ArchiveOptions,
}

#[derive(CandidType, Deserialize)]
pub enum LedgerArg {
    Init(InitArgs),
}

/// Test tokenomics canister deployment and initialization
#[test]
pub fn test_tokenomics_canister_deployment() {
    let pic = PocketIc::new();
    
    // Create mock token canisters
    let primary_token_id = pic.create_canister();
    let secondary_token_id = pic.create_canister();
    let swap_canister_id = pic.create_canister();
    let frontend_canister_id = pic.create_canister();
    
    // Create and deploy tokenomics canister
    let tokenomics_id = pic.create_canister();
    pic.add_cycles(tokenomics_id, 2_000_000_000_000);
    
    let init_args = Encode!(&Some(TokenomicsInitArgs {
        primary_token_id: Some(primary_token_id),
        secondary_token_id: Some(secondary_token_id),
        swap_canister_id: Some(swap_canister_id),
        frontend_canister_id: Some(frontend_canister_id),
        max_primary_supply: 1_000_000,
        initial_primary_mint: 10_000,
        initial_secondary_burn: 5_000,
        max_primary_phase: 100_000,
        halving_step: 50,
        initial_reward_per_burn_unit: 100,
    })).expect("Failed to encode tokenomics init args");
    
    pic.install_canister(
        tokenomics_id,
        TOKENOMICS_WASM.to_vec(),
        init_args,
        Some(Principal::anonymous()),
    );
    
    println!("✓ Tokenomics canister deployed at: {}", tokenomics_id);
    
    // Query tokenomics state
    let query_args = Encode!().expect("Failed to encode empty args");
    let result = pic.query_call(tokenomics_id, Principal::anonymous(), "get_current_primary_rate", query_args);
    
    match result {
        Ok(reply) => {
            let rate: u64 = decode_one(&reply).expect("Failed to decode primary rate");
            assert_eq!(rate, 100, "Initial reward per burn unit should be 100");
            println!("✓ Successfully queried tokenomics - current primary rate: {}", rate);
        }
        Err(e) => {
            panic!("Failed to query tokenomics: {}", e);
        }
    }
}

/// Test ICP swap canister deployment
#[test]
pub fn test_icp_swap_canister_deployment() {
    let pic = PocketIc::new();
    
    // Create mock token canisters
    let primary_token_id = pic.create_canister();
    let secondary_token_id = pic.create_canister();
    let tokenomics_id = pic.create_canister();
    
    // Create and deploy ICP swap canister
    let icp_swap_id = pic.create_canister();
    pic.add_cycles(icp_swap_id, 2_000_000_000_000);
    
    let init_args = Encode!(&IcpSwapInitArgs {
        primary_token_id: Some(primary_token_id),
        secondary_token_id: Some(secondary_token_id),
        tokenomics_canister_id: Some(tokenomics_id),
    }).expect("Failed to encode ICP swap init args");
    
    pic.install_canister(
        icp_swap_id,
        ICP_SWAP_WASM.to_vec(),
        init_args,
        Some(Principal::anonymous()),
    );
    
    println!("✓ ICP Swap canister deployed at: {}", icp_swap_id);
}

/// Test logs canister deployment
#[test]
pub fn test_logs_canister_deployment() {
    let pic = PocketIc::new();
    
    // Create mock canisters
    let primary_token_id = pic.create_canister();
    let secondary_token_id = pic.create_canister();
    let swap_canister_id = pic.create_canister();
    let tokenomics_id = pic.create_canister();
    
    // Create and deploy logs canister
    let logs_id = pic.create_canister();
    pic.add_cycles(logs_id, 2_000_000_000_000);
    
    let init_args = Encode!(&LogsInitArgs {
        primary_token_id,
        secondary_token_id,
        icp_swap_id: swap_canister_id,
        tokenomics_id,
    }).expect("Failed to encode logs init args");
    
    pic.install_canister(
        logs_id,
        LOGS_WASM.to_vec(),
        init_args,
        Some(Principal::anonymous()),
    );
    
    println!("✓ Logs canister deployed at: {}", logs_id);
}

/// Test ICRC1 token deployment
#[test]
pub fn test_icrc1_token_deployment() {
    let pic = PocketIc::new();
    
    // Create token canister
    let token_id = pic.create_canister();
    pic.add_cycles(token_id, 2_000_000_000_000);
    
    let minting_account = Account {
        owner: Principal::anonymous(),
        subaccount: None,
    };
    
    let init_args = Encode!(&LedgerArg::Init(InitArgs {
        decimals: Some(8),
        token_symbol: "TEST".to_string(),
        token_name: "Test Token".to_string(),
        minting_account: minting_account.clone(),
        initial_balances: vec![(minting_account.clone(), Nat::from(1_000_000 * E8S))],
        metadata: vec![],
        maximum_number_of_accounts: None,
        accounts_overflow_trim_quantity: None,
        fee_collector_account: None,
        transfer_fee: Nat::from(10_000u64),
        feature_flags: Some(FeatureFlags { icrc2: true }),
        max_memo_length: None,
        archive_options: ArchiveOptions {
            num_blocks_to_archive: 10_000,
            max_transactions_per_response: None,
            trigger_threshold: 10_000,
            max_message_size_bytes: None,
            cycles_for_archive_creation: None,
            node_max_memory_size_bytes: None,
            controller_id: Principal::anonymous(),
        },
    })).expect("Failed to encode ICRC1 init args");
    
    pic.install_canister(
        token_id,
        ICRC1_LEDGER_WASM.to_vec(),
        init_args,
        Some(Principal::anonymous()),
    );
    
    println!("✓ ICRC1 token deployed at: {}", token_id);
    
    // Query token metadata
    let query_args = Encode!().expect("Failed to encode empty args");
    let result = pic.query_call(token_id, Principal::anonymous(), "icrc1_symbol", query_args);
    
    match result {
        Ok(reply) => {
            let symbol: String = decode_one(&reply).expect("Failed to decode symbol");
            assert_eq!(symbol, "TEST");
            println!("✓ Token symbol verified: {}", symbol);
        }
        Err(e) => {
            panic!("Failed to query token symbol: {}", e);
        }
    }
}