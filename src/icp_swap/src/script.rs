use candid::{ CandidType, Principal };
use ic_cdk::{ self, caller, init, post_upgrade };
use serde::Deserialize;
use std::time::Duration;

use crate::{
    distribute_reward,
    get_icp_rate_in_cents,
    utils::register_info_log,
    ArchiveBalance,
    Configs,
    DailyValues,
    SecondaryRatio,
    Stake,
    APY,
    ARCHIVED_TRANSACTION_LOG,
    CONFIGS,
    DISTRIBUTION_INTERVALS,
    LAUNCH_TIME,
    SECONDARY_RATIO,
    STAKES,
    TOTAL_ARCHIVED_BALANCE,
    TOTAL_UNCLAIMED_ICP_REWARD,
    TOKEN_ID,
};

pub const PRICE_FETCH_INTERVAL: Duration = Duration::from_secs(1 * 24 * 60 * 60); // 1 days in seconds
pub const ALEX_FEE_PUSH_INTERVAL: Duration = Duration::from_secs(4 * 60 * 60); // 4 hours- push platform fees to lbry_fun

#[derive(CandidType, Deserialize, Clone)]
pub struct InitArgs {
    pub token_id: Option<u64>,  // Add token ID for status checking
    pub stakes: Option<Vec<(Principal, Stake)>>,
    pub archived_transaction_log: Option<Vec<(Principal, ArchiveBalance)>>,
    pub total_unclaimed_icp_reward: Option<u128>,
    pub secondary_ratio: Option<SecondaryRatio>,
    pub total_archived_balance: Option<u64>,
    pub apy: Option<Vec<(u32, DailyValues)>>,
    pub distribution_intervals: Option<u32>,
    pub primary_token_id: Option<Principal>,
    pub secondary_token_id: Option<Principal>,
    pub tokenomics_canister_id: Option<Principal>,
    pub icp_ledger_id: Option<Principal>,
    pub distribution_interval_seconds: Option<u64>,
    pub launch_time: Option<u64>,
}

impl Default for InitArgs {
    fn default() -> Self {
        Self {
            token_id: None,
            stakes: None,
            archived_transaction_log: None,
            total_unclaimed_icp_reward: None,
            secondary_ratio: None,
            total_archived_balance: None,
            apy: None,
            distribution_intervals: None,
            primary_token_id: None,
            secondary_token_id: None,
            tokenomics_canister_id: None,
            icp_ledger_id: None,
            distribution_interval_seconds: None, // No default - must be explicitly set
            launch_time: None,
        }
    }
}

// Function to initialize global states from InitArgs.

fn initialize_globals(args: InitArgs) {
    if let Some(stakes) = args.stakes {
        STAKES.with(|m| {
            let mut stakes_map = m.borrow_mut();
            for (principal, stake) in stakes {
                stakes_map.insert(principal, stake);
            }
        });
    }

    if let Some(total_unclaimed_icp_reward) = args.total_unclaimed_icp_reward {
        TOTAL_UNCLAIMED_ICP_REWARD.with(|m| {
            m.borrow_mut().insert((), total_unclaimed_icp_reward);
        });
    }

    if let Some(secondary_ratio) = args.secondary_ratio {
        SECONDARY_RATIO.with(|m| {
            m.borrow_mut().insert((), secondary_ratio);
        });
    }

    if let Some(total_archived_balance) = args.total_archived_balance {
        TOTAL_ARCHIVED_BALANCE.with(|m| {
            m.borrow_mut().insert((), total_archived_balance);
        });
    }

    if let Some(apy) = args.apy {
        APY.with(|m| {
            let mut apy_map = m.borrow_mut();
            for (day, values) in apy {
                apy_map.insert(day, values);
            }
        });
    }

    if let Some(distribution_intervals) = args.distribution_intervals {
        DISTRIBUTION_INTERVALS.with(|m| {
            m.borrow_mut().insert((), distribution_intervals);
        });
    }

    if let Some(logs) = args.archived_transaction_log {
        ARCHIVED_TRANSACTION_LOG.with(|m| {
            let mut log_map = m.borrow_mut();
            for (principal, balance) in logs {
                log_map.insert(principal, balance);
            }
        });
    }

    // Initialize configs - all token IDs are required for new projects
    let self_id = ic_cdk::api::id();
    let primary_token_id = args.primary_token_id.expect("Primary token ID is required");
    let secondary_token_id = args.secondary_token_id.expect("Secondary token ID is required");
    let tokenomics_canister_id = args.tokenomics_canister_id.expect("Tokenomics canister ID is required");
    let icp_ledger_id = args.icp_ledger_id.unwrap_or(Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap());

    // Validate that none of the canister IDs are self-referential
    if primary_token_id == self_id {
        panic!("Primary token ID cannot be the same as this canister's ID");
    }
    if secondary_token_id == self_id {
        panic!("Secondary token ID cannot be the same as this canister's ID");
    }
    if tokenomics_canister_id == self_id {
        panic!("Tokenomics canister ID cannot be the same as this canister's ID");
    }
    if icp_ledger_id == self_id {
        panic!("ICP ledger ID cannot be the same as this canister's ID");
    }

    // Additional validation: ensure all token IDs are different from each other
    if primary_token_id == secondary_token_id {
        panic!("Primary and secondary token IDs must be different");
    }

    let configs = Configs {
        primary_token_id,
        secondary_token_id,
        tokenomics_canister_id,
        icp_ledger_id,
    };

    CONFIGS.with(|m| {
        m.borrow_mut().insert((), configs);
    });

    // Store distribution interval in DISTRIBUTION_INTERVALS if provided
    if let Some(interval_seconds) = args.distribution_interval_seconds {
        // Add lower bound check to prevent DoS attacks
        if interval_seconds < 60 {
            panic!("Distribution interval cannot be less than 60 seconds to prevent timer-based DoS attacks");
        }
        // Validate that the interval fits in u32 to prevent truncation
        if interval_seconds > u32::MAX as u64 {
            panic!("Distribution interval exceeds maximum allowed value of {} seconds", u32::MAX);
        }
        DISTRIBUTION_INTERVALS.with(|m| {
            m.borrow_mut().insert((), interval_seconds as u32);
        });
    }
}

#[init]
fn init(args: Option<InitArgs>) {
    register_info_log(caller(), "init", "Starting initialization...");

    match &args {
        Some(ref init_args) => {
            register_info_log(caller(), "init", "Received init arguments!");

            if let Some(ref stakes) = init_args.stakes {
                register_info_log(
                    caller(),
                    "init",
                    &format!("Stakes provided with length: {}", stakes.len())
                );
            }
            if let Some(ref archived_log) = init_args.archived_transaction_log {
                register_info_log(
                    caller(),
                    "init",
                    &format!("Archived log provided with length: {}", archived_log.len())
                );
            }
            if let Some(unclaimed_reward) = init_args.total_unclaimed_icp_reward {
                register_info_log(
                    caller(),
                    "init",
                    &format!("Total unclaimed reward: {}", unclaimed_reward)
                );
            }
            if let Some(ref ratio) = init_args.secondary_ratio {
                register_info_log(
                    caller(),
                    "init",
                    &format!("Secondary ratio provided: {}", ratio.ratio)
                );
            }
            if init_args.primary_token_id.is_some() {
                register_info_log(
                    caller(),
                    "init",
                    "Primary token ID provided"
                );
            }
            if init_args.secondary_token_id.is_some() {
                register_info_log(
                    caller(),
                    "init",
                    "Secondary token ID provided"
                );
            }
            if init_args.tokenomics_canister_id.is_some() {
                register_info_log(
                    caller(),
                    "init",
                    "Tokenomics canister ID provided"
                );
            }
            if init_args.icp_ledger_id.is_some() {
                register_info_log(
                    caller(),
                    "init",
                    "ICP ledger ID provided"
                );
            }
            if let Some(interval) = init_args.distribution_interval_seconds {
                register_info_log(
                    caller(),
                    "init",
                    &format!("Distribution interval: {} seconds", interval)
                );
            }
            
            // Store launch_time if provided
            if let Some(launch_time) = init_args.launch_time {
                LAUNCH_TIME.with(|m| m.borrow_mut().insert((), launch_time));
                ic_cdk::println!("Launch time set to: {}", launch_time);
            }

            initialize_globals(init_args.clone());
            register_info_log(caller(), "init", "Initialization with provided args complete");
        }
        None => {
            register_info_log(caller(), "init", "No arguments provided, using defaults");
            initialize_globals(InitArgs::default());
            register_info_log(caller(), "init", "Default initialization complete");
        }
    }

    // Store token ID if provided
    if let Some(ref init_args) = args {
        if let Some(token_id) = init_args.token_id {
            TOKEN_ID.with(|id| *id.borrow_mut() = token_id);
            register_info_log(caller(), "init", &format!("Token ID stored: {}", token_id));
        }
    }
    
    let distribution_interval = args.as_ref()
        .and_then(|args| args.distribution_interval_seconds)
        .expect("Distribution interval seconds is required");
    setup_timers(distribution_interval);
    register_info_log(caller(), "init", "Initialization process completed");
}

#[post_upgrade]
fn post_upgrade() {
    // Get distribution interval from storage, default to 1 hour
    let distribution_interval = DISTRIBUTION_INTERVALS.with(|m| {
        m.borrow().get(&()).unwrap_or(3600) as u64
    });
    setup_timers(distribution_interval);
    register_info_log(caller(), "post_upgrade", "Post-upgrade timer setup completed");
}

fn setup_timers(distribution_interval_seconds: u64) {
    // Initial price fetch
    ic_cdk_timers::set_timer(Duration::from_secs(0), || {
        ic_cdk::spawn(get_icp_rate_cents_wrapper());
    });

    // Periodic reward distribution with configurable interval
    let distribution_interval = Duration::from_secs(distribution_interval_seconds);
    let _reward_timer_id: ic_cdk_timers::TimerId = ic_cdk_timers::set_timer_interval(
        distribution_interval,
        || { ic_cdk::spawn(distribute_reward_wrapper()) }
    );

    // Push ALEX fees to lbry_fun periodically
    let _alex_push_timer_id: ic_cdk_timers::TimerId = ic_cdk_timers::set_timer_interval(
        ALEX_FEE_PUSH_INTERVAL,
        || { ic_cdk::spawn(push_alex_fees_wrapper()) }
    );

    // Periodic price fetch
    let _price_timer_id: ic_cdk_timers::TimerId = ic_cdk_timers::set_timer_interval(
        PRICE_FETCH_INTERVAL,
        || { ic_cdk::spawn(get_icp_rate_cents_wrapper()) }
    );
}

async fn distribute_reward_wrapper() {
    match distribute_reward().await {
        Ok(_) => (),
        Err(e) =>
            register_info_log(caller(), "distribute_reward_wrapper", &format!("Error distributing rewards: {}", e)),
    }
}
async fn get_icp_rate_cents_wrapper() {
    match get_icp_rate_in_cents().await {
        Ok(_price) => {
            register_info_log(caller(), "get_icp_rate_cents_wrapper", "Price fetch completed without errors");
        }
        Err(e) => {
            register_info_log(
                caller(),
                "get_icp_rate_cents_wrapper",
                &format!("Error fetching ICP price. Error details: {:?}", e)
            );
        }
    }
}

async fn push_alex_fees_wrapper() {
    use crate::update::collect_alex_fees_internal;
    use candid::Principal;
    
    match collect_alex_fees_internal().await {
        Ok(amount) => {
            if amount > 0 {
                register_info_log(
                    Principal::anonymous(),
                    "push_alex_fees",
                    &format!("Successfully pushed {} ICP to lbry_fun", amount)
                );
            }
        }
        Err(e) => {
            register_info_log(
                Principal::anonymous(),
                "push_alex_fees",
                &format!("Failed to push ALEX fees: {}", e)
            );
        }
    }
}
