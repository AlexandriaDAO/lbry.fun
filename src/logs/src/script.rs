use std::time::Duration;
use ic_cdk::{init, update};
use crate::guard::*;
use crate::register_log;
use crate::storage::{Config, CONFIGS};
use candid::{CandidType, Deserialize, Principal};
pub const LOG_INTERVAL: Duration = Duration::from_secs(60*60); // 1 hour.

#[derive(CandidType, Deserialize)]
pub struct InitArgs {
    pub primary_token_id: Principal,
    pub secondary_token_id: Principal,
    pub icp_swap_id: Principal,
    pub tokenomics_id: Principal,
}

#[init]
 fn init(args: InitArgs) {
    if args.primary_token_id == Principal::anonymous() {
        ic_cdk::trap("Initialization failed: 'primary_token_id' cannot be anonymous.");
    }
    if args.secondary_token_id == Principal::anonymous() {
        ic_cdk::trap("Initialization failed: 'secondary_token_id' cannot be anonymous.");
    }
    if args.icp_swap_id == Principal::anonymous() {
        ic_cdk::trap("Initialization failed: 'icp_swap_id' cannot be anonymous.");
    }
    if args.tokenomics_id == Principal::anonymous() {
        ic_cdk::trap("Initialization failed: 'tokenomics_id' cannot be anonymous.");
    }

    let config = Config {
        primary_token_id: args.primary_token_id,
        secondary_token_id: args.secondary_token_id,
        icp_swap_id: args.icp_swap_id,
        tokenomics_id: args.tokenomics_id,
    };

    CONFIGS.with(|c| {
        c.borrow_mut()
            .set(config)
            .expect("Failed to initialize config");
    });

    let _log_timer_id: ic_cdk_timers::TimerId = ic_cdk_timers::set_timer_interval(LOG_INTERVAL, || ic_cdk::spawn(register_log_wrapper()));
}

#[update(guard = "is_canister")]
async fn register_log_wrapper() {
    match register_log().await {
        Ok(_) => ic_cdk::println!("Logged wrapper"),
        Err(e) => ic_cdk::println!("Error registering log: {}", e),
    }
}