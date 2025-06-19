use candid::{CandidType, Nat, Principal};
use serde::{Deserialize, Serialize};
use crate::constants::{KONG_BACKEND_CANISTER_ID, ICP_LEDGER_CANISTER_ID};
use crate::utils::{get_primary_canister_id, icrc2_approve, get_primary_token_symbol};
use crate::storage::STATE;
use crate::{get_config, get_current_secondary_ratio};

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
    let icp_canister_id = get_config().icp_ledger_id;
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

pub async fn execute_swap_on_dex_no_slippage(pay_symbol: String, pay_amount: Nat, receive_symbol: String) -> Result<Nat, String> {
    let kong_principal = Principal::from_text(KONG_BACKEND_CANISTER_ID).unwrap();
    let icp_canister_id = get_config().icp_ledger_id;
    
    // Approve the Kong DEX to spend the token on our behalf.
    icrc2_approve(icp_canister_id, kong_principal, pay_amount.clone()).await?;

    let swap_args = SwapArgs {
        pay_token: pay_symbol,
        pay_amount: pay_amount.clone(),
        pay_tx_id: None,
        receive_token: receive_symbol,
        receive_amount: None, // No minimum - accept any price
        receive_address: None, // Defaults to caller (this canister)
        max_slippage: Some(100.0), // Accept any price
        referred_by: None,
    };
    
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

pub async fn add_liquidity_to_kong(primary_token_symbol: String, primary_token_amount: Nat, icp_amount: Nat) -> Result<AddLiquidityAmountsReply, String> {
    let kong_principal = Principal::from_text(KONG_BACKEND_CANISTER_ID).unwrap();

    let primary_canister_id = get_primary_canister_id();
    let icp_canister_id = get_config().icp_ledger_id;

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

#[derive(CandidType, Debug, Deserialize, Serialize)]
pub struct PoolReserves {
    pub icp_reserve: u64,
    pub token_reserve: u64,
}

#[derive(CandidType, Debug, Deserialize, Serialize)]
pub struct PoolInfo {
    pub symbol: String,
    pub chain_0: String,
    pub symbol_0: String,
    pub address_0: String,
    pub reserve_0: Nat,
    pub chain_1: String,
    pub symbol_1: String,
    pub address_1: String,
    pub reserve_1: Nat,
    pub lp_token_supply: Nat,
}

#[derive(CandidType, Debug, Deserialize, Serialize)]
pub struct PoolsReply {
    pub pools: Vec<PoolReply>,
    pub total_tvl: Nat,
    pub total_24h_volume: Nat,
    pub total_24h_lp_fee: Nat,
    pub total_24h_num_swaps: Nat,
}

#[derive(CandidType, Debug, Deserialize, Serialize)]
pub struct PoolReply {
    pub pool_id: u32,
    pub symbol: String,
    pub balance_0: Nat,
    pub balance_1: Nat,
    pub tvl: Nat,
    pub rolling_24h_volume: Nat,
    pub lp_token_supply: Nat,
    pub price: f64,
}

pub async fn get_pool_reserves() -> Result<PoolReserves, String> {
    let kong_principal = Principal::from_text(KONG_BACKEND_CANISTER_ID).unwrap();
    let primary_token_symbol = get_primary_token_symbol()
        .await
        .map_err(|e| format!("Failed to get primary token symbol: {}", e))?;
    
    // Create pool symbol (e.g., "ICP_TOKEN")
    let pool_symbol = format!("ICP_{}", primary_token_symbol);
    
    let result: Result<(Option<PoolInfo>,), _> = ic_cdk::call(kong_principal, "pool", (pool_symbol,)).await;
    
    match result {
        Ok((Some(pool_info),)) => {
            // Determine which reserve is ICP and which is the token
            let (icp_reserve, token_reserve) = if pool_info.symbol_0 == "ICP" {
                (pool_info.reserve_0, pool_info.reserve_1)
            } else {
                (pool_info.reserve_1, pool_info.reserve_0)
            };
            
            // Convert Nat to u64
            let icp_reserve_u64: u64 = icp_reserve.0.try_into()
                .map_err(|_| "Failed to convert ICP reserve to u64".to_string())?;
            let token_reserve_u64: u64 = token_reserve.0.try_into()
                .map_err(|_| "Failed to convert token reserve to u64".to_string())?;
            
            Ok(PoolReserves {
                icp_reserve: icp_reserve_u64,
                token_reserve: token_reserve_u64,
            })
        }
        Ok((None,)) => {
            // Pool doesn't exist yet
            Ok(PoolReserves {
                icp_reserve: 0,
                token_reserve: 0,
            })
        }
        Err(e) => Err(format!("Failed to query pool: {:?}", e)),
    }
}

pub async fn mint_tokens_with_icp(icp_amount: u64) -> Result<Nat, String> {
    // For the zero liquidity case, we need to get primary tokens to bootstrap the pool
    // This is a simplified implementation that estimates the amount of primary tokens
    // based on the current secondary ratio and assumed burn rate
    
    // Calculate secondary tokens based on current ratio
    let icp_rate_in_cents = get_current_secondary_ratio();
    let secondary_amount = icp_amount.checked_mul(icp_rate_in_cents)
        .ok_or("Multiplication overflow when calculating secondary amount")?;
    
    // Convert secondary e8s to natural units (since burn_secondary expects natural units)
    let secondary_natural = secondary_amount / 100_000_000u64;
    
    // For bootstrapping liquidity, we'll estimate primary tokens
    // In production, this would involve actual minting/burning through the proper channels
    // The actual ratio would depend on the tokenomics canister's current state
    
    // Return an estimated amount of primary tokens
    // This is a placeholder - in production you'd need to:
    // 1. Call swap() to get secondary tokens
    // 2. Call burn_secondary() to get primary tokens
    let estimated_primary = secondary_natural.checked_mul(1000)
        .ok_or("Multiplication overflow when calculating primary amount")?;
    
    Ok(Nat::from(estimated_primary))
} 