use std::{fmt::format, mem::swap};

use candid::{CandidType, Encode, Nat, Principal};
use ic_cdk::{
    api::management_canister::main::{
        create_canister, install_code, CanisterInstallMode, CreateCanisterArgument,
        InstallCodeArgument,
    },
    caller, update,
};
use serde::{Deserialize, Serialize};

use crate::{
    get_principal, AddTokenArgs, AddTokenReply, AddTokenResponse, AddTokenResult, TokenDetail,
    TokenInfo, TokenRecord, ICP_CANISTER_ID, INTITAL_PRIMARY_MINT, KONG_BACKEND_CANISTER, TOKENS,
};

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
    primary_token_description: String,
    secondary_token_symbol: String,
    secondary_token_name: String,
    secondary_token_description: String,
    primary_max_supply: u64,
    initial_primary_mint: u64,
    initial_secondary_burn: u64,
    primary_max_phase_mint: u64,
) -> Result<String, String> {
    let user_principal = ic_cdk::api::caller(); // Get the calling user's principal
                                                // icp_swap canister
    let swap_canister_id = create_a_canister().await?;
    let tokenomics_canister_id = create_a_canister().await?;
    let frontend_canister_id = create_a_canister().await?;

    // Create primary token
    // ALEX

    // max supply from user
    //
    let primary_token_id = match create_icrc1_canister(
        primary_token_symbol.clone(),
        primary_token_name.clone(),
        primary_token_description,
        tokenomics_canister_id,
        tokenomics_canister_id,
        INTITAL_PRIMARY_MINT,
    )
    .await
    {
        Ok(canister_id) => {
            ic_cdk::println!("Primary Token ID: {}", canister_id);
            canister_id.to_string()
        }
        Err(e) => return Err(e.to_string()),
    };

    // Create secondary token
    let secondary_token_id = match create_icrc1_canister(
        secondary_token_symbol.clone(),
        secondary_token_name.clone(),
        secondary_token_description,
        swap_canister_id,
        swap_canister_id,
        0,
    )
    .await
    {
        Ok(canister_id) => {
            ic_cdk::println!("Secondary Token ID: {}", canister_id);
            canister_id.to_string()
        }
        Err(e) => return Err(e.to_string()),
    };
    ic_cdk::println!("I am heree !");
    install_tokenomics_wasm_on_existing_canister(
        tokenomics_canister_id,
        Some(get_principal(&primary_token_id)),
        Some(get_principal(&secondary_token_id)),
        Some(swap_canister_id),
        Some(frontend_canister_id),
        primary_max_supply.into(),
        initial_primary_mint,
        initial_secondary_burn,
        primary_max_phase_mint,
    )
    .await?;
    install_icp_swap_wasm_on_existing_canister(
        swap_canister_id,
        Some(get_principal(&primary_token_id)),
        Some(get_principal(&secondary_token_id)),
        Some(tokenomics_canister_id),
    )
    .await?;

    match add_token_to_swap(get_principal(&primary_token_id)).await {
        AddTokenResponse::Ok(_) => (),
        AddTokenResponse::Err(e) => return Err(format!("Failed to add token to swap: {}", e)),
    };

    approve_tokens_to_spender(
        get_principal(&primary_token_id),
        get_principal(KONG_BACKEND_CANISTER),
        INTITAL_PRIMARY_MINT.into(),
    )
    .await?;

    approve_tokens_to_spender(
        get_principal(ICP_CANISTER_ID),
        get_principal(KONG_BACKEND_CANISTER),
        INTITAL_PRIMARY_MINT.into(),
    )
    .await?;
    ic_cdk::println!("Tokens approved!");

    create_pool_on_kong_swap(get_principal(&primary_token_id))
        .await
        .map_err(|e| format!("Failed to create pool on Kong swap: {}", e))?;
    ic_cdk::println!("Pool created!");

    TOKENS.with(|tokens| {
        let mut tokens = tokens.borrow_mut();
        let token_id = tokens.len() as u64 + 1; // Generate a new token ID
        let token_record = TokenRecord {
            id: token_id,
            primary_token_id: get_principal(&primary_token_id),
            primary_token_name: primary_token_name.clone(),
            primary_token_symbol: primary_token_symbol.clone(),
            primary_token_max_supply: primary_max_supply,
            secondary_token_id: get_principal(&secondary_token_id),
            secondary_token_name: secondary_token_name.clone(),
            secondary_token_symbol: secondary_token_symbol.clone(),
            icp_swap_canister_id: swap_canister_id,
            tokenomics_canister_id,

            initial_primary_mint,
            initial_secondary_burn,
            primary_max_phase_mint,
            caller: user_principal,
        };
        tokens.insert(token_id, token_record);
    });

    Ok("Tokens created and stored!".to_string())
}

async fn create_icrc1_canister(
    token_symbol: String,
    token_name: String,
    token_description: String,
    minting_account_owner: Principal,
    archive_controller: Principal,
    intital_amount: u64,
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

    let canister_account = Account {
        owner: ic_cdk::api::id(),
        subaccount: None,
    };

    let init_args = InitArgs {
        minting_account: minter_account.clone(),
        fee_collector_account: None,
        transfer_fee: Nat::from(10_000 as u32),
        decimals: Some(8),
        max_memo_length: Some(32),
        initial_balances: vec![(canister_account, Nat::from(intital_amount))],
        maximum_number_of_accounts: Some(1_000_000),
        accounts_overflow_trim_quantity: Some(10_000),
        token_symbol: token_symbol.clone(),
        token_name: token_name.clone(),
        metadata: vec![(
            "description".to_string(),
            MetadataValue::Text(token_description),
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

async fn create_a_canister() -> Result<Principal, String> {
    let create_args = CreateCanisterArgument { settings: None };
    let canister_id_record = create_canister(create_args, 2_000_000_000)
        .await
        .map_err(|e| format!("Failed to create canister: {:?}", e))?;

    let canister_id = canister_id_record.0.canister_id;
    Ok(canister_id)
}

#[derive(CandidType, Serialize)]
struct TokenomicsInitArgs {
    primary_token_id: Option<Principal>,
    secondary_token_id: Option<Principal>,
    swap_canister_id: Option<Principal>,
    frontend_canister_id: Option<Principal>,
    max_primary_supply: u64,
    initial_primary_mint: u64,
    initial_secondary_burn: u64,
    max_primary_phase: u64,
}

#[derive(CandidType)]
struct IcpSwapInitArgs {
    primary_token_id: Option<Principal>,
    secondary_token_id: Option<Principal>,
    tokenomics_canister_id: Option<Principal>,
}

#[update]
async fn install_tokenomics_wasm_on_existing_canister(
    canister_id: Principal,
    primary_token_id: Option<Principal>,
    secondary_token_id: Option<Principal>,
    swap_canister_id: Option<Principal>,
    frontend_canister_id: Option<Principal>,
    max_primary_supply: u64,
    initial_primary_mint: u64,
    initial_secondary_burn: u64,
    max_primary_phase: u64,
) -> Result<(), String> {
    let args = TokenomicsInitArgs {
        primary_token_id,
        secondary_token_id,
        swap_canister_id,
        frontend_canister_id,
        max_primary_supply,
        initial_primary_mint,
        initial_secondary_burn,
        max_primary_phase,
    };
    let encoded_args = Encode!(&Some(args))
        .map_err(|e: candid::Error| format!("Failed to encode args: {:?}", e))?;

    let wasm_module = include_bytes!("tokenomics.wasm").to_vec(); // Path must be valid in your project

    let install_args = InstallCodeArgument {
        mode: CanisterInstallMode::Install,
        canister_id,
        wasm_module,
        arg: encoded_args,
    };

    install_code(install_args)
        .await
        .map_err(|e| format!("Wasm install failed: {:?}", e))?;

    Ok(())
}

#[update]
async fn install_icp_swap_wasm_on_existing_canister(
    canister_id: Principal,
    primary_token_id: Option<Principal>,
    secondary_token_id: Option<Principal>,
    tokenomics_canister_id: Option<Principal>,
) -> Result<(), String> {
    let args = IcpSwapInitArgs {
        primary_token_id,
        secondary_token_id,
        tokenomics_canister_id,
    };

    let encoded_args =
        Encode!(&Some(args)).map_err(|e| format!("Failed to encode args: {:?}", e))?;

    let wasm_module = include_bytes!("icp_swap.wasm").to_vec(); // Path must be valid in your project

    let install_args = InstallCodeArgument {
        mode: CanisterInstallMode::Install,
        canister_id,
        wasm_module,
        arg: encoded_args,
    };

    install_code(install_args)
        .await
        .map_err(|e| format!("Wasm install failed: {:?}", e))?;

    Ok(())
}

async fn add_token_to_swap(token_id: Principal) -> AddTokenResponse {
    let args = AddTokenArgs {
        token: format!("IC.{}", token_id),
    };

    let result: Result<(AddTokenResult,), _> =
        ic_cdk::call(get_principal(KONG_BACKEND_CANISTER), "add_token", (args,)).await;

    match result {
        Ok((AddTokenResult::Ok(AddTokenReply::IC(token_info)),)) => {
            ic_cdk::println!("Token added: {:?}", token_info);
            AddTokenResponse::Ok(TokenDetail::IC(TokenInfo {
                token_id: token_info.token_id,
                chain: token_info.chain,
                canister_id: token_info.canister_id,
                name: token_info.name,
                symbol: token_info.symbol,
                decimals: token_info.decimals,
                fee: 0, // safely handle Nat
                icrc1: token_info.icrc1,
                icrc2: token_info.icrc2,
                icrc3: token_info.icrc3,
                is_removed: token_info.is_removed,
            }))
        }
        Ok((AddTokenResult::Err(err_msg),)) => {
            AddTokenResponse::Err(format!("Add token failed: {}", err_msg))
        }
        Err(e) => {
            ic_cdk::println!("Error calling backend: {:?}", e);
            AddTokenResponse::Err("Call failed".to_string())
        }
    }
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct AddPoolArgs {
    token_0: String,
    amount_0: Nat,
    token_1: String,
    amount_1: Nat,
    on_kong: bool,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct AddPoolReply {
    tx_id: u64,
    pool_id: u32,
    request_id: u64,
    status: String,
    name: String,
    symbol: String,
    chain_0: String,
    address_0: String,
    symbol_0: String,
    amount_0: u128,
    chain_1: String,
    address_1: String,
    symbol_1: String,
    amount_1: u128,
    lp_fee_bps: u8,
    lp_token_symbol: String,
    add_lp_token_amount: u128,
    transfer_ids: Vec<TransferIdReply>,
    claim_ids: Vec<u64>,
    is_removed: bool,
    ts: u64,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct TransferIdReply {}

#[derive(CandidType, Deserialize, Debug)]
pub enum AddPoolResult {
    Ok(AddPoolReply),
    Err(String),
}

pub async fn create_pool_on_kong_swap(primary_token_id: Principal) -> Result<AddPoolReply, String> {
    let args = AddPoolArgs {
        token_0: format!("IC.{}", primary_token_id),
        amount_0: (100_000_000 as u64).into(),
        token_1: format!("IC.{}", ICP_CANISTER_ID), //ICP PAIR
        amount_1: (100_000_000 as u64).into(),
        on_kong: true,
    };

    let (result,): (AddPoolResult,) =
        ic_cdk::call(get_principal(KONG_BACKEND_CANISTER), "add_pool", (args,))
            .await
            .map_err(|e| format!("Call failed: {:?}", e))?;

    match result {
        AddPoolResult::Ok(reply) => Ok(reply),
        AddPoolResult::Err(e) => Err(format!("Pool creation failed: {}", e)),
    }
}

#[derive(CandidType, Deserialize, Debug)]
struct AllowanceArgs {
    owner: Principal,
    spender: Principal,
}

#[derive(CandidType, Deserialize, Debug)]
struct AllowanceResult {
    allowance: Nat,
    expires_at: Option<u64>,
}

pub async fn approve_tokens_to_spender(
    ledger_canister_id: Principal,
    spender: Principal,
    amount: Nat,
) -> Result<Nat, String> {
    let caller = ic_cdk::api::caller();

    let args = ApproveArgs {
        fee: None,
        memo: None,
        from_subaccount: None,
        amount,
        spender: Account {
            owner: spender,
            subaccount: None,
        },
    };

    let (result,): (ApproveResult,) = ic_cdk::call(ledger_canister_id, "icrc2_approve", (args,))
        .await
        .map_err(|e| format!("Call to icrc2_approve failed: {:?}", e))?;

    match result {
        ApproveResult::Ok(block_index) => Ok(block_index),
        ApproveResult::Err(e) => Err(format!("Approval failed: {:?}", e)),
    }
}
#[derive(CandidType, Deserialize, Debug)]
pub enum ApproveResult {
    Ok(Nat), // BlockIndex
    Err(ApproveError),
}
#[derive(CandidType, Deserialize, Debug)]
pub enum ApproveError {
    GenericError { message: String, error_code: u128 },
    TemporarilyUnavailable,
    Duplicate { duplicate_of: u128 },
    BadFee { expected_fee: u128 },
    AllowanceChanged { current_allowance: u128 },
    CreatedInFuture { ledger_time: u64 },
    TooOld,
    Expired { ledger_time: u64 },
    InsufficientFunds { balance: u128 },
}

#[derive(CandidType, Deserialize, Debug)]
pub struct ApproveArgs {
    pub fee: Option<Nat>,
    pub memo: Option<Vec<u8>>,
    pub from_subaccount: Option<Vec<u8>>,
    pub amount: Nat,
    pub spender: Account,
}
