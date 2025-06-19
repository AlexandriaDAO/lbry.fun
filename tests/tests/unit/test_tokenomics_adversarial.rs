use crate::integrated_token_tests::TokenTestEnvironment;
use crate::shared_helpers::{swap_icp, approve_token, approve_icp, ExecutionError, E8S, Account, ApproveArgs};
use candid::{Encode, Nat, Principal};
use num_traits::cast::ToPrimitive;

/// Adversarial tests designed to exploit edge cases and break tokenomics
/// These tests are specifically designed to find vulnerabilities that "reasonable" tests miss
#[cfg(test)]
mod tokenomics_adversarial_tests {
    use super::*;

    /// Test 1: The Catastrophic Bug - burn_unit=1 exploit
    /// This test reproduces the bug where burning 1 secondary token mints millions of primary tokens
    #[test]
    fn test_adversarial_burn_unit_one() {
        let mut env = TokenTestEnvironment::new();
        
        // Create token with adversarial parameters
        let (primary_token, secondary_token, tokenomics, icp_swap, logs) = env
            .create_token_with_config(
                "Exploit Token",
                "EXPLOIT",
                1 * E8S,             // Burn Unit: 1 secondary token in e8s (THE KILLER)
                1_000_000,           // Initial Reward: 1M tokens per burn unit
                1_000_000 * E8S,     // Hard Cap: 1M tokens in e8s
                50,                  // Halving Step: 50%
            )
            .expect("Failed to create token");

        // Use user1 as the attacker
        let attacker = env.user1;
        
        // Approve ICP for the new icp_swap canister on the ICP ledger
        let approve_args = ApproveArgs {
            from_subaccount: None,
            spender: Account {
                owner: icp_swap,
                subaccount: None,
            },
            amount: Nat::from(10 * E8S + 100_000),
            expected_allowance: None,
            expires_at: None,
            fee: None,
            memo: None,
            created_at_time: None,
        };
        
        let approve_result = env.pic.update_call(
            env.icp_ledger,
            attacker,
            "icrc2_approve",
            candid::encode_one(&approve_args).unwrap(),
        );
        assert!(approve_result.is_ok(), "ICP approval failed: {:?}", approve_result);
        
        // Call swap directly on the new icp_swap canister  
        let swap_args = candid::encode_args((10 * E8S, None::<[u8; 32]>)).unwrap();
        let swap_result = env.pic.update_call(
            icp_swap,
            attacker,
            "swap",
            swap_args,
        );
        assert!(swap_result.is_ok(), "Swap failed: {:?}", swap_result);
        
        // Get initial balances
        let initial_primary = env.get_balance("user1", primary_token);
        let initial_secondary = env.get_balance("user1", secondary_token);
        
        println!("Initial primary balance: {} e8s", initial_primary);
        println!("Initial secondary balance: {} e8s", initial_secondary);
        
        // Burn exactly 1 secondary token
        // Approve secondary tokens for burning
        // Approve spending 10 secondary tokens
        approve_token(&env, "user1", secondary_token, icp_swap, 10 * E8S).unwrap();
        
        let burn_result: Result<String, ExecutionError> = env.pic.update_call(
            icp_swap,
            attacker,
            "burn_secondary",
            candid::encode_one(1u64).unwrap(), // Burn 1 secondary token
        ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
        .and_then(|res| {
            candid::decode_one::<Result<String, String>>(&res)
                .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
        });

        // Check if burn succeeded
        assert!(burn_result.is_ok(), "Burn should succeed but got error: {:?}", burn_result);
        
        // Get final balances
        let final_primary = env.get_balance("user1", primary_token);
        let final_secondary = env.get_balance("user1", secondary_token);
        let primary_minted = final_primary - initial_primary;
        
        println!("Final primary balance: {} e8s", final_primary);
        println!("Final secondary balance: {} e8s", final_secondary);
        println!("Primary tokens minted: {} e8s ({} tokens)", primary_minted, primary_minted / E8S);
        
        // The bug: With burn_unit=1 and initial_reward=1M, burning 1 secondary token
        // should give a reasonable amount, NOT the entire supply!
        
        // Expected: ~100 tokens (0.01% of supply) or less
        // Actual (with bug): 1M tokens (100% of supply)
        let max_reasonable_mint = 1000 * E8S; // At most 1000 tokens for burning 1 secondary
        
        assert!(
            primary_minted <= max_reasonable_mint,
            "CATASTROPHIC BUG: Burning 1 secondary token minted {} primary tokens ({}% of total supply)!",
            primary_minted / E8S,
            (primary_minted * 100) / (1_000_000 * E8S)
        );
    }

    /// Test 2: Graph vs Reality Validator
    /// Ensures that tokenomics graphs accurately predict actual burn results
    #[test]
    fn test_tokenomics_graph_accuracy() {
        let mut env = TokenTestEnvironment::new();
        
        let (primary_token, secondary_token, tokenomics, icp_swap, logs) = env
            .create_token_with_config(
                "Graph Test Token",
                "GRAPH",
                100_000 * E8S,       // Burn Unit (in e8s)
                1000,                // Initial Reward
                1_000_000 * E8S,     // Hard Cap (in e8s)
                40,                  // Halving Step
            )
            .expect("Failed to create token");

        // Query tokenomics info to get graph data
        let tokenomics_info: String = env.pic.query_call(
            icp_swap,
            Principal::anonymous(),
            "get_tokenomics_info",
            candid::encode_one(()).unwrap(),
        ).map_err(|e| format!("{:?}", e))
        .and_then(|res| {
            candid::decode_one(&res)
                .map_err(|e| format!("Decode error: {:?}", e))
        }).expect("Failed to get tokenomics info");

        // TODO: Parse tokenomics info and extract graph predictions
        // For now, we'll test specific burn amounts
        
        // Use user2 as test user
        let test_user = env.user2;
        
        // Test points from different epochs
        let test_burns = vec![
            100_000,   // 1 burn unit
            500_000,   // 5 burn units
            1_000_000, // 10 burn units
            2_500_000, // 25 burn units
        ];
        
        for burn_amount in test_burns {
            // Mint enough secondary tokens
            swap_icp(&mut env, "user2", (burn_amount / 100) * E8S).unwrap();
            
            let initial_balance = env.get_balance("user2", primary_token);
            
            // Burn and measure actual reward
            approve_token(&env, "user2", secondary_token, icp_swap, burn_amount * E8S).unwrap();
            
            let burn_result: Result<String, ExecutionError> = env.pic.update_call(
                icp_swap,
                test_user,
                "burn_secondary",
                candid::encode_one(burn_amount as u64).unwrap(),
            ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
            .and_then(|res| {
                candid::decode_one::<Result<String, String>>(&res)
                    .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                    .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
            });
            
            if burn_result.is_ok() {
                let final_balance = env.get_balance("user2", primary_token);
                let actual_minted = final_balance - initial_balance;
                
                println!("Burned {} secondary, got {} primary tokens", 
                    burn_amount, actual_minted / E8S);
                
                // TODO: Compare with graph prediction
                // For now, just ensure it's reasonable
                assert!(
                    actual_minted > 0 && actual_minted < 10_000 * E8S,
                    "Minted amount should be reasonable"
                );
            }
        }
    }

    /// Test 3: Arithmetic Overflow Protection
    /// Tests with values near u64::MAX to ensure no overflow/underflow
    #[test]
    fn test_reward_calculation_overflow() {
        let mut env = TokenTestEnvironment::new();
        
        // Try to create token with extreme values
        let extreme_configs = vec![
            // (hard_cap, burn_unit, initial_reward, description)
            (u64::MAX / E8S, 1, u64::MAX / E8S, "Max reward with min burn unit"),
            (10_000_000, u64::MAX / E8S, 1000, "Max burn unit"),
            (10_000_000, 1_000_000, u64::MAX / E8S / 10000, "Near max reward"),
        ];

        for (hard_cap, burn_unit, initial_reward, desc) in extreme_configs {
            println!("Testing: {}", desc);
            
            // Token creation might fail with extreme values - that's ok
            let config_result = env.create_token_with_config(
                "Overflow Test",
                "OVERFLOW",
                burn_unit * E8S,     // burn_unit in e8s
                initial_reward,      // initial_reward
                hard_cap * E8S,      // hard_cap in e8s
                50,                  // halving_step
            );

            if let Ok((primary_token, secondary_token, tokenomics, icp_swap, logs)) = config_result {
                // Use user3 for extreme tests
                let test_user = env.user3;
                
                // Try to burn with extreme values
                swap_icp(&mut env, "user3", 1000 * E8S).unwrap();
                approve_token(&env, "user3", secondary_token, icp_swap, burn_unit * E8S).unwrap();
                
                let burn_result: Result<String, ExecutionError> = env.pic.update_call(
                    icp_swap,
                    test_user,
                    "burn_secondary",
                    candid::encode_one(burn_unit).unwrap(),
                ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
                .and_then(|res| {
                    candid::decode_one::<Result<String, String>>(&res)
                        .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                        .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
                });

                // Should either fail gracefully or succeed with reasonable values
                if let Ok(_) = burn_result {
                    let balance = env.get_balance("user3", primary_token);
                    assert!(
                        balance < hard_cap * E8S,
                        "Balance should not exceed hard cap"
                    );
                } else {
                    println!("Burn failed as expected with extreme values");
                }
            } else {
                println!("Token creation failed as expected with extreme values");
            }
        }
    }

    /// Test 4: Minimum Value Attack Matrix
    /// Tests all combinations of minimum allowed values
    #[test]
    fn test_minimum_value_matrix() {
        let mut env = TokenTestEnvironment::new();
        
        let min_configs = vec![
            // (hard_cap, burn_unit, initial_reward, halving_step)
            (100_000, 1, 1, 25),           // All minimums
            (100_000, 1, 10, 25),          // Min burn unit with slightly higher reward
            (100_000, 10, 1, 25),          // Min reward
            (1_000_000, 1, 1, 1),          // Extreme halving
        ];

        for (idx, (hard_cap, burn_unit, initial_reward, halving_step)) in min_configs.iter().enumerate() {
            println!("Testing minimum config #{}", idx);
            
            let (primary_token, secondary_token, tokenomics, icp_swap, logs) = env
                .create_token_with_config(
                    &format!("Min Test {}", idx),
                    &format!("MIN{}", idx),
                    (*burn_unit as u64) * E8S,    // burn_unit in e8s
                    *initial_reward as u64,        // initial_reward
                    (*hard_cap as u64) * E8S,      // hard_cap in e8s
                    *halving_step as u64,          // halving_step
                )
                .expect("Should handle minimum values");
            
            // Use user1 as test user
            let test_user = env.user1;
            
            // Mint and burn minimum amounts
            swap_icp(&mut env, "user1", 10 * E8S).unwrap();
            approve_token(&env, "user1", secondary_token, icp_swap, (*burn_unit as u64) * E8S).unwrap();
            
            let burn_result: Result<String, ExecutionError> = env.pic.update_call(
                icp_swap,
                test_user,
                "burn_secondary",
                candid::encode_one(*burn_unit as u64).unwrap(),
            ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
            .and_then(|res| {
                candid::decode_one::<Result<String, String>>(&res)
                    .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                    .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
            });

            assert!(burn_result.is_ok(), "Minimum value burn should succeed");
            
            let balance = env.get_balance("user1", primary_token);
            let expected_max = (*initial_reward as u64) * 10000 * E8S / 100; // Account for decimal
            
            assert!(
                balance <= expected_max,
                "Balance {} should not exceed expected maximum {}",
                balance, expected_max
            );
        }
    }

    /// Test 5: Precision Loss Accumulation
    /// Tests if many small burns vs one large burn produce similar results
    #[test]
    fn test_precision_loss_accumulation() {
        let mut env = TokenTestEnvironment::new();
        
        // Create two identical tokens
        let (primary1, secondary1, tokenomics1, icp_swap1, logs1) = env
            .create_token_with_config(
                "Small Burns Token",
                "SMALL",
                100_000 * E8S,       // burn_unit in e8s
                500,                 // initial_reward
                1_000_000 * E8S,     // hard_cap in e8s
                50,                  // halving_step
            )
            .expect("Failed to create token 1");

        let (primary2, secondary2, tokenomics2, icp_swap2, logs2) = env
            .create_token_with_config(
                "Large Burn Token",
                "LARGE",
                100_000 * E8S,       // burn_unit in e8s
                500,                 // initial_reward
                1_000_000 * E8S,     // hard_cap in e8s
                50,                  // halving_step
            )
            .expect("Failed to create token 2");

        // Use user2 for small burns and user3 for large burn
        let small_burner = env.user2;
        let large_burner = env.user3;

        // Setup for small burns (100 burns of 10,000 each = 1M total)
        swap_icp(&mut env, "user2", 10_000 * E8S).unwrap();

        // Setup for large burn (1 burn of 1M)
        swap_icp(&mut env, "user3", 10_000 * E8S).unwrap();

        // Execute 100 small burns
        let mut small_burn_total = 0u64;
        for _ in 0..100 {
            approve_token(&env, "user2", secondary1, icp_swap1, 10_000 * E8S).unwrap();
            
            let burn_result: Result<String, ExecutionError> = env.pic.update_call(
                icp_swap1,
                small_burner,
                "burn_secondary",
                candid::encode_one(10_000u64).unwrap(),
            ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
            .and_then(|res| {
                candid::decode_one::<Result<String, String>>(&res)
                    .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                    .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
            });

            if burn_result.is_err() {
                break;
            }
        }
        small_burn_total = env.get_balance("user2", primary1);

        // Execute 1 large burn
        approve_token(&env, "user3", secondary2, icp_swap2, 1_000_000 * E8S).unwrap();
        
        let large_burn_result: Result<String, ExecutionError> = env.pic.update_call(
            icp_swap2,
            large_burner,
            "burn_secondary",
            candid::encode_one(1_000_000u64).unwrap(),
        ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
        .and_then(|res| {
            candid::decode_one::<Result<String, String>>(&res)
                .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
        });

        assert!(large_burn_result.is_ok(), "Large burn should succeed");
        let large_burn_total = env.get_balance("user3", primary2);

        println!("100 small burns total: {} tokens", small_burn_total / E8S);
        println!("1 large burn total: {} tokens", large_burn_total / E8S);

        // Results should be within 1% of each other
        let diff = if small_burn_total > large_burn_total {
            small_burn_total - large_burn_total
        } else {
            large_burn_total - small_burn_total
        };

        let tolerance = large_burn_total / 100; // 1% tolerance
        assert!(
            diff <= tolerance,
            "Precision loss too high: {} tokens difference ({}%)",
            diff / E8S,
            (diff * 100) / large_burn_total
        );
    }

    /// Test 6: Concurrent Burn Attack
    /// Tests if concurrent burns can exploit race conditions
    #[test]
    fn test_concurrent_burn_attack() {
        let mut env = TokenTestEnvironment::new();
        
        let (primary_token, secondary_token, tokenomics, icp_swap, logs) = env
            .create_token_with_config(
                "Concurrent Test",
                "CONC",
                100_000 * E8S,       // burn_unit in e8s
                500,                 // initial_reward
                1_000_000 * E8S,     // hard_cap in e8s
                50,                  // halving_step
            )
            .expect("Failed to create token");

        // Use existing test users as concurrent attackers
        let attackers = vec![env.user1, env.user2, env.user3];

        // Setup each attacker with secondary tokens
        for (i, user_name) in ["user1", "user2", "user3"].iter().enumerate() {
            swap_icp(&mut env, user_name, 1_000 * E8S).unwrap();
        }

        // Get initial total supply
        let initial_supply = env.get_total_supply(primary_token);

        // Each attacker burns simultaneously (simulated by sequential burns in test)
        let mut total_minted = 0u64;
        for (i, attacker) in attackers.iter().enumerate() {
            let user_name = match i {
                0 => "user1",
                1 => "user2",
                2 => "user3",
                _ => unreachable!(),
            };
            approve_token(&env, user_name, secondary_token, icp_swap, 100_000 * E8S).unwrap();
            
            let burn_result: Result<String, ExecutionError> = env.pic.update_call(
                icp_swap,
                *attacker,
                "burn_secondary",
                candid::encode_one(100_000u64).unwrap(),
            ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
            .and_then(|res| {
                candid::decode_one::<Result<String, String>>(&res)
                    .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                    .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
            });

            if burn_result.is_ok() {
                let user_name = match attackers.iter().position(|&u| u == *attacker).unwrap() {
                    0 => "user1",
                    1 => "user2",
                    2 => "user3",
                    _ => unreachable!(),
                };
                let balance = env.get_balance(user_name, primary_token);
                total_minted += balance;
            }
        }

        let final_supply = env.get_total_supply(primary_token);
        let supply_increase = final_supply - initial_supply;

        println!("Total minted by attackers: {} tokens", total_minted / E8S);
        println!("Actual supply increase: {} tokens", supply_increase / E8S);

        // Verify no tokens were created from thin air
        assert_eq!(
            total_minted, supply_increase,
            "Sum of individual balances should equal total supply increase"
        );
    }

    /// Test 7: Epoch Boundary Exploitation
    /// Tests if burns at exact epoch boundaries can be exploited
    #[test]
    fn test_epoch_boundary_exploitation() {
        let mut env = TokenTestEnvironment::new();
        
        let (primary_token, secondary_token, tokenomics, icp_swap, logs) = env
            .create_token_with_config(
                "Epoch Test",
                "EPOCH",
                100_000 * E8S,       // 100k secondary per burn unit in e8s
                1000,                // 100 tokens initial reward
                1_000_000 * E8S,     // hard_cap in e8s
                25,                  // 25% halving
            )
            .expect("Failed to create token");
        
        // Use user1 as the exploiter
        let exploiter = env.user1;
        
        // Mint enough for multiple epochs
        swap_icp(&mut env, "user1", 50_000 * E8S).unwrap();
        
        // Burn right up to epoch boundary (99 burn units)
        let pre_boundary_burn = 9_900_000; // 99 burn units
        approve_token(&env, "user1", secondary_token, icp_swap, pre_boundary_burn * E8S).unwrap();
        
        let pre_burn_result: Result<String, ExecutionError> = env.pic.update_call(
            icp_swap,
            exploiter,
            "burn_secondary",
            candid::encode_one(pre_boundary_burn).unwrap(),
        ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
        .and_then(|res| {
            candid::decode_one::<Result<String, String>>(&res)
                .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
        });

        assert!(pre_burn_result.is_ok(), "Pre-boundary burn should succeed");
        let pre_boundary_balance = env.get_balance("user1", primary_token);
        
        // Now burn exactly at boundary crossing
        approve_token(&env, "user1", secondary_token, icp_swap, 100_000 * E8S).unwrap();
        
        let boundary_burn_result: Result<String, ExecutionError> = env.pic.update_call(
            icp_swap,
            exploiter,
            "burn_secondary",
            candid::encode_one(100_000u64).unwrap(),
        ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
        .and_then(|res| {
            candid::decode_one::<Result<String, String>>(&res)
                .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
        });

        assert!(boundary_burn_result.is_ok(), "Boundary burn should succeed");
        let post_boundary_balance = env.get_balance("user1", primary_token);
        let boundary_reward = post_boundary_balance - pre_boundary_balance;
        
        // The boundary burn should get a mix of old and new epoch rewards
        // It should NOT get double rewards or skip halving
        let expected_reward = 75 * E8S; // 75% of 100 due to halving
        let tolerance = expected_reward / 10; // 10% tolerance
        
        assert!(
            boundary_reward >= expected_reward - tolerance && 
            boundary_reward <= expected_reward + tolerance,
            "Boundary burn reward {} should be close to expected {}",
            boundary_reward / E8S, expected_reward / E8S
        );
    }

    /// Test 8: Parameter Validation Bypass Attempts
    /// Tests if parameter validation can be bypassed
    #[test]
    fn test_parameter_validation_bypass() {
        let mut env = TokenTestEnvironment::new();
        
        // Test various invalid parameter combinations
        let invalid_configs = vec![
            // (hard_cap, burn_unit, initial_reward, halving_step, description)
            (50_000, 100_000, 100, 50, "Hard cap below minimum"),
            (20_000_000, 100_000, 100, 50, "Hard cap above maximum"),
            (1_000_000, 0, 100, 50, "Zero burn unit"),
            (1_000_000, 100_000, 0, 50, "Zero initial reward"),
            (1_000_000, 100_000, 100, 0, "Zero halving step"),
            (1_000_000, 100_000, 100, 100, "100% halving step"),
            (1_000_000, 100_000, 15_000, 50, "Initial reward > 10% of supply"),
        ];

        for (hard_cap, burn_unit, initial_reward, halving_step, desc) in invalid_configs {
            println!("Testing invalid config: {}", desc);
            
            let config_result = env.create_token_with_config(
                "Invalid Token",
                "INVALID",
                burn_unit * E8S,     // burn_unit in e8s
                initial_reward,      // initial_reward
                hard_cap * E8S,      // hard_cap in e8s
                halving_step,        // halving_step
            );

            assert!(
                config_result.is_err(),
                "Config '{}' should be rejected but was accepted",
                desc
            );
        }
    }
}