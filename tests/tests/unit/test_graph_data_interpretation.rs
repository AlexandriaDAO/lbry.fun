/// Test that calls the backend exactly like the frontend and shows the table data
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

fn call_backend_and_format_table(env: &TokenTestEnvironment, name: &str, args: PreviewArgs) -> (usize, f64) {
    let response: Result<GraphData, String> = env
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
    
    let graph_data = response.expect("Should get graph data");
    const E8S: f64 = 100_000_000.0;
    
    println!("\n=== {} Backend Table Data ===", name);
    println!("Epoch\tCumulative Secondary Burned\tCumulative Primary Minted\tPrimary Minted In Epoch\tUSD Cost per Primary Token ($)\tCumulative USD Cost ($)\tSupply Minted (%)");
    
    let max_supply = args.primary_max_supply.parse::<u64>().unwrap() as f64 / E8S;
    
    // TGE Data
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
    let num_epochs = graph_data.minted_per_epoch_data_x.len();
    for i in 0..num_epochs {
        let epoch_label = &graph_data.minted_per_epoch_data_x[i];
        
        let cumulative_secondary = if i + 1 < graph_data.cumulative_supply_data_x.len() {
            graph_data.cumulative_supply_data_x[i + 1]
        } else { 0 };
        
        let cumulative_primary = if i + 1 < graph_data.cumulative_supply_data_y.len() {
            graph_data.cumulative_supply_data_y[i + 1] as f64 / E8S
        } else { 0.0 };
        
        let minted_this_epoch = graph_data.minted_per_epoch_data_y[i] as f64 / E8S;
        
        let cost_per_token = if (i * 2) + 3 < graph_data.cost_to_mint_data_y.len() {
            graph_data.cost_to_mint_data_y[(i * 2) + 3]
        } else { 0.0 };
        
        let cumulative_cost = if i + 1 < graph_data.cumulative_usd_cost_data_y.len() {
            graph_data.cumulative_usd_cost_data_y[i + 1]
        } else { 0.0 };
        
        let percentage_minted = (cumulative_primary / max_supply) * 100.0;
        
        println!("{}\t{}\t{:.4}\t{:.4}\t${:.6}\t${:.2}\t{:.2}%",
            epoch_label, 
            cumulative_secondary.to_string().chars()
                .collect::<Vec<char>>()
                .rchunks(3)
                .map(|chunk| chunk.iter().rev().collect::<String>())
                .collect::<Vec<String>>()
                .into_iter()
                .rev()
                .collect::<Vec<String>>()
                .join(","),
            cumulative_primary, 
            minted_this_epoch, 
            cost_per_token, 
            cumulative_cost, 
            percentage_minted
        );
    }
    
    // Return metrics for validation
    let final_supply_percentage = if let Some(final_supply) = graph_data.cumulative_supply_data_y.last() {
        (*final_supply as f64 / E8S / max_supply) * 100.0
    } else { 0.0 };
    
    (num_epochs, final_supply_percentage)
}

#[test]
fn test_all_preset_graphs() {
    println!("\n=== Testing All Preset Graphs ===");
    
    let env = TokenTestEnvironment::new();
    
    // Quick Launch Preset
    let quick_launch_args = PreviewArgs {
        primary_max_supply: "100000000000000".to_string(),      // 1M * E8S
        tge_allocation: "10000000000".to_string(),              // 100 * E8S
        initial_secondary_burn: "100000000000000".to_string(),  // 1M * E8S
        halving_step: "70".to_string(),
        initial_reward_per_burn_unit: "200000000000".to_string(), // 2000 * E8S
    };
    
    let (quick_epochs, quick_supply_pct) = call_backend_and_format_table(&env, "Quick Launch", quick_launch_args);
    
    // Balanced Preset
    let balanced_args = PreviewArgs {
        primary_max_supply: "100000000000000".to_string(),      // 1M * E8S
        tge_allocation: "10000000000".to_string(),              // 100 * E8S
        initial_secondary_burn: "50000000000000".to_string(),   // 500K * E8S
        halving_step: "45".to_string(),
        initial_reward_per_burn_unit: "50000000000".to_string(), // 500 * E8S
    };
    
    let (balanced_epochs, balanced_supply_pct) = call_backend_and_format_table(&env, "Balanced", balanced_args);
    
    // Extended Distribution Preset
    let extended_args = PreviewArgs {
        primary_max_supply: "100000000000000".to_string(),      // 1M * E8S
        tge_allocation: "10000000000".to_string(),              // 100 * E8S
        initial_secondary_burn: "20000000000000".to_string(),   // 200K * E8S
        halving_step: "90".to_string(),
        initial_reward_per_burn_unit: "10000000000".to_string(), // 100 * E8S
    };
    
    let (extended_epochs, extended_supply_pct) = call_backend_and_format_table(&env, "Extended Distribution", extended_args);
    
    // Validation
    println!("\n=== VALIDATION RESULTS ===");
    println!("Quick Launch: {} epochs, {:.2}% supply", quick_epochs, quick_supply_pct);
    println!("Balanced: {} epochs, {:.2}% supply", balanced_epochs, balanced_supply_pct);
    println!("Extended Distribution: {} epochs, {:.2}% supply", extended_epochs, extended_supply_pct);
    
    // Assertions to validate the fix worked
    assert!(quick_epochs >= 3, "Quick Launch should have 3+ epochs, got {}", quick_epochs);
    assert!(quick_epochs <= 7, "Quick Launch should have ≤7 epochs, got {}", quick_epochs);
    assert!(quick_supply_pct <= 100.5, "Quick Launch should not overmint significantly, got {:.2}%", quick_supply_pct);
    
    assert!(balanced_epochs >= 8, "Balanced should have 8+ epochs, got {}", balanced_epochs);
    assert!(balanced_epochs <= 15, "Balanced should have ≤15 epochs, got {}", balanced_epochs);
    assert!(balanced_supply_pct <= 100.5, "Balanced should not overmint significantly, got {:.2}%", balanced_supply_pct);
    
    assert!(extended_epochs >= 15, "Extended Distribution should have 15+ epochs, got {}", extended_epochs);
    assert!(extended_supply_pct <= 100.5, "Extended Distribution should not overmint significantly, got {:.2}%", extended_supply_pct);
    
    println!("\n✅ All presets validated successfully!");
}