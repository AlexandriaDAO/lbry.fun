use candid::{encode_args, decode_one, CandidType, Deserialize, Principal, Nat};
use ic_cdk::api::call::call_raw;
use num_traits::ToPrimitive;
use crate::types::{Account, TokenRecord, ExecutionError};

// ICRC1 token standards
#[derive(CandidType, Deserialize)]
pub struct TransferArg {
    pub from_subaccount: Option<[u8; 32]>,
    pub to: Account,
    pub amount: Nat,
    pub fee: Option<Nat>,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>,
}

#[derive(CandidType, Deserialize)]
pub struct ApproveArgs {
    pub from_subaccount: Option<[u8; 32]>,
    pub spender: Account,
    pub amount: Nat,
    pub expected_allowance: Option<Nat>,
    pub expires_at: Option<u64>,
    pub fee: Option<Nat>,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum TransferResult {
    Ok(Nat),
    Err(TransferError),
}

#[derive(CandidType, Deserialize, Debug)]
pub enum TransferError {
    BadFee { expected_fee: Nat },
    BadBurn { min_burn_amount: Nat },
    InsufficientFunds { balance: Nat },
    TooOld,
    CreatedInFuture { ledger_time: u64 },
    Duplicate { duplicate_of: Nat },
    TemporarilyUnavailable,
    GenericError { error_code: Nat, message: String },
}

// Helper functions for canister interactions

pub async fn get_token_record(lbry_fun_canister: Principal, pool_id: u64) -> Result<TokenRecord, String> {
    ic_cdk::println!("[BOT1] Calling get_all_token_record on {}", lbry_fun_canister.to_text());
    
    // Call get_all_token_record which returns Vec<(u64, TokenRecord)>
    // For query calls with no arguments, we need to pass empty encoded args
    let empty_args = encode_args(()).map_err(|e| format!("Failed to encode empty args: {:?}", e))?;
    
    let result = call_raw(
        lbry_fun_canister,
        "get_all_token_record",
        &empty_args,
        0,
    ).await
    .map_err(|e| format!("Failed to call get_all_token_record: {:?}", e))?;
    
    let all_records: Vec<(u64, TokenRecord)> = decode_one(&result)
        .map_err(|e| format!("Failed to decode token records: {:?}", e))?;
    
    ic_cdk::println!("[BOT1] Received {} token records", all_records.len());
    
    // Find the record with matching pool_id
    all_records.into_iter()
        .find(|(id, _)| *id == pool_id)
        .map(|(_, record)| record)
        .ok_or_else(|| format!("Pool {} not found in lbry_fun registry", pool_id))
}

pub async fn icrc1_balance_of(token: Principal, account: Account) -> Result<u64, String> {
    let args = encode_args((account,)).map_err(|e| format!("Failed to encode args: {:?}", e))?;
    
    let result = call_raw(
        token,
        "icrc1_balance_of",
        &args,
        0,
    ).await
    .map_err(|e| format!("Failed to call icrc1_balance_of: {:?}", e))?;
    
    let balance: Nat = decode_one(&result).map_err(|e| format!("Failed to decode balance: {:?}", e))?;
    
    // Convert Nat to u64
    balance.0.to_u64().ok_or_else(|| "Balance too large for u64".to_string())
}

pub async fn icrc1_total_supply(token: Principal) -> Result<u64, String> {
    let args = encode_args(()).map_err(|e| format!("Failed to encode args: {:?}", e))?;
    
    let result = call_raw(
        token,
        "icrc1_total_supply",
        &args,
        0,
    ).await
    .map_err(|e| format!("Failed to call icrc1_total_supply: {:?}", e))?;
    
    let supply: Nat = decode_one(&result).map_err(|e| format!("Failed to decode supply: {:?}", e))?;
    supply.0.to_u64().ok_or_else(|| "Supply too large for u64".to_string())
}

pub async fn icrc2_approve(
    token: Principal,
    spender: Principal,
    amount: u64,
) -> Result<Nat, String> {
    let args = ApproveArgs {
        from_subaccount: None,
        spender: Account {
            owner: spender,
            subaccount: None,
        },
        amount: Nat::from(amount),
        expected_allowance: None,
        expires_at: None,
        fee: None,
        memo: None,
        created_at_time: None,
    };
    
    let encoded_args = encode_args((args,)).map_err(|e| format!("Failed to encode approve args: {:?}", e))?;
    
    let result = call_raw(
        token,
        "icrc2_approve",
        &encoded_args,
        0,
    ).await
    .map_err(|e| format!("Failed to call icrc2_approve: {:?}", e))?;
    
    let approve_result: Result<Nat, TransferError> = decode_one(&result)
        .map_err(|e| format!("Failed to decode approve result: {:?}", e))?;
    
    match approve_result {
        Ok(block_index) => Ok(block_index),
        Err(e) => Err(format!("Approve failed: {:?}", e)),
    }
}

pub async fn swap_icp(
    icp_swap_canister: Principal,
    amount: u64,
) -> Result<String, String> {
    let args = encode_args((amount, None::<[u8; 32]>))
        .map_err(|e| format!("Failed to encode swap args: {:?}", e))?;
    
    let result = call_raw(
        icp_swap_canister,
        "swap",
        &args,
        0,
    ).await
    .map_err(|e| format!("Failed to call swap: {:?}", e))?;
    
    // The swap function returns Result<String, ExecutionError>
    // We need to decode it as a Result and handle both cases
    let swap_result: Result<String, ExecutionError> = decode_one(&result)
        .map_err(|e| format!("Failed to decode swap result: {:?}", e))?;
    
    match swap_result {
        Ok(success_msg) => Ok(success_msg),
        Err(exec_err) => Err(format!("Swap failed: {:?}", exec_err)),
    }
}

pub async fn burn_secondary(
    icp_swap_canister: Principal,
    amount: u64,
) -> Result<String, String> {
    let args = encode_args((amount, None::<[u8; 32]>))
        .map_err(|e| format!("Failed to encode burn args: {:?}", e))?;
    
    let result = call_raw(
        icp_swap_canister,
        "burn_secondary",
        &args,
        0,
    ).await
    .map_err(|e| format!("Failed to call burn_secondary: {:?}", e))?;
    
    // The burn_secondary function returns Result<String, ExecutionError>
    // We need to decode it as a Result and handle both cases
    let burn_result: Result<String, ExecutionError> = decode_one(&result)
        .map_err(|e| format!("Failed to decode burn result: {:?}", e))?;
    
    match burn_result {
        Ok(success_msg) => Ok(success_msg),
        Err(exec_err) => Err(format!("Burn failed: {:?}", exec_err)),
    }
}

// Constants for canister IDs
pub const LBRY_FUN_CANISTER: &str = "oni4e-oyaaa-aaaap-qp2pq-cai";
pub const ICP_LEDGER_CANISTER: &str = "ryjl3-tyaaa-aaaaa-aaaba-cai";

pub fn get_lbry_fun_principal() -> Principal {
    Principal::from_text(LBRY_FUN_CANISTER).expect("Invalid lbry_fun canister ID")
}

pub fn get_icp_ledger_principal() -> Principal {
    Principal::from_text(ICP_LEDGER_CANISTER).expect("Invalid ICP ledger canister ID")
}