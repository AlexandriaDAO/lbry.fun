use candid::{CandidType, Deserialize};
use crate::tokenomics_simple::{preview_tokenomics_from_frontend};

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

const SECONDARY_BURN_USD_COST: f64 = 0.005; // Effective cost after 50% ICP return (matches tokenomics_simple.rs)

/// Convert the clean tokenomics schedule to the legacy GraphData format
pub fn preview_tokenomics(args: PreviewArgs) -> GraphData {
    // Use the clean implementation
    let schedule = preview_tokenomics_from_frontend(
        args.initial_reward_per_burn_unit,
        args.primary_max_supply,
        args.initial_secondary_burn,
        args.halving_step,
        args.tge_allocation,
    );
    
    let mut graph_data = GraphData::default();
    
    // Convert epochs to graph data
    for (i, epoch) in schedule.epochs.iter().enumerate() {
        // Cumulative supply data (secondary burned vs primary minted)
        graph_data.cumulative_supply_data_x.push(epoch.cumulative_secondary_burned_e8s as u64);
        graph_data.cumulative_supply_data_y.push(epoch.cumulative_primary_minted_e8s as u64);
        
        // Skip TGE for epoch-specific data
        if epoch.epoch_number > 0 {
            // Minted per epoch
            graph_data.minted_per_epoch_data_x.push(format!("Epoch {}", epoch.epoch_number));
            graph_data.minted_per_epoch_data_y.push(epoch.primary_minted_this_epoch_e8s as u64);
        }
        
        // Cost to mint data (x = cumulative primary, y = cost per token)
        if i > 0 {
            let prev_epoch = &schedule.epochs[i - 1];
            graph_data.cost_to_mint_data_x.push(prev_epoch.cumulative_primary_minted_e8s as u64);
            graph_data.cost_to_mint_data_y.push(epoch.cost_per_primary_token_usd);
        }
        
        // Add endpoint for cost graph
        graph_data.cost_to_mint_data_x.push(epoch.cumulative_primary_minted_e8s as u64);
        graph_data.cost_to_mint_data_y.push(epoch.cost_per_primary_token_usd);
        
        // Cumulative USD cost
        let cumulative_usd = (epoch.cumulative_secondary_burned_e8s as f64 / 100_000_000.0) * SECONDARY_BURN_USD_COST;
        graph_data.cumulative_usd_cost_data_x.push(epoch.cumulative_primary_minted_e8s as u64);
        graph_data.cumulative_usd_cost_data_y.push(cumulative_usd);
    }
    
    // Ensure we have the initial (0,0) point for cost graph
    if !graph_data.cost_to_mint_data_x.is_empty() && graph_data.cost_to_mint_data_x[0] != 0 {
        graph_data.cost_to_mint_data_x.insert(0, 0);
        graph_data.cost_to_mint_data_y.insert(0, 0.0);
    }
    
    graph_data
}

/// Generate tokenomics schedule for token creation (legacy format)
pub fn generate_tokenomics_schedule(
    initial_secondary_burn: u64,
    initial_reward_per_burn_unit: u64,
    max_primary_supply: u64,
    halving_step: u64,
) -> TokenomicsSchedule {
    let schedule = preview_tokenomics_from_frontend(
        initial_reward_per_burn_unit,
        max_primary_supply,
        initial_secondary_burn,
        halving_step,
        0, // No TGE for schedule generation
    );
    
    let mut secondary_thresholds = Vec::new();
    let mut primary_rewards = Vec::new();
    
    // Convert to legacy format (cumulative thresholds and reward rates)
    for epoch in schedule.epochs.iter().skip(1) { // Skip TGE
        secondary_thresholds.push(epoch.cumulative_secondary_burned_e8s as u64);
        
        // Calculate the reward rate for this epoch
        if epoch.secondary_burned_this_epoch_e8s > 0 {
            let rate = (epoch.primary_minted_this_epoch_e8s * 10000) / epoch.secondary_burned_this_epoch_e8s;
            primary_rewards.push(rate as u64);
        }
    }
    
    TokenomicsSchedule {
        secondary_burn_thresholds: secondary_thresholds,
        primary_mint_per_threshold: primary_rewards,
    }
}