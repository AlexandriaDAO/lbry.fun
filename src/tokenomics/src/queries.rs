use crate::{
    get_current_threshold_index_mem, get_principal, get_total_secondary_burned_mem, Configs, Logs, TokenLogs, TokenomicsSchedule, CONFIGS, LOGS, TOKENOMICS, TOKEN_LOGS
};
use candid::{CandidType, Nat, Principal};
use ic_cdk::{
    api::call:: CallResult,
    caller, query, update,
};
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone)]
pub struct TransactionRecord {
    burn: Option<BurnRecord>,
    kind: String,
    mint: Option<MintRecord>,
    approve: Option<ApproveRecord>,
    timestamp: u64,
    transfer: Option<TransferRecord>,
}

#[derive(CandidType, Deserialize, Clone)]
struct BurnRecord {
    from: Account,
    memo: Option<Vec<u8>>,
    created_at_time: Option<u64>,
    amount: Nat,
    spender: Option<Account>,
}

#[derive(CandidType, Deserialize, Clone)]
struct MintRecord {
    to: Account,
    memo: Option<Vec<u8>>,
    created_at_time: Option<u64>,
    amount: Nat,
}

#[derive(CandidType, Deserialize, Clone)]
struct ApproveRecord {
    fee: Option<Nat>,
    from: Account,
    memo: Option<Vec<u8>>,
    created_at_time: Option<u64>,
    amount: Nat,
    expected_allowance: Option<Nat>,
    expires_at: Option<u64>,
    spender: Account,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct TransferRecord {
    to: Account,
    fee: Option<Nat>,
    from: Account,
    memo: Option<Vec<u8>>,
    created_at_time: Option<u64>,
    amount: Nat,
    spender: Option<Account>,
}

#[derive(CandidType, Deserialize, Clone)]
struct Account {
    owner: Principal,
    subaccount: Option<Vec<u8>>,
}

#[derive(CandidType, Deserialize)]
struct GetTransactionsRequest {
    start: Nat,
    length: Nat,
}

#[derive(CandidType, Deserialize)]
struct GetTransactionsResponse {
    first_index: Nat,
    log_length: Nat,
    transactions: Vec<TransactionRecord>,
}

#[derive(CandidType, Deserialize)]
struct GetTokensArgs {
    start: Option<Nat>,
    length: Option<Nat>,
}

#[query]
pub fn get_total_secondary_burn() -> u64 {
    let result = get_total_secondary_burned_mem();
    return result.get(&()).unwrap_or(0);
}

#[query]
pub fn get_current_threshold_index() -> u32 {
    let result = get_current_threshold_index_mem();
    return result.get(&()).unwrap_or(0);
}
#[query]
pub fn get_current_primary_rate() -> u64 {
    let primary_mint_per_threshold=get_tokenomics_schedule().primary_mint_per_threshold;
    let current_threshold = get_current_threshold_index();
    primary_mint_per_threshold[current_threshold as usize]
}
#[query]
pub fn get_current_secondary_threshold() -> u64 {
    let secondary_burn_thresholds=get_tokenomics_schedule().secondary_burn_thresholds;
    let current_threshold = get_current_threshold_index();
    secondary_burn_thresholds[current_threshold as usize]
}

#[query]
pub fn get_max_stats() -> (u64, u64) {
    let secondary_burn_thresholds=get_tokenomics_schedule().secondary_burn_thresholds;
    let max_threshold = secondary_burn_thresholds[secondary_burn_thresholds.len() - 1];
    let total_burned = get_total_secondary_burn();
    (max_threshold, total_burned)
}
#[update]
pub async fn fetch_total_minted_primary() -> Result<u64, String> {
    let primary_token_id=get_config().primary_token_id;

    // Call the ledger canister's `icrc1_total_supply` method with no input, expecting a `Nat` response
    let result: Result<(Nat,), _> = ic_cdk::call(primary_token_id, "icrc1_total_supply", ())
        .await
        .map_err(|e: (ic_cdk::api::call::RejectionCode, String)| {
            format!("Failed to call ledger: {:?}", e)
        });

    // Convert the Nat to u64 and handle any potential errors
    match result {
        Ok((total_supply,)) => total_supply
            .0
            .try_into()
            .map_err(|_| "Failed to convert Nat to u64".to_string()),
        Err(_) => Err("Failed to fetch total supply".to_string()),
    }
}

#[query]
pub fn your_principal() -> Result<String, String> {
    Ok(caller().to_string())
}


#[query]
fn get_logs() -> Vec<Logs> {
    LOGS.with(|logs| logs.borrow().clone())
}



#[query]
fn get_token_logs(page: Option<u64>, page_size: Option<u64>) -> PaginatedTokenLogs {
    let page = page.unwrap_or(1).max(1); // Ensure page is at least 1
    let page_size = page_size.unwrap_or(10).max(1); // Ensure page_size is at least 1

    TOKEN_LOGS.with(|logs| {
        let logs = logs.borrow();
        let total_count = logs.len() as u64;
        let total_pages = (total_count as f64 / page_size as f64).ceil() as u64;
        let start_index = ((page - 1) * page_size) as usize;

        let logs = logs
            .iter()
            .rev()
            .skip(start_index)
            .take(page_size as usize)
            .map(|(_, log)| log.clone())
            .collect();

        PaginatedTokenLogs {
            logs,
            total_pages,
            current_page: page,
            page_size,
        }
    })
}
#[ic_cdk::query]
pub fn get_tokenomics_schedule() -> TokenomicsSchedule {
    TOKENOMICS.with(|cell| {
        let binding = cell.borrow();
        let schedule = binding.get();
        schedule.clone()
    })
}

#[query]
pub fn get_config() -> Configs {
    CONFIGS.with(|c| {
        c.borrow().get().clone()
    })
}

#[derive(CandidType, Deserialize)]
pub struct PaginatedTokenLogs {
    logs: Vec<TokenLogs>,
    total_pages: u64,
    current_page: u64,
    page_size: u64,
}