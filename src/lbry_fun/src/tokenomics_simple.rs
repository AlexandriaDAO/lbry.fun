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
/// Formula from tokenomics canister: reward = (primary_per_threshold * in_slot_burn * 10000) / E8S
/// Note: Since both inputs are already in e8s, we need to divide by E8S twice
fn calculate_primary_minted(secondary_burned_e8s: u128, reward_rate_e8s: u128) -> u128 {
    // Match the exact formula from tokenomics/src/script.rs line 144
    // Both inputs are in e8s, so we need to divide by E8S^2 to get the result in e8s
    let reward_e8s = reward_rate_e8s
        .saturating_mul(secondary_burned_e8s)
        .saturating_mul(10000)
        .saturating_div(E8S);
    reward_e8s.saturating_div(E8S)
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
    halving_step: u64,               // Percentage value from frontend (e.g., 70 for 70%)
    tge_allocation: u64,             // E8S from frontend
) -> TokenomicsSchedule {
    // halving_step is already a percentage (e.g., 70 for 70%)
    // No conversion needed, just cast to u32
    let halving_percentage = halving_step as u32;
    
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
    fn test_tokenomics_calculation_fix() {
        // Test that demonstrates the fix for the tokenomics calculation
        
        // Default values from frontend
        let reward_rate = 2000; // 2000 tokens per burn unit
        let initial_burn = 1_000_000; // 1M tokens
        let max_supply = 1_000_000; // 1M tokens
        
        // Convert to E8S as frontend does
        let reward_rate_e8s = reward_rate * E8S as u64;
        let initial_burn_e8s = initial_burn * E8S as u64;
        let max_supply_e8s = max_supply * E8S as u64;
        
        // Generate schedule
        let schedule = preview_tokenomics_from_frontend(
            reward_rate_e8s,
            max_supply_e8s,
            initial_burn_e8s,
            70, // 70% halving
            1 * E8S as u64, // 1 token TGE
        );
        
        // First real epoch (after TGE)
        let first_epoch = &schedule.epochs[1];
        let tokens_minted = first_epoch.primary_minted_this_epoch_e8s / E8S;
        
        // Frontend expects: 2000 * 1000000 / 10000 = 200000 tokens
        assert_eq!(tokens_minted, 200_000, "First epoch should mint 200k tokens");
        
        // Check we reach close to max supply
        let total_minted = schedule.epochs.last().unwrap().cumulative_primary_minted_e8s;
        let total_percentage = (total_minted as f64 / max_supply_e8s as u128 as f64) * 100.0;
        assert!(total_percentage > 99.9, "Should reach > 99.9% of max supply");
        
        // Check we have reasonable number of epochs (not just 4-5)
        assert!(schedule.epochs.len() >= 4, "Should have at least 4 epochs");
        assert!(schedule.epochs.len() <= 10, "Shouldn't need more than 10 epochs for these params");
    }
    
    #[test]
    fn test_halving_percentage_fix() {
        // Test that halving percentage is correctly interpreted
        
        let params = TokenomicsParams {
            max_supply_e8s: 1_000_000 * E8S,
            tge_allocation_e8s: 0,
            initial_burn_e8s: 1_000 * E8S,
            initial_reward_rate_e8s: 100 * E8S,
            halving_percentage: 50, // 50% halving
        };
        
        let schedule = generate_tokenomics_schedule(params);
        
        // With 50% halving, rewards should halve each epoch
        if schedule.epochs.len() >= 3 {
            let epoch1_mint = schedule.epochs[1].primary_minted_this_epoch_e8s;
            let epoch2_mint = schedule.epochs[2].primary_minted_this_epoch_e8s;
            
            // Epoch 2 should mint approximately 50% of epoch 1
            let ratio = epoch2_mint as f64 / epoch1_mint as f64;
            assert!(ratio > 0.45 && ratio < 0.55, 
                "50% halving should reduce rewards by ~50%, got ratio: {}", ratio);
        }
    }
}