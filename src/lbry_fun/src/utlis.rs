use candid::{CandidType, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};
pub const KONG_BACKEND_CANISTER: &str = "2ipq2-uqaaa-aaaar-qailq-cai";
pub const ICP_CANISTER_ID: &str = "nppha-riaaa-aaaal-ajf2q-cai";
pub const INTITAL_PRIMARY_MINT: u64 = 200_000_000;
pub const ICP_TRANSFER_FEE: u64 = 10_000;

pub const E8S:u64=100_000_000;
pub const CHAIN_ID: &str = "IC";

pub fn get_principal(id: &str) -> Principal {
    Principal::from_text(id).expect(&format!("Invalid principal: {}", id))
}

#[derive(CandidType, Deserialize, Debug)]
pub struct AddTokenArgs {
    pub token: String,
}
#[derive(CandidType, Deserialize, Debug)]
pub enum AddTokenResponse {
    Ok(TokenDetail),
    Err(String),
}

#[derive(CandidType, Deserialize, Debug)]
pub enum TokenDetail {
    IC(TokenInfo),
}

#[derive(CandidType, Deserialize, Debug)]
pub enum AddTokenResult {
    Ok(AddTokenReply),
    Err(String),
}

#[derive(CandidType, Deserialize, Debug)]
pub enum AddTokenReply {
    IC(ICTokenReply),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct ICTokenReply {
    pub token_id: u32,
    pub chain: String,
    pub canister_id: String,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub fee: Nat,
    pub icrc1: bool,
    pub icrc2: bool,
    pub icrc3: bool,
    pub is_removed: bool,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct TokenInfo {
    pub token_id: u32,
    pub chain: String,
    pub canister_id: String,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub fee: u64, // backed by candid::Nat
    pub icrc1: bool,
    pub icrc2: bool,
    pub icrc3: bool,
    pub is_removed: bool,
}

//Add Pool

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct AddPoolArgs {
    pub token_0: String,
    pub amount_0: Nat,
    pub token_1: String,
    pub amount_1: Nat,
    pub on_kong: bool,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct AddPoolReply {
    pub pool_id: u32,
    pub request_id: u64,
    pub status: String,
    pub name: String,
    pub symbol: String,
    pub chain_0: String,
    pub address_0: String,
    pub symbol_0: String,
    pub amount_0: u128,
    pub chain_1: String,
    pub address_1: String,
    pub symbol_1: String,
    pub amount_1: u128,
    pub lp_fee_bps: u8,
    pub lp_token_symbol: String,
    pub add_lp_token_amount: u128,
    pub transfer_ids: Vec<TransferIdReply>,
    pub claim_ids: Vec<u64>,
    pub is_removed: bool,
    pub ts: u64,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct TransferIdReply {}

#[derive(CandidType, Deserialize, Debug)]
pub enum AddPoolResult {
    Ok(AddPoolReply),
    Err(String),
}

// approve
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

// tokenomics
#[derive(CandidType, Serialize)]
pub struct TokenomicsInitArgs {
    pub primary_token_id: Option<Principal>,
    pub secondary_token_id: Option<Principal>,
    pub swap_canister_id: Option<Principal>,
    pub frontend_canister_id: Option<Principal>,
    pub max_primary_supply: u64,
    pub initial_primary_mint: u64,
    pub initial_secondary_burn: u64,
    pub max_primary_phase: u64,
}

#[derive(CandidType)]
pub struct IcpSwapInitArgs {
    pub primary_token_id: Option<Principal>,
    pub secondary_token_id: Option<Principal>,
    pub tokenomics_canister_id: Option<Principal>,
}




// other
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ArchiveOptions {
    pub num_blocks_to_archive: u64,
    pub max_transactions_per_response: Option<u64>,
    pub trigger_threshold: u64,
    pub max_message_size_bytes: Option<u64>,
    pub cycles_for_archive_creation: Option<u64>,
    pub node_max_memory_size_bytes: Option<u64>,
    pub controller_id: Principal,
    pub more_controller_ids: Option<Vec<Principal>>,
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct FeatureFlags {
   pub icrc2: bool,
}

#[derive(CandidType, Serialize, Deserialize)]
pub enum MetadataValue {
     Nat64(u64),
     Text(String),
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct InitArgs {
    pub minting_account: Account,
    pub fee_collector_account: Option<Account>,
    pub transfer_fee: Nat,
    pub decimals: Option<u8>,
    pub max_memo_length: Option<u16>,
    pub token_symbol: String,
    pub token_name: String,
    pub metadata: Vec<(String, MetadataValue)>,
    pub initial_balances: Vec<(Account, Nat)>,
    pub feature_flags: Option<FeatureFlags>,
    pub maximum_number_of_accounts: Option<u64>,
    pub accounts_overflow_trim_quantity: Option<u64>,
    pub archive_options: ArchiveOptions,
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct UpgradeArgs {
    pub metadata: Option<Vec<(String, MetadataValue)>>,
    pub token_symbol: Option<String>,
    pub token_name: Option<String>,
    pub transfer_fee: Option<Nat>,
    pub max_memo_length: Option<u16>,
    pub feature_flags: Option<FeatureFlags>,
    pub maximum_number_of_accounts: Option<u64>,
    pub accounts_overflow_trim_quantity: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize)]
pub enum LedgerArg {
    Init(InitArgs),
    Upgrade(Option<UpgradeArgs>),
}