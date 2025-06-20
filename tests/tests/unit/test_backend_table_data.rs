/// Test to view the actual backend table data for each preset
use crate::helpers::token_testing::*;
use candid::{Encode, Principal};

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
fn test_backend_table_data_for_presets() {
    println!("\n=== Backend Table Data for All Presets ===");
    
    let env = TokenTestEnvironment::new();
    const E8S: f64 = 100_000_000.0;
    
    // Define the three presets
    let presets = vec![
        ("Extended Distribution", PreviewArgs {
            primary_max_supply: 1_000_000 * 100_000_000, // Convert to E8S
            tge_allocation: 100 * 100_000_000,
            initial_secondary_burn: 200_000 * 100_000_000,
            halving_step: 90,
            initial_reward_per_burn_unit: 100 * 100_000_000,
        }),
        ("Balanced", PreviewArgs {
            primary_max_supply: 1_000_000 * 100_000_000,
            tge_allocation: 100 * 100_000_000,
            initial_secondary_burn: 500_000 * 100_000_000,
            halving_step: 45,
            initial_reward_per_burn_unit: 500 * 100_000_000,
        }), 
        ("Quick Launch", PreviewArgs {
            primary_max_supply: 1_000_000 * 100_000_000,
            tge_allocation: 100 * 100_000_000,
            initial_secondary_burn: 1_000_000 * 100_000_000,
            halving_step: 70,
            initial_reward_per_burn_unit: 2000 * 100_000_000,
        }),
    ];
    
    for (name, args) in presets {
        println!("\n\n{'='*60}");
        println!("PRESET: {}", name);
        println!("{'='*60}");
        
        // Call preview_tokenomics
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
        
        // Print summary statistics
        let max_supply = args.primary_max_supply as f64 / E8S;
        let total_minted = *graph_data.cumulative_supply_data_y.last().unwrap_or(&0) as f64 / E8S;
        let num_epochs = graph_data.minted_per_epoch_data_x.len();
        
        println!("\nSUMMARY:");
        println!("- Max Supply: {} tokens", max_supply);
        println!("- Total Minted: {} tokens", total_minted);
        println!("- Overminting: {}%", ((total_minted / max_supply) - 1.0) * 100.0);
        println!("- Number of Epochs: {}", num_epochs);
        
        // Print the table data like the frontend does
        println!("\nTABLE DATA:");
        println!("Epoch\tCumulative Secondary Burned\tCumulative Primary Minted\tPrimary Minted In Epoch\tUSD Cost per Primary Token ($)\tCumulative USD Cost ($)\tSupply Minted (%)");
        
        // TGE Data (Epoch 0)
        let tge_primary = graph_data.cumulative_supply_data_y[0] as f64 / E8S;
        let tge_percentage = (tge_primary / max_supply) * 100.0;
        let tge_cost_per_token = if graph_data.cost_to_mint_data_y.len() > 1 { 
            graph_data.cost_to_mint_data_y[1] 
        } else { 
            0.0 
        };
        
        println!("TGE\t0\t{:.4}\t{:.4}\t${:.6}\t$0.00\t{:.2}%",
            tge_primary, tge_primary, tge_cost_per_token, tge_percentage);
        
        // Epoch Data
        for i in 0..num_epochs.min(10) { // Show first 10 epochs
            let epoch_label = &graph_data.minted_per_epoch_data_x[i];
            
            let cumulative_secondary = if i + 1 < graph_data.cumulative_supply_data_x.len() {
                graph_data.cumulative_supply_data_x[i + 1]
            } else {
                0
            };
            let cumulative_primary = if i + 1 < graph_data.cumulative_supply_data_y.len() {
                graph_data.cumulative_supply_data_y[i + 1] as f64 / E8S
            } else {
                0.0
            };
            let minted_this_epoch = graph_data.minted_per_epoch_data_y[i] as f64 / E8S;
            
            let cost_per_token = if (i * 2) + 3 < graph_data.cost_to_mint_data_y.len() {
                graph_data.cost_to_mint_data_y[(i * 2) + 3]
            } else {
                0.0
            };
            let cumulative_cost = if i + 1 < graph_data.cumulative_usd_cost_data_y.len() {
                graph_data.cumulative_usd_cost_data_y[i + 1]
            } else {
                0.0
            };
            let percentage_minted = (cumulative_primary / max_supply) * 100.0;
            
            println!("{}\t{}\t{:.4}\t{:.4}\t${:.6}\t${:.2}\t{:.2}%",
                epoch_label, cumulative_secondary, cumulative_primary, minted_this_epoch,
                cost_per_token, cumulative_cost, percentage_minted);
        }
        
        if num_epochs > 10 {
            println!("... ({} more epochs)", num_epochs - 10);
            
            // Show the last epoch
            let last_idx = num_epochs - 1;
            let epoch_label = &graph_data.minted_per_epoch_data_x[last_idx];
            let cumulative_secondary = *graph_data.cumulative_supply_data_x.last().unwrap_or(&0);
            let cumulative_primary = *graph_data.cumulative_supply_data_y.last().unwrap_or(&0) as f64 / E8S;
            let minted_this_epoch = graph_data.minted_per_epoch_data_y[last_idx] as f64 / E8S;
            let percentage_minted = (cumulative_primary / max_supply) * 100.0;
            
            println!("{}\t{}\t{:.4}\t{:.4}\t...\t...\t{:.2}%",
                epoch_label, cumulative_secondary, cumulative_primary, minted_this_epoch, percentage_minted);
        }
        
        // Verify expectations
        println!("\nVERIFICATION:");
        if name == "Extended Distribution" {
            if num_epochs < 15 {
                println!("⚠️  WARNING: Extended Distribution has only {} epochs (expected 15+)", num_epochs);
            } else {
                println!("✅ Extended Distribution has {} epochs (15+ expected)", num_epochs);
            }
        }
        
        if total_minted > max_supply {
            println!("❌ OVERMINTING DETECTED: {:.2}% over max supply!", ((total_minted / max_supply) - 1.0) * 100.0);
        } else {
            println!("✅ No overminting: {:.2}% of max supply used", (total_minted / max_supply) * 100.0);
        }
    }
}