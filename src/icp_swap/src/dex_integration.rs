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
pub struct SwapReply {
    pub request_id: u64,
    pub status: String,
    pub pay_amount: Nat,
    pub pay_symbol: String,
    pub receive_amount: Nat,
    pub receive_symbol: String,
    pub price: f64,
    pub slippage: f64,
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct SwapArgs {
    pub pay_token: String,
    pub pay_amount: Nat,
    pub pay_tx_id: Option<TxId>,
    pub receive_token: String,
    pub receive_amount: Option<Nat>,
    pub receive_address: Option<String>,
    pub max_slippage: Option<f64>,
    pub referred_by: Option<String>,
}

pub async fn get_kong_swap_quote(pay_symbol: String, pay_amount: Nat, receive_symbol: String) -> Result<SwapAmountsReply, String> {
    let kong_principal = Principal::from_text(KONG_BACKEND_CANISTER_ID).unwrap();
    let args = (pay_symbol, pay_amount, receive_symbol);
    let result: Result<(SwapAmountsReply,), _> = ic_cdk::call(kong_principal, "swap_amounts", args).await;
    result.map(|(r,)| r).map_err(|e| format!("Failed to call swap_amounts: {:?}", e))
}

pub async fn execute_swap_on_dex(pay_symbol: String, pay_amount: Nat, receive_symbol: String) -> Result<Nat, String> {
    // 1. Get quote to establish a price baseline for slippage protection.
    let quote = get_kong_swap_quote(pay_symbol.clone(), pay_amount.clone(), receive_symbol.clone()).await?;

    // 2. Approve the Kong DEX to spend the token on our behalf.
    let kong_principal = Principal::from_text(KONG_BACKEND_CANISTER_ID).unwrap();
    let icp_canister_id = Principal::from_text(ICP_LEDGER_CANISTER_ID).unwrap();
    icrc2_approve(icp_canister_id, kong_principal, pay_amount.clone()).await?;

    // 3. Define SwapArgs with slippage protection.
    // We set max_slippage to 0.5% and also calculate the minimum expected amount.
    // This provides robust protection against price volatility.
    let max_slippage_percent = 0.5;
    // Calculate 99.5% of the quoted amount: (quote.receive_amount * 995) / 1000
    let min_receive_amount = quote.receive_amount * Nat::from(995u32) / Nat::from(1000u32);

    let swap_args = SwapArgs {
        pay_token: pay_symbol,
        pay_amount: pay_amount.clone(),
        pay_tx_id: None, // Not used in the icrc2_approve flow
        receive_token: receive_symbol,
        receive_amount: Some(min_receive_amount),
        receive_address: None, // Defaults to caller (this canister)
        max_slippage: Some(max_slippage_percent),
        referred_by: None,
    };
    
    // 4. Call the swap function on the Kong DEX.
    let result: Result<(SwapReply,), _> = ic_cdk::call(kong_principal, "swap", (swap_args,)).await;

    match result {
        Ok((swap_reply,)) => {
            if swap_reply.status == "Success" {
                Ok(swap_reply.receive_amount)
            } else {
                Err(format!("Swap on DEX failed with status: '{}'", swap_reply.status))
            }
        }
        Err(e) => Err(format!("Failed to call swap on DEX: {:?}", e)),
    }
}

pub async fn get_add_liquidity_amounts(primary_token_symbol: String, icp_amount: Nat) -> Result<AddLiquidityAmountsReply, String> {
    let kong_principal = Principal::from_text(KONG_BACKEND_CANISTER_ID).unwrap();
    let args = (primary_token_symbol, icp_amount, "ICP".to_string());
    let result: Result<(AddLiquidityAmountsReply,), _> = ic_cdk::call(kong_principal, "add_liquidity_amounts", args).await;
    result.map(|(r,)| r).map_err(|e| format!("Failed to call add_liquidity_amounts: {:?}", e))
}

pub async fn add_liquidity_to_kong(primary_token_symbol: String, primary_token_amount: Nat, icp_amount: Nat) -> Result<AddLiquidityAmountsReply, String> {
    let kong_principal = Principal::from_text(KONG_BACKEND_CANISTER_ID).unwrap();

    let primary_canister_id = get_primary_canister_id();
    let icp_canister_id = Principal::from_text(ICP_LEDGER_CANISTER_ID).unwrap();

    // 1. Approve the DEX to spend the tokens we are providing.
    // We approve the full amount we have, the DEX will only take what it needs based on the current ratio.
    icrc2_approve(primary_canister_id, kong_principal, primary_token_amount.clone()).await?;
    icrc2_approve(icp_canister_id, kong_principal, icp_amount.clone()).await?;

    // 2. call add_liquidity to finalize
    let add_liquidity_args = AddLiquidityArgs {
        token_0: primary_token_symbol,
        amount_0: primary_token_amount,
        tx_id_0: None,
        token_1: "ICP".to_string(),
        amount_1: icp_amount,
        tx_id_1: None,
    };

    let result: Result<(AddLiquidityAmountsReply,), _> = ic_cdk::call(kong_principal, "add_liquidity", (add_liquidity_args,)).await;
    result.map(|(r,)| r).map_err(|e| format!("Failed to call add_liquidity: {:?}", e))
} 