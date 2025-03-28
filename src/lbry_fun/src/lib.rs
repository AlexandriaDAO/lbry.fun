mod storage;
pub use storage::{*};

use candid::{CandidType, Encode, Nat, Principal};
use ic_cdk::{
    api::management_canister::main::{
        create_canister, install_code, CanisterInstallMode, CreateCanisterArgument,
        InstallCodeArgument,
    },
    caller,
};
use serde::{Deserialize, Serialize};


#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct Account {
    owner: Principal,
    #[serde(skip_serializing_if = "Option::is_none")]
    subaccount: Option<Vec<u8>>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct ArchiveOptions {
    num_blocks_to_archive: u64,
    max_transactions_per_response: Option<u64>,
    trigger_threshold: u64,
    max_message_size_bytes: Option<u64>,
    cycles_for_archive_creation: Option<u64>,
    node_max_memory_size_bytes: Option<u64>,
    controller_id: Principal,
    more_controller_ids: Option<Vec<Principal>>,
}

#[derive(CandidType, Serialize, Deserialize)]
struct FeatureFlags {
    icrc2: bool,
}

#[derive(CandidType, Serialize, Deserialize)]
enum MetadataValue {
    Nat64(u64),
    Text(String),
}

#[derive(CandidType, Serialize, Deserialize)]
struct InitArgs {
    minting_account: Account,
    fee_collector_account: Option<Account>,
    transfer_fee: Nat,
    decimals: Option<u8>,
    max_memo_length: Option<u16>,
    token_symbol: String,
    token_name: String,
    metadata: Vec<(String, MetadataValue)>,
    initial_balances: Vec<(Account, Nat)>,
    feature_flags: Option<FeatureFlags>,
    maximum_number_of_accounts: Option<u64>,
    accounts_overflow_trim_quantity: Option<u64>,
    archive_options: ArchiveOptions,
}

#[derive(CandidType, Serialize, Deserialize)]
struct UpgradeArgs {
    metadata: Option<Vec<(String, MetadataValue)>>,
    token_symbol: Option<String>,
    token_name: Option<String>,
    transfer_fee: Option<Nat>,
    max_memo_length: Option<u16>,
    feature_flags: Option<FeatureFlags>,
    maximum_number_of_accounts: Option<u64>,
    accounts_overflow_trim_quantity: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize)]
enum LedgerArg {
    Init(InitArgs),
    Upgrade(Option<UpgradeArgs>),
}

#[ic_cdk::update]
async fn create_token(
    primary_token_symbol: String,
    primary_token_name: String,
    secondary_token_symbol: String,
    secondary_token_name: String,
) -> Result<String, String> {
    let user_principal = ic_cdk::api::caller(); // Get the calling user's principal

    // Create primary token
    let primary_token_id = match create_icrc1_canister(
        primary_token_symbol,
        primary_token_name,
        user_principal,
        user_principal,
    )
    .await
    {
        Ok(canister_id) => {
            ic_cdk::println!("Primary Token ID: {}", canister_id);
            canister_id.to_string()
        },
        Err(e) => return Err(e.to_string()),
    };

    // Create secondary token
    let secondary_token_id = match create_icrc1_canister(
        secondary_token_symbol,
        secondary_token_name,
        user_principal,
        user_principal,
    )
    .await
    {
        Ok(canister_id) => {
            ic_cdk::println!("Secondary Token ID: {}", canister_id);
            canister_id.to_string()
        },
        Err(e) => return Err(e.to_string()),    
    };

    // Store 
    // TOKEN_STORAGE.with(|storage| {
    //     storage.borrow_mut().insert(user_principal, (primary_token_id.clone(), secondary_token_id.clone()));
    // });

    Ok("Tokens created and stored!".to_string())
}

async fn create_icrc1_canister(
    token_symbol: String,
    token_name: String,
    minting_account_owner: Principal,
    archive_controller: Principal,
) -> Result<String, String> {
    let create_args = CreateCanisterArgument { settings: None };
    let canister_id_record = create_canister(create_args, 2_000_000_000)
        .await
        .map_err(|e| format!("Failed to create canister: {:?}", e))?;

    let canister_id = canister_id_record.0.canister_id;

    let wasm_bytes = include_bytes!("ic-icrc1-ledger.wasm");

    let minter_account = Account {
        owner: minting_account_owner,
        subaccount: None,
    };

    let initial_owner_account = Account {
        owner: caller(),
        subaccount: None,
    };

    let init_args = InitArgs {
        minting_account: minter_account.clone(),
        fee_collector_account: None,
        transfer_fee: Nat::from(10_000 as u32),
        decimals: Some(8),
        max_memo_length: Some(32),
        initial_balances: vec![(initial_owner_account, Nat::from(1_000_000 as u64))],
        maximum_number_of_accounts: Some(1_000_000),
        accounts_overflow_trim_quantity: Some(10_000),
        token_symbol: token_symbol.clone(),
        token_name: token_name.clone(),
        metadata: vec![(
            "description".to_string(),
            MetadataValue::Text("ICRC-1 token".to_string()),
        )],
        feature_flags: Some(FeatureFlags { icrc2: true }),
        archive_options: ArchiveOptions {
            num_blocks_to_archive: 1000,
            max_transactions_per_response: None,
            trigger_threshold: 2000,
            max_message_size_bytes: None,
            cycles_for_archive_creation: None,
            node_max_memory_size_bytes: None,
            controller_id: archive_controller,
            more_controller_ids: None,
        },
    };

    // Encode as LedgerArg::Init
    let encoded_args = Encode!(&LedgerArg::Init(init_args))
        .map_err(|e| format!("Failed to encode init args: {:?}", e))?;

    let install_args = InstallCodeArgument {
        mode: CanisterInstallMode::Install,
        canister_id,
        wasm_module: wasm_bytes.to_vec(),
        arg: encoded_args,
    };

    install_code(install_args)
        .await
        .map_err(|e| format!("Failed to install ICRC-1 token: {:?}", e))?;

    Ok(canister_id.to_string())
}
