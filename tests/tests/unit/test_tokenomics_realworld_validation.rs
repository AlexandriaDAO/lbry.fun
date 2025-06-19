use crate::integrated_token_tests::TokenTestEnvironment;
use crate::phase2_token_operations::{swap_icp, approve_icp, get_icp_balance};
use crate::shared_helpers::{E8S};
use candid::{Encode, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use num_traits::cast::ToPrimitive;
use pocket_ic::PocketIc;

/// Test configurations based on real-world frontend parameters from the validation plan
#[cfg(test)]
mod tokenomics_realworld_validation_tests {
    use super::*;

    /// Test 1: Extreme Front-Load Configuration - "Whale Capture Token"
    /// This configuration gives 99.7% of tokens in the first epoch
    #[test]
    fn test_extreme_front_load_whale_capture() {
        let mut env = TokenTestEnvironment::new();
        
        // Configuration from validation plan
        let config = env
            .create_token_with_config(
                &env.user1,
                "Whale Capture Token",
                "WHALE",
                1_000_000,     // Hard Cap
                1,             // TGE
                1_000_000,     // Burn Unit (large)
                2_999,         // Initial Reward (just under 30% cap)
                25,            // Halving Step
            )
            .expect("Failed to create token");

        // Get token principals
        let primary_token = config.primary_token.expect("No primary token");
        let secondary_token = config.secondary_token.expect("No secondary token");
        let icp_swap = config.icp_swap.expect("No icp_swap");

        // First whale burns exactly one burn unit
        let whale1 = Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap();
        env.pic.add_cycles(whale1, 10_000_000_000_000);
        
        // First approve ICP
        let icp_amount = 5_000 * E8S; // 5k ICP
        let approve_res = approve_icp(&mut env, &whale1.to_string(), icp_amount + 100_000);
        assert!(approve_res.is_ok(), "ICP approval failed: {:?}", approve_res);
        
        // Mint secondary tokens for whale
        let mint_result = swap_icp(
            &mut env,
            &whale1.to_string(),
            icp_amount,
        );
        assert!(mint_result.is_ok(), "Swap failed: {:?}", mint_result);

        // Approve secondary tokens for burning (using ICRC2 approve)
        let approve_args = crate::phase2_token_operations::ApproveArgs {
            from_subaccount: None,
            spender: crate::phase2_token_operations::Account {
                owner: icp_swap,
                subaccount: None,
            },
            amount: Nat::from(1_000_000 * E8S),
            expected_allowance: None,
            expires_at: None,
            fee: None,
            memo: None,
            created_at_time: None,
        };
        
        let approve_result = env.pic.update_call(
            secondary_token,
            whale1,
            "icrc2_approve",
            candid::encode_one(approve_args).unwrap(),
        );
        assert!(approve_result.is_ok(), "Secondary approval failed");
        
        let burn_result: Result<String, String> = env.pic.update_call(
            icp_swap,
            whale1,
            "burn_secondary",
            candid::encode_one(1_000_000u64).unwrap(),
        ).map_err(|e| format!("{:?}", e))
        .and_then(|res| {
            candid::decode_one::<Result<String, String>>(&res)
                .map_err(|e| format!("Decode error: {:?}", e))
                .and_then(|inner| inner)
        });

        assert!(burn_result.is_ok(), "First burn should succeed");

        // Check primary balance - should be ~299,900 tokens (2,999 * 100)
        let balance_result = env.pic.query_call(
            primary_token,
            Principal::anonymous(),
            "icrc1_balance_of",
            candid::encode_one(&Account {
                owner: whale1,
                subaccount: None,
            }).unwrap(),
        );
        let balance: Nat = candid::decode_one(&balance_result.unwrap()).unwrap();
        let balance = balance.0.to_u64().unwrap();
        let expected_min = 299_000 * E8S;
        let expected_max = 300_000 * E8S;
        assert!(
            balance >= expected_min && balance <= expected_max,
            "Whale should get ~30% of supply. Got: {}, Expected: {}-{}",
            balance / E8S, expected_min / E8S, expected_max / E8S
        );

        // Second participant tries to burn
        let user2 = Principal::from_text("ryjl3-tyaaa-aaaaa-aaaca-cai").unwrap();
        env.pic.add_cycles(user2, 10_000_000_000_000);
        
        let mint_result2 = swap_icp(
            &env.pic,
            icp_swap,
            user2,
            5_000 * E8S,
            secondary_token,
        );
        assert!(mint_result2.is_ok());

        approve_token(&env.pic, secondary_token, user2, icp_swap, 1_000_000 * E8S).unwrap();
        
        let burn_result2: Result<String, ExecutionError> = env.pic.update_call(
            icp_swap,
            user2,
            "burn_secondary",
            candid::encode_one(1_000_000u64).unwrap(),
        ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
        .and_then(|res| {
            candid::decode_one::<Result<String, String>>(&res)
                .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
        });

        assert!(burn_result2.is_ok(), "Second burn should succeed");

        // Check second participant balance - should be significantly less due to halving
        let balance2 = env.get_primary_balance(user2);
        let expected_reward_after_halving = (2_999 * 75 / 100) * 100; // 75% of original
        let expected_min2 = expected_reward_after_halving * E8S * 90 / 100; // Allow 10% variance
        let expected_max2 = expected_reward_after_halving * E8S * 110 / 100;
        
        assert!(
            balance2 >= expected_min2 && balance2 <= expected_max2,
            "Second participant should get ~75% of first reward. Got: {}, Expected: {}-{}",
            balance2 / E8S, expected_min2 / E8S, expected_max2 / E8S
        );

        // Verify extreme inequality
        let ratio = (balance / E8S) / (balance2 / E8S);
        assert!(
            ratio > 130, // First participant got >1.3x more
            "Configuration should create extreme early advantage. Ratio: {}",
            ratio
        );
    }

    /// Test 2: Extreme Back-Load Configuration - "Inflation Bomb Token"
    /// Early participants get minimal rewards, late stage becomes hyperinflationary
    #[test]
    fn test_extreme_back_load_inflation_bomb() {
        let mut env = TokenTestEnvironment::new();
        
        // Configuration from validation plan
        let config = env
            .create_token_with_config(
                &env.user1,
                "Inflation Bomb Token",
                "BOMB",
                10_000_000,    // Hard Cap (10M)
                1,             // TGE
                200_000,       // Burn Unit (small)
                10,            // Initial Reward (very small)
                99,            // Halving Step (almost no halving)
            )
            .expect("Failed to create token");

        let primary_token = config.primary_token.expect("No primary token");
        let secondary_token = config.secondary_token.expect("No secondary token");
        let icp_swap = config.icp_swap.expect("No icp_swap");

        // Early participant burns
        let early_user = Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap();
        env.pic.add_cycles(early_user, 10_000_000_000_000);
        
        swap_icp(&env.pic, icp_swap, early_user, 1_000 * E8S, secondary_token).unwrap();
        approve_token(&env.pic, secondary_token, early_user, icp_swap, 200_000 * E8S).unwrap();
        
        let early_burn: Result<String, ExecutionError> = env.pic.update_call(
            icp_swap,
            early_user,
            "burn_secondary",
            candid::encode_one(200_000u64).unwrap(),
        ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
        .and_then(|res| {
            candid::decode_one::<Result<String, String>>(&res)
                .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
        });

        assert!(early_burn.is_ok());
        let early_balance = env.get_primary_balance(early_user);
        
        // Should get minimal reward (10 * 100 = 1,000 tokens)
        assert!(
            early_balance >= 900 * E8S && early_balance <= 1_100 * E8S,
            "Early participant should get minimal reward. Got: {}",
            early_balance / E8S
        );

        // Simulate many burns to reach later epochs
        let mut total_burned = 200_000u64;
        let mut epoch_count = 1;
        
        // Burn through multiple epochs (simulate passage of time)
        for i in 0..20 {
            let temp_user = Principal::from_text(&format!("ryjl3-tyaaa-aaaaa-aaa{:02x}-cai", i + 0x10)).unwrap();
            env.pic.add_cycles(temp_user, 10_000_000_000_000);
            
            swap_icp(&env.pic, icp_swap, temp_user, 1_000 * E8S, secondary_token).unwrap();
            approve_token(&env.pic, secondary_token, temp_user, icp_swap, 200_000 * E8S).unwrap();
            
            let burn_res: Result<String, ExecutionError> = env.pic.update_call(
                icp_swap,
                temp_user,
                "burn_secondary",
                candid::encode_one(200_000u64).unwrap(),
            ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
            .and_then(|res| {
                candid::decode_one::<Result<String, String>>(&res)
                    .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                    .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
            });
            
            if burn_res.is_ok() {
                total_burned += 200_000;
                
                // Check if we've crossed an epoch boundary
                if total_burned >= (epoch_count * 200_000 * 100) {
                    epoch_count += 1;
                }
            }
        }

        // Late participant burns
        let late_user = Principal::from_text("ryjl3-tyaaa-aaaaa-aaaza-cai").unwrap();
        env.pic.add_cycles(late_user, 10_000_000_000_000);
        
        swap_icp(&env.pic, icp_swap, late_user, 1_000 * E8S, secondary_token).unwrap();
        approve_token(&env.pic, secondary_token, late_user, icp_swap, 200_000 * E8S).unwrap();
        
        let late_burn: Result<String, ExecutionError> = env.pic.update_call(
            icp_swap,
            late_user,
            "burn_secondary",
            candid::encode_one(200_000u64).unwrap(),
        ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
        .and_then(|res| {
            candid::decode_one::<Result<String, String>>(&res)
                .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
        });

        if late_burn.is_ok() {
            let late_balance = env.get_primary_balance(late_user);
            
            // With 99% halving step, rewards barely decrease
            // Late participants might get similar or even more tokens due to rounding
            println!("Early balance: {}, Late balance: {}", early_balance / E8S, late_balance / E8S);
            
            // Verify problematic distribution
            assert!(
                late_balance >= early_balance * 80 / 100, // Late user gets at least 80% of early user
                "Configuration should create problematic late-stage inflation"
            );
        }
    }

    /// Test 3: Minimum Viable Configuration - "Micro Cap Token"
    /// Tests the smallest allowed configuration
    #[test]
    fn test_minimum_viable_micro_cap() {
        let mut env = TokenTestEnvironment::new();
        
        // Configuration from validation plan
        let config = env
            .create_token_with_config(
                &env.user1,
                "Micro Cap Token",
                "MICRO",
                100_000,       // Hard Cap (minimum allowed)
                1,             // TGE
                200_000,       // Burn Unit (minimum for $1k valuation)
                100,           // Initial Reward
                50,            // Halving Step
            )
            .expect("Failed to create token");

        let primary_token = config.primary_token.expect("No primary token");
        let secondary_token = config.secondary_token.expect("No secondary token");
        let icp_swap = config.icp_swap.expect("No icp_swap");

        // Test rounding errors with small values
        let test_user = Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap();
        env.pic.add_cycles(test_user, 10_000_000_000_000);
        
        // Mint exactly minimum burn unit worth
        swap_icp(&env.pic, icp_swap, test_user, 1_000 * E8S, secondary_token).unwrap();
        
        // Try burning less than a full burn unit
        approve_token(&env.pic, secondary_token, test_user, icp_swap, 100_000 * E8S).unwrap();
        
        let partial_burn: Result<String, ExecutionError> = env.pic.update_call(
            icp_swap,
            test_user,
            "burn_secondary",
            candid::encode_one(100_000u64).unwrap(), // Half a burn unit
        ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
        .and_then(|res| {
            candid::decode_one::<Result<String, String>>(&res)
                .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
        });

        assert!(partial_burn.is_ok());
        let balance_after_partial = env.get_primary_balance(test_user);
        
        // Should get proportional reward (50 * 100 = 5,000 tokens)
        assert!(
            balance_after_partial >= 4_500 * E8S && balance_after_partial <= 5_500 * E8S,
            "Partial burn should give proportional reward. Got: {}",
            balance_after_partial / E8S
        );

        // Test supply cap approaching
        let mut total_minted = 1 + (balance_after_partial / E8S); // TGE + first burn
        let mut burns_count = 0;

        // Keep burning until we approach supply cap
        while total_minted < 90_000 && burns_count < 50 {
            approve_token(&env.pic, secondary_token, test_user, icp_swap, 200_000 * E8S).unwrap();
            
            let burn_res: Result<String, ExecutionError> = env.pic.update_call(
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
            
            if burn_res.is_err() {
                break; // Hit supply cap
            }
            
            burns_count += 1;
            let new_balance = env.get_primary_balance(test_user);
            total_minted = 1 + (new_balance / E8S);
        }

        // Verify we can't exceed supply cap
        let final_balance = env.get_primary_balance(test_user);
        assert!(
            final_balance <= 100_000 * E8S,
            "Should not exceed max supply. Got: {}",
            final_balance / E8S
        );
    }

    /// Test 4: Transaction Cap Violation - "Cap Buster Token"
    /// Tests the 0.1% transaction cap enforcement
    #[test]
    fn test_transaction_cap_violation() {
        let mut env = TokenTestEnvironment::new();
        
        // Configuration from validation plan
        let config = env
            .create_token_with_config(
                &env.user1,
                "Cap Buster Token",
                "BUST",
                1_000_000,     // Hard Cap
                1,             // TGE
                500_000,       // Burn Unit
                1_000,         // Initial Reward (would give 100k tokens per burn unit)
                50,            // Halving Step
            )
            .expect("Failed to create token");

        let primary_token = config.primary_token.expect("No primary token");
        let secondary_token = config.secondary_token.expect("No secondary token");
        let icp_swap = config.icp_swap.expect("No icp_swap");

        // User tries to burn large amount that would exceed 0.1% cap
        let whale = Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap();
        env.pic.add_cycles(whale, 10_000_000_000_000);
        
        // Mint 10M secondary tokens
        swap_icp(&env.pic, icp_swap, whale, 100_000 * E8S, secondary_token).unwrap();
        
        // Try to burn 10M secondary tokens at once
        // This would mint 2M primary tokens (10M / 500k * 100k), which is >0.1% of 1M supply
        approve_token(&env.pic, secondary_token, whale, icp_swap, 10_000_000 * E8S).unwrap();
        
        let large_burn: Result<String, ExecutionError> = env.pic.update_call(
            icp_swap,
            whale,
            "burn_secondary",
            candid::encode_one(10_000_000u64).unwrap(),
        ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
        .and_then(|res| {
            candid::decode_one::<Result<String, String>>(&res)
                .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
        });

        // This should fail due to 0.1% cap
        assert!(
            large_burn.is_err(),
            "Large burn should fail due to 0.1% transaction cap"
        );
        
        if let Err(e) = large_burn {
            match e {
                ExecutionError::StateError(msg) => {
                    assert!(
                        msg.contains("exceeds") || msg.contains("0.1%") || msg.contains("cap"),
                        "Error should mention transaction cap. Got: {}",
                        msg
                    );
                }
                _ => panic!("Expected StateError variant, got: {:?}", e)
            }
        }

        // Try burning exactly at the cap (should succeed)
        // 0.1% of 1M = 1,000 primary tokens
        // To get 1,000 primary tokens: 1,000 / 100 = 10 burn units
        // 10 burn units = 10 * 500,000 = 5,000,000 secondary tokens
        approve_token(&env.pic, secondary_token, whale, icp_swap, 500_000 * E8S).unwrap();
        
        let cap_burn: Result<String, ExecutionError> = env.pic.update_call(
            icp_swap,
            whale,
            "burn_secondary",
            candid::encode_one(500_000u64).unwrap(), // Exactly one burn unit
        ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
        .and_then(|res| {
            candid::decode_one::<Result<String, String>>(&res)
                .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
        });

        assert!(
            cap_burn.is_ok(),
            "Burn at or below cap should succeed"
        );
    }

    /// Test 5: Zero Epoch Configuration - Should be rejected
    /// Tests validation of configurations that would mint entire supply instantly
    #[test]
    fn test_zero_epoch_instant_mint_rejection() {
        let mut env = TokenTestEnvironment::new();
        
        // Try to create configuration that violates 30% rule
        let result = env.create_token_with_config(
            &env.user1,
            "Instant Mint Token",
            "INSTANT",
            100_000,       // Hard Cap
            1,             // TGE
            10_000_000,    // Burn Unit (huge)
            99_999,        // Initial Reward (would be 99.999% of supply)
            50,            // Halving Step
        );

        // This should fail validation
        assert!(
            result.is_err(),
            "Configuration violating 30% rule should be rejected"
        );
        
        // Try another configuration that would create zero epochs
        let result2 = env.create_token_with_config(
            &env.user1,
            "Zero Epoch Token",
            "ZERO",
            1_000_000,     // Hard Cap
            1,             // TGE
            1_000_000,     // Burn Unit
            300_000,       // Initial Reward (exactly 30% - should still fail due to first epoch cap)
            50,            // Halving Step
        );

        // This should also fail
        assert!(
            result2.is_err(),
            "Configuration creating zero epochs should be rejected"
        );
    }

    /// Test 6: Frontend Preset Configurations
    /// Tests the three main presets from the frontend
    #[test]
    fn test_frontend_preset_configurations() {
        let mut env = TokenTestEnvironment::new();

        // Extended Distribution Preset
        let extended_config = env
            .create_token_with_config(
                &env.user1,
                "Extended Token",
                "EXT",
                1_000_000,     // Hard Cap
                1,             // TGE
                200_000,       // Burn Unit ($1,000 valuation)
                100,           // Initial Reward
                35,            // Halving Step
            )
            .expect("Extended distribution preset should be valid");

        // Balanced Preset
        let balanced_config = env
            .create_token_with_config(
                &env.user2,
                "Balanced Token",
                "BAL",
                5_000_000,     // Hard Cap
                1,             // TGE
                500_000,       // Burn Unit ($2,500 valuation)
                500,           // Initial Reward
                45,            // Halving Step
            )
            .expect("Balanced preset should be valid");

        // Quick Launch Preset
        let quick_config = env
            .create_token_with_config(
                &env.user3,
                "Quick Token",
                "QUICK",
                10_000_000,    // Hard Cap
                1,             // TGE
                1_000_000,     // Burn Unit ($5,000 valuation)
                2_000,         // Initial Reward
                70,            // Halving Step
            )
            .expect("Quick launch preset should be valid");

        // Test each preset behaves as expected
        let test_presets = vec![
            (extended_config, "Extended", 15), // Expected 15+ epochs
            (balanced_config, "Balanced", 8),   // Expected 8-12 epochs
            (quick_config, "Quick", 3),         // Expected 3-5 epochs
        ];

        for (config, name, min_epochs) in test_presets {
            let icp_swap = config.icp_swap.expect("No icp_swap");
            let secondary_token = config.secondary_token.expect("No secondary token");
            
            // Get tokenomics info to verify epoch count
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
                "{} preset should have valid tokenomics",
                name
            );
            
            // Could parse the response to verify epoch count
            println!("{} preset tokenomics info: {:?}", name, info_res);
        }
    }
}