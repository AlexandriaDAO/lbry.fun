use crate::{
    get_current_secondary_ratio,
    get_distribution_interval,
    get_total_archived_balance,
    get_total_unclaimed_icp_reward,
    guard::*,
    ExecutionError,
    DEFAULT_ADDITION_OVERFLOW_ERROR,
    DEFAULT_BURN_FAILED_ERROR,
    DEFAULT_DIVISION_ERROR,
    DEFAULT_INSUFFICIENT_BALANCE_ERROR,
    DEFAULT_INSUFFICIENT_BALANCE_REWARD_DISTRIBUTION_ERROR,
    DEFAULT_INSUFFICIENT_CANISTER_BALANCE_ERROR,
    DEFAULT_INVALID_AMOUNT_ERROR,
    DEFAULT_MINIMUM_REQUIRED_ERROR,
    DEFAULT_MINT_FAILED,
    DEFAULT_MULTIPLICATION_OVERFLOW_ERROR,
    DEFAULT_TRANSFER_FAILED_ERROR,
    DEFAULT_UNDERFLOW_ERROR,
};
use crate::{ get_stake, storage::* };
use crate::storage::add_to_total_claimed_rewards;
use crate::{ get_user_archive_balance, utils::{*, check_can_trade} };
use candid::{ CandidType, Nat, Principal };
use ic_cdk::{ self, caller, update };
use ic_ledger_types::{
    MAINNET_LEDGER_CANISTER_ID,
};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{ BlockIndex, TransferArg, TransferError };
use icrc_ledger_types::icrc2::transfer_from::{ TransferFromArgs, TransferFromError };
use num_bigint::BigUint;
use serde::Deserialize;

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

#[derive(CandidType, Deserialize, Debug)]
pub enum XRCResponse {
    Ok(ExchangeRateResponse),
    Err(ExchangeRateError),
}
#[derive(CandidType, Deserialize)]
pub struct GetExchangeRateRequest {
    base_asset: Asset,
    quote_asset: Asset,
    timestamp: Option<u64>,
}

// Tokenomics ExecutionError type that matches the new_tokenomics canister's error enum
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
    NoMorePrimaryCanBeMinted {
        reason: String,
    },
}

//swap
#[update(guard = "not_anon")]
pub async fn swap(
    amount_icp: u64,
    from_subaccount: Option<[u8; 32]>
) -> Result<String, ExecutionError> {
    // Check if trading is allowed
    check_can_trade().await?;
    
    let caller = ic_cdk::caller();
    let _guard = CallerGuard::new(caller).map_err(|e| ExecutionError::Unauthorized(e.to_string()))?;
    register_info_log(caller, "swap", &format!("Swap initiated: {}  ICP (e8s)", amount_icp));
    if amount_icp < 10_000_000 {
        return Err(
            ExecutionError::new_with_log(caller, "swap", ExecutionError::MinimumRequired {
                required: 10_000_000,
                provided: amount_icp,
                token: "ICP".to_string(),
                details: DEFAULT_MINIMUM_REQUIRED_ERROR.to_string(),
            })
        );
    }

    deposit_icp_in_canister(amount_icp, from_subaccount).await.map_err(|e| 
        ExecutionError::new_with_log(caller, "swap", ExecutionError::TransferFailed {
            source: caller.to_string(),
            dest: "canister".to_string(),
            token: "ICP".to_string(),
            amount: amount_icp,
            details: e.to_string(),
            reason: DEFAULT_TRANSFER_FAILED_ERROR.to_string(),
        })
    )?;
    register_info_log(
        caller,
        "swap",
        &format!("Successfully deposited {} ICP (e8s) into canister", amount_icp)
    );
    
    // Add the deposited ICP to the reward pool for distribution
    REWARD_POOL.with(|p| {
        let current = p.borrow().get(&()).unwrap_or(0);
        let new_total = current.saturating_add(amount_icp);
        p.borrow_mut().insert((), new_total);
    });
    register_info_log(
        caller,
        "swap",
        &format!("Added {} ICP (e8s) to reward pool", amount_icp)
    );
    
    let icp_rate_in_cents: u64 = get_current_secondary_ratio().ok_or_else(|| 
        ExecutionError::new_with_log(caller, "swap", ExecutionError::StateError(
            "Exchange rate not yet available. Please try again in a few moments.".to_string()
        ))
    )?;
    // checke here if return
    let secondary_amount: u64 = amount_icp.checked_mul(icp_rate_in_cents).ok_or_else(|| 
        ExecutionError::new_with_log(caller, "swap", ExecutionError::MultiplicationOverflow {
            operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
            details: format!(
                "amount_icp: {} with icp_rate_in_cents: {}",
                amount_icp,
                icp_rate_in_cents
            ),
        })
    )?;

    match mint_secondary(secondary_amount).await {
        Ok(_) => {
            register_info_log(
                caller,
                "swap",
                &format!(
                    "Successfully swapped {} ICP (e8s) for {} secondary (e8s) tokens",
                    amount_icp,
                    secondary_amount
                )
            );
        }
        Err(e) => {
            // If there was an error, log it in archive trx and return an error result
            let amount_icp_after_fee = amount_icp.checked_sub(ICP_TRANSFER_FEE).ok_or_else(||
                ExecutionError::new_with_log(caller, "swap", ExecutionError::Underflow {
                    operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                    details: format!(
                        "amount_icp: {} with ICP_TRANSFER_FEE: {}",
                        amount_icp,
                        ICP_TRANSFER_FEE
                    ),
                })
            )?;

            archive_user_transaction(amount_icp_after_fee)?;

            return Err(
                ExecutionError::new_with_log(caller, "swap", ExecutionError::MintFailed {
                    token: "secondary".to_string(),
                    amount: secondary_amount,
                    reason: "secondary ".to_string() + DEFAULT_MINT_FAILED,
                    details: e.to_string(),
                })
            );
        }
    }

    Ok("Swapped Successfully!".to_string())
}

#[allow(non_snake_case)]
#[update(guard = "not_anon")]
pub async fn burn_secondary(
    amount_secondary: u64,
    from_subaccount: Option<[u8; 32]>
) -> Result<String, ExecutionError> {
    // Check if trading is allowed
    check_can_trade().await?;
    
    let caller = ic_cdk::caller();
    let _guard = CallerGuard::new(caller).map_err(|e| ExecutionError::Unauthorized(e.to_string()))?;
    register_info_log(
        caller,
        "burn_secondary",
        &format!("burn_secondary initiated: {} secondary ", amount_secondary)
    );

    if amount_secondary < 1 {
        return Err(
            ExecutionError::new_with_log(caller, "burn_secondary", ExecutionError::MinimumRequired {
                required: 1,
                provided: amount_secondary,
                token: "secondary".to_string(),
                details: DEFAULT_MINIMUM_REQUIRED_ERROR.to_string(),
            })
        );
    }

    //Dynamic price
    let mut icp_rate_in_cents: u64 = get_current_secondary_ratio().ok_or_else(|| 
        ExecutionError::new_with_log(caller, "burn_secondary", ExecutionError::StateError(
            "Exchange rate not yet available. Please try again in a few moments.".to_string()
        ))
    )?;
    let mut amount_icp_e8s = amount_secondary.checked_mul(100_000_000).ok_or_else(|| {
        ExecutionError::new_with_log(caller, "burn_secondary", ExecutionError::MultiplicationOverflow {
            operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
            details: format!("amount_secondary: {} with : {}", amount_secondary, 100_000_000),
        })
    })?;
    icp_rate_in_cents = icp_rate_in_cents.checked_mul(2).ok_or_else(||
        ExecutionError::new_with_log(caller, "burn_secondary", ExecutionError::MultiplicationOverflow {
            operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
            details: format!("icp_rate_in_cents: {} with  {}", amount_secondary, 2),
        })
    )?;
    amount_icp_e8s = amount_icp_e8s.checked_div(icp_rate_in_cents).ok_or_else(||
        ExecutionError::new_with_log(caller, "burn_secondary", ExecutionError::DivisionFailed {
            operation: DEFAULT_DIVISION_ERROR.to_string(),
            details: format!(
                "amount_icp_e8s: {} with icp_rate_in_cents: {}",
                amount_icp_e8s,
                icp_rate_in_cents
            ),
        })
    )?;

    if amount_icp_e8s == 0 {
        return Err(
            ExecutionError::new_with_log(caller, "burn_secondary", ExecutionError::InvalidAmount {
                amount: amount_icp_e8s,
                reason: DEFAULT_INVALID_AMOUNT_ERROR.to_string(),
                details: format!("Calculated ICP amount:{} too small", amount_icp_e8s),
            })
        );
    }

    let total_icp_available: u64 = match fetch_canister_icp_balance().await {
        Ok(bal) => bal,
        Err(e) => {
            return Err(e);
        }
    };
    let total_archived_bal: u64 = get_total_archived_balance();

    let total_unclaimed_icp: u128 = get_total_unclaimed_icp_reward();

    let mut remaining_icp: u64 = total_icp_available.checked_sub(total_unclaimed_icp.try_into().map_err(|_| 
        ExecutionError::new_with_log(caller, "burn_secondary", ExecutionError::ConversionError {
            details: "Total unclaimed ICP exceeds u64 max".to_string()
        })
    )?).ok_or_else(||
        ExecutionError::new_with_log(caller, "burn_secondary", ExecutionError::Underflow {
            operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
            details: format!(
                "total_icp_available: {} with total_unclaimed_icp: {}",
                total_icp_available,
                total_unclaimed_icp
            ),
        })
    )?;
    remaining_icp = remaining_icp.checked_sub(total_archived_bal).ok_or_else(||
        ExecutionError::new_with_log(caller, "burn_secondary", ExecutionError::Underflow {
            operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
            details: format!(
                "remaining_icp: {} with total_archived_bal: {}",
                remaining_icp,
                total_archived_bal
            ),
        })
    )?;

    // For burns, we only need to ensure we have enough ICP to pay out
    // No need to reserve 50% since burning increases our ICP reserves
    if amount_icp_e8s > remaining_icp {
        return Err(
            ExecutionError::new_with_log(
                caller,
                "burn_secondary",
                ExecutionError::InsufficientCanisterBalance {
                    required: amount_icp_e8s,
                    available: remaining_icp,
                    details: DEFAULT_INSUFFICIENT_CANISTER_BALANCE_ERROR.to_string(),
                }
            )
        );
    }

    let amount_secondary_e8s = amount_secondary
        .checked_mul(E8S) // Convert to E8S (smallest unit)
        .ok_or_else(||
            ExecutionError::new_with_log(
                caller,
                "burn_secondary",
                ExecutionError::MultiplicationOverflow {
                    operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                    details: format!("amount_secondary: {} with {}", amount_secondary, 100_000_000),
                }
            )
        )?;

    burn_token(amount_secondary_e8s, from_subaccount).await.map_err(|e|
        ExecutionError::new_with_log(caller, "burn_secondary", ExecutionError::BurnFailed {
            token: "secondary".to_string(),
            amount: amount_secondary,
            details: e.to_string(),
            reason: DEFAULT_BURN_FAILED_ERROR.to_string(),
        })
    )?;
    register_info_log(
        caller,
        "burn_secondary",
        &format!(
            "Successfully burned {} secondary tokens ({} e8s). Preparing to send {} ICP (e8s).",
            amount_secondary,
            amount_secondary_e8s,
            amount_icp_e8s
        )
    );
    // Is this the problem since from_subaccount is alice/bob/etc.?
    match send_icp(caller, amount_icp_e8s, None).await {
        Ok(_) => {
            register_info_log(
                caller,
                "burn_secondary",
                &format!("Successfully sent {} ICP (e8s) to {}", amount_icp_e8s, caller)
            );
            
            // Deduct the refunded ICP from the reward pool
            // This is necessary because the ICP was originally added to the pool during swap
            // but when we refund 50% during burn, we need to remove it from the pool
            REWARD_POOL.with(|p| -> Result<(), ExecutionError> {
                let current = p.borrow().get(&()).unwrap_or(0);
                if current < amount_icp_e8s {
                    return Err(ExecutionError::new_with_log(
                        caller,
                        "burn_secondary", 
                        ExecutionError::InsufficientBalance {
                            required: amount_icp_e8s,
                            available: current,
                            token: "reward_pool".to_string(),
                            details: "Reward pool has insufficient funds for refund".to_string()
                        }
                    ));
                }
                let new_total = current - amount_icp_e8s;
                p.borrow_mut().insert((), new_total);
                Ok(())
            })?;
            register_info_log(
                caller,
                "burn_secondary",
                &format!("Deducted {} ICP (e8s) from reward pool for burn refund", amount_icp_e8s)
            );
        }
        Err(e) => {
            // Archive the full amount - no fee was paid on failed transfer
            archive_user_transaction(amount_icp_e8s)?;
            return Err(
                ExecutionError::new_with_log(caller, "burn_secondary", ExecutionError::TransferFailed {
                    source: "canister".to_string(),
                    dest: caller.to_string(),
                    token: "ICP".to_string(),
                    amount: amount_icp_e8s,
                    details: e,
                    reason: DEFAULT_TRANSFER_FAILED_ERROR.to_string(),
                })
            );
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
                    &format!("Burn completed successfully.Minted primary tokens to {}", caller)
                );
            }
            Err(e) => {
                // Check if error is due to max supply being reached
                let error_reason = if e.contains("Maximum primary token supply reached") || e.contains("Max primary reached") {
                    "Maximum primary supply reached. You received your ICP refund but no primary tokens were minted."
                } else {
                    "Primary token minting failed. You already received your ICP refund."
                };
                
                // Do not archive - user already received ICP refund
                return Err(
                    ExecutionError::new_with_log(caller, "burn_secondary", ExecutionError::MintFailed {
                        token: "primary".to_string(),
                        amount: amount_secondary,
                        details: e,
                        reason: error_reason.to_string(),
                    })
                );
            }
        }
    // } 
    // // else {
    // //     // primary fully minted
    // //     register_info_log(
    // //         caller,
    //         "burn_secondary",
    //         &format!("Burn completed successfully. No more primary tokens can be minted.")
    //     );
    // }

    Ok("Burn Successfully!".to_string())
}

#[allow(non_snake_case)]
async fn mint_secondary(amount: u64) -> Result<BlockIndex, TransferError> {
    let caller: Principal = caller();
    let amount = Nat::from(amount);

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

    // Get secondary token canister ID from configs
    let secondary_token_id = CONFIGS.with(|configs| {
        configs.borrow()
            .get(&())
            .map(|c| c.secondary_token_id)
            .ok_or_else(|| TransferError::GenericError {
                error_code: 1u64.into(),
                message: "Secondary token ID not configured".to_string()
            })
    })?;

    // 1. Asynchronously call another canister function using `ic_cdk::call`.
    let result = ic_cdk
        ::call::<(TransferArg,), (Result<BlockIndex, TransferError>,)>(
            secondary_token_id,
            // 3. Specify the method name on the target canister to be called, in this case, "icrc1_transfer".
            "icrc1_transfer",
            // 4. Provide the arguments for the call in a tuple, here `transfer_args` is encapsulated as a single-element tuple.
            (transfer_args,)
        ).await
        .map_err(|_| TransferError::GenericError {
            message: "Call failed".to_string(),
            error_code: Nat::from(0 as u32),
        })?;
    result.0
}

async fn deposit_icp_in_canister(
    amount: u64,
    from_subaccount: Option<[u8; 32]>
) -> Result<BlockIndex, TransferFromError> {
    let canister_id = ic_cdk::api::id();
    let caller = ic_cdk::caller();
    
    // Get ICP ledger canister ID from configs or use default
    let icp_ledger_id = CONFIGS.with(|configs| {
        configs.borrow()
            .get(&())
            .map(|c| c.icp_ledger_id)
            .unwrap_or_else(|| MAINNET_LEDGER_CANISTER_ID)
    });

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

    let (result,): (Result<BlockIndex, TransferFromError>,) = ic_cdk
        ::call(icp_ledger_id, "icrc2_transfer_from", (transfer_args,)).await
        .map_err(|_| TransferFromError::GenericError {
            message: "Call failed".to_string(),
            error_code: Nat::from(0 as u32),
        })?;

    result // Return the inner Result<BlockIndex, TransferFromError>
}

async fn send_icp(
    destination: Principal,
    amount: u64,
    from_subaccount: Option<[u8; 32]>
) -> Result<BlockIndex, String> {
    // Get ICP ledger canister ID from configs or use default
    let icp_ledger_id = CONFIGS.with(|configs| {
        configs.borrow()
            .get(&())
            .map(|c| c.icp_ledger_id)
            .unwrap_or_else(|| MAINNET_LEDGER_CANISTER_ID)
    });

    let transfer_args = TransferArg {
        amount: Nat::from(amount),
        from_subaccount: from_subaccount.map(|s| s.into()),
        fee: Some(Nat::from(ICP_TRANSFER_FEE)),
        to: Account {
            owner: destination,
            subaccount: None,
        },
        created_at_time: None,
        memo: None,
    };

    // Call icrc1_transfer on the ICP ledger
    let result = ic_cdk
        ::call::<(TransferArg,), (Result<BlockIndex, TransferError>,)>(
            icp_ledger_id,
            "icrc1_transfer",
            (transfer_args,)
        ).await
        .map_err(|e| format!("failed to call ledger: {:?}", e))?;
    
    result.0.map_err(|e| format!("ledger transfer error {:?}", e))
}

#[allow(non_snake_case)]
async fn mint_primary(
    secondary_amount: u64,
    caller: Principal,
    to_subaccount: Option<[u8; 32]>
) -> Result<String, String> {
    // Get tokenomics canister ID from configs
    let tokenomics_canister_id = CONFIGS.with(|configs| {
        configs.borrow()
            .get(&())
            .map(|c| c.tokenomics_canister_id)
            .ok_or_else(|| "Tokenomics canister ID not configured".to_string())
    })?;

    // Prepare arguments and call tokenomics canister
    let args = (secondary_amount, caller, to_subaccount);
    let args_bytes = candid::encode_args(args).expect("Failed to encode arguments");
    
    let result = ic_cdk::api::call::call_raw(
        tokenomics_canister_id,
        "mint_primary",
        &args_bytes,
        0,
    ).await;

    match result {
        Ok(bytes) => {
            // Decode the response which returns Result<String, TokenomicsExecutionError>
            match candid::decode_one::<Result<String, TokenomicsExecutionError>>(&bytes) {
                Ok(Ok(success_msg)) => Ok(success_msg),
                Ok(Err(exec_err)) => {
                    // Convert tokenomics error to user-friendly error message
                    match exec_err {
                        TokenomicsExecutionError::MintFailed { token, amount, reason, details } => {
                            Err(format!("Mint failed for {} {} tokens: {} - {}", 
                                amount, token, reason, details))
                        },
                        TokenomicsExecutionError::MaxMintPrimaryReached { reason } => {
                            Err(format!("Maximum primary token supply reached: {}", reason))
                        },
                        TokenomicsExecutionError::MaxPrimaryPerTrnxReached { reason } => {
                            Err(format!("Transaction exceeds maximum allowed per transaction: {}", reason))
                        },
                        TokenomicsExecutionError::NoMorePrimaryCanBeMinted { reason } => {
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
            ic_cdk::println!("Error calling tokenomics: {:?}", msg);
            Err(format!(
                "Failed to call tokenomics: (code: {:?}, message: \"{}\")",
                code, msg
            ))
        }
    }
}
//stake //
#[allow(non_snake_case)]
#[update(guard = "not_anon")]
async fn stake_primary(
    amount: u64,
    from_subaccount: Option<[u8; 32]>
) -> Result<String, ExecutionError> {
    let caller = ic_cdk::caller();
    let _guard = CallerGuard::new(caller).map_err(|e| ExecutionError::Unauthorized(e.to_string()))?;
    register_info_log(caller, "stake_primary", &format!("Staking initiated: {} primary", amount));
    let mut primary_fee = PRIMARY_FEE.with(|fee| *fee.borrow());
    if amount < 100_000_000 {
        return Err(
            ExecutionError::new_with_log(caller, "stake_primary", ExecutionError::MinimumRequired {
                required: 100_000_000,
                provided: amount,
                token: "primary".to_string(),
                details: DEFAULT_MINIMUM_REQUIRED_ERROR.to_string(),
            })
        );
    }

    if primary_fee == 0 {
        let fee: u64 = get_primary_fee().await?;
        update_primary_fee(fee)?;
        primary_fee = fee;
    }

    let post_fee_amount = amount.checked_sub(primary_fee).ok_or_else(||
        ExecutionError::new_with_log(caller, "stake_primary", ExecutionError::Underflow {
            operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
            details: format!("amount: {} with primary_fee: {}", amount, primary_fee),
        })
    )?;
    // Proceed with transfer
    deposit_token(post_fee_amount, from_subaccount).await.map_err(|e|
        ExecutionError::new_with_log(caller, "stake_primary", ExecutionError::TransferFailed {
            source: caller.to_string(),
            dest: "canister".to_string(),
            token: "primary".to_string(),
            amount: post_fee_amount,
            details: e.to_string(),
            reason: DEFAULT_TRANSFER_FAILED_ERROR.to_string(),
        })
    )?;
    register_info_log(
        caller,
        "stake_primary",
        &format!("Successfully transferred {} primary (e8s) to canister", post_fee_amount)
    );
    let current_time = ic_cdk::api::time();
    STAKES.with(
        |stakes| -> Result<(), ExecutionError> {
            let mut stakes_map = stakes.borrow_mut();

            let updated_stake = match stakes_map.get(&caller) {
                Some(existing_stake) => {
                    let mut updated = existing_stake.clone();
                    updated.amount = updated.amount.checked_add(post_fee_amount).ok_or_else(||
                        ExecutionError::new_with_log(
                            caller,
                            "stake_primary",
                            ExecutionError::AdditionOverflow {
                                operation: DEFAULT_ADDITION_OVERFLOW_ERROR.to_string(),
                                details: format!(
                                    "updated.amount: {} with post_fee_amount: {}",
                                    updated.amount,
                                    post_fee_amount
                                ),
                            }
                        )
                    )?;
                    updated.time = current_time;

                    register_info_log(
                        caller,
                        "stake_primary",
                        &format!(
                            "Successfully staked {} primary. Total staked: {} primary.",
                            post_fee_amount,
                            updated.amount
                        )
                    );
                    updated
                }
                None =>
                    Stake {
                        amount: post_fee_amount,
                        time: current_time,
                        reward_icp: 0,
                    },
            };

            stakes_map.insert(caller, updated_stake);
            Ok(())
        }
    )?;

    Ok("Staked Successfully!".to_string())
}

#[allow(non_snake_case)]
#[update(guard = "not_anon")]
async fn un_stake_all_primary(from_subaccount: Option<[u8; 32]>) -> Result<String, ExecutionError> {
    let caller = ic_cdk::caller();
    let _guard = CallerGuard::new(caller).map_err(|e| ExecutionError::Unauthorized(e.to_string()))?;
    register_info_log(caller, "un_stake_all_primary", "Unstaking initiated.");
    let mut primary_fee = PRIMARY_FEE.with(|fee| *fee.borrow());

    let current_stake = STAKES.with(|stakes| {
        let stakes_map = stakes.borrow();
        stakes_map.get(&caller)
    }).ok_or_else(||
        ExecutionError::new_with_log(
            caller,
            "un_stake_all_primary",
            ExecutionError::StateError("No stake found for caller".to_string())
        )
    )?;

    if primary_fee == 0 {
        let fee: u64 = get_primary_fee().await?;
        update_primary_fee(fee)?;
        primary_fee = fee;
    }

    let staked_amount = current_stake.amount;

    // Verify caller balance
    if staked_amount <= primary_fee {
        // AUDIT comaparing with primary fee to ensure smooth operations
        return Err(
            ExecutionError::new_with_log(
                caller,
                "un_stake_all_primary",
                ExecutionError::InsufficientBalance {
                    required: primary_fee, //Minimum amount
                    available: staked_amount,
                    details: DEFAULT_INSUFFICIENT_CANISTER_BALANCE_ERROR.to_string(),
                    token: "primary".to_string(),
                }
            )
        );
    }

    let post_fee_amount: u64 = staked_amount.checked_sub(primary_fee).ok_or_else(||
        ExecutionError::new_with_log(caller, "un_stake_all_primary", ExecutionError::Underflow {
            operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
            details: format!("staked_amount: {} with primary_fee: {}", staked_amount, primary_fee),
        })
    )?;

    // Withdraw the token
    withdraw_token(post_fee_amount, from_subaccount).await.map_err(|e|
        ExecutionError::new_with_log(caller, "un_stake_all_primary", ExecutionError::TransferFailed {
            source: "Canister".to_string(),
            dest: caller.to_string(),
            token: "primary".to_string(),
            amount: post_fee_amount,
            reason: DEFAULT_TRANSFER_FAILED_ERROR.to_string(),
            details: e.to_string(),
        })
    )?;
    register_info_log(
        caller,
        "un_stake_all_primary",
        &format!("Successfully withdrawn {} primary to {}.", post_fee_amount, caller)
    );

    // Update the stake amount
    let new_amount = current_stake.amount.checked_sub(staked_amount).ok_or_else(||
        ExecutionError::new_with_log(caller, "un_stake_all_primary", ExecutionError::Underflow {
            operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
            details: format!(
                "current_stake.amount: {} with staked_amount: {}",
                current_stake.amount,
                staked_amount
            ),
        })
    )?;
    // Update the stake
    STAKES.with(|stakes| {
        let mut stakes_map = stakes.borrow_mut();
        stakes_map.insert(caller, Stake {
            amount: new_amount,
            time: ic_cdk::api::time(),
            reward_icp: current_stake.reward_icp, // Keep the same reward_icp value
        });
    });
    register_info_log(caller, "un_stake_all_primary", &format!("Successfully unstaked!"));
    Ok("Successfully unstaked!".to_string())
}
//Guard ensure call is only by canister.
// Helper function to safely convert u128 to u64 for ICP transfers
fn safe_reward_to_transfer_amount(reward: u128) -> Result<u64, ExecutionError> {
    reward.try_into()
        .map_err(|_| ExecutionError::ConversionError {
            details: format!("Reward amount {} exceeds maximum transferable amount", reward)
        })
}

// Internal function - only callable by timer
pub async fn distribute_reward() -> Result<String, ExecutionError> {
    // Get current reward pool balance
    let reward_pool = REWARD_POOL.with(|p| {
        p.borrow().get(&()).unwrap_or(0)
    });
    
    if reward_pool == 0 {
        return Ok("No rewards to distribute".to_string());
    }
    
    // Calculate 1% of pool for distribution
    let total_distribution = reward_pool / 100;
    
    // Calculate exact distribution
    let alex_portion = total_distribution / 100;  // 1% of distribution
    let lp_portion = total_distribution - alex_portion; // Remainder for exact accounting
    
    // Update uncollected fees for ALEX stakers (1% of distribution)
    UNCOLLECTED_ALEX_FEES.with(|f| {
        let current = f.borrow().get(&()).unwrap_or(0);
        f.borrow_mut().insert((), current.saturating_add(alex_portion));
    });
    
    // The LP portion (99% of distribution) is distributed directly to stakers
    let total_staked = get_total_primary_staked().await?;
    
    if total_staked == 0 {
        // No stakers - only remove ALEX portion from pool, keep LP portion
        REWARD_POOL.with(|p| {
            let new_pool = reward_pool.saturating_sub(alex_portion);
            p.borrow_mut().insert((), new_pool);
        });
        
        register_info_log(
            Principal::anonymous(),
            "distribute_reward",
            &format!("No stakers - distributed {} to ALEX, {} stays in pool", alex_portion, lp_portion)
        );
        
        return Ok(format!("Distributed {} to ALEX, {} stays in pool (no stakers)", alex_portion, lp_portion));
    }
    
    // Remove full distribution from pool since we have stakers to distribute to
    REWARD_POOL.with(|p| {
        let new_pool = reward_pool.saturating_sub(total_distribution);
        p.borrow_mut().insert((), new_pool);
    });
    
    if total_staked > 0 {
        // Track what we actually distribute (matching core's pattern)
        let mut total_distributed: u128 = 0;
        
        // Calculate and distribute rewards
        STAKES.with(|stakes| -> Result<(), ExecutionError> {
            let mut stakes_map = stakes.borrow_mut();
            
            // Collect keys first (StableBTreeMap doesn't have iter_mut)
            let keys: Vec<Principal> = stakes_map
                .iter()
                .map(|(principal, _)| principal.clone())
                .collect();
            
            for principal in keys {
                if let Some(mut stake) = stakes_map.get(&principal) {
                    // Calculate this stake's reward
                    let stake_ratio = (stake.amount as u128) * SCALING_FACTOR / (total_staked as u128);
                    let icp_reward = ((lp_portion as u128) * stake_ratio) / SCALING_FACTOR;
                    
                    // Accumulate total distributed (like core does)
                    total_distributed = total_distributed.saturating_add(icp_reward);
                    
                    // Update individual stake
                    stake.reward_icp = stake.reward_icp.saturating_add(icp_reward);
                    
                    // Reinsert the updated stake
                    stakes_map.insert(principal, stake);
                }
            }
            Ok(())
        })?;
        
        // Update global counter with ACTUAL distributed amount (not theoretical)
        // This fixes the double-counting bug - we only track what was actually distributed
        add_to_unclaimed_amount(total_distributed)?;
        
        // Track APY for historical data
        let intervals = get_distribution_interval();
        let index = intervals % MAX_DAYS;
        
        // Calculate ICP reward per primary token for APY tracking
        let icp_reward_per_primary = ((lp_portion as u128) * SCALING_FACTOR) / (total_staked as u128);
        
        APY.with(|apy| {
            let mut apy_map = apy.borrow_mut();
            let mut daily_values = apy_map.get(&index).unwrap_or_default();
            daily_values.values.insert(index, icp_reward_per_primary);
            apy_map.insert(index, daily_values);
        });
        
        // Increment distribution counter
        add_to_distribution_intervals(1)?;
    } else {
        // Even if no stakers, we still need to track distributions for APY
        let intervals = get_distribution_interval();
        let index = intervals % MAX_DAYS;
        
        APY.with(|apy| {
            let mut apy_map = apy.borrow_mut();
            let mut daily_values = apy_map.get(&index).unwrap_or_default();
            daily_values.values.insert(index, 0u128); // 0 reward when no stakers
            apy_map.insert(index, daily_values);
        });
        
        add_to_distribution_intervals(1)?;
    }
    
    register_info_log(
        caller(),
        "distribute_reward",
        &format!("Distributed {} to ALEX, {} to stakers from pool of {}", alex_portion, lp_portion, reward_pool)
    );
    
    Ok(format!("Distributed {} to ALEX, {} to stakers", alex_portion, lp_portion))
}

// Legacy distribute_reward_to_stakers function (to be removed when staking is deprecated)
pub async fn distribute_reward_to_stakers() -> Result<String, ExecutionError> {
    register_info_log(caller(), "distribute_reward_to_stakers", "distribute_reward_to_stakers initiated.");
    let intervals = get_distribution_interval();
    let staking_percentage = STAKING_REWARD_PERCENTAGE;
    let total_icp_available: u64 = match fetch_canister_icp_balance().await {
        Ok(bal) => bal,
        Err(e) => {
            return Err(e);
        }
    };

    let total_unclaimed_icp_reward: u128 = get_total_unclaimed_icp_reward();
    let total_archived_bal: u64 = get_total_archived_balance();

    let unclaimed_icps: u128 = total_unclaimed_icp_reward
        .checked_add(total_archived_bal as u128)
        .ok_or_else(||
            ExecutionError::new_with_log(
                caller(),
                "distribute_reward",
                ExecutionError::AdditionOverflow {
                    operation: DEFAULT_ADDITION_OVERFLOW_ERROR.to_string(),
                    details: format!(
                        "total_unclaimed_icp_reward: {} with total_archived_bal: {}",
                        total_unclaimed_icp_reward,
                        total_archived_bal
                    ),
                }
            )
        )?;

    if total_icp_available == 0 || (total_icp_available as u128) < unclaimed_icps {
        return Err(
            ExecutionError::new_with_log(
                caller(),
                "distribute_reward",
                ExecutionError::InsufficientCanisterBalance {
                    required: 1, // required greater than 0
                    available: total_icp_available,
                    details: DEFAULT_INSUFFICIENT_CANISTER_BALANCE_ERROR.to_string(),
                }
            )
        );
    }
    let mut total_icp_allocated: u128 = (total_icp_available as u128)
        .checked_sub(unclaimed_icps)
        .ok_or_else(||
            ExecutionError::new_with_log(caller(), "distribute_reward", ExecutionError::Underflow {
                operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                details: format!(
                    "total_icp_available: {} with unclaimed_icps: {}",
                    total_icp_available,
                    unclaimed_icps
                ),
            })
        )?
        .into();
    total_icp_allocated = total_icp_allocated.checked_mul(staking_percentage as u128).ok_or_else(||
        ExecutionError::new_with_log(
            caller(),
            "distribute_reward",
            ExecutionError::MultiplicationOverflow {
                operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                details: format!(
                    "total_icp_allocated: {} with staking_percentage: {}",
                    total_icp_allocated,
                    staking_percentage
                ),
            }
        )
    )?;

    total_icp_allocated = total_icp_allocated.checked_div(10000).ok_or_else(||
        ExecutionError::new_with_log(caller(), "distribute_reward", ExecutionError::DivisionFailed {
            operation: "ICP allocation calculation".to_string(),
            details: "Please verify the amount is valid and non-zero".to_string(),
        })
    )?;

    if total_icp_allocated < 1_000_000 {
        return Err(
            ExecutionError::new_with_log(
                caller(),
                "distribute_reward",
                ExecutionError::InsufficientBalanceRewardDistribution {
                    available: total_icp_allocated,
                    details: DEFAULT_INSUFFICIENT_BALANCE_REWARD_DISTRIBUTION_ERROR.to_string(),
                }
            )
        );
    }

    let total_staked_primary = get_total_primary_staked().await?;

    if total_staked_primary == 0 {
        return Err(
            ExecutionError::new_with_log(
                caller(),
                "distribute_reward",
                ExecutionError::RewardDistributionError {
                    reason: "No primary staked, cannot distribute rewards".to_string(),
                }
            )
        );
    }
    let icp_reward_per_primary = total_icp_allocated
        .checked_mul(SCALING_FACTOR)
        .ok_or_else(||
            ExecutionError::new_with_log(
                caller(),
                "distribute_reward",
                ExecutionError::MultiplicationOverflow {
                    operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                    details: format!(
                        "total_icp_allocated: {} with SCALING_FACTOR: {}",
                        total_icp_allocated,
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
                        total_icp_allocated * SCALING_FACTOR,
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

                    stake.reward_icp = stake.reward_icp.checked_add(reward).ok_or_else(||
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

    add_to_unclaimed_amount(total_icp_reward)?;

    add_to_distribution_intervals(1)?;
    register_info_log(caller(), "distribute_reward", "Successfully distributed reward. Completed.");

    Ok("Success".to_string())
}

#[update(guard = "not_anon")]
async fn claim_icp_reward(from_subaccount: Option<[u8; 32]>) -> Result<String, ExecutionError> {
    let caller = ic_cdk::caller();
    let _guard = CallerGuard::new(caller).map_err(|e| ExecutionError::Unauthorized(e.to_string()))?;
    register_info_log(caller, "claim_icp_reward", "claim_icp_reward initiated.");

    let caller_stake_reward: Option<Stake> = get_stake(caller);
    match caller_stake_reward {
        Some(stake) => {
            if stake.reward_icp <= 1000_000 {
                return Err(
                    ExecutionError::new_with_log(
                        caller,
                        "claim_icp_reward",
                        ExecutionError::MinimumRequired {
                            required: 1000_000,
                            provided: stake.reward_icp.try_into().unwrap_or(u64::MAX),
                            token: "ICP".to_string(),
                            details: DEFAULT_MINIMUM_REQUIRED_ERROR.to_string(),
                        }
                    )
                );
            }
            let total_icp_available: u64 = match fetch_canister_icp_balance().await {
                Ok(bal) => bal,
                Err(e) => {
                    return Err(e);
                }
            };

            // Convert reward to u64 for comparison and transfer
            let reward_u64 = safe_reward_to_transfer_amount(stake.reward_icp)?;
            
            if reward_u64 > total_icp_available {
                return Err(
                    ExecutionError::new_with_log(
                        caller,
                        "claim_icp_reward",
                        ExecutionError::InsufficientCanisterBalance {
                            required: reward_u64,
                            available: total_icp_available,
                            details: DEFAULT_INSUFFICIENT_CANISTER_BALANCE_ERROR.to_string(),
                        }
                    )
                );
            }
            let amount_after_fee = reward_u64.checked_sub(ICP_TRANSFER_FEE).ok_or_else(||
                ExecutionError::new_with_log(caller, "claim_icp_reward", ExecutionError::Underflow {
                    operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                    details: format!(
                        "stake.reward_icp: {} with ICP_TRANSFER_FEE: {}",
                        reward_u64,
                        ICP_TRANSFER_FEE
                    ),
                })
            )?;
            // Apply CEI pattern: Update all state first
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
            
            // Then send ICP (last step)
            send_icp(caller, amount_after_fee, from_subaccount).await.map_err(|e| {
                // Restore state on failure
                let _ = add_to_unclaimed_amount(stake.reward_icp);
                STAKES.with(|stakes| {
                    let mut stakes_map = stakes.borrow_mut();
                    let mut current_stake = stakes_map.get(&caller).unwrap_or(Stake {
                        amount: 0,
                        time: ic_cdk::api::time(),
                        reward_icp: 0,
                    });
                    current_stake.reward_icp = stake.reward_icp;
                    stakes_map.insert(caller, current_stake);
                });
                
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
                    }
                )
            })?;
            
            // Track the successfully claimed amount (AFTER successful send)
            add_to_total_claimed_rewards(amount_after_fee).map_err(|e|
                ExecutionError::new_with_log(
                    caller,
                    "claim_icp_reward",
                    e
                )
            )?;
            
            register_info_log(
                caller,
                "claim_icp_reward",
                &format!("Successfully sent {} ICP (e8s) to {}", amount_after_fee, caller)
            );
            register_info_log(caller, "claim_icp_reward", "Claim process completed successfully.");
            Ok("Success".to_string())
        }
        None => {
            // User doesn't have a stake
            return Err(
                ExecutionError::new_with_log(
                    caller,
                    "claim_icp_reward",
                    ExecutionError::StateError("No staking record found for caller".to_string())
                )
            );
        }
    }
}

pub async fn get_icp_rate_in_cents() -> Result<u64, ExecutionError> {
    register_info_log(caller(), "get_icp_rate_in_cents", "get_icp_rate_in_cents initiated.");

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

    let call_result: Result<
        Vec<u8>,
        (ic_cdk::api::call::RejectionCode, String)
    > = ic_cdk::api::call::call_raw(
        xrc_canister_id,
        "get_exchange_rate",
        &candid::encode_args((request,)).unwrap(),
        BURN_CYCLE_FEE // payment fee
    ).await;

    match call_result {
        Ok(response_bytes) =>
            match candid::decode_one::<XRCResponse>(&response_bytes) {
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
                            let mut price_in_cents = exchange_rate.rate
                                .checked_div(divisor)
                                .ok_or_else(||
                                    ExecutionError::new_with_log(
                                        caller(),
                                        "get_icp_rate_in_cents",
                                        ExecutionError::DivisionFailed {
                                            operation: DEFAULT_DIVISION_ERROR.to_string(),
                                            details: format!(
                                                "exchange_rate.rate: {} with divisor: {}",
                                                exchange_rate.rate,
                                                divisor
                                            ),
                                        }
                                    )
                                )?;
                            if price_in_cents < 400 {
                                price_in_cents = 400;
                            }
                            let time = ic_cdk::api
                                ::time()
                                .checked_div(1_000_000_000)
                                .ok_or_else(||
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
                                        }
                                    )
                                )?;
                            // Update the closure to handle potential errors
                            update_current_secondary_ratio(price_in_cents, time)?;
                            register_info_log(
                                caller(),
                                "get_icp_rate_in_cents",
                                &format!("get_icp_rate_in_cents process completed successfully.Got {} ICP price in cents", price_in_cents)
                            );

                            Ok(price_in_cents)
                        }
                        XRCResponse::Err(_err) =>
                            Err(
                                ExecutionError::new_with_log(
                                    caller(),
                                    "get_icp_rate_in_cents",
                                    ExecutionError::StateError("Error in XRC response".to_string())
                                )
                            ),
                    }
                }
                Err(_e) =>
                    Err(
                        ExecutionError::new_with_log(
                            caller(),
                            "get_icp_rate_in_cents",
                            ExecutionError::StateError("Error in decoding XRC response".to_string())
                        )
                    ),
            }
        Err((_rejection_code, _msg)) =>
            Err(
                ExecutionError::new_with_log(
                    caller(),
                    "get_icp_rate_in_cents",
                    ExecutionError::StateError("Error call rejected".to_string())
                )
            ),
    }
}

#[update(guard = "not_anon")]
async fn redeem(from_subaccount: Option<[u8; 32]>) -> Result<String, ExecutionError> {
    let caller = ic_cdk::caller();
    let _guard = CallerGuard::new(caller).map_err(|e| ExecutionError::Unauthorized(e.to_string()))?;
    register_info_log(caller, "redeem", "Redeem initiated.");

    let caller_archive_profile: Option<ArchiveBalance> = get_user_archive_balance(caller);
    match caller_archive_profile {
        Some(trx) => {
            if trx.icp <= 0 {
                return Err(
                    ExecutionError::new_with_log(
                        caller,
                        "redeem",
                        ExecutionError::InsufficientBalance {
                            required: 1, //Minimum amount
                            available: trx.icp,
                            token: "ICP".to_string(),
                            details: DEFAULT_INSUFFICIENT_BALANCE_ERROR.to_string(),
                        }
                    )
                );
            }
            let total_icp_available: u64 = match fetch_canister_icp_balance().await {
                Ok(bal) => bal,
                Err(e) => {
                    return Err(e);
                }
            };

            if trx.icp > total_icp_available {
                return Err(
                    ExecutionError::new_with_log(
                        caller,
                        "redeem",
                        ExecutionError::InsufficientCanisterBalance {
                            required: trx.icp,
                            available: total_icp_available,
                            details: DEFAULT_INSUFFICIENT_CANISTER_BALANCE_ERROR.to_string(),
                        }
                    )
                );
            }
            // Apply CEI pattern: Update state FIRST
            sub_to_total_archived_balance(trx.icp)?;

            // Zero user's balance before sending
            ARCHIVED_TRANSACTION_LOG.with(
                |trxs| -> Result<(), ExecutionError> {
                    let mut trxs = trxs.borrow_mut();

                    let mut user_archive = trxs.get(&caller).unwrap_or(ArchiveBalance { icp: 0 });
                    user_archive.icp = 0;

                    trxs.insert(caller, user_archive);

                    Ok(())
                }
            )?;
            
            // THEN send ICP (last step)
            send_icp(caller, trx.icp, from_subaccount).await.map_err(|e| {
                // On failure, restore the state
                let _ = add_to_total_archived_balance(trx.icp);
                ARCHIVED_TRANSACTION_LOG.with(|trxs| {
                    let mut trxs = trxs.borrow_mut();
                    let mut user_archive = trxs.get(&caller).unwrap_or(ArchiveBalance { icp: 0 });
                    user_archive.icp = trx.icp;
                    trxs.insert(caller, user_archive);
                });
                
                ExecutionError::new_with_log(caller, "redeem", ExecutionError::TransferFailed {
                    source: "canister".to_string(),
                    dest: caller.to_string(),
                    token: "ICP".to_string(),
                    amount: trx.icp,
                    details: e.to_string(),
                    reason: DEFAULT_TRANSFER_FAILED_ERROR.to_string(),
                })
            })?;
            
            register_info_log(
                caller,
                "redeem",
                &format!("Successfully sent {} ICP (e8s) exclusive of fee to {}", trx.icp, caller)
            );

            Ok("Success".to_string())
        }
        None => {
            return Err(
                ExecutionError::new_with_log(
                    caller,
                    "redeem",
                    ExecutionError::StateError("No Reedem record found for caller".to_string())
                )
            );
        }
    }
}

async fn withdraw_token(
    amount: u64,
    from_subaccount: Option<[u8; 32]>
) -> Result<BlockIndex, TransferFromError> {
    let caller: Principal = caller();
    let canister_id: Principal = ic_cdk::api::id();
    let primary_fee = PRIMARY_FEE.with(|fee| *fee.borrow());
    
    // Get primary token canister ID from configs
    let primary_token_id = CONFIGS.with(|configs| {
        configs.borrow()
            .get(&())
            .map(|c| c.primary_token_id)
            .ok_or_else(|| TransferFromError::GenericError {
                error_code: 1u64.into(),
                message: "Primary token ID not configured".to_string()
            })
    })?;

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

    let (result,) = ic_cdk
        ::call::<(TransferFromArgs,), (Result<BlockIndex, TransferFromError>,)>(
            primary_token_id,
            "icrc2_transfer_from",
            (transfer_from_args,)
        ).await
        .map_err(|_| TransferFromError::GenericError {
            message: "Call failed".to_string(),
            error_code: Nat::from(0 as u32),
        })?;

    result
}

async fn deposit_token(
    amount: u64,
    from_subaccount: Option<[u8; 32]>
) -> Result<BlockIndex, TransferFromError> {
    let caller: Principal = caller();
    let canister_id: Principal = ic_cdk::api::id();
    let primary_fee = PRIMARY_FEE.with(|fee| *fee.borrow());
    
    // Get primary token canister ID from configs
    let primary_token_id = CONFIGS.with(|configs| {
        configs.borrow()
            .get(&())
            .map(|c| c.primary_token_id)
            .ok_or_else(|| TransferFromError::GenericError {
                error_code: 1u64.into(),
                message: "Primary token ID not configured".to_string()
            })
    })?;
    
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

    let (result,) = ic_cdk
        ::call::<(TransferFromArgs,), (Result<BlockIndex, TransferFromError>,)>(
            primary_token_id,
            "icrc2_transfer_from",
            (transfer_from_args,)
        ).await
        .map_err(|_| TransferFromError::GenericError {
            message: "Call failed".to_string(),
            error_code: Nat::from(0 as u32),
        })?;

    result
}

async fn burn_token(
    amount: u64,
    from_subaccount: Option<[u8; 32]>
) -> Result<BlockIndex, TransferFromError> {
    let canister_id: Principal = ic_cdk::api::id();

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

    // Get secondary token canister ID from configs
    let secondary_token_id = CONFIGS.with(|configs| {
        configs.borrow()
            .get(&())
            .map(|c| c.secondary_token_id)
            .ok_or_else(|| TransferFromError::GenericError {
                error_code: 1u64.into(),
                message: "Secondary token ID not configured".to_string()
            })
    })?;

    // 1. Asynchronously call another canister function using `ic_cdk::call`.
    let (result,) = ic_cdk
        ::call::<(TransferFromArgs,), (Result<BlockIndex, TransferFromError>,)>(
            secondary_token_id,
            // 3. Specify the method name on the target canister to be called, in this case, "icrc2_transfer_from".
            "icrc2_transfer_from",
            // 4. Provide the arguments for the call in a tuple, here `transfer_args` is encapsulated as a single-element tuple.
            (transfer_from_args,)
        ).await
        .map_err(|_| TransferFromError::GenericError {
            message: "Call failed".to_string(),
            error_code: Nat::from(0 as u32),
        })?;

    result // Return the inner Result<BlockIndex, TransferFromError>
}

// Collection result structure
#[derive(CandidType, Deserialize)]
pub struct CollectionResult {
    pub collected: u64,
    pub timestamp: u64,
}

// Collection error structure
#[derive(CandidType, Deserialize)]
pub enum CollectionError {
    AmountTooSmall { amount: u64 },
    TransferFailed { reason: String },
}

// Collection with CEI pattern and failure reversal
#[update(guard = "only_lbry_fun")]
pub async fn collect_alex_fees() -> Result<CollectionResult, CollectionError> {
    // Atomic check and extraction
    let fees = UNCOLLECTED_ALEX_FEES.with(|f| {
        let current = f.borrow().get(&()).unwrap_or(0);
        if current >= ICP_TRANSFER_FEE {
            f.borrow_mut().insert((), 0);
            current
        } else {
            0
        }
    });
    
    if fees == 0 {
        return Err(CollectionError::AmountTooSmall { amount: 0 });
    }
    
    // Interaction - external transfer
    match transfer_icp_to_lbry_fun(fees).await {
        Ok(_) => {
            Ok(CollectionResult { 
                collected: fees,
                timestamp: ic_cdk::api::time()
            })
        }
        Err(e) => {
            // Failure reversal - add back to current balance (don't overwrite)
            UNCOLLECTED_ALEX_FEES.with(|f| {
                let current = f.borrow().get(&()).unwrap_or(0);
                f.borrow_mut().insert((), current + fees);
            });
            Err(CollectionError::TransferFailed { reason: e.to_string() })
        }
    }
}

// Function to add funds to reward pool (only callable by lbry_fun)
#[update(guard = "only_lbry_fun")]
pub fn add_to_reward_pool(amount: u64) -> Result<u64, String> {
    REWARD_POOL.with(|p| {
        let current = p.borrow().get(&()).unwrap_or(0);
        let new_total = current.saturating_add(amount);
        p.borrow_mut().insert((), new_total);
        Ok(new_total)
    })
}

// Helper function to transfer ICP to lbry_fun canister
async fn transfer_icp_to_lbry_fun(amount: u64) -> Result<BlockIndex, String> {
    // Get lbry_fun canister ID from environment or configuration
    let lbry_fun_id = Principal::from_text("oni4e-oyaaa-aaaap-qp2pq-cai")
        .map_err(|e| format!("Invalid lbry_fun canister ID: {}", e))?;
    
    // Get ICP ledger ID from configs or default
    let icp_ledger_id = CONFIGS.with(|configs| {
        configs.borrow()
            .get(&())
            .map(|c| c.icp_ledger_id)
            .unwrap_or(MAINNET_LEDGER_CANISTER_ID)
    });
    
    let transfer_args = TransferArg {
        from_subaccount: None,
        to: lbry_fun_id.into(),
        fee: None,
        created_at_time: None,
        memo: None,
        amount: Nat::from(amount),
    };
    
    let (result,) = ic_cdk::call::<(TransferArg,), (Result<BlockIndex, TransferError>,)>(
        icp_ledger_id,
        "icrc1_transfer",
        (transfer_args,)
    ).await
    .map_err(|e| format!("Transfer call failed: {:?}", e))?;
    
    result.map_err(|e| format!("Transfer failed: {:?}", e))
}
