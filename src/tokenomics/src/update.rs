use crate::guard::*;
use crate::error::ExecutionError;
use crate::register_info_log;
use crate::storage::*;
use crate::DEFAULT_ADDITION_OVERFLOW_ERROR;
use crate::DEFAULT_MINT_FAILED;
use crate::DEFAULT_MULTIPLICATION_OVERFLOW_ERROR;
use crate::DEFAULT_UNDERFLOW_ERROR;
use crate::{
    add_to_total_secondary_burned,
    fetch_total_minted_primary,
    get_current_threshold_index,
    get_total_secondary_burn,
    update_to_current_threshold,
    get_config,
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
    let minted_primary: u64;
    let mut phase_mint_primary: u64 = 0;
    let mut total_burned_secondary: u64 = get_total_secondary_burn();
    register_info_log(
        actual_caller,
        "mint_primary",
        &format!("Processing primary minting against {} secondary ", secondary_burn)
    );
    
    // Early debug log
    register_info_log(
        actual_caller,
        "mint_primary",
        &format!("DEBUG: total_burned_secondary={}, secondary_burn={}", total_burned_secondary, secondary_burn)
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
        })? > {
            let thresholds = get_thresholds().map_err(|e| {
                ExecutionError::new_with_log(
                    actual_caller,
                    "mint_primary",
                    ExecutionError::CanisterCallFailed {
                        canister: "tokenomics".to_string(),
                        method: "get_thresholds".to_string(),
                        details: e,
                    }
                )
            })?;
            // Log the threshold check
            let last_threshold = thresholds[thresholds.len() - 1];
            // Note: We already know this won't overflow because checked_add succeeded above
            let total_after_burn = total_burned_secondary.saturating_add(secondary_burn);
            register_info_log(
                actual_caller,
                "mint_primary",
                &format!("Early threshold check: total_after_burn={} vs last_threshold={}", total_after_burn, last_threshold)
            );
            thresholds[thresholds.len() - 1]
        }
    {
        register_info_log(
            actual_caller,
            "mint_primary",
            "EXCEEDED last threshold - stopping minting"
        );
        return Err(
            ExecutionError::new_with_log(
                actual_caller,
                "mint_primary",
                ExecutionError::MaxMintPrimaryReached {
                    reason: "Max primary reached, minting stopped!".to_string(),
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

    let thresholds = get_thresholds().map_err(|e| {
        ExecutionError::new_with_log(
            actual_caller,
            "mint_primary",
            ExecutionError::CanisterCallFailed {
                canister: "tokenomics".to_string(),
                method: "get_thresholds".to_string(),
                details: e,
            }
        )
    })?;
    let rewards = get_rewards().map_err(|e| {
        ExecutionError::new_with_log(
            actual_caller,
            "mint_primary",
            ExecutionError::CanisterCallFailed {
                canister: "tokenomics".to_string(),
                method: "get_rewards".to_string(),
                details: e,
            }
        )
    })?;
    
    // Log current threshold state
    let current_reward = rewards.get(current_threshold_index as usize).copied().unwrap_or(0);
    register_info_log(actual_caller, "mint_primary", &format!(
        "Threshold state: current_index={}, current_threshold={}, current_reward={}, total_burned={}",
        current_threshold_index,
        thresholds.get(current_threshold_index as usize).unwrap_or(&0),
        current_reward,
        total_burned_secondary
    ));
    
    // Critical check: if reward is 0, we can't mint anything
    if current_reward == 0 {
        register_info_log(actual_caller, "mint_primary", 
            "CRITICAL: Current reward rate is 0 - no primary tokens can be minted!");
    }
    if tentative_total > thresholds[current_threshold_index as usize] {
        let mut secondary_processed: u64 = 0;

        while tentative_total > thresholds[current_threshold_index as usize] {
            let secondary_mint_primary_with_current_threshold: u64 = if
                total_burned_secondary < thresholds[current_threshold_index as usize]
            {
                thresholds[current_threshold_index as usize] - total_burned_secondary
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

            let mut slot_mint = rewards[current_threshold_index as usize].checked_mul(
                secondary_mint_primary_with_current_threshold
            ).ok_or_else(||
                ExecutionError::new_with_log(
                    actual_caller,
                    "mint_primary",
                    ExecutionError::MultiplicationOverflow {
                        operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                        details: format!(
                            "PRIMARY_PER_THRESHOLD[current_threshold_index]: {} with secondary_mint_primary_with_current_threshold: {}",
                            rewards[current_threshold_index as usize],
                            secondary_mint_primary_with_current_threshold
                        ),
                    }
                )
            )?;

            // CRITICAL: Keep the 10,000 multiplication - converts from 4 decimals to 8 decimals
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
            
            // Log calculation details
            register_info_log(actual_caller, "mint_primary", &format!(
                "Threshold loop: secondary_for_threshold={}, reward_rate={}, slot_mint={}, phase_total={}",
                secondary_mint_primary_with_current_threshold,
                rewards[current_threshold_index as usize],
                slot_mint,
                phase_mint_primary
            ));
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
            if current_threshold_index > (thresholds.len() as u32) - 1 {
                current_threshold_index = (thresholds.len() as u32) - 1;
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

            let mut slot_mint = rewards[current_threshold_index as usize].checked_mul(
                secondary_mint_primary_with_current_threshold
            ).ok_or_else(||
                ExecutionError::new_with_log(
                    actual_caller,
                    "mint_primary",
                    ExecutionError::MultiplicationOverflow {
                        operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                        details: format!(
                            "PRIMARY_PER_THRESHOLD[current_threshold_index]: {} with secondary_mint_primary_with_current_threshold:{}",
                            rewards[current_threshold_index as usize],
                            secondary_mint_primary_with_current_threshold
                        ),
                    }
                )
            )?;
            // CRITICAL: Keep the 10,000 multiplication - converts from 4 decimals to 8 decimals
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
        // Log when not crossing threshold
        register_info_log(actual_caller, "mint_primary", &format!(
            "Not crossing threshold: secondary_burn={}, current_reward={}, tentative_total={} < threshold={}",
            secondary_burn,
            rewards[current_threshold_index as usize],
            tentative_total,
            thresholds[current_threshold_index as usize]
        ));
        
        phase_mint_primary = rewards[current_threshold_index as usize].checked_mul(
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
        // CRITICAL: Keep the 10,000 multiplication - converts from 4 decimals to 8 decimals
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

    // Per-transaction limit removed - supply cap provides sufficient protection

    let total_primary_minted = match fetch_total_minted_primary().await {
        Ok(result) => result,
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
    };
    let config = get_config().ok_or_else(|| {
        ExecutionError::new_with_log(
            actual_caller,
            "mint_primary",
            ExecutionError::CanisterCallFailed {
                canister: "tokenomics".to_string(),
                method: "get_config".to_string(),
                details: "Tokenomics configuration missing. Canister not properly initialized.".to_string(),
            }
        )
    })?;
    let max_primary_supply = config.max_primary_supply;
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
    
    // Direct emission without legacy multiplier
    let primary_to_mint = phase_mint_primary.min(remaining_primary);

    // Add detailed logging before the zero check
    register_info_log(actual_caller, "mint_primary", &format!(
        "mint_primary calculation: phase_mint_primary={}, remaining_primary={}, final primary_to_mint={}",
        phase_mint_primary,
        remaining_primary,
        primary_to_mint
    ));
    
    register_info_log(actual_caller, "mint_primary", &format!(
        "mint_primary supply check: total_minted={}, max_supply={}, secondary_burn={}",
        total_primary_minted,
        max_primary_supply,
        secondary_burn
    ));

    if primary_to_mint == 0 {
        register_info_log(actual_caller, "mint_primary", &format!(
            "Zero primary tokens: phase_mint_primary={}, total_minted={}/{} max",
            phase_mint_primary,
            total_primary_minted,
            max_primary_supply
        ));
        return Err(
            ExecutionError::new_with_log(
                actual_caller,
                "mint_primary",
                ExecutionError::NoMorePrimaryCanBeMinted {
                    reason: format!("No more primary can be minted"),
                }
            )
        );
    }

    // Mint 100% to the burner
    match
        mint_primary_internal(
            primary_to_mint,
            actual_caller,
            to_subaccount.map(|s| s.0)
        ).await
    {
        Ok(_) => {
            register_info_log(
                actual_caller,
                "mint_primary",
                &format!("Successfully minted {}(e8s) primary to {}", primary_to_mint, actual_caller)
            );
            minted_primary = primary_to_mint;
        }
        Err(e) => {
            return Err(
                ExecutionError::new_with_log(
                    actual_caller,
                    "mint_primary",
                    ExecutionError::MintFailed {
                        token: "primary".to_string(),
                        amount: primary_to_mint,
                        reason: "primary ".to_string() + DEFAULT_MINT_FAILED,
                        details: e.to_string(),
                    }
                )
            );
        }
    }

    update_to_current_threshold(current_threshold_index);
    add_to_total_secondary_burned(secondary_burn)?;
    
    // Final success log
    register_info_log(actual_caller, "mint_primary", &format!(
        "SUCCESS: Minted {} primary tokens for {} secondary burned", 
        minted_primary, secondary_burn
    ));
    
    Ok("Minted primary ".to_string() + &minted_primary.to_string())
}

async fn mint_primary_internal(
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
    let config = get_config().ok_or("Config not initialized")?;
    ic_cdk
        ::call::<(TransferArg,), (Result<BlockIndex, TransferError>,)>(
            config.primary_token_ledger,
            "icrc1_transfer",
            (transfer_args,)
        ).await
        .map_err(|e| format!("failed to call ledger: {:?}", e))?
        .0.map_err(|e| format!("ledger transfer error {:?}", e))
}