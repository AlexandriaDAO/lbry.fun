use crate::guard::*;
use crate::error::ExecutionError;
use crate::register_info_log;
use crate::storage::*;
use crate::update_log;
use crate::PRIMARY_CANISTER_ID;
use crate::DEFAULT_ADDITION_OVERFLOW_ERROR;
use crate::DEFAULT_DIVISION_ERROR;
use crate::DEFAULT_MINT_FAILED;
use crate::DEFAULT_MULTIPLICATION_OVERFLOW_ERROR;
use crate::DEFAULT_UNDERFLOW_ERROR;
use crate::MAX_PRIMARY;
use crate::{
    add_to_total_SECONDARY_burned,
    fetch_total_minted_PRIMARY,
    get_current_threshold_index,
    get_principal,
    get_total_SECONDARY_burn,
    get_two_random_nfts,
    update_to_current_threshold,
};
use candid::Principal;
use ic_ledger_types::Subaccount;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{ BlockIndex, TransferArg, TransferError };

#[ic_cdk::update(guard = "is_allowed")]
pub async fn mint_PRIMARY(
    secondary_burn: u64,
    actual_caller: Principal,
    to_subaccount: Option<Subaccount>
) -> Result<String, ExecutionError> {
    let mut random_users: (Principal, Principal);
    let mut minted_primary: u64 = 0;
    let mut phase_mint_primary: u64 = 0;
    let mut total_burned_secondary: u64 = get_total_SECONDARY_burn();
    register_info_log(
        actual_caller,
        "mint_PRIMARY",
        &format!("Processing PRIMARY minting aginst {} SECONDARY ", secondary_burn)
    );
    if
        total_burned_secondary.checked_add(secondary_burn).ok_or_else(|| {
            ExecutionError::new_with_log(
                actual_caller,
                "mint_PRIMARY",
                ExecutionError::AdditionOverflow {
                    operation: DEFAULT_ADDITION_OVERFLOW_ERROR.to_string(),
                    details: format!(
                        "total_burned_secondary: {} with secondary_burn: {}",
                        total_burned_secondary,
                        secondary_burn
                    ),
                }
            )
        })? > SECONDARY_THRESHOLDS[SECONDARY_THRESHOLDS.len() - 1]
    {
        return Err(
            ExecutionError::new_with_log(
                actual_caller,
                "mint_PRIMARY",
                ExecutionError::MaxMintAlexReached {
                    reason: "Max PRIMARY reached,minting stopped !".to_string(),
                }
            )
        );
    }

    let mut current_threshold_index: u32 = get_current_threshold_index();
    let tentative_total: u64 = total_burned_secondary.checked_add(secondary_burn).ok_or_else(|| {
        ExecutionError::new_with_log(actual_caller, "mint_PRIMARY", ExecutionError::AdditionOverflow {
            operation: DEFAULT_ADDITION_OVERFLOW_ERROR.to_string(),
            details: format!(
                "total_burned_secondary: {} with secondary_burn: {}",
                total_burned_secondary,
                secondary_burn
            ),
        })
    })?;

    if tentative_total > SECONDARY_THRESHOLDS[current_threshold_index as usize] {
        let mut secondary_processed: u64 = 0;

        while tentative_total > SECONDARY_THRESHOLDS[current_threshold_index as usize] {
            let secondary_mint_primary_with_current_threshold: u64 = if
                total_burned_secondary < SECONDARY_THRESHOLDS[current_threshold_index as usize]
            {
                SECONDARY_THRESHOLDS[current_threshold_index as usize] - total_burned_secondary
            } else {
                secondary_burn.checked_sub(secondary_processed).ok_or_else(|| {
                    ExecutionError::new_with_log(
                        actual_caller,
                        "mint_PRIMARY",
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

            let mut slot_mint = PRIMARY_PER_THRESHOLD[current_threshold_index as usize].checked_mul(
                secondary_mint_primary_with_current_threshold
            ).ok_or_else(||
                ExecutionError::new_with_log(
                    actual_caller,
                    "mint_PRIMARY",
                    ExecutionError::MultiplicationOverflow {
                        operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                        details: format!(
                            "PRIMARY_PER_THRESHOLD[current_threshold_index]: {} with secondary_mint_primary_with_current_threshold: {}",
                            PRIMARY_PER_THRESHOLD[current_threshold_index as usize],
                            secondary_mint_primary_with_current_threshold
                        ),
                    }
                )
            )?;

            slot_mint = slot_mint.checked_mul(10000).ok_or_else(|| {
                ExecutionError::new_with_log(
                    actual_caller,
                    "mint_PRIMARY",
                    ExecutionError::MultiplicationOverflow {
                        operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                        details: format!("slot_mint: {} with {}", slot_mint, 10000),
                    }
                )
            })?;

            phase_mint_primary = phase_mint_primary.checked_add(slot_mint).ok_or_else(|| {
                ExecutionError::new_with_log(
                    actual_caller,
                    "mint_PRIMARY",
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
                        "mint_PRIMARY",
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
                        "mint_PRIMARY",
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
            if current_threshold_index > (SECONDARY_THRESHOLDS.len() as u32) - 1 {
                current_threshold_index = (SECONDARY_THRESHOLDS.len() as u32) - 1;
            }
        }

        if secondary_burn > secondary_processed {
            let secondary_mint_primary_with_current_threshold: u64 = secondary_burn
                .checked_sub(secondary_processed)
                .ok_or_else(|| {
                    ExecutionError::new_with_log(
                        actual_caller,
                        "mint_PRIMARY",
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

            let mut slot_mint = PRIMARY_PER_THRESHOLD[current_threshold_index as usize].checked_mul(
                secondary_mint_primary_with_current_threshold
            ).ok_or_else(||
                ExecutionError::new_with_log(
                    actual_caller,
                    "mint_PRIMARY",
                    ExecutionError::MultiplicationOverflow {
                        operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                        details: format!(
                            "PRIMARY_PER_THRESHOLD[current_threshold_index]: {} with secondary_mint_primary_with_current_threshold:{}",
                            PRIMARY_PER_THRESHOLD[current_threshold_index as usize],
                            secondary_mint_primary_with_current_threshold
                        ),
                    }
                )
            )?;
            slot_mint = slot_mint.checked_mul(10000).ok_or_else(|| {
                ExecutionError::new_with_log(
                    actual_caller,
                    "mint_PRIMARY",
                    ExecutionError::MultiplicationOverflow {
                        operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                        details: format!("slot_mint: {} with {}", slot_mint, 10000),
                    }
                )
            })?;

            phase_mint_primary = phase_mint_primary.checked_add(slot_mint).ok_or_else(|| {
                ExecutionError::new_with_log(
                    actual_caller,
                    "mint_PRIMARY",
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
                    "mint_PRIMARY",
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
        phase_mint_primary = PRIMARY_PER_THRESHOLD[current_threshold_index as usize].checked_mul(
            secondary_burn
        ).ok_or_else(|| {
            ExecutionError::new_with_log(
                actual_caller,
                "mint_PRIMARY",
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
                "mint_PRIMARY",
                ExecutionError::MultiplicationOverflow {
                    operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                    details: format!("phase_mint_primary: {} with {}", phase_mint_primary, 10000),
                }
            )
        })?;
    }

    // Check for maximum PRIMARY per transaction (50 PRIMARY = 500_000 after multiplication by 10000)
    if phase_mint_primary > 500_000_0000 {
        return Err(
            ExecutionError::new_with_log(
                actual_caller,
                "mint_PRIMARY",
                ExecutionError::MaxAlexPerTrnxReached {
                    reason: format!(
                        "This would mint {} PRIMARY which exceeds the maximum of 50 PRIMARY per transaction",
                        (phase_mint_primary as f64) / 10000.0
                    ),
                }
            )
        );
    }

    let mut total_primary_minted = 0;

    match fetch_total_minted_PRIMARY().await {
        Ok(result) => {
            total_primary_minted = result;
        }
        Err(e) => {
            return Err(
                ExecutionError::new_with_log(
                    actual_caller,
                    "mint_PRIMARY",
                    ExecutionError::CanisterCallFailed {
                        canister: "PRIMARY".to_string(),
                        method: "mint".to_string(),
                        details: e,
                    }
                )
            );
        }
    }
    let remaining_primary = MAX_PRIMARY.checked_sub(total_primary_minted).ok_or_else(|| {
        ExecutionError::new_with_log(actual_caller, "mint_PRIMARY", ExecutionError::Underflow {
            operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
            details: format!(
                "MAX_PRIMARY: {} with total_primary_minted: {}",
                MAX_PRIMARY,
                total_primary_minted
            ),
        })
    })?;
    let primary_to_mint = phase_mint_primary
        .checked_mul(3)
        .ok_or_else(|| {
            ExecutionError::new_with_log(
                actual_caller,
                "mint_PRIMARY",
                ExecutionError::MultiplicationOverflow {
                    operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                    details: format!("phase_mint_primary: {} with {}", phase_mint_primary, 3),
                }
            )
        })?
        .min(remaining_primary);

    if primary_to_mint == 0 {
        return Err(
            ExecutionError::new_with_log(
                actual_caller,
                "mint_PRIMARY",
                ExecutionError::NoMoreAlexCanbeMinted {
                    reason: format!("No more PRIMARY can be minted"),
                }
            )
        );
    }

    let primary_per_recipient = primary_to_mint.checked_div(3).ok_or_else(|| {
        ExecutionError::new_with_log(actual_caller, "mint_PRIMARY", ExecutionError::DivisionFailed {
            operation: DEFAULT_DIVISION_ERROR.to_string(),
            details: format!("primary_to_mint: {} with  {}", primary_to_mint, 3),
        })
    })?;
    let fetched_random_principals = get_two_random_nfts().await;
    match fetched_random_principals {
        Ok(((principal1, subaccount1), (principal2, subaccount2))) => {
            random_users = (principal1, principal2);

            let subaccount1_arr: Option<[u8; 32]> = if subaccount1.len() == 32 {
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&subaccount1);
                Some(arr)
            } else {
                None
            };

            let subaccount2_arr: Option<[u8; 32]> = if subaccount2.len() == 32 {
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&subaccount2);
                Some(arr)
            } else {
                None
            };

            match
                mint_PRIMARY_internal(
                    primary_per_recipient,
                    actual_caller,
                    to_subaccount.map(|s| s.0)
                ).await
            {
                Ok(_) => {
                    register_info_log(
                        actual_caller,
                        "mint_PRIMARY",
                        &format!("Sucessfully minted {}(e8s) PRIMARY to  {}  ", primary_per_recipient,actual_caller)
                    );
                    minted_primary = minted_primary.checked_add(primary_per_recipient).ok_or_else(|| {
                        ExecutionError::new_with_log(
                            actual_caller,
                            "mint_PRIMARY",
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
                            "mint_PRIMARY",
                            ExecutionError::MintFailed {
                                token: "PRIMARY".to_string(),
                                amount: primary_per_recipient,
                                reason: "PRIMARY ".to_string() + DEFAULT_MINT_FAILED,
                                details: e.to_string(),
                            }
                        )
                    );
                }
            }

            match mint_PRIMARY_internal(primary_per_recipient, random_users.0, subaccount1_arr).await {
                Ok(_) => {
                    register_info_log(
                        actual_caller,
                        "mint_PRIMARY",
                        &format!("Sucessfully minted {} (e8s) PRIMARY to  {}  ", primary_per_recipient,random_users.0)
                    );
                    minted_primary = minted_primary.checked_add(primary_per_recipient).ok_or_else(|| {
                        ExecutionError::new_with_log(
                            actual_caller,
                            "mint_PRIMARY",
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
                Err(_e) =>
                    update_log(
                        &format!(
                            "Something went wrong while minting to random user 1. Principal: {}",
                            random_users.0
                        )
                    ),
            }

            match mint_PRIMARY_internal(primary_per_recipient, random_users.1, subaccount2_arr).await {
                Ok(_) => {
                    register_info_log(
                        actual_caller,
                        "mint_PRIMARY",
                        &format!("Sucessfully minted {} (e8s) PRIMARY  to  {}  ", primary_per_recipient,random_users.1)
                    );
                    minted_primary = minted_primary.checked_add(primary_per_recipient).ok_or_else(|| {
                        ExecutionError::new_with_log(
                            actual_caller,
                            "mint_PRIMARY",
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
                Err(_e) =>
                    update_log(
                        &format!(
                            "Something went wrong while minting to random user 2. Principal: {}",
                            random_users.1
                        )
                    ),
            }
        }
        Err(e) => {
            return Err(
                ExecutionError::new_with_log(
                    actual_caller,
                    "mint_PRIMARY",
                    ExecutionError::CanisterCallFailed {
                        canister: "icrc7_scion".to_string(),
                        method: "get_two_random_nfts".to_string(),
                        details: "Failed to fetch random users".to_string(),
                    }
                )
            )?;
        }
    }

    update_to_current_threshold(current_threshold_index);
    add_to_total_SECONDARY_burned(secondary_burn)?;
    Ok("Minted PRIMARY ".to_string() + &minted_primary.to_string())
}

async fn mint_PRIMARY_internal(
    minted_primary: u64,
    destination: Principal,
    to_subaccount: Option<[u8; 32]>
) -> Result<BlockIndex, String> {
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
            get_principal(PRIMARY_CANISTER_ID),
            "icrc1_transfer",
            (transfer_args,)
        ).await
        .map_err(|e| format!("failed to call ledger: {:?}", e))?
        .0.map_err(|e| format!("ledger transfer error {:?}", e))
}
