use ic_cdk::update;
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
    let primary_token_supply = get_primary_token_supply().await?;
    let secondary_token_supply = get_secondary_token_supply().await?;
    let total_secondary_burned = get_total_secondary_burned().await?;
    let icp_in_lp_treasury = get_icp_in_lp_treasury().await?;
    let total_primary_staked = get_total_primary_staked().await?;
    let staker_count = get_stakers_count().await?;
    let apy = get_apy_value().await?;
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

        log_map.insert(time.clone(), new_log);
        Ok(())
    })?;
    Ok("Logged!".to_string())
}
