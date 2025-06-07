use crate::get_config;
use crate::get_tokenomics_schedule;
use crate::guard::*;
use crate::error::ExecutionError;
use crate::register_info_log;
use crate::storage::*;
use crate::update_log;
use crate::DEFAULT_ADDITION_OVERFLOW_ERROR;
use crate::DEFAULT_DIVISION_ERROR;
use crate::DEFAULT_MINT_FAILED;
use crate::DEFAULT_MULTIPLICATION_OVERFLOW_ERROR;
use crate::DEFAULT_UNDERFLOW_ERROR;
use crate::{
    add_to_total_secondary_burned,
    fetch_total_minted_primary,
    get_current_threshold_index,
    get_principal,
    get_total_secondary_burn,
    update_to_current_threshold,
};
use candid::Principal;
use ic_ledger_types::Subaccount;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{ BlockIndex, TransferArg, TransferError };

#[ic_cdk::update(guard = "is_allowed")]
pub async fn mint_primary(
    secondary_burn: u64,
    actual_caller: Principal,
    to_subaccount: Option<Subaccount>
) -> Result<String, ExecutionError> {
    let mut random_users: (Principal, Principal);
    let mut minted_primary: u64 = 0;
    let mut phase_mint_primary: u64 = 0;
    let mut total_burned_secondary: u64 = get_total_secondary_burn();
    let max_primary_supply=get_config().max_primary_supply;
    let max_primary_phase=get_config().max_primary_phase;
    let primary_mint_per_threshold=get_tokenomics_schedule().primary_mint_per_threshold;
    let secondary_burn_thresholds=get_tokenomics_schedule().secondary_burn_thresholds;


    register_info_log(
        actual_caller,
        "mint_primary",
        &format!("Processing primary minting aginst {} secondary ", secondary_burn)
    );
    if
        total_burned_secondary.checked_add(secondary_burn).ok_or_else(|| {
            ExecutionError::new_with_log(
                actual_caller,
                "mint_primary",
                ExecutionError::AdditionOverflow {
                    operation: DEFAULT_ADDITION_OVERFLOW_ERROR.to_string(),
                    details: format!(
                        "total_burned_secondary: {} with secondary_burn: {}",
                        total_burned_secondary,
                        secondary_burn
                    ),
                }
            )
        })? > secondary_burn_thresholds[secondary_burn_thresholds.len() - 1]
    {
        return Err(
            ExecutionError::new_with_log(
                actual_caller,
                "mint_primary",
                ExecutionError::MaxMintPrimaryReached {
                    reason: "Max primary reached,minting stopped !".to_string(),
                }
            )
        );
    }

    let mut current_threshold_index: u32 = get_current_threshold_index();
    let tentative_total: u64 = total_burned_secondary.checked_add(secondary_burn).ok_or_else(|| {
        ExecutionError::new_with_log(actual_caller, "mint_primary", ExecutionError::AdditionOverflow {
            operation: DEFAULT_ADDITION_OVERFLOW_ERROR.to_string(),
            details: format!(
                "total_burned_secondary: {} with secondary_burn: {}",
                total_burned_secondary,
                secondary_burn
            ),
        })
    })?;

    if tentative_total > secondary_burn_thresholds[current_threshold_index as usize] {
        let mut secondary_processed: u64 = 0;

        while tentative_total > secondary_burn_thresholds[current_threshold_index as usize] {
            let secondary_mint_primary_with_current_threshold: u64 = if
                total_burned_secondary < secondary_burn_thresholds[current_threshold_index as usize]
            {
                secondary_burn_thresholds[current_threshold_index as usize] - total_burned_secondary
            } else {
                secondary_burn.checked_sub(secondary_processed).ok_or_else(|| {
                    ExecutionError::new_with_log(
                        actual_caller,
                        "mint_primary",
                        ExecutionError::Underflow {
                            operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                            details: format!(
                                "secondary_burn: {} with secondary_processed: {}",
                                secondary_burn,
                                secondary_processed
                            ),
                        }
                    )
                })?
            };

            let mut slot_mint = primary_mint_per_threshold[current_threshold_index as usize].checked_mul(
                secondary_mint_primary_with_current_threshold
            ).ok_or_else(||
                ExecutionError::new_with_log(
                    actual_caller,
                    "mint_primary",
                    ExecutionError::MultiplicationOverflow {
                        operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                        details: format!(
                            "primary_mint_per_threshold[current_threshold_index]: {} with secondary_mint_primary_with_current_threshold: {}",
                            primary_mint_per_threshold[current_threshold_index as usize],
                            secondary_mint_primary_with_current_threshold
                        ),
                    }
                )
            )?;

            slot_mint = slot_mint.checked_mul(10000).ok_or_else(|| {
                ExecutionError::new_with_log(
                    actual_caller,
                    "mint_primary",
                    ExecutionError::MultiplicationOverflow {
                        operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                        details: format!("slot_mint: {} with {}", slot_mint, 10000),
                    }
                )
            })?;

            phase_mint_primary = phase_mint_primary.checked_add(slot_mint).ok_or_else(|| {
                ExecutionError::new_with_log(
                    actual_caller,
                    "mint_primary",
                    ExecutionError::AdditionOverflow {
                        operation: DEFAULT_ADDITION_OVERFLOW_ERROR.to_string(),
                        details: format!(
                            "slot_mint: {} with phase_mint_primary: {}",
                            slot_mint,
                            phase_mint_primary
                        ),
                    }
                )
            })?;
            secondary_processed = secondary_processed
                .checked_add(secondary_mint_primary_with_current_threshold)
                .ok_or_else(|| {
                    ExecutionError::new_with_log(
                        actual_caller,
                        "mint_primary",
                        ExecutionError::AdditionOverflow {
                            operation: DEFAULT_ADDITION_OVERFLOW_ERROR.to_string(),
                            details: format!(
                                "secondary_processed: {} with secondary_mint_primary_with_current_threshold: {}",
                                secondary_processed,
                                secondary_mint_primary_with_current_threshold
                            ),
                        }
                    )
                })?;
            total_burned_secondary = total_burned_secondary
                .checked_add(secondary_mint_primary_with_current_threshold)
                .ok_or_else(||
                    ExecutionError::new_with_log(
                        actual_caller,
                        "mint_primary",
                        ExecutionError::AdditionOverflow {
                            operation: DEFAULT_ADDITION_OVERFLOW_ERROR.to_string(),
                            details: format!(
                                "total_burned_secondary: {} with secondary_mint_primary_with_current_threshold: {}",
                                total_burned_secondary,
                                secondary_mint_primary_with_current_threshold
                            ),
                        }
                    )
                )?;
            current_threshold_index += 1;
            if current_threshold_index > (secondary_burn_thresholds.len() as u32) - 1 {
                current_threshold_index = (secondary_burn_thresholds.len() as u32) - 1;
            }
        }

        if secondary_burn > secondary_processed {
            let secondary_mint_primary_with_current_threshold: u64 = secondary_burn
                .checked_sub(secondary_processed)
                .ok_or_else(|| {
                    ExecutionError::new_with_log(
                        actual_caller,
                        "mint_primary",
                        ExecutionError::Underflow {
                            operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                            details: format!(
                                "secondary_burn: {} with secondary_processed: {}",
                                secondary_burn,
                                secondary_processed
                            ),
                        }
                    )
                })?;

            let mut slot_mint = primary_mint_per_threshold[current_threshold_index as usize].checked_mul(
                secondary_mint_primary_with_current_threshold
            ).ok_or_else(||
                ExecutionError::new_with_log(
                    actual_caller,
                    "mint_primary",
                    ExecutionError::MultiplicationOverflow {
                        operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                        details: format!(
                            "primary_mint_per_threshold[current_threshold_index]: {} with secondary_mint_primary_with_current_threshold:{}",
                            primary_mint_per_threshold[current_threshold_index as usize],
                            secondary_mint_primary_with_current_threshold
                        ),
                    }
                )
            )?;
            slot_mint = slot_mint.checked_mul(10000).ok_or_else(|| {
                ExecutionError::new_with_log(
                    actual_caller,
                    "mint_primary",
                    ExecutionError::MultiplicationOverflow {
                        operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                        details: format!("slot_mint: {} with {}", slot_mint, 10000),
                    }
                )
            })?;

            phase_mint_primary = phase_mint_primary.checked_add(slot_mint).ok_or_else(|| {
                ExecutionError::new_with_log(
                    actual_caller,
                    "mint_primary",
                    ExecutionError::AdditionOverflow {
                        operation: DEFAULT_ADDITION_OVERFLOW_ERROR.to_string(),
                        details: format!(
                            "phase_mint_primary: {} with slot_mint: {}",
                            phase_mint_primary,
                            slot_mint
                        ),
                    }
                )
            })?;

            secondary_processed.checked_add(secondary_mint_primary_with_current_threshold).ok_or_else(|| {
                ExecutionError::new_with_log(
                    actual_caller,
                    "mint_primary",
                    ExecutionError::AdditionOverflow {
                        operation: DEFAULT_ADDITION_OVERFLOW_ERROR.to_string(),
                        details: format!(
                            "secondary_processed: {} with secondary_mint_primary_with_current_threshold: {}",
                            secondary_processed,
                            secondary_mint_primary_with_current_threshold
                        ),
                    }
                )
            })?;
        }
    } else {
        phase_mint_primary = primary_mint_per_threshold[current_threshold_index as usize].checked_mul(
            secondary_burn
        ).ok_or_else(|| {
            ExecutionError::new_with_log(
                actual_caller,
                "mint_primary",
                ExecutionError::MultiplicationOverflow {
                    operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                    details: format!(
                        "phase_mint_primary: {} with secondary_burn:{}",
                        phase_mint_primary,
                        secondary_burn
                    ),
                }
            )
        })?;
        phase_mint_primary = phase_mint_primary.checked_mul(10000).ok_or_else(|| {
            ExecutionError::new_with_log(
                actual_caller,
                "mint_primary",
                ExecutionError::MultiplicationOverflow {
                    operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                    details: format!("phase_mint_primary: {} with {}", phase_mint_primary, 10000),
                }
            )
        })?;
    }

    // Check for maximum primary per transaction (50 primary = 500_000 after multiplication by 10000)
    let max_phase_in_e8s=max_primary_phase*100_000_000;
    if phase_mint_primary >  max_phase_in_e8s{
        return Err(
            ExecutionError::new_with_log(
                actual_caller,
                "mint_primary",
                ExecutionError::MaxPrimaryPerTrnxReached {
                    reason: format!(
                        "This would mint {} primary which exceeds the maximum of 50 primary per transaction",
                        (phase_mint_primary as f64) / 10000.0
                    ),
                }
            )
        );
    }

    let mut total_primary_minted = 0;

    match fetch_total_minted_primary().await {
        Ok(result) => {
            total_primary_minted = result;
        }
        Err(e) => {
            return Err(
                ExecutionError::new_with_log(
                    actual_caller,
                    "mint_primary",
                    ExecutionError::CanisterCallFailed {
                        canister: "primary".to_string(),
                        method: "mint".to_string(),
                        details: e,
                    }
                )
            );
        }
    }

    let remaining_primary = max_primary_supply.checked_sub(total_primary_minted).ok_or_else(|| {
        ExecutionError::new_with_log(actual_caller, "mint_primary", ExecutionError::Underflow {
            operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
            details: format!(
                "max_primary_supply: {} with total_primary_minted: {}",
                max_primary_supply,
                total_primary_minted
            ),
        })
    })?;
    let primary_to_mint = phase_mint_primary
        .min(remaining_primary);

    if primary_to_mint == 0 {
        return Err(
            ExecutionError::new_with_log(
                actual_caller,
                "mint_primary",
                ExecutionError::NoMorePrimaryCanbeMinted {
                    reason: format!("No more primary can be minted"),
                }
            )
        );
    }

    let primary_per_recipient = primary_to_mint;
    match
    mint_primary_internal(
        primary_per_recipient,
        actual_caller,
        to_subaccount.map(|s| s.0)
    ).await
{
    Ok(_) => {
        register_info_log(
            actual_caller,
            "mint_primary",
            &format!("Sucessfully minted {}(e8s) primary to  {}  ", primary_per_recipient,actual_caller)
        );
        minted_primary = minted_primary.checked_add(primary_per_recipient).ok_or_else(|| {
            ExecutionError::new_with_log(
                actual_caller,
                "mint_primary",
                ExecutionError::AdditionOverflow {
                    operation: DEFAULT_ADDITION_OVERFLOW_ERROR.to_string(),
                    details: format!(
                        "minted_primary: {} with primary_per_recipient: {}",
                        minted_primary,
                        primary_per_recipient
                    ),
                }
            )
        })?;
    }
    Err(e) => {
        return Err(
            ExecutionError::new_with_log(
                actual_caller,
                "mint_primary",
                ExecutionError::MintFailed {
                    token: "primary".to_string(),
                    amount: primary_per_recipient,
                    reason: "primary ".to_string() + DEFAULT_MINT_FAILED,
                    details: e.to_string(),
                }
            )
        );
    }
}

    update_to_current_threshold(current_threshold_index);
    add_to_total_secondary_burned(secondary_burn)?;
    Ok("Minted primary ".to_string() + &minted_primary.to_string())
}

async fn mint_primary_internal(
    minted_primary: u64,
    destination: Principal,
    to_subaccount: Option<[u8; 32]>
) -> Result<BlockIndex, String> {
    let primary_token_id=get_config().primary_token_id;

    let transfer_args: TransferArg = TransferArg {
        amount: minted_primary.into(),
        from_subaccount: None,
        fee: None,
        to: Account {
            owner: destination,
            subaccount: to_subaccount,
        },
        created_at_time: None,
        memo: None,
    };
    ic_cdk
        ::call::<(TransferArg,), (Result<BlockIndex, TransferError>,)>(
            primary_token_id,
            "icrc1_transfer",
            (transfer_args,)
        ).await
        .map_err(|e| format!("failed to call ledger: {:?}", e))?
        .0.map_err(|e| format!("ledger transfer error {:?}", e))
}
