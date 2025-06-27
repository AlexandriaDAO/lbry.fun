use crate::{
    get_config, get_current_secondary_ratio, get_distribution_interval, get_total_archived_balance,
    get_total_unclaimed_icp_reward, guard::*, ExecutionError, DEFAULT_ADDITION_OVERFLOW_ERROR,
    DEFAULT_BURN_FAILED_ERROR, DEFAULT_DIVISION_ERROR, DEFAULT_INSUFFICIENT_BALANCE_ERROR,
    DEFAULT_INSUFFICIENT_BALANCE_REWARD_DISTRIBUTION_ERROR,
    DEFAULT_INSUFFICIENT_CANISTER_BALANCE_ERROR, DEFAULT_INVALID_AMOUNT_ERROR,
    DEFAULT_MINIMUM_REQUIRED_ERROR, DEFAULT_MINT_FAILED, DEFAULT_MULTIPLICATION_OVERFLOW_ERROR,
    DEFAULT_TRANSFER_FAILED_ERROR, DEFAULT_UNDERFLOW_ERROR,
};
use crate::{get_stake, storage::*};
use crate::{get_user_archive_balance, utils::*};
use crate::storage::{get_accumulated_primary_tokens, add_to_accumulated_primary_tokens, withdraw_from_accumulated_primary_tokens, 
    get_next_event_id, store_distribution_event, DistributionEvent, DistributionAllocations, 
    DistributionResults, LpProvisionStatus};
use crate::{constants::*, dex_integration::{*, get_pool_reserves, mint_tokens_with_icp}};
use candid::{CandidType, Nat, Principal};
use ic_cdk::{self, caller, update};
use ic_ledger_types::{
    AccountIdentifier,
    BlockIndex as BlockIndexIC,
    Memo,
    Subaccount,
    Tokens,
    DEFAULT_SUBACCOUNT,
    //  MAINNET_LEDGER_CANISTER_ID,
};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{BlockIndex, TransferArg, TransferError};
use icrc_ledger_types::icrc2::transfer_from::{TransferFromArgs, TransferFromError};
use num_bigint::BigUint;
use serde::Deserialize;

const LBRY_FUN_CANISTER_ID: &str = "54fqz-5iaaa-aaaap-qkmqa-cai";

#[warn(non_snake_case)]
#[derive(CandidType, Deserialize, Debug)]
pub struct Metadata {
    decimals: u32,
    forex_timestamp: Option<u64>,
    quote_asset_num_received_rates: u64,
    base_asset_num_received_rates: u64,
    base_asset_num_queried_sources: u64,
    standard_deviation: u64,
    quote_asset_num_queried_sources: u64,
}
#[derive(CandidType, Deserialize, Debug)]
pub struct ExchangeRateResponse {
    metadata: Metadata,
    rate: u64,
    timestamp: u64,
    quote_asset: Asset,
    base_asset: Asset,
}
#[derive(CandidType, Deserialize, Debug)]
pub enum AssetClass {
    Cryptocurrency,
    FiatCurrency,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct Asset {
    class: AssetClass,
    symbol: String,
}

#[derive(CandidType, Deserialize)]
pub struct GetExchangeRateRequest {
    base_asset: Asset,
    quote_asset: Asset,
    timestamp: Option<u64>,
}

// Tokenomics ExecutionError type that matches the tokenomics canister's error enum
#[derive(Debug, CandidType, Deserialize, Clone)]
pub enum TokenomicsExecutionError {
    MintFailed {
        token: String,
        amount: u64,
        reason: String,
        details: String,
    },
    AdditionOverflow {
        operation: String,
        details: String,
    },
    MultiplicationOverflow {
        operation: String,
        details: String,
    },
    Underflow {
        operation: String,
        details: String,
    },
    DivisionFailed {
        operation: String,
        details: String,
    },
    CanisterCallFailed {
        canister: String,
        method: String,
        details: String,
    },
    MaxMintPrimaryReached {
        reason: String,
    },
    MaxPrimaryPerTrnxReached {
        reason: String,
    },
    NoMorePrimaryCanbeMinted {
        reason: String,
    },
}

//swap
#[update(guard = "not_anon")]
pub async fn swap(
    amount_icp: u64,
    from_subaccount: Option<[u8; 32]>,
) -> Result<String, ExecutionError> {
    let caller = ic_cdk::caller();
    let _guard =
        CallerGuard::new(caller).map_err(|e| ExecutionError::Unauthorized(e.to_string()))?;
    
    // Check if trading is enabled
    match crate::utils::is_live().await {
        Ok(true) => {
            // Trading is enabled, continue
        },
        Ok(false) => {
            return Err(ExecutionError::TradingNotEnabled {
                reason: "Token is not live yet. Minting/burning enabled 24 hours after pool creation.".to_string()
            });
        },
        Err(e) => {
            return Err(ExecutionError::StateError(format!("Failed to check trading status: {}", e)));
        }
    }
    
    register_info_log(
        caller,
        "swap",
        &format!("Swap initiated: {}  ICP (e8s)", amount_icp),
    );
    if amount_icp < 10_000_000 {
        return Err(ExecutionError::new_with_log(
            caller,
            "swap",
            ExecutionError::MinimumRequired {
                required: 10_000_000,
                provided: amount_icp,
                token: "ICP".to_string(),
                details: DEFAULT_MINIMUM_REQUIRED_ERROR.to_string(),
            },
        ));
    }

    deposit_icp_in_canister(amount_icp, from_subaccount)
        .await
        .map_err(|e| {
            ExecutionError::new_with_log(
                caller,
                "swap",
                ExecutionError::TransferFailed {
                    source: caller.to_string(),
                    dest: "canister".to_string(),
                    token: "ICP".to_string(),
                    amount: amount_icp,
                    details: e.to_string(),
                    reason: DEFAULT_TRANSFER_FAILED_ERROR.to_string(),
                },
            )
        })?;
    register_info_log(
        caller,
        "swap",
        &format!(
            "Successfully deposited {} ICP (e8s) into canister",
            amount_icp
        ),
    );
    let icp_rate_in_cents: u64 = get_current_secondary_ratio();
    register_info_log(
        caller,
        "swap",
        &format!("Current secondary ratio: {}", icp_rate_in_cents),
    );
    // checke here if return
    let secondary_amount: u64 = amount_icp.checked_mul(icp_rate_in_cents).ok_or_else(|| {
        ExecutionError::new_with_log(
            caller,
            "swap",
            ExecutionError::MultiplicationOverflow {
                operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                details: format!(
                    "amount_icp: {} with icp_rate_in_cents: {}",
                    amount_icp, icp_rate_in_cents
                ),
            },
        )
    })?;

    match mint_secondary_token(secondary_amount).await {
        Ok(_) => {
            register_info_log(
                caller,
                "swap",
                &format!(
                    "Successfully swapped {} ICP (e8s) for {} secondary (e8s) tokens",
                    amount_icp, secondary_amount
                ),
            );
        }
        Err(e) => {
            // If there was an error, log it in archive trx and return an error result
            let amount_icp_after_fee =
                amount_icp.checked_sub(ICP_TRANSFER_FEE).ok_or_else(|| {
                    ExecutionError::new_with_log(
                        caller,
                        "swap",
                        ExecutionError::Underflow {
                            operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                            details: format!(
                                "amount_icp: {} with ICP_TRANSFER_FEE: {}",
                                amount_icp, ICP_TRANSFER_FEE
                            ),
                        },
                    )
                })?;

            archive_user_transaction(amount_icp_after_fee)?;

            return Err(ExecutionError::new_with_log(
                caller,
                "swap",
                ExecutionError::MintFailed {
                    token: "secondary".to_string(),
                    amount: secondary_amount,
                    reason: "secondary ".to_string() + DEFAULT_MINT_FAILED,
                    details: e.to_string(),
                },
            ));
        }
    }

    Ok("Swapped Successfully!".to_string())
}

#[allow(non_snake_case)]
#[update(guard = "not_anon")]
/// Burns secondary tokens and returns ICP to the caller
/// 
/// # Parameters
/// - `amount_secondary`: Amount in natural units (e.g., 1 for 1 token, NOT in e8s format)
///   The function will internally convert to e8s by multiplying by 100_000_000
/// - `from_subaccount`: Optional subaccount for the transaction
pub async fn burn_secondary(
    amount_secondary: u64,
    from_subaccount: Option<[u8; 32]>,
) -> Result<String, ExecutionError> {
    let caller = ic_cdk::caller();
    let _guard =
        CallerGuard::new(caller).map_err(|e| ExecutionError::Unauthorized(e.to_string()))?;
    
    // Check if trading is enabled
    match crate::utils::is_live().await {
        Ok(true) => {
            // Trading is enabled, continue
        },
        Ok(false) => {
            return Err(ExecutionError::TradingNotEnabled {
                reason: "Token is not live yet. Minting/burning enabled 24 hours after pool creation.".to_string()
            });
        },
        Err(e) => {
            return Err(ExecutionError::StateError(format!("Failed to check trading status: {}", e)));
        }
    }
    
    register_info_log(
        caller,
        "burn_secondary",
        &format!("burn_secondary initiated: {} secondary ", amount_secondary),
    );

    if amount_secondary < 1 {
        return Err(ExecutionError::new_with_log(
            caller,
            "burn_secondary",
            ExecutionError::MinimumRequired {
                required: 1,
                provided: amount_secondary,
                token: "secondary".to_string(),
                details: DEFAULT_MINIMUM_REQUIRED_ERROR.to_string(),
            },
        ));
    }

    //Dynamic price
    let mut icp_rate_in_cents: u64 = get_current_secondary_ratio();
    let mut amount_icp_e8s = amount_secondary.checked_mul(100_000_000).ok_or_else(|| {
        ExecutionError::new_with_log(
            caller,
            "burn_secondary",
            ExecutionError::MultiplicationOverflow {
                operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                details: format!(
                    "amount_secondary: {} with : {}",
                    amount_secondary, 100_000_000
                ),
            },
        )
    })?;
    icp_rate_in_cents = icp_rate_in_cents.checked_mul(2).ok_or_else(|| {
        ExecutionError::new_with_log(
            caller,
            "burn_secondary",
            ExecutionError::MultiplicationOverflow {
                operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                details: format!("icp_rate_in_cents: {} with  {}", amount_secondary, 2),
            },
        )
    })?;
    amount_icp_e8s = amount_icp_e8s
        .checked_div(icp_rate_in_cents)
        .ok_or_else(|| {
            ExecutionError::new_with_log(
                caller,
                "burn_secondary",
                ExecutionError::DivisionFailed {
                    operation: DEFAULT_DIVISION_ERROR.to_string(),
                    details: format!(
                        "amount_icp_e8s: {} with icp_rate_in_cents: {}",
                        amount_icp_e8s, icp_rate_in_cents
                    ),
                },
            )
        })?;

    if amount_icp_e8s == 0 {
        return Err(ExecutionError::new_with_log(
            caller,
            "burn_secondary",
            ExecutionError::InvalidAmount {
                amount: amount_icp_e8s,
                reason: DEFAULT_INVALID_AMOUNT_ERROR.to_string(),
                details: format!("Calculated ICP amount:{} too small", amount_icp_e8s),
            },
        ));
    }

    let mut total_icp_available: u64 = 0;
    match fetch_canister_icp_balance().await {
        Ok(bal) => {
            total_icp_available = bal;
        }
        Err(e) => {
            return Err(e);
        }
    }
    ic_cdk::println!("AVaiable balance is {}", total_icp_available);
    let total_archived_bal: u64 = get_total_archived_balance();

    let total_unclaimed_icp: u64 = get_total_unclaimed_icp_reward();

    let mut remaining_icp: u64 = total_icp_available
        .checked_sub(total_unclaimed_icp)
        .ok_or_else(|| {
            ExecutionError::new_with_log(
                caller,
                "burn_secondary",
                ExecutionError::Underflow {
                    operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                    details: format!(
                        "total_icp_available: {} with total_unclaimed_icp: {}",
                        total_icp_available, total_unclaimed_icp
                    ),
                },
            )
        })?;
    remaining_icp = remaining_icp
        .checked_sub(total_archived_bal)
        .ok_or_else(|| {
            ExecutionError::new_with_log(
                caller,
                "burn_secondary",
                ExecutionError::Underflow {
                    operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                    details: format!(
                        "remaining_icp: {} with total_archived_bal: {}",
                        remaining_icp, total_archived_bal
                    ),
                },
            )
        })?;

    // For burns, we only need to ensure we have enough ICP to pay out
    // No need to reserve 50% since burning increases our ICP reserves
    if amount_icp_e8s > remaining_icp {
        return Err(ExecutionError::new_with_log(
            caller,
            "burn_secondary",
            ExecutionError::InsufficientCanisterBalance {
                required: amount_icp_e8s,
                available: remaining_icp,
                details: DEFAULT_INSUFFICIENT_CANISTER_BALANCE_ERROR.to_string(),
            },
        ));
    }

    let amount_secondary_e8s = amount_secondary
        .checked_mul(100_000_000) //todo
        .ok_or_else(|| {
            ExecutionError::new_with_log(
                caller,
                "burn_secondary",
                ExecutionError::MultiplicationOverflow {
                    operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                    details: format!(
                        "amount_secondary: {} with {}",
                        amount_secondary, 100_000_000
                    ),
                },
            )
        })?;

    burn_token(amount_secondary_e8s, from_subaccount)
        .await
        .map_err(|e| {
            ExecutionError::new_with_log(
                caller,
                "burn_secondary",
                ExecutionError::BurnFailed {
                    token: "secondary".to_string(),
                    amount: amount_secondary,
                    details: e.to_string(),
                    reason: DEFAULT_BURN_FAILED_ERROR.to_string(),
                },
            )
        })?;
    register_info_log(
        caller,
        "burn_secondary",
        &format!(
            "Successfully burned {} secondary tokens ({} e8s). Preparing to send {} ICP (e8s).",
            amount_secondary, amount_secondary_e8s, amount_icp_e8s
        ),
    );
    // Is this the problem since from_subaccount is alice/bob/etc.?
    match send_icp(caller, amount_icp_e8s, None).await {
        Ok(_) => {
            register_info_log(
                caller,
                "burn_secondary",
                &format!(
                    "Successfully sent {} ICP (e8s) to {}",
                    amount_icp_e8s, caller
                ),
            );
        }
        Err(e) => {
            let amount_icp_after_fee = amount_icp_e8s
                .checked_mul(2)
                .ok_or_else(|| {
                    ExecutionError::new_with_log(
                        caller,
                        "burn_secondary",
                        ExecutionError::MultiplicationOverflow {
                            operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                            details: format!("amount_icp_e8s: {} with {}", amount_icp_e8s, 2),
                        },
                    )
                })?
                .checked_sub(ICP_TRANSFER_FEE)
                .ok_or_else(|| {
                    ExecutionError::new_with_log(
                        caller,
                        "burn_secondary",
                        ExecutionError::Underflow {
                            operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                            details: format!(
                                "amount_icp_e8s: {} with ICP_TRANSFER_FEE: {}",
                                amount_icp_e8s, ICP_TRANSFER_FEE
                            ),
                        },
                    )
                })?;

            archive_user_transaction(amount_icp_after_fee)?;
            return Err(ExecutionError::new_with_log(
                caller,
                "burn_secondary",
                ExecutionError::TransferFailed {
                    source: "canister".to_string(),
                    dest: caller.to_string(),
                    token: "ICP".to_string(),
                    amount: amount_icp_e8s,
                    details: e,
                    reason: DEFAULT_TRANSFER_FAILED_ERROR.to_string(),
                },
            ));
        }
    }

    // No secondary burn limit - the 21M primary cap is still enforced in the mint_primary function (reason described in commented out utils.rs function)
    // Original code checked against secondary thresholds:
    // let limit_result = within_max_limit(amount_secondary).await.map_err(|e|
    //     ExecutionError::new_with_log(
    //         caller,
    //         "burn_secondary",
    //         ExecutionError::StateError(format!("Failed to check max limit: {}", e))
    //     )
    // )?;

    // if limit_result > 0 {
    match mint_primary(amount_secondary, caller, from_subaccount).await {
        Ok(_) => {
            register_info_log(
                caller,
                "burn_secondary",
                &format!(
                    "Burn completed successfully.Minted primary tokens to {}",
                    caller
                ),
            );
        }
        Err(e) => {
            let amount_icp_after_fee =
                amount_icp_e8s
                    .checked_sub(ICP_TRANSFER_FEE)
                    .ok_or_else(|| {
                        ExecutionError::new_with_log(
                            caller,
                            "burn_secondary",
                            ExecutionError::Underflow {
                                operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                                details: format!(
                                    "amount_icp_e8s: {} with ICP_TRANSFER_FEE: {}",
                                    amount_icp_e8s, ICP_TRANSFER_FEE
                                ),
                            },
                        )
                    })?;

            archive_user_transaction(amount_icp_after_fee)?;
            return Err(ExecutionError::new_with_log(
                caller,
                "burn_secondary",
                ExecutionError::MintFailed {
                    token: "primary".to_string(),
                    amount: amount_secondary,
                    details: e,
                    reason: DEFAULT_MINT_FAILED.to_string(),
                },
            ));
        }
    }
    // }
    // // else {
    // //     // primary fully minted
    // //     register_info_log(
    //         caller,
    //         "burn_secondary",
    //         &format!("Burn completed successfully. No more primary tokens can be minted.")
    //     );
    // }

    Ok("Burn Successfully!".to_string())
}

#[allow(non_snake_case)]
async fn mint_secondary_token(amount: u64) -> Result<BlockIndex, TransferError> {
    let caller: Principal = caller();
    let secondary_token_id = get_config().secondary_token_id;

    let amount: Nat = Nat::from(amount);

    let transfer_args: TransferArg = TransferArg {
        // can be used to distinguish between transactions
        // the amount we want to transfer
        amount,
        // we want to transfer tokens from the default subaccount of the canister
        from_subaccount: None,
        // if not specified, the default fee for the canister is used
        fee: None,
        // the account we want to transfer tokens to
        to: Account {
            owner: caller,
            subaccount: None,
        },
        // a timestamp indicating when the transaction was created by the caller; if it is not specified by the caller then this is set to the current ICP time
        created_at_time: None,
        memo: None,
    };

    // 1. Asynchronously call another canister function using `ic_cdk::call`.
    let result = ic_cdk::call::<(TransferArg,), (Result<BlockIndex, TransferError>,)>(
        // 2. Convert a textual representation of a Principal into an actual `Principal` object. The principal is the one we specified in `dfx.json`.
        //    `expect` will panic if the conversion fails, ensuring the code does not proceed with an invalid principal.
        secondary_token_id,
        // 3. Specify the method name on the target canister to be called, in this case, "icrc1_transfer".
        "icrc1_transfer",
        // 4. Provide the arguments for the call in a tuple, here `transfer_args` is encapsulated as a single-element tuple.
        (transfer_args,),
    )
    .await
    .map_err(|_| TransferError::GenericError {
        message: "Call failed".to_string(),
        error_code: Nat::from(0 as u32),
    })?;
    result.0
}

async fn deposit_icp_in_canister(
    amount: u64,
    from_subaccount: Option<[u8; 32]>,
) -> Result<BlockIndex, TransferFromError> {
    let canister_id = ic_cdk::api::id();
    let caller = ic_cdk::caller();

    let transfer_args = TransferFromArgs {
        from: Account {
            owner: caller,
            subaccount: from_subaccount,
        },
        to: Account {
            owner: canister_id,
            subaccount: None,
        },
        amount: amount.into(),
        fee: Some(Nat::from(ICP_TRANSFER_FEE)),
        memo: None,
        created_at_time: None,
        spender_subaccount: None,
    };

    let (result,): (Result<BlockIndex, TransferFromError>,) = ic_cdk::call(
        get_config().icp_ledger_id,
        "icrc2_transfer_from",
        (transfer_args,),
    )
    .await
    .map_err(|_| TransferFromError::GenericError {
        message: "Call failed".to_string(),
        error_code: Nat::from(0 as u32),
    })?;

    result // Return the inner Result<BlockIndex, TransferFromError>
}

async fn send_icp(
    destination: Principal,
    amount: u64,
    from_subaccount: Option<[u8; 32]>,
) -> Result<BlockIndex, String> {
    let transfer_args = TransferArg {
        from_subaccount,
        to: Account {
            owner: destination,
            subaccount: None,
        },
        amount: amount.into(),
        fee: Some(Nat::from(ICP_TRANSFER_FEE)),
        memo: None,
        created_at_time: None,
    };

    let result: Result<(Result<BlockIndex, TransferError>,), _> = ic_cdk::call(
        get_config().icp_ledger_id,
        "icrc1_transfer",
        (transfer_args,),
    )
    .await;

    match result {
        Ok((Ok(block_index),)) => Ok(block_index),
        Ok((Err(err),)) => Err(format!("Ledger transfer error: {:?}", err)),
        Err((code, msg)) => Err(format!(
            "Failed to call ledger: (code: {:?}, message: \"{}\")",
            code, msg
        )),
    }
}

#[allow(non_snake_case)]
async fn mint_primary(
    secondary_amount: u64,
    caller: Principal,
    to_subaccount: Option<[u8; 32]>,
) -> Result<String, String> {
    // Get the tokenomics canister ID from config
    let tokenomics_canister_id = get_config().tokenomics_cansiter_id;

    //raw mode to handle the ExecutionError return type properly
    let result = ic_cdk::api::call::call_raw(
        tokenomics_canister_id,
        "mint_primary",
        candid::encode_args((secondary_amount, caller, to_subaccount))
            .map_err(|e| format!("Failed to encode arguments: {}", e))?,
        0,
    )
    .await;

    match result {
        Ok(bytes) => {
            // Decode the response which returns Result<String, TokenomicsExecutionError>
            match candid::decode_one::<Result<String, TokenomicsExecutionError>>(&bytes) {
                Ok(Ok(success_msg)) => Ok(success_msg),
                Ok(Err(exec_err)) => {
                    // Convert tokenomics error to a string with proper details
                    match exec_err {
                        TokenomicsExecutionError::MintFailed { token, amount, reason, details } => {
                            Err(format!("Mint failed for {} tokens ({}): {} - {}", amount, token, reason, details))
                        },
                        TokenomicsExecutionError::MaxMintPrimaryReached { reason } => {
                            Err(format!("Maximum primary token supply reached: {}", reason))
                        },
                        TokenomicsExecutionError::MaxPrimaryPerTrnxReached { reason } => {
                            Err(format!("Transaction exceeds maximum allowed per transaction: {}", reason))
                        },
                        TokenomicsExecutionError::NoMorePrimaryCanbeMinted { reason } => {
                            Err(format!("No more primary tokens can be minted: {}", reason))
                        },
                        TokenomicsExecutionError::AdditionOverflow { operation, details } => {
                            Err(format!("Addition overflow in {}: {}", operation, details))
                        },
                        TokenomicsExecutionError::MultiplicationOverflow { operation, details } => {
                            Err(format!("Multiplication overflow in {}: {}", operation, details))
                        },
                        TokenomicsExecutionError::Underflow { operation, details } => {
                            Err(format!("Underflow in {}: {}", operation, details))
                        },
                        TokenomicsExecutionError::DivisionFailed { operation, details } => {
                            Err(format!("Division failed in {}: {}", operation, details))
                        },
                        TokenomicsExecutionError::CanisterCallFailed { canister, method, details } => {
                            Err(format!("Call to {}.{} failed: {}", canister, method, details))
                        },
                    }
                },
                Err(e) => Err(format!("Failed to decode tokenomics response: {}", e)),
            }
        }
        Err((code, msg)) => {
            ic_cdk::println!("Error: {:?}", msg);
            Err(format!(
                "Failed to call tokenomics: (code: {:?}, message: \"{}\")",
                code, msg
            ))
        }
    }
}
//stake
#[allow(non_snake_case)]
#[update(guard = "not_anon")]
pub async fn stake_primary(
    amount: u64,
    from_subaccount: Option<[u8; 32]>,
) -> Result<String, ExecutionError> {
    let caller = ic_cdk::caller();
    let _guard =
        CallerGuard::new(caller).map_err(|e| ExecutionError::Unauthorized(e.to_string()))?;
    register_info_log(
        caller,
        "stake_primary",
        &format!("Staking initiated: {} primary", amount),
    );
    let mut primary_fee = PRIMARY_FEE.with(|fee| *fee.borrow());
    if amount < 100_000_000 {
        return Err(ExecutionError::new_with_log(
            caller,
            "stake_primary",
            ExecutionError::MinimumRequired {
                required: 100_000_000,
                provided: amount,
                token: "primary".to_string(),
                details: DEFAULT_MINIMUM_REQUIRED_ERROR.to_string(),
            },
        ));
    }

    if primary_fee == 0 {
        let fee: u64 = get_primary_fee().await?;
        update_primary_fee(fee)?;
        primary_fee = fee;
    }

    let post_fee_amount = amount.checked_sub(primary_fee).ok_or_else(|| {
        ExecutionError::new_with_log(
            caller,
            "stake_primary",
            ExecutionError::Underflow {
                operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                details: format!("amount: {} with primary_fee: {}", amount, primary_fee),
            },
        )
    })?;
    // Proceed with transfer
    deposit_token(post_fee_amount, from_subaccount)
        .await
        .map_err(|e| {
            ExecutionError::new_with_log(
                caller,
                "stake_primary",
                ExecutionError::TransferFailed {
                    source: caller.to_string(),
                    dest: "canister".to_string(),
                    token: "primary".to_string(),
                    amount: post_fee_amount,
                    details: e.to_string(),
                    reason: DEFAULT_TRANSFER_FAILED_ERROR.to_string(),
                },
            )
        })?;
    register_info_log(
        caller,
        "stake_primary",
        &format!(
            "Successfully transferred {} primary (e8s) to canister",
            post_fee_amount
        ),
    );
    let current_time = ic_cdk::api::time();
    STAKES.with(|stakes| -> Result<(), ExecutionError> {
        let mut stakes_map = stakes.borrow_mut();

        let updated_stake = match stakes_map.get(&caller) {
            Some(existing_stake) => {
                let mut updated = existing_stake.clone();
                updated.amount = updated.amount.checked_add(post_fee_amount).ok_or_else(|| {
                    ExecutionError::new_with_log(
                        caller,
                        "stake_primary",
                        ExecutionError::AdditionOverflow {
                            operation: DEFAULT_ADDITION_OVERFLOW_ERROR.to_string(),
                            details: format!(
                                "updated.amount: {} with post_fee_amount: {}",
                                updated.amount, post_fee_amount
                            ),
                        },
                    )
                })?;
                updated.time = current_time;

                register_info_log(
                    caller,
                    "stake_primary",
                    &format!(
                        "Successfully staked {} primary. Total staked: {} primary.",
                        post_fee_amount, updated.amount
                    ),
                );
                updated
            }
            None => Stake {
                amount: post_fee_amount,
                time: current_time,
                reward_icp: 0,
            },
        };

        stakes_map.insert(caller, updated_stake);
        Ok(())
    })?;

    Ok("Staked Successfully!".to_string())
}

#[allow(non_snake_case)]
#[update(guard = "not_anon")]
pub async fn un_stake_all_primary(from_subaccount: Option<[u8; 32]>) -> Result<String, ExecutionError> {
    let caller = ic_cdk::caller();
    let _guard =
        CallerGuard::new(caller).map_err(|e| ExecutionError::Unauthorized(e.to_string()))?;
    register_info_log(caller, "un_stake_all_primary", "Unstaking initiated.");
    let mut primary_fee = PRIMARY_FEE.with(|fee| *fee.borrow());

    let current_stake = STAKES
        .with(|stakes| {
            let stakes_map = stakes.borrow();
            stakes_map.get(&caller)
        })
        .ok_or_else(|| {
            ExecutionError::new_with_log(
                caller,
                "un_stake_all_primary",
                ExecutionError::StateError("No stake found for caller".to_string()),
            )
        })?;

    if primary_fee == 0 {
        let fee: u64 = get_primary_fee().await?;
        update_primary_fee(fee)?;
        primary_fee = fee;
    }

    let staked_amount = current_stake.amount;

    // Verify caller balance
    if staked_amount <= primary_fee {
        // AUDIT comaparing with primary fee to ensure smooth operations
        return Err(ExecutionError::new_with_log(
            caller,
            "un_stake_all_primary",
            ExecutionError::InsufficientBalance {
                required: primary_fee, //Minimum amount
                available: staked_amount,
                details: DEFAULT_INSUFFICIENT_CANISTER_BALANCE_ERROR.to_string(),
                token: "primary".to_string(),
            },
        ));
    }

    let post_fee_amount: u64 = staked_amount.checked_sub(primary_fee).ok_or_else(|| {
        ExecutionError::new_with_log(
            caller,
            "un_stake_all_primary",
            ExecutionError::Underflow {
                operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                details: format!(
                    "staked_amount: {} with primary_fee: {}",
                    staked_amount, primary_fee
                ),
            },
        )
    })?;

    // Withdraw the token
    withdraw_token(post_fee_amount, from_subaccount)
        .await
        .map_err(|e| {
            ExecutionError::new_with_log(
                caller,
                "un_stake_all_primary",
                ExecutionError::TransferFailed {
                    source: "Canister".to_string(),
                    dest: caller.to_string(),
                    token: "primary".to_string(),
                    amount: post_fee_amount,
                    reason: DEFAULT_TRANSFER_FAILED_ERROR.to_string(),
                    details: e.to_string(),
                },
            )
        })?;
    register_info_log(
        caller,
        "un_stake_all_primary",
        &format!(
            "Successfully withdrawn {} primary to {}.",
            post_fee_amount, caller
        ),
    );

    // Update the stake amount
    let new_amount = current_stake
        .amount
        .checked_sub(staked_amount)
        .ok_or_else(|| {
            ExecutionError::new_with_log(
                caller,
                "un_stake_all_primary",
                ExecutionError::Underflow {
                    operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                    details: format!(
                        "current_stake.amount: {} with staked_amount: {}",
                        current_stake.amount, staked_amount
                    ),
                },
            )
        })?;
    // Update the stake
    STAKES.with(|stakes| {
        let mut stakes_map = stakes.borrow_mut();
        stakes_map.insert(
            caller,
            Stake {
                amount: new_amount,
                time: ic_cdk::api::time(),
                reward_icp: current_stake.reward_icp, // Keep the same reward_icp value
            },
        );
    });
    register_info_log(
        caller,
        "un_stake_all_primary",
        &format!("Successfully unstaked!"),
    );
    Ok("Successfully unstaked!".to_string())
}

// Helper function to update LP provision status in the latest event
async fn update_lp_provision_status(event_id: u64, status: LpProvisionStatus) {
    DISTRIBUTION_EVENTS.with(|events| {
        let mut events_map = events.borrow_mut();
        if let Some(event) = events_map.get(&event_id) {
            let mut event = event.clone();
            event.results.lp_provision_status = status;
            events_map.insert(event_id, event);
        }
    });
}

// This is now an internal function, called by a timer.
async fn provide_liquidity_from_treasury() {
    let treasury_balance = LP_TREASURY.with(|cell| *cell.borrow().get());

    if treasury_balance < MIN_ICP_FOR_PROVISION_E8S {
        return; // Not enough balance, wait for the next scheduled call.
    }
    
    // Get the latest event ID to update
    let latest_event_id = NEXT_EVENT_ID.with(|id| *id.borrow().get()).saturating_sub(1);
    
    let result: Result<String, ExecutionError> = async {
        // Use 2% of the treasury for deployment (1% buyback + 1% LP).
        let deploy_percent = 2;
        
        let primary_token_symbol = get_primary_token_symbol()
            .await
            .map_err(|e| ExecutionError::StateError(format!("Failed to get primary token symbol: {}", e)))?;

        let icp_to_deploy = (treasury_balance * deploy_percent) / 100;
        
        // Check if pool has liquidity
        let pool_reserves = get_pool_reserves().await
            .map_err(|e| ExecutionError::StateError(format!(
                "Failed to get pool reserves: {}. If KongSwap API changed, fallback will be used.", e
            )))?;
        
        if pool_reserves.icp_reserve < 100_000_000 { // Less than 1 ICP
            // Pool has no liquidity - use all 2% to mint tokens and add initial liquidity
            let tokens_to_mint = mint_tokens_with_icp(icp_to_deploy).await
                .map_err(|e| ExecutionError::StateError(format!("Failed to mint tokens with ICP: {}", e)))?;
            
            let lp_result = add_liquidity_to_kong(
                primary_token_symbol.clone(),
                tokens_to_mint,
                Nat::from(icp_to_deploy),
            )
            .await
            .map_err(|e| {
                // Update LP provision status to failed
                let event_id = latest_event_id;
                let error_string = e.to_string();
                ic_cdk::spawn(async move {
                    update_lp_provision_status(
                        event_id,
                        LpProvisionStatus::Failed { reason: error_string }
                    ).await;
                });
                ExecutionError::StateError(format!(
                    "Failed to add initial liquidity to KongSwap pool '{}': {}. Funds are safe and will retry next cycle.", 
                    primary_token_symbol, e
                ))
            })?;
            
            // Update LP provision status to success
            update_lp_provision_status(
                latest_event_id, 
                LpProvisionStatus::Success { lp_tokens: lp_result.add_lp_token_amount.clone() }
            ).await;
            
            // Update treasury balance
            withdraw_from_lp_treasury(icp_to_deploy)?;
            
            return Ok(format!(
                "Successfully bootstrapped pool with {} e8s ICP. Added {} LP tokens.",
                icp_to_deploy, lp_result.add_lp_token_amount
            ));
        }
        
        // Pool has liquidity - proceed with normal buyback and LP provision
        let mut icp_for_buyback = icp_to_deploy / 2;
        let mut icp_for_pairing = icp_to_deploy - icp_for_buyback;
        
        // Check if we have accumulated tokens from previous failed attempts
        let accumulated_tokens = get_accumulated_primary_tokens();
        let mut total_primary_tokens_nat = Nat::from(accumulated_tokens);
        
        // Only buy more if we don't have enough accumulated
        if accumulated_tokens < 1_000_000 { // Less than 0.01 tokens (assuming 8 decimals)
            // 2. Execute buyback on DEX with no slippage protection
            let primary_tokens_bought_nat = execute_swap_on_dex_no_slippage(
                "ICP".to_string(),
                Nat::from(icp_for_buyback),
                primary_token_symbol.clone(),
            )
            .await
            .map_err(|e| ExecutionError::StateError(format!(
                "Failed to execute buyback swap on KongSwap (ICP -> {}): {}. Will retry next cycle.", 
                primary_token_symbol, e
            )))?;

            if primary_tokens_bought_nat == Nat::from(0u32) {
                return Err(ExecutionError::StateError(format!(
                    "Buyback of {} ICP resulted in zero {} tokens. Pool may have insufficient liquidity. Will retry next cycle.",
                    icp_for_buyback / 100_000_000, primary_token_symbol
                )));
            }
            
            total_primary_tokens_nat = total_primary_tokens_nat + primary_tokens_bought_nat;
        } else {
            // We have accumulated tokens, adjust ICP allocation
            // Use all ICP for pairing since we already have tokens
            icp_for_pairing = icp_to_deploy;
        }

        // 3. Add liquidity to DEX with the assets we have.
        // The DEX will handle the ratio, leaving any "dust" unspent.
        let lp_result = match add_liquidity_to_kong(
            primary_token_symbol.clone(),
            total_primary_tokens_nat.clone(),
            Nat::from(icp_for_pairing),
        )
        .await {
            Ok(result) => {
                // Update LP provision status to success
                update_lp_provision_status(
                    latest_event_id, 
                    LpProvisionStatus::Success { lp_tokens: result.add_lp_token_amount.clone() }
                ).await;
                result
            },
            Err(e) => {
                // LP failed - save the primary tokens for next attempt
                let tokens_to_save: u64 = total_primary_tokens_nat.0.try_into()
                    .map_err(|_| ExecutionError::StateError("Could not convert tokens to u64".to_string()))?;
                
                // Only save newly bought tokens (not the ones already accumulated)
                let new_tokens = tokens_to_save.saturating_sub(accumulated_tokens);
                if new_tokens > 0 {
                    add_to_accumulated_primary_tokens(new_tokens)?;
                }
                
                // Update LP provision status to failed
                update_lp_provision_status(
                    latest_event_id,
                    LpProvisionStatus::Failed { reason: e.to_string() }
                ).await;
                
                return Err(ExecutionError::StateError(format!(
                    "Failed to add liquidity to KongSwap pool 'ICP_{}': {}. Saved {} {} tokens for next attempt. No funds lost.", 
                    primary_token_symbol, e, new_tokens / 100_000_000, primary_token_symbol
                )));
            }
        };

        // 4. Update treasury balance with the actual amounts used.
        let icp_provided_for_lp: u64 = lp_result.amount_1.0.try_into()
            .map_err(|_| ExecutionError::StateError("Could not convert LP amount to u64".to_string()))?;

        // Calculate tokens actually used in LP
        let tokens_used_in_lp: u64 = lp_result.amount_0.0.try_into()
            .map_err(|_| ExecutionError::StateError("Could not convert LP token amount to u64".to_string()))?;
        
        // Clear accumulated tokens if we used them
        if accumulated_tokens > 0 {
            let tokens_to_clear = tokens_used_in_lp.min(accumulated_tokens);
            withdraw_from_accumulated_primary_tokens(tokens_to_clear)?;
        }
        
        let final_icp_spent = if accumulated_tokens >= 1_000_000 {
            // We used accumulated tokens, only spent ICP on liquidity
            icp_provided_for_lp
        } else {
            // Normal case - spent on both buyback and liquidity
            icp_for_buyback + icp_provided_for_lp
        };
        
        withdraw_from_lp_treasury(final_icp_spent)?;

        Ok(format!(
            "Successfully deployed {} e8s ICP ({}% of treasury). Used {} primary tokens (including {} accumulated), added {} to LP.",
            final_icp_spent, deploy_percent, tokens_used_in_lp, accumulated_tokens.min(tokens_used_in_lp), lp_result.add_lp_token_amount
        ))
    }.await;
    
    // Log the outcome, regardless of success or failure.
    let principal = get_principal(LBRY_FUN_CANISTER_ID);
    match result {
        Ok(msg) => register_info_log(principal, "provide_liquidity_from_treasury", &msg),
        Err(e) => register_error_log(principal, "provide_liquidity_from_treasury", e),
    }
}


pub async fn distribute_reward() -> Result<String, ExecutionError> {
    register_info_log(
        caller(),
        "distribute_reward",
        "distribute_reward initiated.",
    );
    let intervals = get_distribution_interval();
    let staking_percentage = STAKING_REWARD_PERCENTAGE;
    let mut total_icp_available: u64 = 0;

    match fetch_canister_icp_balance().await {
        
        Ok(bal) => {
            total_icp_available = bal;
        }
        Err(e) => {
            return Err(e);
        }
    }

    let total_unclaimed_icp_reward: u64 = get_total_unclaimed_icp_reward();
    let total_archived_bal: u64 = get_total_archived_balance();

    let unclaimed_icps: u64 = total_unclaimed_icp_reward
        .checked_add(total_archived_bal)
        .ok_or_else(|| {
            ExecutionError::new_with_log(
                caller(),
                "distribute_reward",
                ExecutionError::AdditionOverflow {
                    operation: DEFAULT_ADDITION_OVERFLOW_ERROR.to_string(),
                    details: format!(
                        "total_unclaimed_icp_reward: {} with total_archived_bal: {}",
                        total_unclaimed_icp_reward, total_archived_bal
                    ),
                },
            )
        })?;

    if total_icp_available == 0 || total_icp_available < unclaimed_icps {
        return Err(ExecutionError::new_with_log(
            caller(),
            "distribute_reward",
            ExecutionError::InsufficientCanisterBalance {
                required: 1, // required greater than 0
                available: total_icp_available,
                details: DEFAULT_INSUFFICIENT_CANISTER_BALANCE_ERROR.to_string(),
            },
        ));
    }
    let mut total_icp_allocated: u128 = total_icp_available
        .checked_sub((unclaimed_icps as u128).try_into().unwrap())
        .ok_or_else(|| {
            ExecutionError::new_with_log(
                caller(),
                "distribute_reward",
                ExecutionError::Underflow {
                    operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                    details: format!(
                        "total_icp_available: {} with unclaimed_icps: {}",
                        total_icp_available, unclaimed_icps
                    ),
                },
            )
        })?
        .into();
    total_icp_allocated = total_icp_allocated
        .checked_mul(staking_percentage as u128)
        .ok_or_else(|| {
            ExecutionError::new_with_log(
                caller(),
                "distribute_reward",
                ExecutionError::MultiplicationOverflow {
                    operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                    details: format!(
                        "total_icp_allocated: {} with staking_percentage: {}",
                        total_icp_allocated, staking_percentage
                    ),
                },
            )
        })?;

    total_icp_allocated = total_icp_allocated.checked_div(10000).ok_or_else(|| {
        ExecutionError::new_with_log(
            caller(),
            "distribute_reward",
            ExecutionError::DivisionFailed {
                operation: "ICP allocation calculation".to_string(),
                details: "Please verify the amount is valid and non-zero".to_string(),
            },
        )
    })?;

    // Check if distribution amount is sufficient for viable transfers
    if total_icp_allocated < MIN_DISTRIBUTION_AMOUNT as u128 {
        return Err(ExecutionError::new_with_log(
            caller(),
            "distribute_reward",
            ExecutionError::InsufficientBalanceRewardDistribution {
                available: total_icp_allocated,
                details: format!(
                    "Distribution blocked: {} e8s is below minimum threshold of {} e8s (0.001 ICP) required for viable transfers",
                    total_icp_allocated, MIN_DISTRIBUTION_AMOUNT
                ),
            },
        ));
    }

    // Calculate the 1% fee for the Alexandria project (1% of the distribution, not 1% of 1%).
    // Using 10/1000 = 1/100 = 1% to match the LP treasury pattern
    let alexandria_fee_share = total_icp_allocated.checked_mul(10).ok_or_else(|| ExecutionError::MultiplicationOverflow {
        operation: "distribute_reward".to_string(),
        details: "Failed to calculate alexandria_fee_share multiplication".to_string()
    })?
    .checked_div(1000).ok_or_else(|| ExecutionError::DivisionFailed {
        operation: "distribute_reward".to_string(),
        details: "Failed to calculate alexandria_fee_share".to_string()
    })?;

    // Calculate the 49.5% share for the LP Treasury.
    // Multiplying by 495 and dividing by 1000 is a safe way to handle 49.5%.
    let lp_treasury_share = total_icp_allocated.checked_mul(495).ok_or_else(|| ExecutionError::MultiplicationOverflow {
        operation: "distribute_reward".to_string(),
        details: "Failed to calculate lp_treasury_share".to_string()
    })?
    .checked_div(1000).ok_or_else(|| ExecutionError::DivisionFailed {
        operation: "distribute_reward".to_string(),
        details: "Failed to calculate lp_treasury_share".to_string()
    })?;

    // The remainder is for the stakers. This avoids potential rounding errors.
    let staker_share = total_icp_allocated.checked_sub(alexandria_fee_share).ok_or_else(|| ExecutionError::Underflow {
        operation: "distribute_reward".to_string(),
        details: "Failed to calculate staker_share".to_string()
    })?
    .checked_sub(lp_treasury_share).ok_or_else(|| ExecutionError::Underflow {
        operation: "distribute_reward".to_string(),
        details: "Failed to calculate staker_share".to_string()
    })?;

    // Create distribution event
    let mut event = DistributionEvent {
        event_id: get_next_event_id(),
        timestamp: ic_cdk::api::time(),
        distribution_cycle: intervals,
        total_available: total_icp_allocated as u64,
        allocations: DistributionAllocations {
            alexandria_allocated: alexandria_fee_share as u64,
            lp_treasury_allocated: lp_treasury_share as u64,
            stakers_allocated: staker_share as u64,
        },
        results: DistributionResults {
            alexandria_sent: None,
            lp_treasury_added: 0,
            stakers_distributed: None,
            stakers_rollover: 0,
            lp_provision_status: LpProvisionStatus::Pending,
            error_details: None,
        },
    };

    let lbry_fun_principal = Principal::from_text(LBRY_FUN_CANISTER_ID).expect("Invalid lbry_fun canister principal");

    if alexandria_fee_share > 0 {
        match send_icp(lbry_fun_principal, alexandria_fee_share as u64, None).await {
            Ok(_) => {
                event.results.alexandria_sent = Some(alexandria_fee_share as u64);
                register_info_log(caller(), "distribute_reward", &format!("Successfully sent {} e8s fee to lbry_fun.", alexandria_fee_share));
            },
            Err(e) => {
                // Log the critical error but allow other distributions to proceed
                event.results.error_details = Some(format!("Alexandria: {}", e));
                register_error_log(caller(), "distribute_reward", ExecutionError::TransferFailed {
                    source: "self".to_string(),
                    dest: "lbry_fun".to_string(),
                    token: "ICP".to_string(),
                    amount: alexandria_fee_share as u64,
                    details: e,
                    reason: "Failed to send Alexandria fee".to_string(),
                });
            }
        }
    }
    
    add_to_lp_treasury(lp_treasury_share as u64)?;
    event.results.lp_treasury_added = lp_treasury_share as u64;

    // Now handle staker distribution if there are stakers
    let total_staked_primary = get_total_primary_staked().await? as u128;

    if total_staked_primary == 0 {
        // No stakers, but Alexandria fee and LP treasury have been processed
        event.results.stakers_rollover = staker_share as u64;
        register_info_log(
            caller(),
            "distribute_reward",
            &format!("Distribution complete: Alexandria fee ({} e8s) and LP treasury ({} e8s) processed. No stakers to distribute to.", 
                     alexandria_fee_share, lp_treasury_share),
        );
        
        // Store the event before triggering LP provision
        store_distribution_event(event)?;
        
        // Increment distribution intervals even when no stakers
        add_to_distribution_intervals(1)?;
        
        // Provide liquidity from treasury after distribution
        if LP_TREASURY.with(|cell| *cell.borrow().get()) >= MIN_ICP_FOR_PROVISION_E8S {
            ic_cdk::spawn(async {
                provide_liquidity_from_treasury().await;
            });
        }
        
        return Ok("Reward distribution complete (no stakers)".to_string());
    }

    if staker_share < 1_000_000 {
        return Err(ExecutionError::new_with_log(
            caller(),
            "distribute_reward",
            ExecutionError::InsufficientBalanceRewardDistribution {
                available: staker_share,
                details: DEFAULT_INSUFFICIENT_BALANCE_REWARD_DISTRIBUTION_ERROR.to_string(),
            },
        ));
    }
    let mut icp_reward_per_primary = staker_share
        .checked_mul(SCALING_FACTOR)
        .ok_or_else(||
            ExecutionError::new_with_log(
                caller(),
                "distribute_reward",
                ExecutionError::MultiplicationOverflow {
                    operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                    details: format!(
                        "total_icp_allocated: {} with SCALING_FACTOR: {}",
                        staker_share,
                        SCALING_FACTOR
                    ),
                }
            )
        )?
        .checked_div(total_staked_primary)
        .ok_or_else(||
            ExecutionError::new_with_log(
                caller(),
                "distribute_reward",
                ExecutionError::DivisionFailed {
                    operation: DEFAULT_DIVISION_ERROR.to_string(),
                    details: format!(
                        "total_icp_allocated * SCALING_FACTOR: {} divided by total_staked_primary: {}",
                        staker_share * SCALING_FACTOR,
                        total_staked_primary
                    ),
                }
            )
        )?;

    let mut total_icp_reward: u128 = 0;
    STAKES.with(
        |stakes| -> Result<(), ExecutionError> {
            let mut stakes_map = stakes.borrow_mut();

            let keys: Vec<Principal> = stakes_map
                .iter()
                .map(|(principal, _)| principal.clone())
                .collect();

            for principal in keys {
                // Retrieve.
                if let Some(mut stake) = stakes_map.get(&principal) {
                    let reward = (stake.amount as u128)
                        .checked_mul(icp_reward_per_primary)
                        .ok_or_else(||
                            ExecutionError::new_with_log(
                                caller(),
                                "distribute_reward",
                                ExecutionError::MultiplicationOverflow {
                                    operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                                    details: format!(
                                        "stake.amount: {} with icp_reward_per_primary: {}",
                                        stake.amount,
                                        icp_reward_per_primary
                                    ),
                                }
                            )
                        )?
                        .checked_div(SCALING_FACTOR)
                        .ok_or_else(||
                            ExecutionError::new_with_log(
                                caller(),
                                "distribute_reward",
                                ExecutionError::DivisionFailed {
                                    operation: DEFAULT_DIVISION_ERROR.to_string(),
                                    details: format!(
                                        "stake.amount*icp_reward_per_primary: {} with SCALING_FACTOR: {}",
                                        (stake.amount as u128) * icp_reward_per_primary,
                                        SCALING_FACTOR
                                    ),
                                }
                            )
                        )?;

                    total_icp_reward = total_icp_reward.checked_add(reward).ok_or_else(||
                        ExecutionError::new_with_log(
                            caller(),
                            "distribute_reward",
                            ExecutionError::AdditionOverflow {
                                operation: DEFAULT_ADDITION_OVERFLOW_ERROR.to_string(),
                                details: format!(
                                    "total_icp_reward: {} with total_icp_reward: {}",
                                    total_icp_reward,
                                    total_icp_reward
                                ),
                            }
                        )
                    )?;

                    stake.reward_icp = stake.reward_icp.checked_add(reward as u64).ok_or_else(||
                        ExecutionError::new_with_log(
                            caller(),
                            "distribute_reward",
                            ExecutionError::AdditionOverflow {
                                operation: DEFAULT_ADDITION_OVERFLOW_ERROR.to_string(),
                                details: format!(
                                    "stake.reward_icp: {} with reward: {}",
                                    stake.reward_icp,
                                    reward
                                ),
                            }
                        )
                    )?;

                    // Reinsert the updated stake back into the map.
                    stakes_map.insert(principal, stake);
                }
            }

            Ok(())
        }
    )?;

    let index = intervals % MAX_DAYS;

    APY.with(|apy| {
        let mut apy_map = apy.borrow_mut();
        let mut daily_values = apy_map.get(&index).unwrap_or_default();
        daily_values.values.insert(index, icp_reward_per_primary);
        apy_map.insert(index, daily_values);
    });

    add_to_unclaimed_amount(total_icp_reward as u64)?;
    
    // Record staker distribution in the event
    event.results.stakers_distributed = Some(total_icp_reward as u64);
    
    // Store the event before triggering LP provision
    store_distribution_event(event)?;

    add_to_distribution_intervals(1)?;
    register_info_log(
        caller(),
        "distribute_reward",
        "Successfully distributed reward. Completed.",
    );

    // Provide liquidity from treasury after distribution
    if LP_TREASURY.with(|cell| *cell.borrow().get()) >= MIN_ICP_FOR_PROVISION_E8S {
        ic_cdk::spawn(async {
            provide_liquidity_from_treasury().await;
        });
    }

    Ok("Success".to_string())
}

#[update(guard = "not_anon")]
pub async fn claim_icp_reward(from_subaccount: Option<[u8; 32]>) -> Result<String, ExecutionError> {
    let caller = ic_cdk::caller();
    let _guard =
        CallerGuard::new(caller).map_err(|e| ExecutionError::Unauthorized(e.to_string()))?;
    register_info_log(caller, "claim_icp_reward", "claim_icp_reward initiated.");

    let caller_stake_reward: Option<Stake> = get_stake(caller);
    match caller_stake_reward {
        Some(stake) => {
            if stake.reward_icp <= 1000_000 {
                return Err(ExecutionError::new_with_log(
                    caller,
                    "claim_icp_reward",
                    ExecutionError::MinimumRequired {
                        required: 1000_000,
                        provided: stake.reward_icp,
                        token: "ICP".to_string(),
                        details: DEFAULT_MINIMUM_REQUIRED_ERROR.to_string(),
                    },
                ));
            }
            let mut total_icp_available: u64 = 0;

            match fetch_canister_icp_balance().await {
                Ok(bal) => {
                    total_icp_available = bal;
                }
                Err(e) => {
                    return Err(e);
                }
            }

            if stake.reward_icp > total_icp_available {
                return Err(ExecutionError::new_with_log(
                    caller,
                    "claim_icp_reward",
                    ExecutionError::InsufficientCanisterBalance {
                        required: stake.reward_icp,
                        available: total_icp_available,
                        details: DEFAULT_INSUFFICIENT_CANISTER_BALANCE_ERROR.to_string(),
                    },
                ));
            }
            let amount_after_fee =
                stake
                    .reward_icp
                    .checked_sub(ICP_TRANSFER_FEE)
                    .ok_or_else(|| {
                        ExecutionError::new_with_log(
                            caller,
                            "claim_icp_reward",
                            ExecutionError::Underflow {
                                operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                                details: format!(
                                    "stake.reward_icp: {} with ICP_TRANSFER_FEE: {}",
                                    stake.reward_icp, ICP_TRANSFER_FEE
                                ),
                            },
                        )
                    })?;
            send_icp(caller, amount_after_fee, from_subaccount)
                .await
                .map_err(|e| {
                    ExecutionError::new_with_log(
                        caller,
                        "claim_icp_reward",
                        ExecutionError::TransferFailed {
                            source: "canister".to_string(),
                            dest: caller.to_string(),
                            token: "ICP".to_string(),
                            amount: amount_after_fee,
                            details: e.to_string(),
                            reason: DEFAULT_TRANSFER_FAILED_ERROR.to_string(),
                        },
                    )
                })?;
            register_info_log(
                caller,
                "claim_icp_reward",
                &format!(
                    "Successfully sent {} ICP (e8s) to {}",
                    amount_after_fee, caller
                ),
            );
            sub_to_unclaimed_amount(stake.reward_icp)?;

            STAKES.with(|stakes| {
                let mut stakes_map = stakes.borrow_mut();

                // Get the current stake for the caller, or insert a new one if it doesn't exist.
                let mut current_stake = stakes_map.get(&caller).unwrap_or(Stake {
                    amount: 0,
                    time: ic_cdk::api::time(),
                    reward_icp: 0,
                });

                current_stake.reward_icp = 0;

                // Reinsert the updated stake back into the map.
                stakes_map.insert(caller, current_stake);
            });
            register_info_log(
                caller,
                "claim_icp_reward",
                "Claim process completed successfully.",
            );
            Ok("Success".to_string())
        }
        None => {
            // User doesn't have a stake
            return Err(ExecutionError::new_with_log(
                caller,
                "claim_icp_reward",
                ExecutionError::StateError("No staking record found for caller".to_string()),
            ));
        }
    }
}

pub async fn get_icp_rate_in_cents() -> Result<u64, ExecutionError> {
    register_info_log(
        caller(),
        "get_icp_rate_in_cents",
        "get_icp_rate_in_cents initiated.",
    );

    let request: GetExchangeRateRequest = GetExchangeRateRequest {
        base_asset: Asset {
            symbol: "ICP".to_string(),
            class: AssetClass::Cryptocurrency,
        },
        quote_asset: Asset {
            symbol: "USDT".to_string(),
            class: AssetClass::Cryptocurrency,
        },
        timestamp: None,
    };

    let xrc_canister_id = Principal::from_text(XRC_CANISTER_ID).unwrap();

    let call_result: Result<Vec<u8>, (ic_cdk::api::call::RejectionCode, String)> =
        ic_cdk::api::call::call_raw(
            xrc_canister_id,
            "get_exchange_rate",
            &candid::encode_args((request,)).unwrap(),
            BURN_CYCLE_FEE, // payment fee
        )
        .await;

    match call_result {
        Ok(response_bytes) => match candid::decode_one::<XRCResponse>(&response_bytes) {
            Ok(response) => {
                match response {
                    XRCResponse::Ok(exchange_rate) => {
                        let divisor: u64 = (10_u64).pow(
                                exchange_rate.metadata.decimals.checked_sub(2).ok_or_else(||
                                    ExecutionError::new_with_log(
                                        caller(),
                                        "get_icp_rate_in_cents",
                                        ExecutionError::Underflow {
                                            operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                                            details: format!(
                                                "exchange_rate.metadata.decimals: {} with ICP_TRANSFER_FEE: {}",
                                                exchange_rate.metadata.decimals,
                                                ICP_TRANSFER_FEE
                                            ),
                                        }
                                    )
                                )?
                            );
                        let mut price_in_cents =
                            exchange_rate.rate.checked_div(divisor).ok_or_else(|| {
                                ExecutionError::new_with_log(
                                    caller(),
                                    "get_icp_rate_in_cents",
                                    ExecutionError::DivisionFailed {
                                        operation: DEFAULT_DIVISION_ERROR.to_string(),
                                        details: format!(
                                            "exchange_rate.rate: {} with divisor: {}",
                                            exchange_rate.rate, divisor
                                        ),
                                    },
                                )
                            })?;
                        if price_in_cents < 400 {
                            price_in_cents = 400;
                        }
                        let time =
                            ic_cdk::api::time()
                                .checked_div(1_000_000_000)
                                .ok_or_else(|| {
                                    ExecutionError::new_with_log(
                                        caller(),
                                        "get_icp_rate_in_cents",
                                        ExecutionError::DivisionFailed {
                                            operation: DEFAULT_DIVISION_ERROR.to_string(),
                                            details: format!(
                                                "time: {} with divisor: {}",
                                                ic_cdk::api::time(),
                                                1_000_000_000
                                            ),
                                        },
                                    )
                                })?;
                        // Update the closure to handle potential errors
                        update_current_secondary_ratio(price_in_cents, time)?;
                        register_info_log(
                                caller(),
                                "get_icp_rate_in_cents",
                                &format!("get_icp_rate_in_cents process completed successfully.Got {} ICP price in cents", price_in_cents)
                            );

                        Ok(price_in_cents)
                    }
                    XRCResponse::Err(err) => Err(ExecutionError::new_with_log(
                        caller(),
                        "get_icp_rate_in_cents",
                        ExecutionError::StateError(format!("Error in XRC response: {:?}", err)),
                    )),
                }
            }
            Err(_e) => Err(ExecutionError::new_with_log(
                caller(),
                "get_icp_rate_in_cents",
                ExecutionError::StateError("Error in decoding XRC response".to_string()),
            )),
        },
        Err((_rejection_code, msg)) => Err(ExecutionError::new_with_log(
            caller(),
            "get_icp_rate_in_cents",
            ExecutionError::StateError(format!("Error call rejected: {}", msg)),
        )),
    }
}

#[update(guard = "not_anon")]
pub async fn redeem(from_subaccount: Option<[u8; 32]>) -> Result<String, ExecutionError> {
    let caller = ic_cdk::caller();
    let _guard =
        CallerGuard::new(caller).map_err(|e| ExecutionError::Unauthorized(e.to_string()))?;
    register_info_log(caller, "redeem", "Redeem initiated.");

    let caller_archive_profile: Option<ArchiveBalance> = get_user_archive_balance(caller);
    match caller_archive_profile {
        Some(trx) => {
            if trx.icp <= 0 {
                return Err(ExecutionError::new_with_log(
                    caller,
                    "redeem",
                    ExecutionError::InsufficientBalance {
                        required: 1, //Minimum amount
                        available: trx.icp,
                        token: "ICP".to_string(),
                        details: DEFAULT_INSUFFICIENT_BALANCE_ERROR.to_string(),
                    },
                ));
            }
            let mut total_icp_available: u64 = 0;

            match fetch_canister_icp_balance().await {
                Ok(bal) => {
                    total_icp_available = bal;
                }
                Err(e) => {
                    return Err(e);
                }
            }

            if trx.icp > total_icp_available {
                return Err(ExecutionError::new_with_log(
                    caller,
                    "redeem",
                    ExecutionError::InsufficientCanisterBalance {
                        required: trx.icp,
                        available: total_icp_available,
                        details: DEFAULT_INSUFFICIENT_CANISTER_BALANCE_ERROR.to_string(),
                    },
                ));
            }
            send_icp(caller, trx.icp, from_subaccount)
                .await
                .map_err(|e| {
                    ExecutionError::new_with_log(
                        caller,
                        "redeem",
                        ExecutionError::TransferFailed {
                            source: "canister".to_string(),
                            dest: caller.to_string(),
                            token: "ICP".to_string(),
                            amount: trx.icp,
                            details: e.to_string(),
                            reason: DEFAULT_TRANSFER_FAILED_ERROR.to_string(),
                        },
                    )
                })?;
            register_info_log(
                caller,
                "claim_icp_reward",
                &format!(
                    "Successfully sent {} ICP (e8s) exculisve of fee to {}",
                    trx.icp, caller
                ),
            );
            sub_to_total_archived_balance(trx.icp)?;

            // make balance to 0
            ARCHIVED_TRANSACTION_LOG.with(|trxs| -> Result<(), ExecutionError> {
                let mut trxs = trxs.borrow_mut();

                let mut user_archive = trxs.get(&caller).unwrap_or(ArchiveBalance { icp: 0 });
                user_archive.icp = 0;

                trxs.insert(caller, user_archive);

                Ok(())
            })?;

            Ok("Success".to_string())
        }
        None => {
            return Err(ExecutionError::new_with_log(
                caller,
                "redeem",
                ExecutionError::StateError("No Reedem record found for caller".to_string()),
            ));
        }
    }
}

async fn withdraw_token(
    amount: u64,
    from_subaccount: Option<[u8; 32]>,
) -> Result<BlockIndex, TransferFromError> {
    let caller: Principal = caller();
    let canister_id: Principal = ic_cdk::api::id();
    let primary_token_id = get_config().primary_token_id;

    let primary_fee = PRIMARY_FEE.with(|fee| *fee.borrow());

    let amount: Nat = Nat::from(amount);
    if amount <= Nat::from(0 as u8) {
        return Err(TransferFromError::GenericError {
            message: format!("Minimum {} e8s required!", 1),
            error_code: Nat::from(1 as u8),
        });
    }
    let transfer_from_args: TransferFromArgs = TransferFromArgs {
        from: canister_id.into(),
        memo: None,
        amount,
        spender_subaccount: None,
        fee: Some(Nat::from(primary_fee)),
        to: Account {
            owner: caller,
            subaccount: from_subaccount,
        },
        created_at_time: None,
    };

    let (result,): (Result<BlockIndex, TransferFromError>,) = ic_cdk::call::<(TransferFromArgs,), (Result<BlockIndex, TransferFromError>,)>(
        primary_token_id,
        "icrc2_transfer_from",
        (transfer_from_args,),
    )
    .await
    .map_err(|_| TransferFromError::GenericError {
        message: "Call failed".to_string(),
        error_code: Nat::from(0 as u32),
    })?;

    result
}

async fn deposit_token(
    amount: u64,
    from_subaccount: Option<[u8; 32]>,
) -> Result<BlockIndex, TransferFromError> {
    let primary_token_id = get_config().primary_token_id;

    let caller: Principal = caller();
    let canister_id: Principal = ic_cdk::api::id();
    let primary_fee = PRIMARY_FEE.with(|fee| *fee.borrow());
    let amount = Nat::from(amount);
    if amount < Nat::from(0 as u8) {
        return Err(TransferFromError::GenericError {
            message: format!("Minimum {} e8s required!", primary_fee + 1),
            error_code: Nat::from(1 as u8),
        });
    }
    let transfer_from_args: TransferFromArgs = TransferFromArgs {
        from: Account {
            owner: caller,
            subaccount: from_subaccount,
        },
        memo: None,
        amount,
        spender_subaccount: None,
        fee: Some(Nat::from(primary_fee)),
        to: canister_id.into(),
        created_at_time: None,
    };

    let (result,) = ic_cdk::call::<(TransferFromArgs,), (Result<BlockIndex, TransferFromError>,)>(
        primary_token_id,
        "icrc2_transfer_from",
        (transfer_from_args,),
    )
    .await
    .map_err(|_| TransferFromError::GenericError {
        message: "Call failed".to_string(),
        error_code: Nat::from(0 as u32),
    })?;

    result
}

async fn burn_token(
    amount: u64,
    from_subaccount: Option<[u8; 32]>,
) -> Result<BlockIndex, TransferFromError> {
    let canister_id: Principal = ic_cdk::api::id();
    let secondary_token_id = get_config().secondary_token_id;
    let big_int_amount: BigUint = BigUint::from(amount);
    let amount: Nat = Nat(big_int_amount);

    let transfer_from_args = TransferFromArgs {
        from: Account {
            owner: ic_cdk::caller(),
            subaccount: from_subaccount,
        },
        // can be used to distinguish between transactions
        memo: None,
        // the amount we want to transfer
        amount,
        // the subaccount we want to spend the tokens from (in this case we assume the default subaccount has been approved)
        spender_subaccount: None,
        // if not specified, the default fee for the canister is used
        fee: None,
        // the account we want to transfer tokens to
        to: canister_id.into(),
        // a timestamp indicating when the transaction was created by the caller; if it is not specified by the caller then this is set to the current ICP time
        created_at_time: None,
    };

    // 1. Asynchronously call another canister function using `ic_cdk::call`.
    let (result,) = ic_cdk::call::<(TransferFromArgs,), (Result<BlockIndex, TransferFromError>,)>(
        // 2. Convert a textual representation of a Principal into an actual `Principal` object. The principal is the one we specified in `dfx.json`.
        //    `expect` will panic if the conversion fails, ensuring the code does not proceed with an invalid principal.
        secondary_token_id,
        // 3. Specify the method name on the target canister to be called, in this case, "icrc1_transfer".
        "icrc2_transfer_from",
        // 4. Provide the arguments for the call in a tuple, here `transfer_args` is encapsulated as a single-element tuple.
        (transfer_from_args,),
    )
    .await
    .map_err(|_| TransferFromError::GenericError {
        message: "Call failed".to_string(),
        error_code: Nat::from(0 as u32),
    })?;

    result // Return the inner Result<BlockIndex, TransferFromError>
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
    Other { code: u32, description: String },
    ForexInvalidTimestamp,
    NotEnoughCycles,
    ForexQuoteAssetNotFound,
    StablecoinRateNotFound,
    Pending,
}

#[derive(CandidType, Deserialize)]
pub enum XRCResponse {
    Ok(ExchangeRateResponse),
    Err(ExchangeRateError),
}

// Development-only method to manually trigger distribution
// WARNING: This should NOT be included in production builds
#[update]
pub async fn dev_trigger_distribution() -> Result<String, String> {
    // In production, this should check if caller is authorized or return error
    distribute_reward().await
        .map_err(|e| format!("Distribution failed: {}", e))
}
