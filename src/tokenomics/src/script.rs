use candid::{CandidType, Principal};
use ic_cdk::init;
use serde::Deserialize;

use crate::{Configs, TokenomicsSchedule, CONFIGS, TOKENOMICS};

#[derive(CandidType, Deserialize, Clone, Default)]
pub struct InitArgs {
    pub primary_token_id: Option<Principal>,
    pub secondary_token_id: Option<Principal>,
    pub swap_canister_id: Option<Principal>,
    pub frontend_canister_id:Option<Principal>,
    pub max_primary_supply: u64,
    pub tge_allocation: u64,
    pub initial_secondary_burn: u64,
    pub max_primary_phase:u64,
    pub halving_step: u64,
    pub initial_reward_per_burn_unit: u64,
}

fn initialize_globals(args: InitArgs) {
    CONFIGS.with(|c| {
        let mut config = c.borrow_mut();
        config
            .set(Configs {
                primary_token_id: args.primary_token_id.unwrap_or(Principal::anonymous()),
                secondary_token_id: args.secondary_token_id.unwrap_or(Principal::anonymous()),
                swap_canister_id: args.swap_canister_id.unwrap_or(Principal::anonymous()),
                frontend_canister_id:args.frontend_canister_id.unwrap_or(Principal::anonymous()),
                max_primary_supply: args.max_primary_supply,
                tge_allocation: args.tge_allocation,
                initial_secondary_burn: args.initial_secondary_burn,
                max_primary_phase:args.max_primary_phase,
                halving_step: args.halving_step,
                initial_reward_per_burn_unit: args.initial_reward_per_burn_unit,
            })
            .unwrap();
    });

    // Generate and store tokenomics schedule
    let schedule = generate_tokenomics_schedule(
        args.initial_secondary_burn,
        args.initial_reward_per_burn_unit,
        args.max_primary_supply,
        args.halving_step,
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

            if init_args.frontend_canister_id.is_none() {
                ic_cdk::trap("Initialization failed: 'frontend_canister_id' is missing.");
            }

            if init_args.max_primary_supply == 0 {
                ic_cdk::trap("Initialization failed: 'max_primary_supply' must be greater than 0.");
            }

            if init_args.tge_allocation == 0 {
                ic_cdk::trap(
                    "Initialization failed: 'tge_allocation' must be greater than 0.",
                );
            }

            if init_args.initial_secondary_burn == 0 {
                ic_cdk::trap(
                    "Initialization failed: 'initial_secondary_burn' must be greater than 0.",
                );
            }
            if init_args.max_primary_phase == 0 {
                ic_cdk::trap(
                    "Initialization failed: 'max_primary_phase' must be greater than 0.",
                );
            }
            if init_args.initial_reward_per_burn_unit == 0 {
                ic_cdk::trap(
                    "Initialization failed: 'initial_reward_per_burn_unit' must be greater than 0.",
                );
            }
            if init_args.halving_step < 25 || init_args.halving_step > 90 {
                ic_cdk::trap(
                    "Initialization failed: 'halving_step' must be between 25 and 90.",
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
    initial_reward_per_burn_unit: u64,
    max_primary_supply: u64,
    halving_step: u64,
) -> TokenomicsSchedule {
    let mut secondary_thresholds = Vec::new();
    let mut primary_rewards = Vec::new();

    let mut current_burn = initial_secondary_burn as u128;
    let mut last_burn = 0u128;
    let mut total_minted = 0u128;
    let mut primary_per_threshold = initial_reward_per_burn_unit as u128;

    let mut one_reward_mode = false;

    while total_minted < max_primary_supply as u128 {
        let in_slot_burn = current_burn - last_burn;

        let reward = (primary_per_threshold * in_slot_burn) / (initial_secondary_burn as u128);

        if one_reward_mode {
            // Remaining mint allowed
            let remaining_mint = max_primary_supply as u128 - total_minted;

            let final_burn = remaining_mint / 10000;

            // Final cumulative burn value
            let final_threshold = last_burn + final_burn;

            secondary_thresholds.push(final_threshold as u64);
            primary_rewards.push(1);

            total_minted += remaining_mint;
            break;
        }

        if reward == 0 {
            break;
        }

        secondary_thresholds.push(current_burn as u64);
        primary_rewards.push(primary_per_threshold as u64);

        total_minted += reward;
        last_burn = current_burn;
        current_burn = current_burn * 2;

        if primary_per_threshold > 1 {
            primary_per_threshold = std::cmp::max(1, (primary_per_threshold * halving_step) / 100);
        }

        if primary_per_threshold == 1 {
            one_reward_mode = true;
        }
    }

    TokenomicsSchedule {
        secondary_burn_thresholds: secondary_thresholds,
        primary_mint_per_threshold: primary_rewards,
    }
}