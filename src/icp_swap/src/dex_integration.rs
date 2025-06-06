use candid::{CandidType, Nat, Principal};
use serde::{Deserialize, Serialize};
use crate::constants::{KONG_BACKEND_CANISTER_ID, ICP_LEDGER_CANISTER_ID};
use crate::utils::{get_primary_canister_id, icrc2_approve};
use crate::storage::STATE;

// CandidType structs for KongSwap calls

#[derive(CandidType, Debug, Deserialize, Serialize)]
pub struct SwapAmountsTxReply {
    pub pool_symbol: String,
    pub pay_chain: String,
    pub pay_symbol: String,
    pub pay_address: String,
    pub pay_amount: Nat,
    pub receive_chain: String,
    pub receive_symbol: String,
    pub receive_address: String,
    pub receive_amount: Nat,
    pub price: f64,
    pub lp_fee: Nat,
    pub gas_fee: Nat,
}

#[derive(CandidType, Debug, Deserialize, Serialize)]
pub struct SwapAmountsReply {
    pub pay_chain: String,
    pub pay_symbol: String,
    pub pay_address: String,
    pub pay_amount: Nat,
    pub receive_chain: String,
    pub receive_symbol: String,
    pub receive_address: String,
    pub receive_amount: Nat,
    pub mid_price: f64,
    pub price: f64,
    pub slippage: f64,
    pub txs: Vec<SwapAmountsTxReply>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AddLiquidityAmountsReply {
    pub symbol: String,
    pub chain_0: String,
    pub symbol_0: String,
    pub address_0: String,
    pub amount_0: Nat,
    pub fee_0: Nat,
    pub chain_1: String,
    pub symbol_1: String,
    pub address_1: String,
    pub amount_1: Nat,
    pub fee_1: Nat,
    pub add_lp_token_amount: Nat,
}

#[derive(CandidType, Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TxId {
    BlockIndex(Nat),
    TransactionHash(String),
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct AddLiquidityArgs {
    pub token_0: String,
    pub amount_0: Nat,
    pub tx_id_0: Option<TxId>,
    pub token_1: String,
    pub amount_1: Nat,
    pub tx_id_1: Option<TxId>,
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct TransferIdReply {
    pub transfer_id: u64,
    pub transfer: TransferReply,
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub enum TransferReply {
    IC(ICTransferReply),
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct ICTransferReply {
    pub chain: String,
    pub symbol: String,
    pub is_send: bool,
    pub amount: Nat,
    pub canister_id: String,
    pub block_index: Nat,
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct AddLiquidityReply {
    pub tx_id: u64,
    pub symbol: String,
    pub request_id: u64,
    pub status: String,
    pub chain_0: String,
    pub symbol_0: String,
    pub amount_0: Nat,
    pub chain_1: String,
    pub symbol_1: String,
    pub amount_1: Nat,
    pub add_lp_token_amount: Nat,
    pub transfer_ids: Vec<TransferIdReply>,
    pub claim_ids: Vec<u64>,
    pub ts: u64,
}

// Public async functions

pub async fn get_kong_swap_quote(pay_symbol: String, pay_amount: Nat, receive_symbol: String) -> Result<SwapAmountsReply, String> {
    let kong_principal = Principal::from_text(KONG_BACKEND_CANISTER_ID).unwrap();
    let args = (pay_symbol, pay_amount, receive_symbol);
    let result: Result<(SwapAmountsReply,), _> = ic_cdk::call(kong_principal, "swap_amounts", args).await;
    result.map(|(r,)| r).map_err(|e| format!("Failed to call swap_amounts: {:?}", e))
}

pub async fn add_liquidity_to_kong(primary_token_symbol: String, primary_token_amount: Nat, icp_amount: Nat) -> Result<AddLiquidityReply, String> {
    let kong_principal = Principal::from_text(KONG_BACKEND_CANISTER_ID).unwrap();

    // 1. call add_liquidity_amounts to get proportional amounts
    let args = (primary_token_symbol.clone(), primary_token_amount.clone(), "ICP".to_string());
    let amounts_result: Result<(AddLiquidityAmountsReply,), _> = ic_cdk::call(kong_principal, "add_liquidity_amounts", args).await;
    let amounts = amounts_result.map_err(|e| format!("Failed to call add_liquidity_amounts: {:?}", e))?.0;

    if amounts.amount_1 > icp_amount {
        return Err("Not enough ICP in treasury for this liquidity add".to_string());
    }

    let primary_canister_id = get_primary_canister_id();
    let icp_canister_id = Principal::from_text(ICP_LEDGER_CANISTER_ID).unwrap();

    // 2. call icrc2_approve on both the primary token ledger and the ICP ledger
    icrc2_approve(primary_canister_id, kong_principal, amounts.amount_0.clone()).await?;
    icrc2_approve(icp_canister_id, kong_principal, amounts.amount_1.clone()).await?;

    // 3. call add_liquidity to finalize
    let add_liquidity_args = AddLiquidityArgs {
        token_0: primary_token_symbol,
        amount_0: amounts.amount_0.clone(),
        tx_id_0: None,
        token_1: "ICP".to_string(),
        amount_1: amounts.amount_1.clone(),
        tx_id_1: None,
    };

    let result: Result<(AddLiquidityReply,), _> = ic_cdk::call(kong_principal, "add_liquidity", (add_liquidity_args,)).await;
    result.map(|(r,)| r).map_err(|e| format!("Failed to call add_liquidity: {:?}", e))
} 