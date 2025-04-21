use candid::{CandidType, Principal};
use ic_cdk::{self, caller, init, post_upgrade, update};
use serde::Deserialize;
use std::time::Duration;


pub const INTERVAL: Duration = Duration::from_secs(60 * 60); // 1 hour.


#[post_upgrade]
fn post_upgrade() {
    setup_timers();

}

fn setup_timers() {
    // Initial price fetch


    // Periodic
    let timer_id: ic_cdk_timers::TimerId =
        ic_cdk_timers::set_timer_interval(INTERVAL, || {
            // ic_cdk::spawn(())
        });


}

