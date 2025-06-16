use candid::{CandidType, Deserialize, Principal, Nat};
use pocket_ic::PocketIc;

/// Mock root icp_swap canister that accepts ICP transfers
/// This simulates the parent project's icp_swap canister (54fqz-5iaaa-aaaap-qkmqa-cai)
pub fn deploy_mock_root_icp_swap(pic: &PocketIc) -> Principal {
    // Use a simple ICRC1 ledger as mock since it can receive ICP transfers
    let icrc1_wasm = include_bytes!("../../../src/lbry_fun/src/ic-icrc1-ledger.wasm");
    
    // Deploy with the expected canister ID
    let canister_id = Principal::from_text("54fqz-5iaaa-aaaap-qkmqa-cai")
        .expect("Valid principal");
    
    // Try to create with specific ID, if fails use any ID
    let actual_id = match pic.create_canister_with_id(None, None, canister_id) {
        Ok(id) => id,
        Err(_) => {
            println!("Warning: Could not create canister with specific ID, using auto-generated ID");
            pic.create_canister()
        }
    };
    
    // Initialize as a basic ICRC1 token that can receive transfers
    let init_args = InitArgs {
        token_symbol: "MOCK".to_string(),
        token_name: "Mock Root ICP Swap".to_string(),
        minting_account: Account {
            owner: actual_id,
            subaccount: None,
        },
        transfer_fee: 10_000_u64.into(),
        metadata: vec![],
        initial_balances: vec![],
        archive_options: ArchiveOptions {
            num_blocks_to_archive: 1000_u64,
            trigger_threshold: 2000_u64,
            controller_id: actual_id,
            more_controller_ids: None,
            cycles_for_archive_creation: None,
            max_transactions_per_response: None,
        },
        feature_flags: Some(FeatureFlags { icrc2: true }),
    };
    
    // Add cycles to the canister before installing
    pic.add_cycles(actual_id, 10_000_000_000_000); // 10 trillion cycles
    
    pic.install_canister(
        actual_id,
        icrc1_wasm.to_vec(),
        candid::encode_one(LedgerArg::Init(init_args)).expect("Failed to encode init args"),
        None,
    );
    
    println!("Deployed mock root icp_swap at: {}", actual_id);
    actual_id
}

// Types needed for ICRC1 initialization
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Account {
    pub owner: Principal,
    pub subaccount: Option<[u8; 32]>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ArchiveOptions {
    pub num_blocks_to_archive: u64,
    pub trigger_threshold: u64,
    pub controller_id: Principal,
    pub more_controller_ids: Option<Vec<Principal>>,
    pub cycles_for_archive_creation: Option<u64>,
    pub max_transactions_per_response: Option<u64>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct InitArgs {
    pub token_symbol: String,
    pub token_name: String,
    pub minting_account: Account,
    pub transfer_fee: Nat,
    pub metadata: Vec<(String, MetadataValue)>,
    pub initial_balances: Vec<(Account, Nat)>,
    pub archive_options: ArchiveOptions,
    pub feature_flags: Option<FeatureFlags>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum LedgerArg {
    Init(InitArgs),
    Upgrade(Option<UpgradeArgs>),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct UpgradeArgs {
    pub metadata: Option<Vec<(String, MetadataValue)>>,
    pub token_symbol: Option<String>,
    pub token_name: Option<String>,
    pub transfer_fee: Option<Nat>,
    pub change_fee_collector: Option<ChangeFeeCollector>,
    pub max_memo_length: Option<u16>,
    pub feature_flags: Option<FeatureFlags>,
    pub maximum_number_of_accounts: Option<u64>,
    pub accounts_overflow_trim_quantity: Option<u64>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum MetadataValue {
    Nat(Nat),
    Int(i128),
    Text(String),
    Blob(Vec<u8>),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct FeatureFlags {
    pub icrc2: bool,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum ChangeFeeCollector {
    Unset,
    SetTo(Account),
}