use crate::storage::get_config;
use candid::{CandidType, Nat, Principal};
use ic_cdk::api::call::{call, RejectionCode};

#[derive(CandidType)]
struct BalanceOfArgs {
    owner: Principal,
    subaccount: Option<Vec<u8>>,
}

pub async fn get_primary_token_supply() -> Result<Nat, String> {
    let config = get_config();
    let canister_id = config.primary_token_id;
    match call::<(), (Nat,)>(canister_id, "icrc1_total_supply", ()).await {
        Ok((supply,)) => Ok(supply),
        Err((code, msg)) => Err(format!(
            "Primary token supply call failed: {:?}: {}",
            code, msg
        )),
    }
}

pub async fn get_secondary_token_supply() -> Result<Nat, String> {
    let config = get_config();
    let canister_id = config.secondary_token_id;
    match call::<(), (Nat,)>(canister_id, "icrc1_total_supply", ()).await {
        Ok((supply,)) => Ok(supply),
        Err((code, msg)) => Err(format!(
            "Secondary token supply call failed: {:?}: {}",
            code, msg
        )),
    }
}

pub async fn get_total_secondary_burned() -> Result<u64, String> {
    let config = get_config();
    let canister_id = config.tokenomics_id;
    match call::<(), (u64,)>(canister_id, "get_total_secondary_burn", ()).await {
        Ok((total,)) => Ok(total),
        Err((code, msg)) => Err(format!(
            "Total secondary burned call failed: {:?}: {}",
            code, msg
        )),
    }
}

pub async fn get_icp_in_lp_treasury() -> Result<u64, String> {
    let config = get_config();
    let canister_id = config.icp_swap_id;
    match call::<(), (u64,)>(canister_id, "get_lp_treasury_balance", ()).await {
        Ok((balance,)) => Ok(balance),
        Err((code, msg)) => Err(format!(
            "ICP in LP treasury call failed: {:?}: {}",
            code, msg
        )),
    }
}

pub async fn get_total_primary_staked() -> Result<Nat, String> {
    let config = get_config();
    let primary_canister_id = config.primary_token_id;
    let icp_swap_canister_id = config.icp_swap_id;
    let args = BalanceOfArgs {
        owner: icp_swap_canister_id,
        subaccount: None,
    };
    let result: Result<(Nat,), (RejectionCode, String)> =
        ic_cdk::call(primary_canister_id, "icrc1_balance_of", (args,)).await;
    match result {
        Ok((balance,)) => Ok(balance),
        Err((code, msg)) => Err(format!(
            "Total primary staked call failed: {:?} - {}",
            code, msg
        )),
    }
}

pub async fn get_stakers_count() -> Result<u64, String> {
    let config = get_config();
    let canister_id = config.icp_swap_id;
    match call::<(), (u64,)>(canister_id, "get_stakers_count", ()).await {
        Ok((count,)) => Ok(count),
        Err((code, msg)) => Err(format!("Stakers count call failed: {:?}: {}", code, msg)),
    }
}

pub async fn get_apy_value() -> Result<u128, String> {
    let config = get_config();
    let canister_id = config.icp_swap_id;
    match call::<(), (Vec<(u32, u128)>,)>(canister_id, "get_all_apy_values", ()).await {
        Ok((apy_values,)) => {
            let last_value = apy_values.last().map(|(_, value)| *value).unwrap_or(0);
            Ok(last_value)
        }
        Err((code, msg)) => Err(format!("APY value call failed: {:?}: {}", code, msg)),
    }
}

