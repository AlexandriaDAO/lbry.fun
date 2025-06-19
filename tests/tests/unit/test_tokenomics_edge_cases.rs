use crate::integrated_token_tests::TokenTestEnvironment;
use crate::shared_helpers::{swap_icp, approve_token, ExecutionError, E8S, Account, ApproveArgs};
use candid::{Encode, Nat, Principal};
use num_traits::cast::ToPrimitive;

/// Additional edge case tests for tokenomics validation
#[cfg(test)]
mod tokenomics_edge_case_tests {
    use super::*;

    /// Test 7: E8S Conversion Edge Cases
    /// Tests decimal conversions between frontend and backend
    #[test]
    fn test_e8s_conversion_edge_cases() {
        let mut env = TokenTestEnvironment::new();
        
        // Test fractional initial rewards
        let (primary_token, secondary_token, tokenomics, icp_swap, logs) = env
            .create_token_with_config(
                "Fractional Token",
                "FRAC",
                200_000 * E8S,       // Burn Unit (in e8s)
                15,                  // Initial Reward: 1.5 tokens (15 * 0.1)
                1_000_000 * E8S,     // Max primary supply (in e8s)
                50,                  // Halving Step
            )
            .expect("Failed to create token");

        // Add test user to the environment
        let test_user = env.user1;
        
        // Mint and burn exactly one burn unit
        swap_icp(&mut env, "user1", 1_000 * E8S).unwrap();
        approve_token(&env, "user1", secondary_token, icp_swap, 200_000 * E8S).unwrap();
        
        let burn_result: Result<String, ExecutionError> = env.pic.update_call(
            icp_swap,
            test_user,
            "burn_secondary",
            candid::encode_one(200_000u64).unwrap(),
        ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
        .and_then(|res| {
            candid::decode_one::<Result<String, String>>(&res)
                .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
        });

        assert!(burn_result.is_ok());
        
        let balance = env.get_balance("user1", primary_token);
        // Should get 1.5 * 100 = 150 tokens (in e8s: 150 * 10^8)
        let expected = 150 * E8S;
        assert!(
            balance >= expected * 99 / 100 && balance <= expected * 101 / 100,
            "Fractional reward conversion failed. Got: {}, Expected: {}",
            balance, expected
        );

        // Test very small decimal (0.1 tokens)
        let (primary_token2, secondary_token2, tokenomics2, icp_swap2, logs2) = env
            .create_token_with_config(
                "Tiny Decimal Token",
                "TINY",
                200_000 * E8S,       // Burn Unit (in e8s)
                1,                   // Initial Reward: 0.1 tokens (1 * 0.1)
                1_000_000 * E8S,     // Max primary supply (in e8s)
                50,                  // Halving Step
            )
            .expect("Failed to create token");

        swap_icp(&mut env, "user2", 1_000 * E8S).unwrap();
        approve_token(&env, "user2", secondary_token2, icp_swap2, 200_000 * E8S).unwrap();
        
        let burn_result2: Result<String, ExecutionError> = env.pic.update_call(
            icp_swap2,
            env.user2,
            "burn_secondary",
            candid::encode_one(200_000u64).unwrap(),
        ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
        .and_then(|res| {
            candid::decode_one::<Result<String, String>>(&res)
                .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
        });

        assert!(burn_result2.is_ok());
        
        let balance2 = env.get_balance("user2", primary_token2);
        // Should get 0.1 * 100 = 10 tokens (in e8s: 10 * 10^8)
        let expected2 = 10 * E8S;
        assert!(
            balance2 >= expected2 * 99 / 100 && balance2 <= expected2 * 101 / 100,
            "Small decimal conversion failed. Got: {}, Expected: {}",
            balance2, expected2
        );
    }

    /// Test 8: Boundary Value Tests
    /// Tests exact minimum and maximum allowed values
    #[test]
    fn test_boundary_values() {
        let mut env = TokenTestEnvironment::new();

        // Test minimum hard cap (100,000)
        let (min_primary, min_secondary, min_tokenomics, min_icp_swap, min_logs) = env
            .create_token_with_config(
                "Min Cap Token",
                "MINCAP",
                200_000 * E8S,       // Burn Unit (in e8s)
                100,                 // Initial Reward
                100_000 * E8S,       // Minimum allowed (in e8s)
                25,                  // Minimum halving step
            )
            .expect("Min cap should be valid");

        // Test maximum hard cap (10,000,000)
        let (max_primary, max_secondary, max_tokenomics, max_icp_swap, max_logs) = env
            .create_token_with_config(
                "Max Cap Token",
                "MAXCAP",
                10_000_000 * E8S,    // Maximum burn unit (in e8s)
                10_000,              // 10% of supply (maximum initial reward)
                10_000_000 * E8S,    // Maximum allowed (in e8s)
                90,                  // Maximum halving step (90, not 99)
            )
            .expect("Max cap should be valid");

        // Test edge case: Initial reward exactly at 10% limit
        let (ten_primary, ten_secondary, ten_tokenomics, ten_icp_swap, ten_logs) = env
            .create_token_with_config(
                "Ten Percent Token",
                "TENPCT",
                500_000 * E8S,       // Burn Unit (in e8s)
                1_000,               // Exactly 0.1% of supply per burn (10% total if 100 burn units)
                1_000_000 * E8S,     // Hard Cap (in e8s)
                50,                  // Halving Step
            )
            .expect("10% initial reward should be valid");

        // Verify boundary configurations work correctly
        for (icp_swap, name) in vec![
            (min_icp_swap, "Min Cap"),
            (max_icp_swap, "Max Cap"),
            (ten_icp_swap, "Ten Percent"),
        ] {
            
            // Query tokenomics to ensure valid
            let info_res: Result<String, String> = env.pic.query_call(
                icp_swap,
                Principal::anonymous(),
                "get_tokenomics_info",
                candid::encode_one(()).unwrap(),
            ).map_err(|e| format!("{:?}", e))
            .and_then(|res| {
                candid::decode_one(&res)
                    .map_err(|e| format!("Decode error: {:?}", e))
            });

            assert!(
                info_res.is_ok(),
                "{} boundary configuration should be valid",
                name
            );
        }
    }

    /// Test 9: Sequential Burn Patterns
    /// Tests different user behavior patterns
    #[test]
    fn test_sequential_burn_patterns() {
        let mut env = TokenTestEnvironment::new();
        
        let (primary_token, secondary_token, tokenomics, icp_swap, logs) = env
            .create_token_with_config(
                "Pattern Test Token",
                "PATTERN",
                500_000 * E8S,       // Burn Unit (in e8s)
                500,                 // Initial Reward
                5_000_000 * E8S,     // Hard Cap (in e8s)
                45,                  // Halving Step
            )
            .expect("Failed to create token");

        // Pattern 1: Single whale burns entire first epoch
        // Use user1 as the whale
        let whale = env.user1;
        
        // Calculate how many burn units for first epoch (100 burn units)
        let first_epoch_secondary = 500_000 * 100; // 50M secondary tokens
        swap_icp(&mut env, "user1", 500_000 * E8S).unwrap();
        
        // Burn in chunks to avoid transaction cap
        let mut whale_total = 0u64;
        for i in 0..10 {
            approve_token(&env, "user1", secondary_token, icp_swap, 5_000_000 * E8S).unwrap();
            
            let burn_res: Result<String, ExecutionError> = env.pic.update_call(
                icp_swap,
                whale,
                "burn_secondary",
                candid::encode_one(5_000_000u64).unwrap(), // 10 burn units at a time
            ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
            .and_then(|res| {
                candid::decode_one::<Result<String, String>>(&res)
                    .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                    .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
            });
            
            if burn_res.is_ok() {
                whale_total += 5_000_000;
            } else {
                break;
            }
        }

        let whale_balance = env.get_balance("user1", primary_token);
        println!("Whale burned {} secondary, got {} primary", whale_total, whale_balance / E8S);

        // Pattern 2: Use user2 for small burns
        let mut small_user_total_primary = 0u64;
        // Do multiple small burns with user2
        for i in 0..5 { // Reduced for test speed
            // Each burn is 0.1 burn units (50k secondary)
            swap_icp(&mut env, "user2", 500 * E8S).unwrap();
            approve_token(&env, "user2", secondary_token, icp_swap, 50_000 * E8S).unwrap();
            
            let burn_res: Result<String, ExecutionError> = env.pic.update_call(
                icp_swap,
                env.user2,
                "burn_secondary",
                candid::encode_one(50_000u64).unwrap(),
            ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
            .and_then(|res| {
                candid::decode_one::<Result<String, String>>(&res)
                    .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                    .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
            });
            
            if burn_res.is_ok() {
                // Don't add to total yet, check balance at end
            }
        }

        small_user_total_primary = env.get_balance("user2", primary_token);
        println!("User2 got total {} primary from small burns", small_user_total_primary / E8S);

        // Pattern 3: Alternating large/small burns using user3
        swap_icp(&mut env, "user3", 5_500 * E8S).unwrap();
        
        let mut alt_pattern_worked = true;
        for i in 0..5 {
            // Large burn
            approve_token(&env, "user3", secondary_token, icp_swap, 500_000 * E8S).unwrap();
            let large_burn: Result<String, ExecutionError> = env.pic.update_call(
                icp_swap,
                env.user3,
                "burn_secondary",
                candid::encode_one(500_000u64).unwrap(),
            ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
            .and_then(|res| {
                candid::decode_one::<Result<String, String>>(&res)
                    .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                    .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
            });
            
            if large_burn.is_err() {
                alt_pattern_worked = false;
                break;
            }
            
            // Small burn with same user
            approve_token(&env, "user3", secondary_token, icp_swap, 50_000 * E8S).unwrap();
            let small_burn: Result<String, ExecutionError> = env.pic.update_call(
                icp_swap,
                env.user3,
                "burn_secondary",
                candid::encode_one(50_000u64).unwrap(),
            ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
            .and_then(|res| {
                candid::decode_one::<Result<String, String>>(&res)
                    .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                    .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
            });
            
            if small_burn.is_err() {
                alt_pattern_worked = false;
                break;
            }
        }

        assert!(alt_pattern_worked, "Alternating pattern should work");
        
        let alt_balance = env.get_balance("user3", primary_token);
        
        // User should have tokens from both large and small burns
        assert!(
            alt_balance > 0,
            "Alternating pattern user should have tokens"
        );
    }

    /// Test 10: Supply Exhaustion Scenarios
    /// Tests behavior when approaching and hitting max supply
    #[test]
    fn test_supply_exhaustion() {
        let mut env = TokenTestEnvironment::new();
        
        // Create token with small supply for faster exhaustion
        let (primary_token, secondary_token, tokenomics, icp_swap, logs) = env
            .create_token_with_config(
                "Exhaustion Token",
                "EXHAUST",
                200_000 * E8S,       // Burn Unit (in e8s)
                200,                 // Initial Reward (20 tokens per 0.1 burn unit)
                100_000 * E8S,       // Small hard cap (in e8s)
                75,                  // High halving to exhaust quickly
            )
            .expect("Failed to create token");

        // Use user1 as the burner
        let burner = env.user1;
        
        // Mint a large amount of secondary tokens
        swap_icp(&mut env, "user1", 50_000 * E8S).unwrap();
        
        // Keep burning until we exhaust supply
        let mut total_burned = 0u64;
        let mut last_successful_balance = 0u64;
        let mut exhausted = false;
        
        for i in 0..100 {
            approve_token(&env, "user1", secondary_token, icp_swap, 200_000 * E8S).unwrap();
            
            let burn_res: Result<String, ExecutionError> = env.pic.update_call(
                icp_swap,
                burner,
                "burn_secondary",
                candid::encode_one(200_000u64).unwrap(),
            ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
            .and_then(|res| {
                candid::decode_one::<Result<String, String>>(&res)
                    .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                    .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
            });
            
            if burn_res.is_err() {
                exhausted = true;
                break;
            } else {
                total_burned += 200_000;
                last_successful_balance = env.get_balance("user1", primary_token);
            }
        }

        assert!(exhausted, "Should eventually exhaust supply");
        assert!(
            last_successful_balance <= 100_000 * E8S,
            "Should not exceed max supply"
        );

        // Try one more burn after exhaustion
        approve_token(&env, "user1", secondary_token, icp_swap, 200_000 * E8S).unwrap();
        let post_exhaust_burn: Result<String, ExecutionError> = env.pic.update_call(
            icp_swap,
            burner,
            "burn_secondary",
            candid::encode_one(200_000u64).unwrap(),
        ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
        .and_then(|res| {
            candid::decode_one::<Result<String, String>>(&res)
                .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
        });

        assert!(
            post_exhaust_burn.is_err(),
            "Burns after supply exhaustion should fail"
        );
        
        if let Err(e) = post_exhaust_burn {
            match e {
                ExecutionError::StateError(msg) => {
                    assert!(
                        msg.contains("Max primary reached") || msg.contains("supply"),
                        "Error should mention supply exhaustion. Got: {}",
                        msg
                    );
                }
                _ => panic!("Expected StateError variant, got: {:?}", e)
            }
        }
    }

    /// Test 11: Halving Precision and One Reward Mode
    /// Tests precise halving calculations and one reward mode activation
    #[test]
    fn test_halving_precision_and_one_reward_mode() {
        let mut env = TokenTestEnvironment::new();
        
        // Create token that will quickly reach one reward mode
        let (primary_token, secondary_token, tokenomics, icp_swap, logs) = env
            .create_token_with_config(
                "One Reward Token",
                "ONEREWARD",
                500_000 * E8S,       // Burn Unit (in e8s)
                10,                  // Initial Reward (small to reach one reward quickly)
                1_000_000 * E8S,     // Hard Cap (in e8s)
                25,                  // Aggressive halving
            )
            .expect("Failed to create token");

        // Use user1 as the test user
        let test_user = env.user1;
        
        // Mint enough for multiple epochs
        swap_icp(&mut env, "user1", 100_000 * E8S).unwrap();
        
        let mut rewards = Vec::new();
        let mut epoch = 0;
        
        // Burn through multiple epochs to observe halving
        for i in 0..20 {
            // Burn exactly one burn unit each time
            approve_token(&env, "user1", secondary_token, icp_swap, 500_000 * E8S).unwrap();
            
            let initial_balance = env.get_balance("user1", primary_token);
            
            let burn_res: Result<String, ExecutionError> = env.pic.update_call(
                icp_swap,
                test_user,
                "burn_secondary",
                candid::encode_one(500_000u64).unwrap(),
            ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
            .and_then(|res| {
                candid::decode_one::<Result<String, String>>(&res)
                    .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                    .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
            });
            
            if burn_res.is_err() {
                break;
            }
            
            let new_balance = env.get_balance("user1", primary_token);
            let reward = (new_balance - initial_balance) / E8S;
            
            if rewards.is_empty() || reward != *rewards.last().unwrap() {
                if !rewards.is_empty() {
                    epoch += 1;
                }
                rewards.push(reward);
                println!("Epoch {}: Reward = {} tokens", epoch, reward);
            }
        }

        // Verify halving precision
        for i in 1..rewards.len() {
            let expected_reward = rewards[i-1] * 75 / 100; // 25% halving
            let actual_reward = rewards[i];
            
            // Allow for rounding
            let diff = if expected_reward > actual_reward {
                expected_reward - actual_reward
            } else {
                actual_reward - expected_reward
            };
            
            assert!(
                diff <= 1 || rewards[i] == 100, // Either precise halving or one reward mode
                "Halving precision error at epoch {}. Expected: {}, Got: {}",
                i, expected_reward, actual_reward
            );
            
            // Check if we've reached one reward mode
            if rewards[i] == 100 {
                println!("One reward mode activated at epoch {}", i);
                // All subsequent rewards should also be 100
                for j in (i+1)..rewards.len() {
                    assert_eq!(
                        rewards[j], 100,
                        "Once in one reward mode, should stay at 100 tokens"
                    );
                }
                break;
            }
        }
    }
}