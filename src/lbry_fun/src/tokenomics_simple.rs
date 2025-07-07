use candid::{CandidType, Deserialize};

// Clear constants
const E8S: u128 = 100_000_000;
const SECONDARY_TOKEN_USD_COST: f64 = 0.005; // Effective cost after 50% ICP return


/// Simple, clean tokenomics calculation
/// All values are in E8S internally, converted only for display
#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct TokenomicsParams {
    pub max_supply_e8s: u128,           // e.g., 1M tokens = 100_000_000_000_000
    pub tge_allocation_e8s: u128,       // e.g., 100 tokens = 10_000_000_000
    pub initial_burn_e8s: u128,         // e.g., 1M tokens = 100_000_000_000_000
    pub initial_reward_rate_e8s: u128,  // e.g., 2000 tokens = 200_000_000_000
    pub halving_percentage: u32,        // e.g., 70 for 70%
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct EpochData {
    pub epoch_number: u32,
    pub secondary_burned_this_epoch_e8s: u128,
    pub primary_minted_this_epoch_e8s: u128,
    pub cumulative_secondary_burned_e8s: u128,
    pub cumulative_primary_minted_e8s: u128,
    pub cost_per_primary_token_usd: f64,
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct TokenomicsSchedule {
    pub epochs: Vec<EpochData>,
    pub total_epochs: u32,
    pub total_supply_percentage: f64,
}

/// Calculate how many primary tokens are minted for burning secondary tokens
/// Takes reward rate in E8S format and burn amount in E8S format
fn calculate_primary_minted(secondary_burned_e8s: u128, reward_rate_e8s: u128) -> u128 {
    // Apply tokenomics formula: (rate × amount × 3)
    // The 3x multiplier matches the whitepaper expectations
    // Work in E8S to preserve precision
    secondary_burned_e8s
        .saturating_mul(reward_rate_e8s)
        .saturating_div(E8S)  // Normalize after multiplication
        .saturating_mul(3)    // 3x multiplier
}

/// Calculate the cost per primary token in USD
fn calculate_cost_per_token(secondary_burned: u128, primary_minted: u128) -> f64 {
    if primary_minted == 0 {
        return 0.0;
    }
    
    let secondary_burned_natural = secondary_burned as f64 / E8S as f64;
    let primary_minted_natural = primary_minted as f64 / E8S as f64;
    
    (secondary_burned_natural * SECONDARY_TOKEN_USD_COST) / primary_minted_natural
}

/// Generate a complete tokenomics schedule using dynamic parameters
pub fn generate_tokenomics_schedule(params: TokenomicsParams) -> TokenomicsSchedule {
    let mut epochs = Vec::new();
    
    // Minimum reward rate (0.01 tokens in E8S)
    const MIN_REWARD_RATE_E8S: u128 = 1_000_000;
    
    // Start with TGE allocation
    let mut cumulative_primary = params.tge_allocation_e8s;
    let mut cumulative_secondary = 0u128;
    
    // Add TGE as epoch 0
    epochs.push(EpochData {
        epoch_number: 0,
        secondary_burned_this_epoch_e8s: 0,
        primary_minted_this_epoch_e8s: params.tge_allocation_e8s,
        cumulative_secondary_burned_e8s: 0,
        cumulative_primary_minted_e8s: params.tge_allocation_e8s,
        cost_per_primary_token_usd: 0.0,
    });
    
    // Initialize dynamic variables
    let mut epoch_number = 1;
    let mut burn_amount = params.initial_burn_e8s;
    let mut reward_rate = params.initial_reward_rate_e8s;
    
    // Generate epochs dynamically until natural termination
    loop {
        // Calculate primary tokens to mint with 3x multiplier
        let primary_to_mint = calculate_primary_minted(burn_amount, reward_rate);
        let remaining_supply = params.max_supply_e8s.saturating_sub(cumulative_primary);
        
        // Natural termination: minting less than 1 token
        if primary_to_mint < E8S {
            break;
        }
        
        // Check if we would exceed max supply
        if primary_to_mint > remaining_supply {
            // Final partial epoch
            if remaining_supply >= E8S {
                // Calculate proportional burn amount
                let actual_secondary_burned = burn_amount
                    .saturating_mul(remaining_supply)
                    .saturating_div(primary_to_mint.max(1));
                
                cumulative_primary = params.max_supply_e8s;
                cumulative_secondary = cumulative_secondary.saturating_add(actual_secondary_burned);
                
                let cost_per_token = calculate_cost_per_token(actual_secondary_burned, remaining_supply);
                
                epochs.push(EpochData {
                    epoch_number,
                    secondary_burned_this_epoch_e8s: actual_secondary_burned,
                    primary_minted_this_epoch_e8s: remaining_supply,
                    cumulative_secondary_burned_e8s: cumulative_secondary,
                    cumulative_primary_minted_e8s: cumulative_primary,
                    cost_per_primary_token_usd: cost_per_token,
                });
            }
            break;
        }
        
        // Full epoch
        cumulative_primary = cumulative_primary.saturating_add(primary_to_mint);
        cumulative_secondary = cumulative_secondary.saturating_add(burn_amount);
        
        let cost_per_token = calculate_cost_per_token(burn_amount, primary_to_mint);
        
        epochs.push(EpochData {
            epoch_number,
            secondary_burned_this_epoch_e8s: burn_amount,
            primary_minted_this_epoch_e8s: primary_to_mint,
            cumulative_secondary_burned_e8s: cumulative_secondary,
            cumulative_primary_minted_e8s: cumulative_primary,
            cost_per_primary_token_usd: cost_per_token,
        });
        
        // Update for next epoch
        epoch_number += 1;
        
        // Burn pattern: same for epoch 2, then double each epoch
        if epoch_number > 2 {
            burn_amount = burn_amount.saturating_mul(2);
        }
        
        // Apply halving but enforce minimum
        let new_reward_rate = reward_rate
            .saturating_mul(params.halving_percentage as u128)
            .saturating_div(100);
            
        // Don't go below minimum
        reward_rate = new_reward_rate.max(MIN_REWARD_RATE_E8S);
        
        // Natural termination if max supply reached
        if cumulative_primary >= params.max_supply_e8s {
            break;
        }
        
        // Stop if we've been at minimum reward rate for too long
        // and the amount minted per epoch becomes insignificant relative to total supply
        if reward_rate == MIN_REWARD_RATE_E8S && primary_to_mint < params.max_supply_e8s / 1000 {
            break;
        }
        
        // Safety check: prevent infinite loops
        if epoch_number > 100 {
            break;
        }
    }
    
    let total_supply_percentage = if params.max_supply_e8s > 0 {
        (cumulative_primary as f64 / params.max_supply_e8s as f64) * 100.0
    } else {
        0.0
    };
    
    // Total epochs is the highest epoch number we've created
    let total_epochs = epochs.iter()
        .filter(|e| e.epoch_number > 0)  // Exclude TGE
        .map(|e| e.epoch_number)
        .max()
        .unwrap_or(0);
    
    TokenomicsSchedule {
        epochs,
        total_epochs,
        total_supply_percentage,
    }
}

/// Convert frontend parameters to backend format and generate schedule
/// Now uses dynamic parameters to allow user experimentation
pub fn preview_tokenomics_from_frontend(
    primary_per_threshold: u64,      // E8S from frontend (already converted)
    max_primary_supply: u64,         // E8S from frontend
    initial_secondary_burn: u64,     // E8S from frontend (already converted)
    halving_step: u64,               // Percentage as natural number (e.g., 50 for 50%)
    tge_allocation: u64,             // E8S from frontend
) -> TokenomicsSchedule {
    // Frontend already sends values in E8S, no conversion needed
    let params = TokenomicsParams {
        max_supply_e8s: max_primary_supply as u128,
        tge_allocation_e8s: tge_allocation as u128,
        initial_burn_e8s: initial_secondary_burn as u128,  // Already in E8S
        initial_reward_rate_e8s: primary_per_threshold as u128,  // Already in E8S
        halving_percentage: halving_step as u32,
    };
    
    generate_tokenomics_schedule(params)
}