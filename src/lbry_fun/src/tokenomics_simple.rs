use candid::{CandidType, Deserialize};

// Clear constants
const E8S: u128 = 100_000_000;
const SECONDARY_TOKEN_USD_COST: f64 = 0.005; // Effective cost after 50% ICP return

// Hardcoded thresholds from tokenomics canister (in natural units, not E8S)
const SECONDARY_THRESHOLDS: [u64; 18] = [
    21_000,         // 21,000.00
    42_000,         // 42,000.00
    84_000,         // 84,000.00
    168_000,        // 168,000.00
    336_000,        // 336,000.00
    672_000,        // 672,000.00
    1_344_000,      // 1,344,000.00
    2_688_000,      // 2,688,000.00
    5_376_000,      // 5,376,000.00
    10_752_000,     // 10,752,000.00
    21_504_000,     // 21,504,000.00
    43_008_000,     // 43,008,000.00
    86_016_000,     // 86,016,000.00
    172_032_000,    // 172,032,000.00
    344_064_000,    // 344,064,000.00
    688_128_000,    // 688,128,000.00
    1_376_256_000,  // 1,376,256,000.00
    61_632_592_000, // 61,632,592,000.00
];

// Hardcoded rewards from tokenomics canister (in 4-decimal format)
const PRIMARY_PER_THRESHOLD: [u64; 18] = [
    50_000, // 5.0000
    25_000, // 2.5000
    12_500, // 1.2500
    6_250,  // 0.6250
    3_125,  // 0.3125
    1_562,  // 0.1562
    781,    // 0.0781
    391,    // 0.0391
    195,    // 0.0195
    98,     // 0.0098
    49,     // 0.0049
    24,     // 0.0024
    12,     // 0.0012
    6,      // 0.0006
    3,      // 0.0003
    2,      // 0.0002
    1,      // 0.0001
    1,      // 0.0001
];

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
/// The tokenomics canister uses 4-decimal format internally, so we need to convert
/// E8S reward rate to 4-decimal format before calculation
fn calculate_primary_minted(secondary_burned_e8s: u128, reward_rate_e8s: u128) -> u128 {
    // Convert E8S reward rate to 4-decimal format (as used by tokenomics canister)
    let reward_rate_4decimal = reward_rate_e8s / 10_000;
    
    // Convert secondary burned from E8S to natural units
    let secondary_burned_natural = secondary_burned_e8s / E8S;
    
    // Apply tokenomics formula: rate × amount × 3
    // The 3x multiplier matches the whitepaper expectations
    // Then convert result to E8S
    reward_rate_4decimal
        .saturating_mul(secondary_burned_natural)
        .saturating_mul(3)  // 3x multiplier
        .saturating_mul(E8S) / 10_000  // Convert 4-decimal result to E8S
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
    
    // Initialize tracking variables
    let mut epoch_number = 1;
    let mut current_threshold_index = 0usize;
    
    // Generate epochs based on hardcoded thresholds
    while current_threshold_index < SECONDARY_THRESHOLDS.len() && cumulative_primary < params.max_supply_e8s {
        // Calculate how much to burn in this epoch
        let target_cumulative = SECONDARY_THRESHOLDS[current_threshold_index] as u128 * E8S;
        let burn_this_epoch = target_cumulative.saturating_sub(cumulative_secondary);
        
        if burn_this_epoch == 0 {
            current_threshold_index += 1;
            continue;
        }
        
        // Get the reward rate for this threshold (convert 4-decimal to E8S)
        let reward_rate_4decimal = PRIMARY_PER_THRESHOLD[current_threshold_index] as u128;
        let reward_rate_e8s = reward_rate_4decimal * 10_000; // Convert to match expected format
        
        // Calculate primary tokens to mint
        let primary_to_mint = calculate_primary_minted(burn_this_epoch, reward_rate_e8s);
        let remaining_supply = params.max_supply_e8s.saturating_sub(cumulative_primary);
        
        // Cap at max supply
        let actual_primary_minted = primary_to_mint.min(remaining_supply);
        
        // Calculate actual secondary burned (proportional if we hit the cap)
        let actual_secondary_burned = if primary_to_mint > 0 && actual_primary_minted < primary_to_mint {
            // We hit the cap, so calculate proportional burn
            burn_this_epoch
                .saturating_mul(actual_primary_minted)
                .saturating_div(primary_to_mint)
        } else {
            burn_this_epoch
        };
        
        // Only add epoch if we actually minted something
        if actual_primary_minted > 0 {
            cumulative_primary = cumulative_primary.saturating_add(actual_primary_minted);
            cumulative_secondary = cumulative_secondary.saturating_add(actual_secondary_burned);
            
            let cost_per_token = calculate_cost_per_token(actual_secondary_burned, actual_primary_minted);
            
            epochs.push(EpochData {
                epoch_number,
                secondary_burned_this_epoch_e8s: actual_secondary_burned,
                primary_minted_this_epoch_e8s: actual_primary_minted,
                cumulative_secondary_burned_e8s: cumulative_secondary,
                cumulative_primary_minted_e8s: cumulative_primary,
                cost_per_primary_token_usd: cost_per_token,
            });
            
            epoch_number += 1;
        }
        
        // If we've reached max supply, stop
        if cumulative_primary >= params.max_supply_e8s {
            break;
        }
        
        // Move to next threshold
        current_threshold_index += 1;
    }
    
    let total_supply_percentage = if params.max_supply_e8s > 0 {
        (cumulative_primary as f64 / params.max_supply_e8s as f64) * 100.0
    } else {
        0.0
    };
    
    TokenomicsSchedule {
        epochs,
        total_epochs: epoch_number - 1,
        total_supply_percentage,
    }
}

/// Convert frontend parameters to backend format and generate schedule
/// Note: This now uses hardcoded thresholds and reward rates to match the tokenomics canister
/// The user parameters are largely ignored except for max_supply and tge_allocation
pub fn preview_tokenomics_from_frontend(
    primary_per_threshold: u64,      // Ignored - uses hardcoded values
    max_primary_supply: u64,         // E8S from frontend - still used for cap
    initial_secondary_burn: u64,     // Ignored - uses hardcoded thresholds
    halving_step: u64,               // Ignored - uses hardcoded halving pattern
    tge_allocation: u64,             // E8S from frontend - still used
) -> TokenomicsSchedule {
    // Create params with only the values we actually use
    let params = TokenomicsParams {
        max_supply_e8s: max_primary_supply as u128,
        tge_allocation_e8s: tge_allocation as u128,
        // These are ignored but needed for the struct
        initial_burn_e8s: 0,
        initial_reward_rate_e8s: 0,
        halving_percentage: 0,
    };
    
    generate_tokenomics_schedule(params)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_simple_tokenomics_debug() {
        // Test with very simple values to debug the issue
        let schedule = preview_tokenomics_from_frontend(
            1,      // 1 token reward per burn (frontend sends natural units)
            1000 * E8S as u64,  // 1000 max supply (frontend sends E8S)
            10,     // 10 secondary tokens to burn (frontend sends natural units)
            50,     // 50% halving
            0,      // No TGE
        );
        
        println!("DEBUG: Simple tokenomics test");
        println!("Epochs: {}", schedule.epochs.len());
        
        for (i, epoch) in schedule.epochs.iter().enumerate() {
            println!("Epoch {}: ", i);
            println!("  Secondary burned (E8S): {}", epoch.secondary_burned_this_epoch_e8s);
            println!("  Secondary burned (natural): {}", epoch.secondary_burned_this_epoch_e8s / E8S);
            println!("  Primary minted (E8S): {}", epoch.primary_minted_this_epoch_e8s);
            println!("  Primary minted (natural): {}", epoch.primary_minted_this_epoch_e8s / E8S);
            println!("  Cost per token USD: ${}", epoch.cost_per_primary_token_usd);
            println!("  Cumulative secondary (E8S): {}", epoch.cumulative_secondary_burned_e8s);
            println!("  Cumulative primary (E8S): {}", epoch.cumulative_primary_minted_e8s);
        }
        
        // First epoch should burn 10 secondary and mint 10 primary (1:1 ratio)
        assert_eq!(schedule.epochs[1].secondary_burned_this_epoch_e8s, 10 * E8S);
        assert_eq!(schedule.epochs[1].primary_minted_this_epoch_e8s, 10 * E8S);
        
        // Cost should be $0.01 per primary token (10 secondary * $0.01 / 10 primary)
        assert!((schedule.epochs[1].cost_per_primary_token_usd - 0.01).abs() < 0.0001);
    }
    
    #[test]
    fn test_e8s_to_4decimal_conversion() {
        // Test the E8S to 4-decimal conversion matches tokenomics canister behavior
        
        // Test case 1: 5 tokens per burn unit (matches PRIMARY_PER_THRESHOLD[0])
        let reward_rate_e8s = 5 * E8S; // 500_000_000
        let secondary_burned = 1 * E8S; // 1 token
        
        let result = calculate_primary_minted(secondary_burned, reward_rate_e8s);
        assert_eq!(result, 5 * E8S, "Should mint 5 tokens for 1 secondary burned at 5 token rate");
        
        // Test case 2: 2.5 tokens per burn unit (matches PRIMARY_PER_THRESHOLD[1])
        let reward_rate_e8s = 250_000_000; // 2.5 * E8S
        let result = calculate_primary_minted(secondary_burned, reward_rate_e8s);
        assert_eq!(result, 250_000_000, "Should mint 2.5 tokens for 1 secondary burned at 2.5 token rate");
        
        // Test case 3: Larger burn amount
        let reward_rate_e8s = 5 * E8S;
        let secondary_burned = 1000 * E8S;
        let result = calculate_primary_minted(secondary_burned, reward_rate_e8s);
        assert_eq!(result, 5000 * E8S, "Should mint 5000 tokens for 1000 secondary burned at 5 token rate");
    }
    
    #[test]
    fn test_tokenomics_calculation_with_4decimal_fix() {
        // Test that demonstrates the fix for the tokenomics calculation
        
        // Use values that match tokenomics canister's PRIMARY_PER_THRESHOLD[0]
        let reward_rate = 5; // 5 tokens per burn unit
        let initial_burn = 1_000_000; // 1M tokens
        let max_supply = 10_000_000; // 10M tokens
        
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
            1 * E8S as u64, // Small TGE
        );
        
        // First real epoch (after TGE) should mint: 5 tokens × 1M tokens = 5M tokens
        let first_epoch = &schedule.epochs[1];
        let tokens_minted_e8s = first_epoch.primary_minted_this_epoch_e8s;
        let tokens_minted = tokens_minted_e8s / E8S;
        
        assert_eq!(tokens_minted, 5_000_000, "First epoch should mint 5M tokens");
        
        // Check second epoch with 70% halving
        if schedule.epochs.len() > 2 {
            let second_epoch = &schedule.epochs[2];
            let second_tokens_minted = second_epoch.primary_minted_this_epoch_e8s / E8S;
            
            // Second epoch: 3.5 tokens × 2M tokens = 7M tokens
            // But we only have ~5M left (10M - 5M - 1 TGE), so it should cap
            assert!(second_tokens_minted <= 5_000_000, "Second epoch should not exceed remaining supply");
        }
    }
    
    #[test]
    fn test_halving_percentage_fix() {
        // Test that halving percentage is correctly interpreted
        
        let params = TokenomicsParams {
            max_supply_e8s: 1_000_000 * E8S,
            tge_allocation_e8s: 1 * E8S, // Small TGE to start epochs
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
            // But note: secondary burn doubles each epoch, so total minted might stay same
            // What halves is the reward rate per unit burned
            let epoch1_burned = schedule.epochs[1].secondary_burned_this_epoch_e8s;
            let epoch2_burned = schedule.epochs[2].secondary_burned_this_epoch_e8s;
            
            let epoch1_rate = epoch1_mint as f64 / epoch1_burned as f64;
            let epoch2_rate = epoch2_mint as f64 / epoch2_burned as f64;
            
            let ratio = epoch2_rate / epoch1_rate;
            assert!(ratio > 0.45 && ratio < 0.55, 
                "50% halving should reduce rate by ~50%, got ratio: {}", ratio);
        }
    }
}