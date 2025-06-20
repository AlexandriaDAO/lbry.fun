/// Test that shows EXACTLY what the backend returns, formatted like the frontend table
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
fn test_exact_backend_output() {
    println!("\n=== EXACT Backend Output Test ===");
    
    let env = TokenTestEnvironment::new();
    const E8S: f64 = 100_000_000.0;
    
    // Test with EXACT Quick Launch parameters as sent by frontend
    let args = PreviewArgs {
        primary_max_supply: "100000000000000".to_string(),      // 1M * E8S
        tge_allocation: "10000000000".to_string(),              // 100 * E8S
        initial_secondary_burn: "100000000000000".to_string(),  // 1M * E8S
        halving_step: "70".to_string(),
        initial_reward_per_burn_unit: "200000000000".to_string(), // 2000 * E8S
    };
    
    println!("Quick Launch Parameters (as sent by frontend):");
    println!("  primary_max_supply: {}", args.primary_max_supply);
    println!("  tge_allocation: {}", args.tge_allocation);
    println!("  initial_secondary_burn: {}", args.initial_secondary_burn);
    println!("  halving_step: {}", args.halving_step);
    println!("  initial_reward_per_burn_unit: {}", args.initial_reward_per_burn_unit);
    
    // Call backend
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
    
    // Format output EXACTLY like the frontend table
    println!("\nBackend Table Output:");
    println!("Epoch\tCumulative Secondary Burned\tCumulative Primary Minted\tPrimary Minted In Epoch\tUSD Cost per Primary Token ($)\tCumulative USD Cost ($)\tSupply Minted (%)");
    
    let max_supply = args.primary_max_supply.parse::<u64>().unwrap() as f64 / E8S;
    
    // TGE Data
    if let Some(tge_amount) = graph_data.cumulative_supply_data_y.first() {
        let tge_natural = *tge_amount as f64 / E8S;
        let tge_percentage = (tge_natural / max_supply) * 100.0;
        println!("TGE\t0\t{:.4}\t{:.4}\t$0.000000\t$0.00\t{:.2}%",
            tge_natural, tge_natural, tge_percentage);
    }
    
    // Epoch Data
    for i in 0..graph_data.minted_per_epoch_data_x.len() {
        let epoch_label = &graph_data.minted_per_epoch_data_x[i];
        
        let cumulative_secondary = if i + 1 < graph_data.cumulative_supply_data_x.len() {
            graph_data.cumulative_supply_data_x[i + 1]
        } else { 0 };
        
        let cumulative_primary = if i + 1 < graph_data.cumulative_supply_data_y.len() {
            graph_data.cumulative_supply_data_y[i + 1] as f64 / E8S
        } else { 0.0 };
        
        let minted_this_epoch = graph_data.minted_per_epoch_data_y[i] as f64 / E8S;
        let cumulative_cost = if i + 1 < graph_data.cumulative_usd_cost_data_y.len() {
            graph_data.cumulative_usd_cost_data_y[i + 1]
        } else { 0.0 };
        
        let percentage_minted = (cumulative_primary / max_supply) * 100.0;
        
        println!("{}\t{}\t{:.4}\t{:.4}\t$0.000000\t${:.2}\t{:.2}%",
            epoch_label, cumulative_secondary.to_string().replace("_", ","), 
            cumulative_primary, minted_this_epoch, cumulative_cost, percentage_minted);
    }
    
    // Analysis
    println!("\n=== ANALYSIS ===");
    println!("Number of epochs: {}", graph_data.minted_per_epoch_data_x.len());
    
    if graph_data.minted_per_epoch_data_x.len() == 1 {
        println!("⚠️  Only 1 epoch! This matches what you're seeing in the frontend.");
        
        if let Some(first_epoch_minted) = graph_data.minted_per_epoch_data_y.first() {
            let minted_natural = *first_epoch_minted as f64 / E8S;
            println!("First epoch mints: {:.4} tokens", minted_natural);
            println!("That's {:.2}% of max supply", (minted_natural / max_supply) * 100.0);
            
            // Check if it's the 18.6B number you mentioned
            if minted_natural > 1_000_000_000.0 {
                println!("❌ This is minting BILLIONS of tokens! ({:.2}B)", minted_natural / 1_000_000_000.0);
            }
        }
    }
    
    // Let's trace the calculation
    println!("\n=== Calculation Trace ===");
    let primary_per_threshold = 200_000_000_000u128; // 2000 * E8S
    let in_slot_burn = 100_000_000_000_000u128;      // 1M * E8S
    
    println!("primary_per_threshold = {} (in E8S)", primary_per_threshold);
    println!("in_slot_burn = {} (in E8S)", in_slot_burn);
    
    // Current formula in backend
    let reward = (primary_per_threshold * in_slot_burn) / 100_000_000 / 10000;
    println!("\nCurrent formula: ({} * {}) / {} / 10000", primary_per_threshold, in_slot_burn, 100_000_000);
    println!("Result: {} tokens", reward);
    println!("That's {:.2}B tokens!", reward as f64 / 1_000_000_000.0);
    
    println!("\n❌ The formula is still producing billions of tokens!");
    println!("This explains why we only get 1 epoch - it hits the max supply immediately.");
}