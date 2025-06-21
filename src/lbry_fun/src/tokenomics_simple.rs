use candid::{CandidType, Deserialize};

// Clear constants
const E8S: u128 = 100_000_000;
const SECONDARY_TOKEN_USD_COST: f64 = 0.01;

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
/// Formula: primary_minted = (secondary_burned * reward_rate) / 10000
fn calculate_primary_minted(secondary_burned_e8s: u128, reward_rate_e8s: u128) -> u128 {
    // Both values are in E8S
    // We want: tokens_per_burn * burn_amount / 10000
    // Since both are E8S: (E8S * E8S) / (E8S * 10000)
    secondary_burned_e8s
        .saturating_mul(reward_rate_e8s)
        .saturating_div(E8S)
        .saturating_div(10000)
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

/// Generate a complete tokenomics schedule
pub fn generate_tokenomics_schedule(params: TokenomicsParams) -> TokenomicsSchedule {
    let mut epochs = Vec::new();
    
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
    
    // Initialize epoch variables
    let mut epoch_number = 1;
    let mut burn_per_epoch = params.initial_burn_e8s;
    let mut reward_rate = params.initial_reward_rate_e8s;
    
    // Generate epochs until we reach max supply
    while cumulative_primary < params.max_supply_e8s {
        let primary_to_mint = calculate_primary_minted(burn_per_epoch, reward_rate);
        let remaining_supply = params.max_supply_e8s.saturating_sub(cumulative_primary);
        
        // Cap at max supply
        let actual_primary_minted = primary_to_mint.min(remaining_supply);
        
        // Calculate actual secondary burned (proportional if we hit the cap)
        let actual_secondary_burned = if primary_to_mint > 0 && actual_primary_minted < primary_to_mint {
            // We hit the cap, so calculate proportional burn
            burn_per_epoch
                .saturating_mul(actual_primary_minted)
                .saturating_div(primary_to_mint)
        } else {
            burn_per_epoch
        };
        
        cumulative_primary += actual_primary_minted;
        cumulative_secondary += actual_secondary_burned;
        
        let cost_per_token = calculate_cost_per_token(actual_secondary_burned, actual_primary_minted);
        
        epochs.push(EpochData {
            epoch_number,
            secondary_burned_this_epoch_e8s: actual_secondary_burned,
            primary_minted_this_epoch_e8s: actual_primary_minted,
            cumulative_secondary_burned_e8s: cumulative_secondary,
            cumulative_primary_minted_e8s: cumulative_primary,
            cost_per_primary_token_usd: cost_per_token,
        });
        
        // If we've reached max supply, stop
        if cumulative_primary >= params.max_supply_e8s {
            break;
        }
        
        // Update for next epoch
        epoch_number += 1;
        burn_per_epoch = burn_per_epoch.saturating_mul(2); // Double each epoch
        
        // Apply halving
        if reward_rate > 1 {
            reward_rate = reward_rate
                .saturating_mul(params.halving_percentage as u128)
                .saturating_div(100)
                .max(1);
        }
        
        // Safety check to prevent infinite loops
        if epoch_number > 100 {
            break;
        }
    }
    
    let total_supply_percentage = if params.max_supply_e8s > 0 {
        (cumulative_primary as f64 / params.max_supply_e8s as f64) * 100.0
    } else {
        0.0
    };
    
    TokenomicsSchedule {
        epochs,
        total_epochs: epoch_number,
        total_supply_percentage,
    }
}

/// Convert frontend parameters to backend format and generate schedule
pub fn preview_tokenomics_from_frontend(
    primary_per_threshold: u64,      // E8S from frontend
    max_primary_supply: u64,         // E8S from frontend
    initial_secondary_burn: u64,     // E8S from frontend
    halving_step: u64,               // E8S from frontend (needs conversion to percentage)
    tge_allocation: u64,             // E8S from frontend
) -> TokenomicsSchedule {
    // Convert halving_step from E8S representation to percentage
    // Frontend sends 70000 * E8S for 70%, so divide by (E8S * 1000) to get 70
    let halving_percentage = (halving_step / (E8S as u64 * 1000)) as u32;
    
    let params = TokenomicsParams {
        max_supply_e8s: max_primary_supply as u128,
        tge_allocation_e8s: tge_allocation as u128,
        initial_burn_e8s: initial_secondary_burn as u128,
        initial_reward_rate_e8s: primary_per_threshold as u128,
        halving_percentage: halving_percentage.min(100), // Cap at 100%
    };
    
    generate_tokenomics_schedule(params)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_quick_launch_preset() {
        let params = TokenomicsParams {
            max_supply_e8s: 100_000_000_000_000,      // 1M tokens
            tge_allocation_e8s: 10_000_000_000,       // 100 tokens
            initial_burn_e8s: 100_000_000_000_000,    // 1M tokens
            initial_reward_rate_e8s: 200_000_000_000, // 2000 tokens
            halving_percentage: 70,
        };
        
        let max_supply = params.max_supply_e8s;
        let schedule = generate_tokenomics_schedule(params);
        
        println!("Quick Launch Schedule:");
        println!("Total epochs: {}", schedule.total_epochs);
        println!("Total supply: {:.2}%", schedule.total_supply_percentage);
        
        for epoch in &schedule.epochs {
            let primary_natural = epoch.primary_minted_this_epoch_e8s as f64 / E8S as f64;
            let secondary_natural = epoch.secondary_burned_this_epoch_e8s as f64 / E8S as f64;
            let cumulative_pct = (epoch.cumulative_primary_minted_e8s as f64 / max_supply as f64) * 100.0;
            
            println!(
                "Epoch {}: Burn {:.0} → Mint {:.0} (Total: {:.2}%)",
                epoch.epoch_number,
                secondary_natural,
                primary_natural,
                cumulative_pct
            );
        }
        
        // Verify expectations
        assert_eq!(schedule.epochs.len(), 5); // TGE + 4 epochs
        assert!(schedule.total_supply_percentage >= 99.9 && schedule.total_supply_percentage <= 100.1);
        
        // Check first real epoch (index 1)
        let epoch1 = &schedule.epochs[1];
        assert_eq!(epoch1.primary_minted_this_epoch_e8s, 20_000_000_000_000); // 200k tokens
    }
}