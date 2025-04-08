use candid::{CandidType, Principal};
use ic_cdk::init;
use serde::Deserialize;

use crate::{Configs, TokenomicsSchedule, CONFIGS, TOKENOMICS};

#[derive(CandidType, Deserialize, Clone, Default)]
pub struct InitArgs {
    pub primary_token_id: Option<Principal>,
    pub secondary_token_id: Option<Principal>,
    pub swap_canister_id: Option<Principal>,
    pub max_primary_supply: u64,
    pub initial_primary_mint: u64,
    pub initial_secondary_burn: u64,
}

fn initialize_globals(args: InitArgs) {
    CONFIGS.with(|c| {
        let mut config = c.borrow_mut();
        config
            .set(Configs {
                primary_token_id: args.primary_token_id.unwrap_or(Principal::anonymous()),
                secondary_token_id: args.secondary_token_id.unwrap_or(Principal::anonymous()),
                swap_canister_id: args.swap_canister_id.unwrap_or(Principal::anonymous()),
                max_primary_supply: 0,
                initial_primary_mint: 0,
                initial_secondary_burn: 0,
            })
            .unwrap();
    });

    // Generate and store tokenomics schedule
    let schedule = generate_tokenomics_schedule(
        args.initial_secondary_burn,
        args.initial_primary_mint,
        args.max_primary_supply,
    );

    TOKENOMICS.with(|s| {
        let mut store = s.borrow_mut();
        store.set(schedule).expect("Failed to store schedule");
    });
}

#[init]
fn init(args: Option<InitArgs>) {
    match args {
        Some(init_args) => {
            if init_args.primary_token_id.is_none() {
                ic_cdk::trap("Initialization failed: 'primary_token_id' is missing.");
            }

            if init_args.secondary_token_id.is_none() {
                ic_cdk::trap("Initialization failed: 'secondary_token_id' is missing.");
            }

            if init_args.swap_canister_id.is_none() {
                ic_cdk::trap("Initialization failed: 'swap_canister_id' is missing.");
            }

            if init_args.max_primary_supply == 0 {
                ic_cdk::trap("Initialization failed: 'max_primary_supply' must be greater than 0.");
            }

            if init_args.initial_primary_mint == 0 {
                ic_cdk::trap(
                    "Initialization failed: 'initial_primary_mint' must be greater than 0.",
                );
            }

            if init_args.initial_secondary_burn == 0 {
                ic_cdk::trap(
                    "Initialization failed: 'initial_secondary_burn' must be greater than 0.",
                );
            }

            initialize_globals(init_args);
        }
        None => {
            ic_cdk::trap("Initialization failed: No init arguments provided.");
        }
    }
}
fn generate_tokenomics_schedule(
    initial_secondary_burn: u64,
    initial_primary_mint: u64,
    max_primary_supply: u64,
) -> TokenomicsSchedule {
    let mut secondary_thresholds = Vec::new();
    let mut primary_rewards = Vec::new();

    let mut current_burn = initial_secondary_burn as u128;
    let mut last_burn = 0u128;
    let mut total_minted = 0u128;
    let mut primary_per_threshold = 0u128;
    primary_per_threshold = initial_primary_mint as u128;
    while total_minted < max_primary_supply as u128 {
        let in_slot_burn = current_burn - last_burn;

        let reward = ((primary_per_threshold as u128) * (in_slot_burn as u128)) / 10000;

        if reward == 0 {
            ic_cdk::println!("Break at reward = 0");
            ic_cdk::println!("in_slot_burn{:?}", in_slot_burn);
            ic_cdk::println!("primary_per_threshold {:?}", primary_per_threshold);

            break;
        }

        secondary_thresholds.push(current_burn as u64);
        primary_rewards.push(primary_per_threshold as u64);

        total_minted += reward;
        last_burn = current_burn;

        // Double the burn threshold
        match current_burn.checked_mul(2) {
            Some(b) => current_burn = b,
            _none => {
                ic_cdk::println!("Break at current_burn ");

                break;
            }
        }
        if (primary_per_threshold > 1) {
            match primary_per_threshold.checked_div(2) {
                Some(b) => primary_per_threshold = b,
                _none => {} //skip,
            }
        }
    }
    ic_cdk::println!("The max is {:?}", total_minted);
    ic_cdk::println!("the max primary supply is {:?}", max_primary_supply);
    TokenomicsSchedule {
        secondary_burn_thresholds: secondary_thresholds,
        primary_mint_per_threshold: primary_rewards,
    }
}
