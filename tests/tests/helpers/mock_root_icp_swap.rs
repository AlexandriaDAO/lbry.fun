use candid::{CandidType, Deserialize, Principal, Nat, Encode};
use pocket_ic::PocketIc;
use crate::shared_helpers::E8S;
use crate::individual_canister_tests::{LedgerArg, InitArgs, FeatureFlags, ArchiveOptions, MetadataValue, Account};

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
        decimals: Some(8),
        token_symbol: "MOCK".to_string(),
        token_name: "Mock Root ICP Swap".to_string(),
        minting_account: Account {
            owner: actual_id,
            subaccount: None,
        },
        initial_balances: vec![],
        metadata: vec![],
        maximum_number_of_accounts: Some(1_000_000),
        accounts_overflow_trim_quantity: Some(10_000),
        fee_collector_account: None,
        transfer_fee: 10_000_u64.into(),
        feature_flags: Some(FeatureFlags { icrc2: true }),
        max_memo_length: Some(32),
        archive_options: ArchiveOptions {
            num_blocks_to_archive: 1000_u64,
            max_transactions_per_response: None,
            trigger_threshold: 2000_u64,
            max_message_size_bytes: None,
            cycles_for_archive_creation: None,
            node_max_memory_size_bytes: None,
            controller_id: actual_id,
        },
    };
    
    // Add cycles to the canister before installing
    pic.add_cycles(actual_id, 10_000_000_000_000); // 10 trillion cycles
    
    pic.install_canister(
        actual_id,
        icrc1_wasm.to_vec(),
        Encode!(&LedgerArg::Init(init_args)).expect("Failed to encode init args"),
        None,
    );
    
    println!("Deployed mock root icp_swap at: {}", actual_id);
    actual_id
}