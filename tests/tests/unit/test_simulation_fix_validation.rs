/// Test to validate that the simulation fix properly prevents overminting

use candid::{Encode, decode_one};

#[test]
fn test_simulation_fix_prevents_overminting() {
    println!("\n=== Testing Simulation Fix - Overminting Prevention ===");
    
    let pic = pocket_ic::PocketIc::new();
    
    // Deploy lbry_fun canister with the fixed code
    let lbry_fun_wasm = include_bytes!("../../../../target/wasm32-unknown-unknown/release/lbry_fun.wasm");
    let canister_id = pic.create_canister();
    pic.add_cycles(canister_id, 2_000_000_000_000);
    
    let arg = Encode!(&()).unwrap();
    pic.install_canister(canister_id, lbry_fun_wasm.to_vec(), arg, None);
    
    // Test default preset
    println!("\nTesting default preset:");
    test_preset(&pic, canister_id, 
        1_000_000,    // max_supply
        1,            // tge
        1_000_000,    // initial_burn
        70,           // halving
        2000          // reward_rate
    );
    
    // Test extended preset
    println!("\nTesting extended preset:");
    test_preset(&pic, canister_id,
        1_000_000,    // max_supply
        1,            // tge
        200_000,      // initial_burn  
        90,           // halving
        100           // reward_rate
    );
    
    // Test edge case with very high reward rate
    println!("\nTesting high reward rate:");
    test_preset(&pic, canister_id,
        1_000_000,    // max_supply
        0,            // tge
        100_000,      // initial_burn
        50,           // halving
        10_000        // reward_rate
    );
}

fn test_preset(
    pic: &pocket_ic::PocketIc, 
    canister_id: candid::Principal,
    max_supply: u64,
    tge: u64,
    initial_burn: u64,
    halving: u64,
    reward_rate: u64
) {
    use lbry_fun::simulation::{PreviewArgs, GraphData};
    
    let args = PreviewArgs {
        primary_max_supply: max_supply,
        tge_allocation: tge,
        initial_secondary_burn: initial_burn,
        halving_step: halving,
        initial_reward_per_burn_unit: reward_rate,
    };
    
    let result: GraphData = decode_one(
        &pic.query_call(
            canister_id,
            candid::Principal::anonymous(),
            "preview_tokenomics",
            Encode!(&args).unwrap()
        ).unwrap().unwrap()
    ).unwrap();
    
    // Check that total supply doesn't exceed max
    let total_minted_e8s = result.cumulative_supply_data_y.last().unwrap_or(&0);
    let total_minted_tokens = total_minted_e8s / 100_000_000;
    
    println!("- Max supply: {} tokens", max_supply);
    println!("- Total minted: {} tokens (e8s: {})", total_minted_tokens, total_minted_e8s);
    println!("- Number of epochs: {}", result.minted_per_epoch_data_y.len());
    
    // The key assertion - total minted should not exceed max supply
    assert!(
        total_minted_tokens <= max_supply,
        "Total minted {} exceeds max supply {}",
        total_minted_tokens, max_supply
    );
    
    // Check monotonic increase
    for i in 1..result.cumulative_supply_data_y.len() {
        assert!(
            result.cumulative_supply_data_y[i] >= result.cumulative_supply_data_y[i-1],
            "Supply must be monotonically increasing"
        );
    }
}

#[test] 
fn test_graph_data_units() {
    println!("\n=== Testing Graph Data Units ===");
    
    let pic = pocket_ic::PocketIc::new();
    
    // Deploy lbry_fun canister
    let lbry_fun_wasm = include_bytes!("../../../../target/wasm32-unknown-unknown/release/lbry_fun.wasm");
    let canister_id = pic.create_canister();
    pic.add_cycles(canister_id, 2_000_000_000_000);
    
    let arg = Encode!(&()).unwrap();
    pic.install_canister(canister_id, lbry_fun_wasm.to_vec(), arg, None);
    
    use lbry_fun::simulation::{PreviewArgs, GraphData};
    
    let args = PreviewArgs {
        primary_max_supply: 21_000_000,
        tge_allocation: 0,
        initial_secondary_burn: 5_000,
        halving_step: 50,
        initial_reward_per_burn_unit: 100,
    };
    
    let result: GraphData = decode_one(
        &pic.query_call(
            canister_id,
            candid::Principal::anonymous(),
            "preview_tokenomics",
            Encode!(&args).unwrap()
        ).unwrap().unwrap()
    ).unwrap();
    
    println!("Graph data analysis:");
    println!("- Epochs: {}", result.minted_per_epoch_data_y.len());
    
    // Check first few epochs
    for i in 0..std::cmp::min(3, result.minted_per_epoch_data_y.len()) {
        let minted_e8s = result.minted_per_epoch_data_y[i];
        let minted_tokens = minted_e8s / 100_000_000;
        println!("- Epoch {}: {} tokens (e8s: {})", i + 1, minted_tokens, minted_e8s);
        
        // Verify the values are in e8s
        assert!(
            minted_e8s > 100_000_000, // Should be > 1 token in e8s
            "Epoch {} value {} seems too small for e8s", i + 1, minted_e8s
        );
    }
    
    // The frontend should divide by E8S when displaying
    println!("\nIMPORTANT: Graph data is in e8s units!");
    println!("Frontend must divide by 100,000,000 to display as tokens");
}