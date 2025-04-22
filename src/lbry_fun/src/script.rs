use ic_cdk::{self, init, post_upgrade};
use std::time::Duration;

use crate::publish_eligible_tokens_on_kongswap;

pub const INTERVAL: Duration = Duration::from_secs(60*60); // 1 hour.

#[post_upgrade]
fn post_upgrade() {
    setup_timers();
}

fn setup_timers() {
    // Periodic
    let _timer_id: ic_cdk_timers::TimerId =
        ic_cdk_timers::set_timer_interval(INTERVAL, || ic_cdk::spawn(publish_eligible_tokens_on_kongswap_wrapper()));
}

async fn publish_eligible_tokens_on_kongswap_wrapper() {
    match publish_eligible_tokens_on_kongswap().await {
        Ok(_) => ic_cdk::println!("Published eligible tokens completed!"),
        Err(e) => {
            ic_cdk::println!("Error launching on Kongswap: {}", e);
        }
    }
}

#[init]
fn init() {
    setup_timers();
    ic_cdk::println!("Initialization complete");
}
