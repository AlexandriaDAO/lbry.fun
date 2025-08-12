use ic_cdk::update;
use candid::Nat;
use crate::guard::*;
use crate::{
    utils::{
        get_apy_value, get_icp_in_lp_treasury, get_primary_token_supply,
        get_secondary_token_supply, get_stakers_count, get_total_primary_staked,
        get_total_secondary_burned,
    },
    Log, LOGS,
};

#[update(guard = "is_canister")]
pub async fn register_log() -> Result<String, String> {
    // Use unwrap_or with sensible defaults instead of ? operator
    let primary_token_supply = get_primary_token_supply().await.unwrap_or(Nat::from(0u128));
    let secondary_token_supply = get_secondary_token_supply().await.unwrap_or(Nat::from(0u128));
    let total_secondary_burned = get_total_secondary_burned().await.unwrap_or(0);
    let icp_in_lp_treasury = get_icp_in_lp_treasury().await.unwrap_or(0);
    let total_primary_staked = get_total_primary_staked().await.unwrap_or(Nat::from(0u128));
    let staker_count = get_stakers_count().await.unwrap_or(0);
    let apy = get_apy_value().await.unwrap_or(0);
    let time = ic_cdk::api::time();

    LOGS.with(|logs| -> Result<(), String> {
        let mut log_map = logs.borrow_mut();
        if log_map.contains_key(&time) {
            return Err("Log already exists for this timestamp".to_string());
        }
        let new_log = Log {
            time,
            primary_token_supply,
            secondary_token_supply,
            total_secondary_burned,
            icp_in_lp_treasury,
            total_primary_staked,
            staker_count,
            apy,
        };

        log_map.insert(time, new_log);
        Ok(())
    })?;
    Ok("Logged!".to_string())
}
