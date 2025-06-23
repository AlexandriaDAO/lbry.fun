/// Test that shows EXACTLY what the backend returns to the frontend
use crate::helpers::token_testing::*;
use candid::{Encode, Principal};

#[derive(Debug, candid::CandidType, candid::Deserialize)]
struct PreviewArgs {
    primary_max_supply: String,
    tge_allocation: String,
    initial_secondary_burn: String,
    halving_step: String,
    initial_reward_per_burn_unit: String,
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
fn test_actual_backend_response() {
    println!("\n=== ACTUAL Backend Response Test ===");
    println!("This test calls the backend EXACTLY like the frontend does");
    
    let env = TokenTestEnvironment::new();
    
    // These are the EXACT parameters the frontend sends for each preset
    // Frontend multiplies by E8S (100_000_000) before sending
    let presets = vec![
        ("Quick Launch", PreviewArgs {
            primary_max_supply: "100000000000000".to_string(),      // 1M * E8S
            tge_allocation: "10000000000".to_string(),              // 100 * E8S
            initial_secondary_burn: "100000000000000".to_string(),  // 1M * E8S
            halving_step: "70".to_string(),
            initial_reward_per_burn_unit: "200000000000".to_string(), // 2000 * E8S
        }),
        ("Balanced", PreviewArgs {
            primary_max_supply: "100000000000000".to_string(),      // 1M * E8S
            tge_allocation: "10000000000".to_string(),              // 100 * E8S
            initial_secondary_burn: "50000000000000".to_string(),   // 500K * E8S
            halving_step: "45".to_string(),
            initial_reward_per_burn_unit: "50000000000".to_string(), // 500 * E8S
        }),
        ("Extended Distribution", PreviewArgs {
            primary_max_supply: "100000000000000".to_string(),      // 1M * E8S
            tge_allocation: "10000000000".to_string(),              // 100 * E8S
            initial_secondary_burn: "20000000000000".to_string(),   // 200K * E8S
            halving_step: "90".to_string(),
            initial_reward_per_burn_unit: "10000000000".to_string(), // 100 * E8S
        }),
    ];
    
    for (name, args) in presets {
        println!("\n\n{}", "=".repeat(60));
        println!("Testing: {} Preset", name);
        println!("{}", "=".repeat(60));
        
        println!("\nParameters sent to backend:");
        println!("  primary_max_supply: {}", args.primary_max_supply);
        println!("  tge_allocation: {}", args.tge_allocation);
        println!("  initial_secondary_burn: {}", args.initial_secondary_burn);
        println!("  halving_step: {}", args.halving_step);
        println!("  initial_reward_per_burn_unit: {}", args.initial_reward_per_burn_unit);
        
        // Call the backend exactly like the frontend does
        let response: Result<GraphData, String> = env
            .pic
            .update_call(
                env.lbry_fun,
                Principal::anonymous(),
                "preview_tokenomics_graphs",
                candid::encode_one(&args).unwrap(),
            )
            .map(|res| {
                let bytes = res.as_slice();
                candid::decode_one(bytes).unwrap()
            })
            .map_err(|e| format!("Call failed: {:?}", e));
            
        match response {
            Ok(graph_data) => {
                println!("\nRaw Response Data:");
                println!("  cumulative_supply_data_x length: {}", graph_data.cumulative_supply_data_x.len());
                println!("  cumulative_supply_data_y length: {}", graph_data.cumulative_supply_data_y.len());
                println!("  minted_per_epoch_data_x: {:?}", graph_data.minted_per_epoch_data_x);
                println!("  minted_per_epoch_data_y: {:?}", graph_data.minted_per_epoch_data_y);
                
                println!("\nEpoch count: {}", graph_data.minted_per_epoch_data_x.len());
                
                if graph_data.minted_per_epoch_data_x.len() == 1 {
                    println!("\n⚠️  WARNING: Only 1 epoch returned! This is what the frontend sees!");
                    println!("This explains why all graphs show only 1 epoch.");
                }
                
                // Show the actual minting data
                if let Some(first_epoch_minted) = graph_data.minted_per_epoch_data_y.first() {
                    let minted_e8s = *first_epoch_minted;
                    let minted_natural = minted_e8s as f64 / 100_000_000.0;
                    println!("\nFirst epoch mints: {} tokens", minted_natural);
                    
                    let max_supply = args.primary_max_supply.parse::<u64>().unwrap_or(0) as f64 / 100_000_000.0;
                    let percentage = (minted_natural / max_supply) * 100.0;
                    println!("That's {:.2}% of max supply in first epoch!", percentage);
                }
                
                // Check total minted
                if let Some(total) = graph_data.cumulative_supply_data_y.last() {
                    let total_e8s = *total;
                    let total_natural = total_e8s as f64 / 100_000_000.0;
                    let max_supply = args.primary_max_supply.parse::<u64>().unwrap_or(0) as f64 / 100_000_000.0;
                    println!("\nTotal minted: {} tokens ({:.2}% of max supply)", 
                        total_natural, (total_natural / max_supply) * 100.0);
                }
            }
            Err(e) => {
                println!("\n❌ ERROR calling backend: {}", e);
            }
        }
    }
    
    println!("\n\nCONCLUSION:");
    println!("If all presets show only 1 epoch, the issue is likely:");
    println!("1. The reward calculation is so small that epoch 2 would mint 0 tokens");
    println!("2. The first epoch is hitting the max supply cap");
    println!("3. There's a logic error that stops after the first epoch");
}