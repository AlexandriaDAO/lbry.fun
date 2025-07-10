use crate::{
    storage::*,
    utils::{
        principal_to_subaccount, is_token_live, SCALING_FACTOR, STAKING_REWARD_PERCENTAGE,
    },
    Configs,
    CONFIGS,
    LAUNCH_TIME,
};
use candid::{CandidType, Principal};
use ic_cdk::{api::caller, query};
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
pub fn get_total_unclaimed_icp_reward() -> u64 {
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
                let icp_reward_per_alex =
                    daily_values.values.get(&day).cloned().unwrap_or_default();
                (day, icp_reward_per_alex)
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
