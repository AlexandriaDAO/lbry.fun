use candid::{CandidType, Nat, Principal};
use ic_cdk::api::management_canister::main::{
    CanisterSettings, InstallCodeArgument,
};
use serde::{Deserialize, Serialize};

// Precise type definitions matching the Candid interface
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct Account {
    owner: Principal,
    #[serde(skip_serializing_if = "Option::is_none")]
    subaccount: Option<[u8; 32]>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
enum MetadataValue {
    #[serde(rename = "Text")]
    Text(String),
    #[serde(rename = "Nat")]
    Nat(Nat),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct FeatureFlags {
    icrc2: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct ArchiveOptions {
    num_blocks_to_archive: Nat,
    max_transactions_per_response: Option<Nat>,
    trigger_threshold: Nat,
    max_message_size_bytes: Option<Nat>,
    cycles_for_archive_creation: Option<Nat>,
    node_max_memory_size_bytes: Option<Nat>,
    controller_id: Principal,
    #[serde(skip_serializing_if = "Option::is_none")]
    more_controller_ids: Option<Vec<Principal>>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
struct InitArgs {
    minting_account: Account,
    #[serde(skip_serializing_if = "Option::is_none")]
    fee_collector_account: Option<Account>,
    transfer_fee: Nat,
    #[serde(skip_serializing_if = "Option::is_none")]
    decimals: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_memo_length: Option<u16>,
    token_symbol: String,
    token_name: String,
    metadata: Vec<(String, MetadataValue)>,
    initial_balances: Vec<(Account, Nat)>,
    #[serde(skip_serializing_if = "Option::is_none")]
    feature_flags: Option<FeatureFlags>,
    #[serde(skip_serializing_if = "Option::is_none")]
    maximum_number_of_accounts: Option<Nat>,
    #[serde(skip_serializing_if = "Option::is_none")]
    accounts_overflow_trim_quantity: Option<Nat>,
    archive_options: ArchiveOptions,
}

#[ic_cdk::update]
async fn create_token(
    token_symbol: String,
    token_name: String,
    minting_account_owner: Principal,
    archive_controller: Principal,
) -> Result<String, String> {
    let caller = ic_cdk::caller();
    
    // Step 1: Create a new canister
    let create_result: (CreateCanisterResult,) = ic_cdk::api::call::call_with_payment(
        Principal::management_canister(),
        "create_canister",
        (CreateCanisterArgument {
            settings: Some(CanisterSettings {
                controllers: Some(vec![ic_cdk::api::id(), caller]),
                compute_allocation: None,
                memory_allocation: None,
                freezing_threshold: None,
                reserved_cycles_limit: None,
            }),
        },),
        7_692_307_492, // Required cycles for canister creation
    )
    .await
    .map_err(|e| format!("Failed to create canister: {}", e.1))?;

    let canister_id = create_result.0.canister_id;
    ic_cdk::println!("Created new canister with ID: {}", canister_id);

    // Prepare initialization arguments
    let init_args = InitArgs {
        minting_account: Account {
            owner: minting_account_owner,
            subaccount: None,
        },
        fee_collector_account: None,
        transfer_fee: Nat::from(10_000 as u64),
        decimals: Some(8),
        max_memo_length: Some(32),
        token_symbol: token_symbol.clone(),
        token_name: token_name.clone(),
        metadata: vec![
            ("icrc1:symbol".to_string(), MetadataValue::Text(token_symbol)),
            ("icrc1:name".to_string(), MetadataValue::Text(token_name)),
            ("icrc1:decimals".to_string(), MetadataValue::Nat(Nat::from(8 as u64))),
            ("icrc1:fee".to_string(), MetadataValue::Nat(Nat::from(10_000 as u64))),
        ],
        initial_balances: vec![],
        feature_flags: Some(FeatureFlags {
            icrc2: true,
        }),
        maximum_number_of_accounts: Some(Nat::from(10_000_000 as u64)),
        accounts_overflow_trim_quantity: Some(Nat::from(100_000 as u64)),
        archive_options: ArchiveOptions {
            num_blocks_to_archive: Nat::from(3000 as u64),
            max_transactions_per_response: None,
            trigger_threshold: Nat::from(6000 as u64),
            max_message_size_bytes: None,
            cycles_for_archive_creation: Some(Nat::from(10_000_000_000_000 as u64)),
            node_max_memory_size_bytes: None,
            controller_id: archive_controller,
            more_controller_ids: None,
        },
    };

    let encoded_args = candid::encode_one(init_args)
        .map_err(|e| format!("Encoding error: {:?}", e))?;

    let wasm_module = include_bytes!("ic-icrc1-ledger.wasm");

    match ic_cdk::api::call::call_with_payment::<(InstallCodeArgument,), ()>(
        Principal::management_canister(),
        "install_code",
        (InstallCodeArgument {
            mode: ic_cdk::api::management_canister::main::CanisterInstallMode::Install,
            canister_id,
            wasm_module: wasm_module.to_vec(),
            arg: encoded_args,
        },),
        0,
    )
    .await
    {
        Ok(_) => Ok(format!("🎉 Token Deployed! Canister ID: {}", canister_id)),
        Err(e) => Err(format!("Error during code installation: {:?}", e)),
    }
}

#[derive(CandidType, Serialize)]
struct CreateCanisterArgument {
    settings: Option<CanisterSettings>,
}

#[derive(CandidType, Deserialize)]
struct CreateCanisterResult {
    canister_id: Principal,
}

ic_cdk::export_candid!();