use candid::{CandidType, Nat, Principal};
use serde::Deserialize;
pub const KONG_BACKEND_CANISTER: &str = "2ipq2-uqaaa-aaaar-qailq-cai";
pub const ICP_CANISTER_ID: &str = "nppha-riaaa-aaaal-ajf2q-cai";
pub const INTITAL_PRIMARY_MINT: u64 = 200_000_000;

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

#[derive(CandidType, Deserialize, Debug)]
pub struct AddPoolArgs {
    pub token_0: String,
    pub token_1: String,
    pub amount_0: u64,
    pub amount_1: u64,
    pub tx_id_0: Option<u64>,
    pub tx_id_1: Option<u64>,
    pub lp_fee_bps: Option<u8>,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct TransferInfo {
    pub transfer_id: u64,
    pub transfer: Transfer,
}

#[derive(CandidType, Deserialize, Debug)]
enum Transfer {
    IC(TransferDetails),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct TransferDetails {
    pub is_send: bool,
    pub block_index: u64,
    pub chain: String,
    pub canister_id: String,
    pub amount: u64,
    pub symbol: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct AddPoolResult {
    pub ts: u64,
    pub request_id: u64,
    pub status: String,
    pub tx_id: u64,
    pub lp_token_symbol: String,
    pub add_lp_token_amount: u64,
    pub transfer_ids: Vec<TransferInfo>,
    pub name: String,
    pub amount_0: u64,
    pub amount_1: u64,
    pub claim_ids: Vec<u64>,
    pub address_0: String,
    pub address_1: String,
    pub symbol_0: String,
    pub symbol_1: String,
    pub pool_id: u32,
    pub chain_0: String,
    pub chain_1: String,
    pub is_removed: bool,
    pub symbol: String,
    pub lp_fee_bps: u8,
}

#[derive(CandidType, Deserialize, Debug)]
enum AddPoolResponse {
    Ok(AddPoolResult),
    Err(String),
}
