use crate::integrated_token_tests::TokenTestEnvironment;
use crate::shared_helpers::{ExecutionError, E8S, Account, ApproveArgs};
use candid::{Encode, Nat, Principal};

/// Analyze the actual COST of the burn_unit=1 scenario
#[cfg(test)]
mod burn_cost_analysis_tests {
    use super::*;

    #[test]
    fn test_burn_unit_one_cost_analysis() {
        let mut env = TokenTestEnvironment::new();
        
        println!("\n=== COST ANALYSIS: burn_unit=1 vulnerability ===");
        
        // Create token with burn_unit = 1
        let (primary_token, secondary_token, tokenomics, icp_swap, logs) = env
            .create_token_with_config(
                "Cost Analysis Token",
                "COST",
                1,                   // burn_unit: 1 (not 1 * E8S)
                1_000_000,           // initial_reward: 1M 
                21_000_000 * E8S,    // max_supply: 21M tokens
                50,                  // halving_step: 50%
            )
            .expect("Failed to create token");

        // Check the secondary ratio (how many secondary tokens per ICP)
        let ratio_result = env.pic.query_call(
            icp_swap,
            Principal::anonymous(),
            "get_current_secondary_ratio",
            candid::encode_one(()).unwrap(),
        ).unwrap();
        
        let ratio: u64 = candid::decode_one(&ratio_result).unwrap();
        println!("Secondary ratio: {} secondary tokens per ICP", ratio);
        
        // Assuming ICP price of $4.00 (from the ratio of 400)
        let icp_price = 4.0;
        let secondary_per_icp = ratio as f64;
        let cost_per_secondary = icp_price / secondary_per_icp;
        
        println!("\nCOST BREAKDOWN:");
        println!("  ICP price: ${:.2}", icp_price);
        println!("  Secondary tokens per ICP: {}", secondary_per_icp);
        println!("  Cost per secondary token: ${:.6}", cost_per_secondary);
        
        // Now calculate the cost to mint 100 primary tokens
        let primary_per_burn = 100; // As shown in previous test
        let cost_per_100_primary = cost_per_secondary * 1.0; // Burning 1 secondary token
        
        println!("\nEXPLOIT ANALYSIS:");
        println!("  Burning 1 secondary token mints: {} primary tokens", primary_per_burn);
        println!("  Cost to mint {} primary tokens: ${:.6}", primary_per_burn, cost_per_100_primary);
        println!("  Cost per primary token: ${:.8}", cost_per_100_primary / primary_per_burn as f64);
        
        // Calculate total supply exploit cost
        let total_supply = 21_000_000;
        let burns_needed = total_supply / primary_per_burn;
        let total_cost = burns_needed as f64 * cost_per_100_primary;
        
        println!("\nTOTAL SUPPLY EXPLOIT:");
        println!("  Total primary supply: {} tokens", total_supply);
        println!("  Burns needed to mint entire supply: {}", burns_needed);
        println!("  Total cost to mint entire supply: ${:.2}", total_cost);
        
        // The vulnerability is if the entire supply can be minted for an unreasonably low cost
        let reasonable_market_cap = 1_000_000.0; // $1M minimum market cap
        
        if total_cost < reasonable_market_cap {
            println!("\n🚨 VULNERABILITY CONFIRMED!");
            println!("Entire supply can be minted for ${:.2}, which is less than ${:.0} reasonable market cap", 
                     total_cost, reasonable_market_cap);
        } else {
            println!("\n✅ NO VULNERABILITY");
            println!("Cost to mint entire supply (${:.2}) is reasonable", total_cost);
        }
        
        // Additional check: With burn_unit=1 and $0.005 cost per secondary (mentioned in CLAUDE.md)
        let actual_secondary_cost = 0.005; // From project background
        let actual_cost_per_100_primary = actual_secondary_cost * 1.0;
        let actual_total_cost = burns_needed as f64 * actual_cost_per_100_primary;
        
        println!("\nWITH ACTUAL $0.005 SECONDARY COST:");
        println!("  Cost to mint 100 primary tokens: ${:.3}", actual_cost_per_100_primary);
        println!("  Total cost to mint entire supply: ${:.2}", actual_total_cost);
        
        if actual_total_cost < 10_000.0 {
            println!("\n🚨🚨🚨 CRITICAL VULNERABILITY!");
            println!("Entire {} token supply can be minted for only ${:.2}!", total_supply, actual_total_cost);
        }
    }
}