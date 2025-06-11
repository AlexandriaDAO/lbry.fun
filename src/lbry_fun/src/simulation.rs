use candid::{CandidType, Deserialize};

#[derive(CandidType, Deserialize, Clone, Default)]
pub struct TokenomicsSchedule {
    pub secondary_burn_thresholds: Vec<u64>,
    pub primary_mint_per_threshold: Vec<u64>,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct PreviewArgs {
    pub primary_max_supply: u64,
    pub tge_allocation: u64,
    pub initial_secondary_burn: u64,
    pub halving_step: u64,
    pub initial_reward_per_burn_unit: u64,
}

#[derive(CandidType, Deserialize, Clone, Default)]
pub struct GraphData {
    pub cumulative_supply_data_x: Vec<u64>,
    pub cumulative_supply_data_y: Vec<u64>,
    pub minted_per_epoch_data_x: Vec<String>,
    pub minted_per_epoch_data_y: Vec<u64>,
    pub cost_to_mint_data_x: Vec<u64>,
    pub cost_to_mint_data_y: Vec<f64>,
    pub cumulative_usd_cost_data_x: Vec<u64>,
    pub cumulative_usd_cost_data_y: Vec<f64>,
}

const SECONDARY_BURN_USD_COST: f64 = 0.005;
const E8S: u128 = 100_000_000;

pub fn preview_tokenomics(args: PreviewArgs) -> GraphData {
    let schedule = generate_tokenomics_schedule(
        args.initial_secondary_burn,
        args.initial_reward_per_burn_unit,
        args.primary_max_supply,
        args.halving_step,
    );

    let mut graph_data = GraphData::default();
    if schedule.secondary_burn_thresholds.is_empty() {
        return graph_data;
    }

    let max_primary_supply_e8s = (args.primary_max_supply as u128).saturating_mul(E8S);
    let tge_allocation_e8s = (args.tge_allocation as u128).saturating_mul(E8S);

    let mut total_primary_minted_e8s = tge_allocation_e8s;
    let mut total_secondary_burned = 0u128;

    graph_data
        .cumulative_supply_data_x
        .push(total_secondary_burned as u64);
    graph_data
        .cumulative_supply_data_y
        .push(total_primary_minted_e8s as u64);
    graph_data
        .cumulative_usd_cost_data_x
        .push(total_primary_minted_e8s as u64);
    graph_data.cumulative_usd_cost_data_y.push(0.0);
    graph_data.cost_to_mint_data_x.push(0);
    graph_data.cost_to_mint_data_y.push(0.0);
    graph_data
        .cost_to_mint_data_x
        .push(total_primary_minted_e8s as u64);
    graph_data.cost_to_mint_data_y.push(0.0);

    let mut last_secondary_burned_threshold = 0u128;

    for i in 0..schedule.secondary_burn_thresholds.len() {
        if total_primary_minted_e8s >= max_primary_supply_e8s {
            break;
        }

        let current_threshold = schedule.secondary_burn_thresholds[i] as u128;
        let epoch_secondary_burn_capacity =
            current_threshold.saturating_sub(last_secondary_burned_threshold);
        if epoch_secondary_burn_capacity == 0 {
            continue;
        }

        let reward_rate = schedule.primary_mint_per_threshold[i] as u128;
        if reward_rate == 0 {
            continue;
        }

        let potential_primary_mint_e8s = epoch_secondary_burn_capacity
            .saturating_mul(reward_rate)
            .saturating_mul(10000);
        let remaining_to_mint_e8s =
            max_primary_supply_e8s.saturating_sub(total_primary_minted_e8s);

        let (actual_primary_mint_e8s, actual_secondary_burned) =
            if potential_primary_mint_e8s > remaining_to_mint_e8s {
                let secondary_needed_to_cap = if reward_rate > 0 {
                    remaining_to_mint_e8s
                        .saturating_div(reward_rate)
                        .saturating_div(10000)
                } else {
                    0
                };
                (remaining_to_mint_e8s, secondary_needed_to_cap)
            } else {
                (potential_primary_mint_e8s, epoch_secondary_burn_capacity)
            };

        if actual_primary_mint_e8s == 0 {
            continue;
        }

        let prev_total_primary_minted_e8s = total_primary_minted_e8s;
        total_primary_minted_e8s += actual_primary_mint_e8s;
        total_secondary_burned += actual_secondary_burned;

        graph_data
            .cumulative_supply_data_x
            .push(total_secondary_burned as u64);
        graph_data
            .cumulative_supply_data_y
            .push(total_primary_minted_e8s as u64);
        graph_data
            .minted_per_epoch_data_x
            .push(format!("Epoch {}", i + 1));
        graph_data
            .minted_per_epoch_data_y
            .push(actual_primary_mint_e8s as u64);

        let cumulative_usd_cost = (total_secondary_burned as f64) * SECONDARY_BURN_USD_COST;
        graph_data
            .cumulative_usd_cost_data_x
            .push(total_primary_minted_e8s as u64);
        graph_data
            .cumulative_usd_cost_data_y
            .push(cumulative_usd_cost);

        let cost_per_primary_token = if actual_primary_mint_e8s > 0 {
            (actual_secondary_burned as f64 * SECONDARY_BURN_USD_COST)
                / (actual_primary_mint_e8s as f64 / E8S as f64)
        } else {
            0.0
        };

        graph_data
            .cost_to_mint_data_x
            .push(prev_total_primary_minted_e8s as u64);
        graph_data
            .cost_to_mint_data_y
            .push(cost_per_primary_token);
        graph_data
            .cost_to_mint_data_x
            .push(total_primary_minted_e8s as u64);
        graph_data
            .cost_to_mint_data_y
            .push(cost_per_primary_token);

        last_secondary_burned_threshold = current_threshold;
    }

    graph_data
}

fn generate_tokenomics_schedule(
    initial_secondary_burn: u64,
    initial_reward_per_burn_unit: u64,
    max_primary_supply: u64,
    halving_step: u64,
) -> TokenomicsSchedule {
    let mut secondary_thresholds = Vec::new();
    let mut primary_rewards = Vec::new();

    let mut burn_for_epoch = initial_secondary_burn as u128;
    let mut cumulative_burn = 0u128;
    let mut total_minted = 0u128;
    let mut primary_per_threshold = initial_reward_per_burn_unit as u128;
    let mut one_reward_mode = false;
    const E8S: u128 = 100_000_000;

    while total_minted < max_primary_supply as u128 {
        let in_slot_burn = burn_for_epoch;
        let reward_e8s = primary_per_threshold * in_slot_burn * 10000;
        let reward = reward_e8s / E8S;

        if one_reward_mode {
            let remaining_mint = max_primary_supply as u128 - total_minted;
            let final_burn = remaining_mint * 10000;
            let final_threshold = cumulative_burn + final_burn;
            secondary_thresholds.push(final_threshold as u64);
            primary_rewards.push(1);
            total_minted += remaining_mint;
            break;
        }

        if reward == 0 {
            break;
        }

        cumulative_burn += burn_for_epoch;
        secondary_thresholds.push(cumulative_burn as u64);
        primary_rewards.push(primary_per_threshold as u64);

        total_minted += reward;
        burn_for_epoch *= 2;

        if primary_per_threshold > 1 {
            primary_per_threshold =
                std::cmp::max(1, (primary_per_threshold * halving_step as u128) / 100);
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