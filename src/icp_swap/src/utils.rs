use crate::{
    get_config, get_distribution_interval, get_distribution_interval_mem, get_secondary_ratio_mem, get_stake, get_total_archived_balance, get_total_archived_balance_mem, get_total_unclaimed_icp_reward, get_total_unclaimed_icp_reward_mem, ArchiveBalance, ExecutionError, SecondaryRatio, Log, LogType, ARCHIVED_TRANSACTION_LOG, CONFIGS, DEFAULT_ADDITION_OVERFLOW_ERROR, DEFAULT_MULTIPLICATION_OVERFLOW_ERROR, DEFAULT_UNDERFLOW_ERROR, LOGS, LOG_COUNTER, PRIMARY_FEE
};
use candid::{ CandidType, Nat, Principal };
use ic_cdk::api::call::RejectionCode;
use ic_cdk::{ self, caller };
use ic_ledger_types::AccountIdentifier;
use ic_ledger_types::Subaccount;
use ic_ledger_types::{ AccountBalanceArgs, DEFAULT_SUBACCOUNT, MAINNET_LEDGER_CANISTER_ID };
use serde::Deserialize;

pub const STAKING_REWARD_PERCENTAGE: u64 = 100; // 1%
pub const XRC_CANISTER_ID: &str = "uf6dk-hyaaa-aaaaq-qaaaq-cai";
pub const ICP_CANISTER_ID: &str = "nppha-riaaa-aaaal-ajf2q-cai";

pub const ICP_TRANSFER_FEE: u64 = 10_000;
pub const MAX_DAYS: u32 = 30;
pub const SCALING_FACTOR: u128 = 1_000_000_000_000; // Adjust based on your precision needs
pub const BURN_CYCLE_FEE: u64 = 10_000_000_000;
pub const DEFAULT_SECONDARY_RATIO: u64 = 400;
pub const E8S: u64 = 100_000_000;
pub const LOGS_LIMIT: u64 = 100_000;

pub fn verify_caller_balance(amount: u64) -> bool {
    let caller_stake = get_stake(caller());
    match caller_stake {
        Some(stake) => amount <= (stake.amount as u64),
        None => false,
    }
}
pub fn get_principal(id: &str) -> Principal {
    Principal::from_text(id).expect(&format!("Invalid principal: {}", id))
}

pub fn get_caller_stake_balance() -> u64 {
    let caller_stake = get_stake(caller());
    match caller_stake {
        Some(stake) => {
            return stake.amount;
        }
        None => {
            return 0;
        }
    }
}

pub fn principal_to_subaccount(principal_id: &Principal) -> Subaccount {
    let mut subaccount = [0; std::mem::size_of::<Subaccount>()];
    let principal_id = principal_id.as_slice();
    subaccount[0] = principal_id.len().try_into().unwrap();
    subaccount[1..1 + principal_id.len()].copy_from_slice(principal_id);

    Subaccount(subaccount)
}

// // This logic is removed because of a known bug, whereby failed burns still increase burn_amount.
// // It was kept as a pre-audit minting limit precaution.

// pub async fn within_max_limit(burn_amount: u64) -> Result<u64, ExecutionError> {
//     let result: Result<(u64, u64), String> = ic_cdk
//         ::call::<(), (u64, u64)>(
//             Principal::from_text(TOKENOMICS_CANISTER_ID).map_err(|e|
//                 ExecutionError::new_with_log(
//                     caller(),
//                     "within_max_limit",
//                     ExecutionError::StateError(format!("Invalid tokenomics canister ID: {}", e))
//                 )
//             )?,
//             "get_max_stats",
//             ()
//         ).await
//         .map_err(|e: (ic_cdk::api::call::RejectionCode, String)| {
//             format!("failed to call tokenomics canister: {:?}", e)
//         });

//     match result {
//         Ok((max_threshold, total_burned)) => {
//             //Todo
//             if burn_amount + total_burned <= max_threshold {
//                 Ok(burn_amount)
//             } else {
//                 Ok(max_threshold - total_burned)
//             }
//         }
//         Err(e) =>
//             Err(
//                 ExecutionError::new_with_log(
//                     caller(),
//                     "within_max_limit",
//                     ExecutionError::StateError(e)
//                 )
//             ),
//     }
// }

//remove
pub async fn tokenomics_burn_secondary_stats() -> Result<(u64, u64), String> {
    let tokenomics_canister_id=get_config().tokenomics_cansiter_id;
    let result: Result<(u64, u64), String> = ic_cdk
        ::call::<(), (u64, u64)>(
            tokenomics_canister_id,
            "get_max_stats",
            ()
        ).await
        .map_err(|e: (ic_cdk::api::call::RejectionCode, String)| {
            format!("failed to call ledger: {:?}", e)
        });

    match result {
        Ok((max_threshold, total_burned)) => {
            return Ok((max_threshold, total_burned));
        }
        Err(e) => {
            return Err(e);
        }
    }
}

// pub static TOTAL_ARCHIVED_BALANCE: RefCell<u64> = RefCell::new(0);
pub(crate) fn add_to_distribution_intervals(amount: u32) -> Result<(), ExecutionError> {
    let current_total = get_distribution_interval();
    let new_total = current_total.checked_add(amount).ok_or_else(||
        ExecutionError::new_with_log(
            caller(),
            "add_to_distribution_intervals",
            ExecutionError::AdditionOverflow {
                operation: DEFAULT_ADDITION_OVERFLOW_ERROR.to_string(),
                details: format!("current_total: {} with amount: {}", current_total, amount),
            }
        )
    )?;
    let mut result = get_distribution_interval_mem();
    result.insert((), new_total);
    Ok(())
}
pub(crate) fn add_to_total_archived_balance(amount: u64) -> Result<(), ExecutionError> {
    let current_total = get_total_archived_balance();
    let new_total = current_total.checked_add(amount).ok_or_else(|| {
        ExecutionError::new_with_log(
            caller(),
            "add_to_total_archived_balance",
            ExecutionError::AdditionOverflow {
                operation: DEFAULT_ADDITION_OVERFLOW_ERROR.to_string(),
                details: format!("current_total: {} with amount: {}", current_total, amount),
            }
        )
    })?;
    let mut result = get_total_archived_balance_mem();
    result.insert((), new_total);
    Ok(())
}
pub(crate) fn sub_to_total_archived_balance(amount: u64) -> Result<(), ExecutionError> {
    let current_total = get_total_archived_balance();
    let new_total = current_total.checked_sub(amount).ok_or_else(||
        ExecutionError::new_with_log(
            caller(),
            "sub_to_total_archived_balance",
            ExecutionError::Underflow {
                operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                details: format!("current_total: {} with amount: {}", current_total, amount),
            }
        )
    )?;
    let mut result = get_total_archived_balance_mem();
    result.insert((), new_total);
    Ok(())
}
pub(crate) fn add_to_unclaimed_amount(amount: u64) -> Result<(), ExecutionError> {
    let current_total = get_total_unclaimed_icp_reward();
    let new_total = current_total.checked_add(amount).ok_or_else(||
        ExecutionError::new_with_log(
            caller(),
            "add_to_unclaimed_amount",
            ExecutionError::AdditionOverflow {
                operation: DEFAULT_ADDITION_OVERFLOW_ERROR.to_string(),
                details: format!("current_total: {} with amount: {}", current_total, amount),
            }
        )
    )?;
    let mut result = get_total_unclaimed_icp_reward_mem();
    result.insert((), new_total);
    Ok(())
}
pub(crate) fn sub_to_unclaimed_amount(amount: u64) -> Result<(), ExecutionError> {
    let current_total = get_total_unclaimed_icp_reward();
    let new_total = current_total.checked_sub(amount).ok_or_else(||
        ExecutionError::new_with_log(
            caller(),
            "sub_to_unclaimed_amount",
            ExecutionError::Underflow {
                operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                details: format!("current_total: {} with amount: {}", current_total, amount),
            }
        )
    )?;
    let mut result = get_total_unclaimed_icp_reward_mem();
    result.insert((), new_total);
    Ok(())
}

pub(crate) fn update_current_secondary_ratio(
    new_ratio: u64,
    current_time: u64
) -> Result<(), ExecutionError> {
    // Get the StableBTreeMap for secondary ratio
    let mut secondary_ratio_map = get_secondary_ratio_mem();

    // Create a new SecondaryRatio instance with the provided values
    let secondary_ratio = SecondaryRatio {
        ratio: new_ratio,
        time: current_time,
    };

    // Insert or update the SecondaryRatio value at the key `()`
    secondary_ratio_map.insert((), secondary_ratio);
    Ok(())
}
pub(crate) fn update_primary_fee(fee: u64) -> Result<(), ExecutionError> {
    PRIMARY_FEE.with(|fee_cell| {
        *fee_cell.borrow_mut() = fee;
    });
    Ok(())
}
pub(crate) fn archive_user_transaction(amount: u64) -> Result<String, ExecutionError> {
    let caller = ic_cdk::caller();

    ARCHIVED_TRANSACTION_LOG.with(
        |trxs| -> Result<(), ExecutionError> {
            let mut trxs = trxs.borrow_mut();

            let mut user_archive = trxs.get(&caller).unwrap_or(ArchiveBalance { icp: 0 });
            user_archive.icp = user_archive.icp.checked_add(amount).ok_or_else(|| {
                ExecutionError::new_with_log(
                    caller,
                    "archive_user_transaction",
                    ExecutionError::AdditionOverflow {
                        operation: DEFAULT_ADDITION_OVERFLOW_ERROR.to_string(),
                        details: format!(
                            "user_archive.icp: {} with amount: {}",
                            user_archive.icp,
                            amount
                        ),
                    }
                )
            })?;

            trxs.insert(caller, user_archive);
            register_info_log(
                caller,
                "archive_user_transaction",
                &format!("archive_user_transaction added {} ICP ", amount)
            );

            Ok(())
        }
    )?;
    add_to_total_archived_balance(amount)?;

    Ok("Transaction added successfully!".to_string())
}

pub(crate) async fn get_total_primary_staked() -> Result<u64, ExecutionError> {
    let primary_token_id=get_config().primary_token_id;
    let canister_id = ic_cdk::api::id();
    let args = BalanceOfArgs {
        owner: canister_id,
        subaccount: None, // Set subaccount to None, or Some(...) if needed
    };

    let result: Result<(Nat,), (RejectionCode, String)> = ic_cdk::call(
        primary_token_id,
        "icrc1_balance_of",
        (args,)
    ).await;

    match result {
        Ok((balance,)) =>
            balance.0
                .try_into()
                .map_err(|_|
                    ExecutionError::new_with_log(
                        caller(),
                        "get_total_primary_staked",
                        ExecutionError::StateError("Balance exceeds u64 max value".to_string())
                    )
                ),
        Err((code, msg)) =>
            Err(
                ExecutionError::new_with_log(
                    caller(),
                    "get_total_primary_staked",
                    ExecutionError::CanisterCallFailed {
                        canister: "primary".to_string(),
                        method: "icrc1_balance_of".to_string(),
                        details: format!("Rejection code: {:?}, Message: {}", code, msg),
                    }
                )
            ),
    }
}
pub(crate) async fn fetch_canister_icp_balance() -> Result<u64, ExecutionError> {
    let canister_id = ic_cdk::api::id();
    let account_identifier = AccountIdentifier::new(&canister_id, &DEFAULT_SUBACCOUNT);
    let balance_args = AccountBalanceArgs {
        account: account_identifier,
    };

    // Call the ledger canister's `account_balance` method and extract the balance in e8s (u64)
    let result = ic_ledger_types
        ::account_balance(MAINNET_LEDGER_CANISTER_ID, balance_args).await
        .map_err(|e|
            ExecutionError::new_with_log(
                caller(),
                "fetch_canister_icp_balance",
                ExecutionError::CanisterCallFailed {
                    canister: MAINNET_LEDGER_CANISTER_ID.to_string(),
                    method: "account_balance".to_string(),
                    details: format!("Rejection call failed: {:?}", e),
                }
            )
        );
    // Convert the Tokens to u64 (in e8s) and return
    result.map(|tokens| tokens.e8s())
}

pub(crate) async fn get_primary_fee() -> Result<u64, ExecutionError> {
    let primary_token_id=get_config().primary_token_id;
    let result: Result<(Nat,), (RejectionCode, String)> = ic_cdk::call(
        primary_token_id,
        "icrc1_fee",
        ()
    ).await;

    match result {
        Ok((fee,)) =>
            fee.0.try_into().map_err(|_| ExecutionError::MultiplicationOverflow {
                operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                details: "Fee value exceeds u64 maximum".to_string(),
            }),
        Err((code, msg)) =>
            Err(
                ExecutionError::new_with_log(
                    caller(),
                    "get_primary_fee",
                    ExecutionError::CanisterCallFailed {
                        canister: primary_token_id.to_string(),
                        method: "icrc1_fee".to_string(),
                        details: format!("Rejection code: {:?}, Message: {}", code, msg),
                    }
                )
            ),
    }
}
// Function to register an info log

pub fn register_info_log(caller: Principal, function: &str, detail: &str) {
    let timestamp = ic_cdk::api::time();
    let log_id =
        LOG_COUNTER.with(|counter| {
            let next_id = *counter.borrow() + 1;
            *counter.borrow_mut() = next_id;
            next_id
        }) % LOGS_LIMIT;
    let log_entry = Log {
        log_id,
        timestamp,
        caller,
        function: function.to_string(),
        log_type: LogType::Info {
            detail: detail.to_string(),
        },
    };

    LOGS.with(|logs| logs.borrow_mut().insert(log_id, log_entry));
}

// Function to register an error log
pub fn register_error_log(caller: Principal, function: &str, error: ExecutionError) {
    let log_id =
        LOG_COUNTER.with(|counter| {
            let next_id = *counter.borrow() + 1;
            *counter.borrow_mut() = next_id;
            next_id
        }) % LOGS_LIMIT;
    let timestamp = ic_cdk::api::time();
    let log_entry = Log {
        log_id,
        timestamp,
        caller,
        function: function.to_string(),
        log_type: LogType::Error { error },
    };

    LOGS.with(|logs| logs.borrow_mut().insert(log_id, log_entry));
}

#[derive(CandidType)]
struct BalanceOfArgs {
    owner: Principal,
    subaccount: Option<Vec<u8>>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum ExchangeRateError {
    AnonymousPrincipalNotAllowed,
    CryptoQuoteAssetNotFound,
    FailedToAcceptCycles,
    ForexBaseAssetNotFound,
    CryptoBaseAssetNotFound,
    StablecoinRateTooFewRates,
    ForexAssetsNotFound,
    InconsistentRatesReceived,
    RateLimited,
    StablecoinRateZeroRate,
    Other {
        code: u32,
        description: String,
    },
    ForexInvalidTimestamp,
    NotEnoughCycles,
    ForexQuoteAssetNotFound,
    StablecoinRateNotFound,
    Pending,
}
