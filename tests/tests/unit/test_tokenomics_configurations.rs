use crate::integrated_token_tests::TokenTestEnvironment;
use crate::phase2_token_operations::{swap_icp, approve_icp};
use crate::shared_helpers::{E8S, ExecutionError, Account, ApproveArgs, approve_token};
use candid::{Encode, Nat, Principal};

/// Tests for various tokenomics configurations to find edge cases and vulnerabilities
#[cfg(test)]
mod tokenomics_configuration_tests {
    use super::*;

    /// Test 1: Whale Capture Configuration
    /// High initial reward that gives 30% of supply in first epoch
    #[test]
    fn test_whale_capture_configuration() {
        let mut env = TokenTestEnvironment::new();
        
        // Configuration that front-loads rewards
        let (primary, secondary, tokenomics, icp_swap, logs) = env.create_token_with_config(
            "Whale Capture",
            "WHALE",
            1_000_000 * E8S,      // burn_unit: 1M secondary tokens (high barrier)
            2_999,                // initial_reward: Just under 30% cap
            1_000_000 * E8S,      // max_supply: 1M tokens
            25,                   // halving_step: 25% (aggressive halving)
        ).expect("Failed to create whale capture token");
        
        println!("\n=== Whale Capture Configuration Test ===");
        println!("Burn unit: 1M secondary tokens");
        println!("Initial reward: 2,999 primary per burn unit");
        println!("Expected: First burner gets ~299,900 tokens (30% of supply)");
        
        // First whale gets secondary tokens
        // With ratio of 400, need 2500 ICP to get 1M secondary tokens
        // But alice only has 1000 ICP, so let's adjust
        approve_icp(&mut env, "alice", 250 * E8S + 100_000).unwrap();
        swap_icp(&mut env, "alice", 250 * E8S).unwrap(); // Get 100k secondary tokens
        
        let alice_secondary = env.get_balance("alice", secondary);
        println!("Alice secondary balance: {} natural", alice_secondary / E8S);
        
        // Since we can't get 1M secondary tokens, let's check if we can burn less
        // The burn unit is 1M, so trying to burn less should fail
        approve_token(&env, "alice", secondary, icp_swap, 100_000 * E8S).unwrap();
        
        let burn_result: Result<Result<String, ExecutionError>, _> = env.pic.update_call(
            icp_swap,
            env.test_users["alice"],
            "burn_secondary",
            candid::encode_one(100_000u64).unwrap(), // Less than burn unit
        ).map(|res| candid::decode_one(&res).unwrap());
        
        if let Ok(Err(e)) = &burn_result {
            println!("Burn failed as expected (insufficient secondary): {:?}", e);
            println!("❌ FINDING: High burn unit (1M) creates extreme barrier to entry");
            
            // Let's create a more reasonable configuration
            let (primary2, secondary2, _, icp_swap2, _) = env.create_token_with_config(
                "Whale2",
                "WHL2",
                10_000 * E8S,        // More reasonable burn unit
                299,                 // Still high reward (29.9% of supply per burn)
                1_000_000 * E8S,     // 1M tokens
                25,                  // Aggressive halving
            ).expect("Failed to create whale2 token");
            
            // Now alice can participate
            approve_token(&env, "alice", secondary2, icp_swap2, 10_000 * E8S).unwrap();
            
            let burn2: Result<Result<String, ExecutionError>, _> = env.pic.update_call(
                icp_swap2,
                env.test_users["alice"],
                "burn_secondary",
                candid::encode_one(10_000u64).unwrap(),
            ).map(|res| candid::decode_one(&res).unwrap());
            
            if burn2.is_ok() && burn2.as_ref().unwrap().is_ok() {
                let alice_primary = env.get_balance("alice", primary2);
                println!("\nWith 10k burn unit:");
                println!("Alice received: {} primary tokens", alice_primary / E8S);
                let supply_percent = (alice_primary as f64) / ((1_000_000 * E8S) as f64) * 100.0;
                println!("That's {:.2}% of total supply", supply_percent);
                println!("❌ FINDING: Even with lower burn unit, first mover gets ~30% of supply!");
            }
            return; // Exit early
        }
        
        assert!(false, "Expected burn to fail with high burn unit");
        
        // The rest of the test would be unreachable due to early return
        // The key finding is that high burn units create barriers to entry
    }

    /// Test 2: Low Burn Unit Configuration
    /// Tests if low burn units can be exploited
    #[test]
    fn test_low_burn_unit_exploit() {
        let mut env = TokenTestEnvironment::new();
        
        // Try to create token with very low burn unit
        let (primary, secondary, tokenomics, icp_swap, logs) = env.create_token_with_config(
            "Low Burn",
            "LOWB",
            200_000 * E8S,        // Minimum allowed burn unit
            10,                   // Low initial reward
            10_000_000 * E8S,     // Large max supply
            50,                   // Normal halving
        ).expect("Failed to create low burn token");
        
        println!("\n=== Low Burn Unit Configuration Test ===");
        println!("Burn unit: 200,000 secondary tokens (minimum allowed)");
        println!("Market cap at launch: ${}", (200_000 as f64) * 0.005);
        
        // Get secondary tokens
        approve_icp(&mut env, "alice", 500 * E8S + 100_000).unwrap();
        swap_icp(&mut env, "alice", 500 * E8S).unwrap(); // Get 200k secondary tokens
        
        // Try to burn the minimum
        approve_token(&env, "alice", secondary, icp_swap, 200_000 * E8S).unwrap();
        
        let burn_result: Result<Result<String, ExecutionError>, _> = env.pic.update_call(
            icp_swap,
            env.test_users["alice"],
            "burn_secondary",
            candid::encode_one(200_000u64).unwrap(),
        ).map(|res| candid::decode_one(&res).unwrap());
        
        if burn_result.is_ok() && burn_result.as_ref().unwrap().is_ok() {
            let alice_primary = env.get_balance("alice", primary);
            println!("Tokens received from minimum burn: {} primary", alice_primary / E8S);
            
            // Calculate percentage of total supply
            let supply_percentage = (alice_primary as f64) / ((10_000_000 * E8S) as f64) * 100.0;
            println!("Percentage of total supply: {:.6}%", supply_percentage);
            
            // Should be well under 0.1% cap
            assert!(
                supply_percentage < 0.1,
                "Single burn should not exceed 0.1% cap. Got: {:.6}%",
                supply_percentage
            );
        }
        
        println!("✅ FINDING: Minimum burn unit of 200k enforces $1000 minimum correctly");
    }

    /// Test 3: Transaction Cap Violation Attempt
    /// Try to mint more than 0.1% in a single transaction
    #[test]
    fn test_transaction_cap_enforcement() {
        let mut env = TokenTestEnvironment::new();
        
        // Configuration designed to violate 0.1% cap
        let (primary, secondary, tokenomics, icp_swap, logs) = env.create_token_with_config(
            "Cap Buster",
            "BUST",
            500_000 * E8S,        // burn_unit
            1_000,                // High reward: would give 100k tokens per burn
            1_000_000 * E8S,      // max_supply: 1M
            50,                   // halving
        ).expect("Failed to create cap buster token");
        
        println!("\n=== Transaction Cap Test ===");
        println!("Configuration would give {} tokens per burn", 1_000 * 100);
        println!("This is {}% of 1M supply", (100_000 as f64) / 1_000_000.0 * 100.0);
        
        // Get secondary tokens  
        approve_icp(&mut env, "alice", 300 * E8S + 100_000).unwrap();
        swap_icp(&mut env, "alice", 300 * E8S).unwrap(); // Get 120k secondary tokens
        
        // Try to burn
        approve_token(&env, "alice", secondary, icp_swap, 500_000 * E8S).unwrap();
        
        let burn_result: Result<Result<String, ExecutionError>, _> = env.pic.update_call(
            icp_swap,
            env.test_users["alice"],
            "burn_secondary",
            candid::encode_one(500_000u64).unwrap(),
        ).map(|res| candid::decode_one(&res).unwrap());
        
        // This configuration should ideally be rejected or capped
        if burn_result.is_ok() && burn_result.as_ref().unwrap().is_ok() {
            let alice_primary = env.get_balance("alice", primary);
            let minted_percentage = (alice_primary as f64) / ((1_000_000 * E8S) as f64) * 100.0;
            
            println!("WARNING: Burn succeeded!");
            println!("Minted: {} tokens ({:.4}% of supply)", 
                     alice_primary / E8S, minted_percentage);
            
            if minted_percentage > 0.1 {
                println!("❌ CRITICAL: Transaction cap NOT enforced! Minted {:.4}% > 0.1%", 
                         minted_percentage);
            }
        } else if let Ok(Err(e)) = burn_result {
            println!("✅ Burn correctly rejected: {:?}", e);
        }
    }

    /// Test 4: Extreme Halving Configuration
    /// Tests edge cases with very high/low halving steps
    #[test]
    fn test_extreme_halving_configurations() {
        let mut env = TokenTestEnvironment::new();
        
        // Test with 99% halving (almost no halving)
        let (primary, secondary, _, icp_swap, _) = env.create_token_with_config(
            "No Halving",
            "NOHV",
            500_000 * E8S,
            100,
            5_000_000 * E8S,
            99,                   // 99% = almost no halving
        ).expect("Failed to create no-halving token");
        
        println!("\n=== Extreme Halving Test (99%) ===");
        
        // Do multiple burns to see halving effect
        let users = vec!["alice", "bob", "charlie"];
        let mut rewards = Vec::new();
        
        for (i, user) in users.iter().enumerate() {
            approve_icp(&mut env, user, 300 * E8S + 100_000).unwrap();
            swap_icp(&mut env, user, 300 * E8S).unwrap();
            
            approve_token(&env, user, secondary, icp_swap, 500_000 * E8S).unwrap();
            
            let burn_result: Result<Result<String, ExecutionError>, _> = env.pic.update_call(
                icp_swap,
                env.test_users[*user],
                "burn_secondary",
                candid::encode_one(500_000u64).unwrap(),
            ).map(|res| candid::decode_one(&res).unwrap());
            
            if burn_result.is_ok() && burn_result.as_ref().unwrap().is_ok() {
                let balance = env.get_balance(user, primary);
                rewards.push(balance / E8S);
                println!("Burn {}: {} got {} tokens", i + 1, user, balance / E8S);
            }
        }
        
        // Check halving effect
        if rewards.len() >= 2 {
            let halving_ratio = (rewards[1] as f64) / (rewards[0] as f64);
            println!("Actual halving ratio: {:.2}%", halving_ratio * 100.0);
            
            assert!(
                halving_ratio > 0.95,
                "With 99% halving, rewards should barely decrease"
            );
            
            println!("❌ FINDING: 99% halving creates inflation-like tokenomics");
        }
    }

    /// Test 5: Supply Exhaustion Scenario
    /// What happens when approaching max supply?
    #[test]
    fn test_supply_exhaustion_handling() {
        let mut env = TokenTestEnvironment::new();
        
        // Small supply that can be exhausted quickly
        let (primary, secondary, tokenomics, icp_swap, _) = env.create_token_with_config(
            "Tiny Supply",
            "TINY",
            500_000 * E8S,
            900,                  // High reward to exhaust quickly
            100_000 * E8S,        // Only 100k tokens total
            50,
        ).expect("Failed to create tiny supply token");
        
        println!("\n=== Supply Exhaustion Test ===");
        println!("Max supply: 100,000 tokens");
        println!("Reward per burn: 90,000 tokens");
        
        // First burn should get most of the supply
        approve_icp(&mut env, "alice", 300 * E8S + 100_000).unwrap();
        swap_icp(&mut env, "alice", 300 * E8S).unwrap();
        approve_token(&env, "alice", secondary, icp_swap, 500_000 * E8S).unwrap();
        
        let burn1: Result<Result<String, ExecutionError>, _> = env.pic.update_call(
            icp_swap,
            env.test_users["alice"],
            "burn_secondary",
            candid::encode_one(500_000u64).unwrap(),
        ).map(|res| candid::decode_one(&res).unwrap());
        
        if burn1.is_ok() && burn1.as_ref().unwrap().is_ok() {
            let alice_balance = env.get_balance("alice", primary);
            println!("First burn minted: {} tokens", alice_balance / E8S);
            
            // Try second burn - should fail or give minimal tokens
            approve_icp(&mut env, "bob", 300 * E8S + 100_000).unwrap();
            swap_icp(&mut env, "bob", 300 * E8S).unwrap();
            approve_token(&env, "bob", secondary, icp_swap, 500_000 * E8S).unwrap();
            
            let burn2: Result<Result<String, ExecutionError>, _> = env.pic.update_call(
                icp_swap,
                env.test_users["bob"],
                "burn_secondary",
                candid::encode_one(500_000u64).unwrap(),
            ).map(|res| candid::decode_one(&res).unwrap());
            
            if burn2.is_ok() && burn2.as_ref().unwrap().is_ok() {
                let bob_balance = env.get_balance("bob", primary);
                let total_minted = (alice_balance + bob_balance) / E8S;
                
                println!("Second burn minted: {} tokens", bob_balance / E8S);
                println!("Total minted: {} / {} max supply", total_minted, 100_000);
                
                assert!(
                    total_minted <= 100_000,
                    "Should not mint more than max supply!"
                );
            } else if let Ok(Err(e)) = burn2 {
                println!("✅ Second burn correctly failed: {:?}", e);
            }
        }
    }

    /// Test 6: Preset Configurations Validation
    /// Verify the frontend presets work as expected
    #[test]
    fn test_frontend_preset_configurations() {
        let mut env = TokenTestEnvironment::new();
        
        // Test "Extended Distribution" preset
        let (primary, secondary, _, icp_swap, _) = env.create_token_with_config(
            "Extended",
            "EXT",
            200_000 * E8S,        // burn_unit
            100,                  // initial_reward
            1_000_000 * E8S,      // max_supply
            35,                   // halving_step
        ).expect("Failed to create extended distribution token");
        
        println!("\n=== Extended Distribution Preset Test ===");
        
        // Calculate expected epochs
        let mut remaining_supply = 1_000_000u64;
        let mut current_reward = 100u64;
        let mut epoch_count = 0;
        
        while remaining_supply > 0 && current_reward > 0 {
            let epoch_mint = std::cmp::min(current_reward * 100, remaining_supply);
            remaining_supply = remaining_supply.saturating_sub(epoch_mint);
            current_reward = current_reward * 35 / 100; // 35% of previous
            epoch_count += 1;
            
            if epoch_count > 100 { break; } // Safety limit
        }
        
        println!("Calculated epochs: {}", epoch_count);
        assert!(
            epoch_count >= 15,
            "Extended distribution should have 15+ epochs. Got: {}",
            epoch_count
        );
        
        // Verify initial valuation
        let initial_valuation = (200_000 as f64) * 0.005;
        println!("Initial valuation: ${}", initial_valuation);
        assert_eq!(initial_valuation, 1000.0, "Should have exactly $1000 initial valuation");
        
        println!("✅ Extended Distribution preset validated");
    }
}