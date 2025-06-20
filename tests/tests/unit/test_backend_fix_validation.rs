/// Test the actual backend fix by calling the simulation code
use crate::shared_helpers::*;
use crate::helpers::token_testing::*;
use candid::{Encode, Nat, Principal};
use num_traits::cast::ToPrimitive;

#[derive(Debug, candid::CandidType, candid::Deserialize)]
struct PreviewArgs {
    primary_max_supply: u64,
    tge_allocation: u64,
    initial_secondary_burn: u64,
    halving_step: u64,
    initial_reward_per_burn_unit: u64,
}

#[derive(Debug, candid::CandidType, candid::Deserialize)]
struct GraphData {
    cumulative_supply_data_x: Vec<u64>,
    cumulative_supply_data_y: Vec<u64>,
    minted_per_epoch_data_x: Vec<String>,
    minted_per_epoch_data_y: Vec<u64>,
    cost_to_mint_data_x: Vec<u64>,
    cost_to_mint_data_y: Vec<f64>,
    cumulative_usd_cost_data_x: Vec<u64>,
    cumulative_usd_cost_data_y: Vec<f64>,
}

#[test]
fn test_backend_fix_no_overminting() {
    println!("\n=== Testing Backend Fix for Overminting ===");
    
    // Create environment
    let env = TokenTestEnvironment::new();
    
    // Test all three presets
    let presets = vec![
        ("Extended Distribution", PreviewArgs {
            primary_max_supply: 1_000_000,
            tge_allocation: 100,
            initial_secondary_burn: 200_000,
            halving_step: 90,
            initial_reward_per_burn_unit: 100,
        }),
        ("Balanced", PreviewArgs {
            primary_max_supply: 1_000_000,
            tge_allocation: 100,
            initial_secondary_burn: 500_000,
            halving_step: 45,
            initial_reward_per_burn_unit: 500,
        }), 
        ("Quick Launch", PreviewArgs {
            primary_max_supply: 1_000_000,
            tge_allocation: 100,
            initial_secondary_burn: 1_000_000,
            halving_step: 70,
            initial_reward_per_burn_unit: 2000,
        }),
    ];
    
    for (name, args) in presets {
        println!("\n--- Testing {} Preset ---", name);
        
        // Get graph data from the backend
        let graph_response: Result<GraphData, String> = env
            .pic
            .query_call(
                env.lbry_fun,
                Principal::anonymous(),
                "preview_tokenomics",
                candid::encode_one(&args).unwrap(),
            )
            .map(|res| {
                let bytes = res.as_slice();
                candid::decode_one(bytes).unwrap()
            });
            
        let graph_data = graph_response.expect("Should get graph data");
        
        // Check total minted from the cumulative data
        let total_minted = graph_data.cumulative_supply_data_y
            .last()
            .expect("Should have minting data");
            
        println!("Total epochs: {}", graph_data.minted_per_epoch_data_x.len());
        println!("Total minted: {} tokens", total_minted);
        println!("Max supply: 1,000,000 tokens");
        
        // Verify no overminting
        assert!(
            *total_minted <= 1_000_000,
            "{}: Total minted {} exceeds max supply 1,000,000",
            name,
            total_minted
        );
        
        // For Extended Distribution, verify 15+ epochs
        if name == "Extended Distribution" {
            assert!(
                graph_data.minted_per_epoch_data_x.len() >= 15,
                "Extended Distribution should have 15+ epochs, got {}",
                graph_data.minted_per_epoch_data_x.len()
            );
        }
    }
    
    println!("\n✅ Backend fix verified: All presets mint within max supply!");
}

#[test]
fn test_tokenomics_schedule_generation() {
    println!("\n=== Testing Tokenomics Schedule Generation ===");
    
    let env = TokenTestEnvironment::new();
    
    // Create a token with Quick Launch preset
    let (primary, secondary, tokenomics, icp_swap, _) = env.create_token_with_config(
        "TEST",
        "Test Token",
        100,
        "https://test.com",
        1_000_000,
        1_000_000,
        2000,
        70,
    );
    
    // Get the tokenomics schedule
    let response: Result<(Vec<u64>, Vec<u64>), String> = env
        .pic
        .query_call(
            tokenomics,
            Principal::anonymous(),
            "get_tokenomics_schedule", 
            candid::encode_one(()).unwrap(),
        )
        .map(|res| {
            let bytes = res.as_slice();
            candid::decode_one(bytes).unwrap()
        });
        
    let (thresholds, rewards) = response.expect("Should get tokenomics schedule");
    
    println!("Tokenomics schedule:");
    let mut total_minted = 0u64;
    for (i, (threshold, reward)) in thresholds.iter().zip(rewards.iter()).enumerate() {
        let epoch_mint = if i == 0 {
            *reward  // First epoch
        } else {
            let prev_threshold = if i > 0 { thresholds[i-1] } else { 0 };
            let burn_in_epoch = threshold - prev_threshold;
            (burn_in_epoch * reward) / 10000  // Apply the fix
        };
        
        total_minted += epoch_mint;
        
        if i < 5 || epoch_mint > 0 {
            println!("Epoch {}: threshold={}, reward={}, minted={}, total={}", 
                i, threshold, reward, epoch_mint, total_minted);
        }
    }
    
    println!("\nTotal minted from schedule: {} tokens", total_minted);
    assert!(
        total_minted <= 1_000_000,
        "Schedule should not exceed max supply, got {}",
        total_minted
    );
}