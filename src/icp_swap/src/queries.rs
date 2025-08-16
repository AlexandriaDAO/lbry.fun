use crate::{
    storage::*,
    utils::{
        principal_to_subaccount, is_token_live, SCALING_FACTOR, STAKING_REWARD_PERCENTAGE,
    },
    Configs,
    CONFIGS,
    LAUNCH_TIME,
    UNCOLLECTED_ALEX_FEES,
    REWARD_POOL,
    ReconciliationStatus,
    ALLOWED_DISCREPANCY_E8S,
};
use candid::{CandidType, Principal};
use ic_cdk::{api::caller, query, update};
use serde::Deserialize;
//swap
#[query]
pub async fn caller_subaccount() -> String {
    // In ICRC-1, we return the subaccount as a hex string
    let subaccount = principal_to_subaccount(&caller());
    // Convert bytes to hex string manually
    subaccount.iter()
        .map(|byte| format!("{:02x}", byte))
        .collect::<String>()
}
//stake
#[query]
pub fn get_all_stakes() -> Vec<(Principal, Stake)> {
    STAKES.with(|stakes| {
        let stakes_map = stakes.borrow();

        // return a Vec of tuples
        stakes_map
            .iter()
            .map(|(principal, stake)| (principal.clone(), stake.clone())) // Clone to ensure ownership
            .collect()
    })
}

#[query]
pub fn get_stakers_count() -> u64 {
    STAKES.with(|stakes| {
        let stakes_map = stakes.borrow();
        stakes_map.len() as u64 // Return the number of stakers as u64
    })
}
#[query]
pub fn get_stake(principal: Principal) -> Option<Stake> {
    STAKES.with(|stakes| {
        let stakes_map = stakes.borrow();
        stakes_map.get(&principal)
    })
}

#[query]
pub fn get_total_unclaimed_icp_reward() -> u128 {
    let result = get_total_unclaimed_icp_reward_mem();
    result.get(&()).unwrap_or(0)
}

#[query]
pub fn get_current_staking_reward_percentage() -> String {
    format!("Staking percentage {}%", STAKING_REWARD_PERCENTAGE / 100)
}

#[query]
pub fn get_current_secondary_ratio() -> Option<u64> {
    let secondary_ratio_map = get_secondary_ratio_mem();

    match secondary_ratio_map.get(&()) {
        Some(secondary_ratio) => Some(secondary_ratio.ratio), // Return the ratio if it exists
        None => None,                                          // Return None if no ratio is set
    }
}

#[query]
pub fn get_user_archive_balance(principal: Principal) -> Option<ArchiveBalance> {
    ARCHIVED_TRANSACTION_LOG.with(|trx| {
        let trxs = trx.borrow();
        trxs.get(&principal)
    })
}

#[query]
pub fn get_all_archive_balances() -> Vec<(Principal, ArchiveBalance)> {
    ARCHIVED_TRANSACTION_LOG.with(|trxs| {
        let trxs = trxs.borrow();

        trxs.iter()
            .map(|(principal, balance)| (principal.clone(), balance.clone()))
            .collect()
    })
}
#[query]
pub fn get_total_archived_balance() -> u64 {
    let result = get_total_archived_balance_mem();
    result.get(&()).unwrap_or(0)
}
#[query]
pub fn get_distribution_interval() -> u32 {
    let result = get_distribution_interval_mem();
    result.get(&()).unwrap_or(0)
}

#[query]
pub fn get_all_apy_values() -> Vec<(u32, u128)> {
    APY.with(|apy| {
        let mut values: Vec<(u32, u128)> = apy
            .borrow()
            .iter()
            .map(|(day, daily_values)| {
                // Extract the day and its corresponding reward value
                let icp_reward_per_primary =
                    daily_values.values.get(&day).cloned().unwrap_or_default();
                (day, icp_reward_per_primary)
            })
            .collect();

        // Sort the values by day (ascending order)
        values.sort_by_key(|&(day, _)| day);

        values
    })
}
#[query]
pub fn get_scaling_factor() -> u128 {
    return SCALING_FACTOR;
}
#[derive(CandidType, Deserialize)]
pub struct PaginatedLogs {
    logs: Vec<Log>,
    total_pages: u64,
    current_page: u64,
    page_size: u64,
}

#[query]
pub fn get_logs(page: Option<u64>, page_size: Option<u64>) -> PaginatedLogs {
    let page = page.unwrap_or(1).max(1); // Ensure page is at least 1
    let page_size = page_size.unwrap_or(10).max(1); // Ensure page_size is at least 1

    LOGS.with(|logs| {
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

        PaginatedLogs {
            logs,
            total_pages,
            current_page: page,
            page_size,
        }
    })
}

#[query]
pub fn get_config() -> Option<Configs> {
    CONFIGS.with(|configs| {
        configs.borrow().get(&()).map(|c| c.clone())
    })
}

#[query]
pub fn get_launch_status() -> (bool, Option<u64>) {
    let is_live = is_token_live();
    let launch_time = LAUNCH_TIME.with(|m| m.borrow().get(&()));
    (is_live, launch_time)
}

// Query function for lbry_fun to check available fees
#[query]
pub fn get_uncollected_fees() -> (u64, u64) {
    (
        UNCOLLECTED_ALEX_FEES.with(|f| f.borrow().get(&()).unwrap_or(0)),
        0  // LP fees are distributed directly to stakers, not accumulated
    )
}

// Query function to get reward pool status
#[query]
pub fn get_reward_pool_status() -> u64 {
    REWARD_POOL.with(|p| p.borrow().get(&()).unwrap_or(0))
}

#[update]
pub async fn get_reconciliation_status() -> ReconciliationStatus {
    // 1. Get actual ICP balance from ledger using existing utility
    let actual_balance = match crate::utils::fetch_canister_icp_balance().await {
        Ok(balance) => balance,
        Err(_) => return ReconciliationStatus {
            // Return error state with all zeros
            icp_balance_actual: 0,
            icp_balance_expected: 0,
            discrepancy_e8s: 0,
            reward_pool: 0,
            uncollected_alex_fees: 0,
            total_staked: 0,
            operational_balance: 0,
            total_claimed_rewards: 0,
            unexplained_discrepancy: 0,
            timestamp: ic_cdk::api::time(),
            canister_id: ic_cdk::api::id(),
            requires_attention: true,
            operational_balance_suspicious: false,
        }
    };
    
    // 2. Gather all components of expected balance
    let reward_pool = REWARD_POOL.with(|p| p.borrow().get(&()).unwrap_or(0));
    let uncollected_alex = UNCOLLECTED_ALEX_FEES.with(|f| f.borrow().get(&()).unwrap_or(0));
    
    // 3. Calculate total ICP rewards reserved for stakers (sum of all accumulated rewards)
    let total_staked = STAKES.with(|stakes| {
        stakes.borrow().iter()
            .map(|(_, stake)| stake.reward_icp as u64)
            .sum::<u64>()
    });
    
    // 4. Get archived balance (ICP held for users from failed transactions)
    let archived_balance = get_total_archived_balance();
    
    // 5. Get total claimed rewards (ICP that left the canister)
    let total_claimed = get_total_claimed_rewards();
    
    // 6. Calculate expected balance (all ICP that should be in canister)
    let expected_balance = reward_pool + uncollected_alex + total_staked + archived_balance;
    
    // 7. Calculate actual discrepancy between ledger balance and internal accounting
    let discrepancy = (actual_balance as i64) - (expected_balance as i64);
    
    // 8. Calculate unexplained discrepancy
    // Note: Claimed rewards are already accounted for through reduced stake.reward_icp values
    // which automatically reduces total_staked and thus expected_balance.
    // No adjustment needed - discrepancy already reflects true unexplained amount.
    let unexplained_discrepancy = discrepancy;
    
    // 9. Operational balance represents unexplained positive funds
    let operational_balance = if unexplained_discrepancy > 0 {
        unexplained_discrepancy as u64
    } else {
        0
    };
    
    // 10. Validate operational balance isn't suspiciously high
    // If operational balance is more than 10% of total staked, flag it
    let operational_balance_suspicious = if total_staked > 0 {
        operational_balance > (total_staked / 10)
    } else {
        operational_balance > 100_000_000  // 1 ICP for empty pools
    };
    
    ReconciliationStatus {
        icp_balance_actual: actual_balance,
        icp_balance_expected: expected_balance,
        discrepancy_e8s: discrepancy,
        reward_pool,
        uncollected_alex_fees: uncollected_alex,
        total_staked,
        operational_balance,
        total_claimed_rewards: total_claimed,
        unexplained_discrepancy,
        timestamp: ic_cdk::api::time(),
        canister_id: ic_cdk::api::id(),
        requires_attention: unexplained_discrepancy.abs() as u64 > ALLOWED_DISCREPANCY_E8S || operational_balance_suspicious,
        operational_balance_suspicious,
    }
}

#[query]
pub fn get_total_claimed_rewards() -> u64 {
    crate::storage::get_total_claimed_rewards()
}

#[query]
pub fn validate_reward_consistency() -> Result<String, String> {
    let sum_of_rewards: u128 = STAKES.with(|stakes| {
        stakes.borrow()
            .iter()
            .map(|(_, stake)| stake.reward_icp)
            .sum()
    });
    
    let total_unclaimed = get_total_unclaimed_icp_reward();
    
    if sum_of_rewards != total_unclaimed {
        return Err(format!(
            "Reward mismatch: sum of individual rewards {} != total unclaimed {}",
            sum_of_rewards, total_unclaimed
        ));
    }
    Ok(format!("Reward consistency validated: {} E8S", total_unclaimed))
}

#[query]
pub fn validate_archived_consistency() -> Result<String, String> {
    let sum_of_archived: u64 = ARCHIVED_TRANSACTION_LOG.with(|log| {
        log.borrow()
            .iter()
            .map(|(_, balance)| balance.icp)
            .sum()
    });
    
    let total_archived = get_total_archived_balance();
    
    if sum_of_archived != total_archived {
        return Err(format!(
            "Archive mismatch: sum of individual archives {} != total archived {}",
            sum_of_archived, total_archived
        ));
    }
    Ok(format!("Archive consistency validated: {} E8S", total_archived))
}

#[update]
pub async fn validate_accounting() -> Result<String, String> {
    // Check reward consistency
    let reward_check = validate_reward_consistency();
    if let Err(e) = reward_check {
        return Err(format!("Reward validation failed: {}", e));
    }
    
    // Check archive consistency
    let archive_check = validate_archived_consistency();
    if let Err(e) = archive_check {
        return Err(format!("Archive validation failed: {}", e));
    }
    
    // Check that no values are suspiciously negative (using saturating arithmetic detection)
    let reward_pool = REWARD_POOL.with(|p| p.borrow().get(&()).unwrap_or(0));
    let uncollected_fees = UNCOLLECTED_ALEX_FEES.with(|f| f.borrow().get(&()).unwrap_or(0));
    
    // Get actual balance
    let actual_balance = crate::utils::fetch_canister_icp_balance().await
        .map_err(|e| format!("Failed to fetch balance: {:?}", e))?;
    
    // Calculate expected
    let total_unclaimed = get_total_unclaimed_icp_reward();
    let total_archived = get_total_archived_balance();
    let total_claimed = get_total_claimed_rewards();
    
    let expected = reward_pool
        .saturating_add(uncollected_fees)
        .saturating_add(total_unclaimed.try_into().unwrap_or(u64::MAX))
        .saturating_add(total_archived);
    
    let discrepancy = (actual_balance as i64) - (expected as i64);
    // No adjustment for claimed rewards - they're already accounted for in expected balance
    let unexplained = discrepancy;
    
    Ok(format!(
        "Validation complete. Actual: {} E8S, Expected: {} E8S, Discrepancy: {} E8S\n\
         Reward pool: {}, Uncollected fees: {}, Total unclaimed: {}, Total archived: {}\n\
         Total claimed (left canister): {} E8S\n\
         Unexplained discrepancy: {} E8S",
        actual_balance, expected, discrepancy, 
        reward_pool, uncollected_fees, total_unclaimed, total_archived,
        total_claimed, unexplained
    ))
}
