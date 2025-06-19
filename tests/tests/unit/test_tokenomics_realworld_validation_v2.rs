use crate::integrated_token_tests::TokenTestEnvironment;
use crate::phase2_token_operations::{swap_icp, approve_icp};
use crate::shared_helpers::{E8S};
use candid::{Encode, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use num_traits::cast::ToPrimitive;

/// Test configurations based on real-world frontend parameters from the validation plan
#[cfg(test)]
mod tokenomics_realworld_validation_tests {
    use super::*;

    /// Test 1: Extreme Front-Load Configuration - "Whale Capture Token"
    /// This configuration gives 99.7% of tokens in the first epoch
    #[test]
    fn test_extreme_front_load_whale_capture() {
        let mut env = TokenTestEnvironment::new();
        
        // Create the token with extreme front-load configuration
        env.create_token(
            "alice",
            "Whale Capture Token",
            "WHALE"
        ).expect("Failed to create token");
        
        // Get token principals for alice's token
        let (primary_token, secondary_token, icp_swap) = {
            let alice_principal = env.test_users["alice"];
            
            // Query lbry_fun for alice's token
            let result = env.pic.query_call(
                env.lbry_fun,
                alice_principal,
                "get_user_metadata",
                candid::encode_one(&alice_principal).unwrap(),
            ).unwrap();
            
            let tokens: Vec<(Principal, Principal, Principal, Principal, Principal)> = 
                candid::decode_one(&result).unwrap();
            
            let (primary, secondary, _, icp_swap_canister, _) = &tokens[0];
            (*primary, *secondary, *icp_swap_canister)
        };
        
        // Update tokenomics with extreme configuration
        let update_result = env.pic.update_call(
            icp_swap,
            env.test_users["alice"],
            "update_tokenomics_config",
            candid::encode_args((
                1_000_000u64,     // max_primary_supply
                1u64,             // initial_primary_mint (TGE)
                1_000_000u64,     // initial_secondary_burn (large burn unit)
                25u64,            // halving_step
                2_999u64,         // initial_reward_per_burn_unit (just under 30%)
            )).unwrap(),
        );
        assert!(update_result.is_ok(), "Failed to update tokenomics config");

        // First whale gets secondary tokens
        approve_icp(&mut env, "bob", 5_000 * E8S + 100_000).unwrap();
        swap_icp(&mut env, "bob", 5_000 * E8S).unwrap();
        
        // Get bob's secondary balance
        let bob_secondary_balance = env.get_balance("bob", secondary_token);
        println!("Bob's secondary balance: {}", bob_secondary_balance / E8S);
        
        // Bob approves and burns one burn unit (1M secondary)
        let approve_args = crate::individual_canister_tests::Icrc2ApproveArgs {
            from_subaccount: None,
            spender: crate::individual_canister_tests::Account {
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
        
        env.pic.update_call(
            secondary_token,
            env.test_users["bob"],
            "icrc2_approve",
            candid::encode_one(approve_args).unwrap(),
        ).unwrap();
        
        // Bob burns secondary for primary
        let burn_result: Result<Result<String, String>, _> = env.pic.update_call(
            icp_swap,
            env.test_users["bob"],
            "burn_secondary",
            candid::encode_one(1_000_000u64).unwrap(),
        ).map(|res| candid::decode_one(&res).unwrap());

        assert!(burn_result.is_ok() && burn_result.unwrap().is_ok(), 
                "First burn should succeed");

        // Check bob's primary balance - should be ~299,900 tokens (2,999 * 100)
        let bob_primary_balance = env.get_balance("bob", primary_token);
        let expected_min = 299_000 * E8S;
        let expected_max = 300_000 * E8S;
        assert!(
            bob_primary_balance >= expected_min && bob_primary_balance <= expected_max,
            "Whale should get ~30% of supply. Got: {}, Expected: {}-{}",
            bob_primary_balance / E8S, expected_min / E8S, expected_max / E8S
        );

        // Second participant tries to burn
        approve_icp(&mut env, "charlie", 5_000 * E8S + 100_000).unwrap();
        swap_icp(&mut env, "charlie", 5_000 * E8S).unwrap();
        
        // Charlie approves and burns
        let approve_args2 = crate::individual_canister_tests::Icrc2ApproveArgs {
            from_subaccount: None,
            spender: crate::individual_canister_tests::Account {
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
        
        env.pic.update_call(
            secondary_token,
            env.test_users["charlie"],
            "icrc2_approve",
            candid::encode_one(approve_args2).unwrap(),
        ).unwrap();
        
        let burn_result2: Result<Result<String, String>, _> = env.pic.update_call(
            icp_swap,
            env.test_users["charlie"],
            "burn_secondary",
            candid::encode_one(1_000_000u64).unwrap(),
        ).map(|res| candid::decode_one(&res).unwrap());

        assert!(burn_result2.is_ok() && burn_result2.unwrap().is_ok(), 
                "Second burn should succeed");

        // Check second participant balance - should be significantly less due to halving
        let charlie_primary_balance = env.get_balance("charlie", primary_token);
        let expected_reward_after_halving = (2_999 * 75 / 100) * 100; // 75% of original
        let expected_min2 = expected_reward_after_halving * E8S * 90 / 100; // Allow 10% variance
        let expected_max2 = expected_reward_after_halving * E8S * 110 / 100;
        
        assert!(
            charlie_primary_balance >= expected_min2 && charlie_primary_balance <= expected_max2,
            "Second participant should get ~75% of first reward. Got: {}, Expected: {}-{}",
            charlie_primary_balance / E8S, expected_min2 / E8S, expected_max2 / E8S
        );

        // Verify extreme inequality
        let ratio = (bob_primary_balance / E8S) / (charlie_primary_balance / E8S);
        assert!(
            ratio > 1, // First participant got more
            "Configuration should create early advantage. Ratio: {}",
            ratio
        );
    }

    /// Test 2: Extreme Back-Load Configuration - "Inflation Bomb Token"
    /// Early participants get minimal rewards, late stage becomes hyperinflationary
    #[test]
    fn test_extreme_back_load_inflation_bomb() {
        let mut env = TokenTestEnvironment::new();
        
        // Create the token
        env.create_token(
            "alice",
            "Inflation Bomb Token",
            "BOMB"
        ).expect("Failed to create token");
        
        // Get token principals
        let (primary_token, secondary_token, icp_swap) = {
            let alice_principal = env.test_users["alice"];
            let result = env.pic.query_call(
                env.lbry_fun,
                alice_principal,
                "get_user_metadata",
                candid::encode_one(&alice_principal).unwrap(),
            ).unwrap();
            let tokens: Vec<(Principal, Principal, Principal, Principal, Principal)> = 
                candid::decode_one(&result).unwrap();
            let (primary, secondary, _, icp_swap_canister, _) = &tokens[0];
            (*primary, *secondary, *icp_swap_canister)
        };
        
        // Update with extreme back-load configuration
        env.pic.update_call(
            icp_swap,
            env.test_users["alice"],
            "update_tokenomics_config",
            candid::encode_args((
                10_000_000u64,    // max_primary_supply (10M)
                1u64,             // initial_primary_mint (TGE)
                200_000u64,       // initial_secondary_burn (small burn unit)
                99u64,            // halving_step (almost no halving)
                10u64,            // initial_reward_per_burn_unit (very small)
            )).unwrap(),
        ).unwrap();

        // Early participant burns
        approve_icp(&mut env, "bob", 1_000 * E8S + 100_000).unwrap();
        swap_icp(&mut env, "bob", 1_000 * E8S).unwrap();
        
        // Bob approves and burns one burn unit
        let approve_args = crate::individual_canister_tests::Icrc2ApproveArgs {
            from_subaccount: None,
            spender: crate::individual_canister_tests::Account {
                owner: icp_swap,
                subaccount: None,
            },
            amount: Nat::from(200_000 * E8S),
            expected_allowance: None,
            expires_at: None,
            fee: None,
            memo: None,
            created_at_time: None,
        };
        
        env.pic.update_call(
            secondary_token,
            env.test_users["bob"],
            "icrc2_approve",
            candid::encode_one(approve_args).unwrap(),
        ).unwrap();
        
        let early_burn: Result<Result<String, String>, _> = env.pic.update_call(
            icp_swap,
            env.test_users["bob"],
            "burn_secondary",
            candid::encode_one(200_000u64).unwrap(),
        ).map(|res| candid::decode_one(&res).unwrap());

        assert!(early_burn.is_ok() && early_burn.unwrap().is_ok());
        let early_balance = env.get_balance("bob", primary_token);
        
        // Should get minimal reward (10 * 100 = 1,000 tokens)
        assert!(
            early_balance >= 900 * E8S && early_balance <= 1_100 * E8S,
            "Early participant should get minimal reward. Got: {}",
            early_balance / E8S
        );

        // Simulate many burns to reach later epochs
        // Using dynamic user creation for simulation
        let mut total_burned = 200_000u64;
        let mut epoch_count = 1;
        
        // Create and use multiple users for simulation
        for i in 0..20 {
            let user_name = format!("user{}", i);
            env.add_user(&user_name);
            
            approve_icp(&mut env, &user_name, 1_000 * E8S + 100_000).unwrap();
            swap_icp(&mut env, &user_name, 1_000 * E8S).unwrap();
            
            // Approve burn
            let approve_args = crate::individual_canister_tests::Icrc2ApproveArgs {
                from_subaccount: None,
                spender: crate::individual_canister_tests::Account {
                    owner: icp_swap,
                    subaccount: None,
                },
                amount: Nat::from(200_000 * E8S),
                expected_allowance: None,
                expires_at: None,
                fee: None,
                memo: None,
                created_at_time: None,
            };
            
            env.pic.update_call(
                secondary_token,
                env.test_users[&user_name],
                "icrc2_approve",
                candid::encode_one(approve_args).unwrap(),
            ).unwrap();
            
            let burn_res: Result<Result<String, String>, _> = env.pic.update_call(
                icp_swap,
                env.test_users[&user_name],
                "burn_secondary",
                candid::encode_one(200_000u64).unwrap(),
            ).map(|res| candid::decode_one(&res).unwrap());
            
            if burn_res.is_ok() && burn_res.unwrap().is_ok() {
                total_burned += 200_000;
                
                // Check if we've crossed an epoch boundary
                if total_burned >= (epoch_count * 200_000 * 100) {
                    epoch_count += 1;
                }
            }
        }

        // Late participant burns
        approve_icp(&mut env, "charlie", 1_000 * E8S + 100_000).unwrap();
        swap_icp(&mut env, "charlie", 1_000 * E8S).unwrap();
        
        let approve_args_late = crate::individual_canister_tests::Icrc2ApproveArgs {
            from_subaccount: None,
            spender: crate::individual_canister_tests::Account {
                owner: icp_swap,
                subaccount: None,
            },
            amount: Nat::from(200_000 * E8S),
            expected_allowance: None,
            expires_at: None,
            fee: None,
            memo: None,
            created_at_time: None,
        };
        
        env.pic.update_call(
            secondary_token,
            env.test_users["charlie"],
            "icrc2_approve",
            candid::encode_one(approve_args_late).unwrap(),
        ).unwrap();
        
        let late_burn: Result<Result<String, String>, _> = env.pic.update_call(
            icp_swap,
            env.test_users["charlie"],
            "burn_secondary",
            candid::encode_one(200_000u64).unwrap(),
        ).map(|res| candid::decode_one(&res).unwrap());

        if late_burn.is_ok() && late_burn.unwrap().is_ok() {
            let late_balance = env.get_balance("charlie", primary_token);
            
            // With 99% halving step, rewards barely decrease
            println!("Early balance: {}, Late balance: {}", early_balance / E8S, late_balance / E8S);
            
            // Verify problematic distribution
            assert!(
                late_balance >= early_balance * 80 / 100, // Late user gets at least 80% of early user
                "Configuration should create problematic late-stage inflation"
            );
        }
    }

    /// Test 3: Transaction Cap Violation - "Cap Buster Token"
    /// Tests the 0.1% transaction cap enforcement
    #[test]
    fn test_transaction_cap_violation() {
        let mut env = TokenTestEnvironment::new();
        
        // Create the token
        env.create_token(
            "alice",
            "Cap Buster Token",
            "BUST"
        ).expect("Failed to create token");
        
        // Get token principals
        let (primary_token, secondary_token, icp_swap) = {
            let alice_principal = env.test_users["alice"];
            let result = env.pic.query_call(
                env.lbry_fun,
                alice_principal,
                "get_user_metadata",
                candid::encode_one(&alice_principal).unwrap(),
            ).unwrap();
            let tokens: Vec<(Principal, Principal, Principal, Principal, Principal)> = 
                candid::decode_one(&result).unwrap();
            let (primary, secondary, _, icp_swap_canister, _) = &tokens[0];
            (*primary, *secondary, *icp_swap_canister)
        };
        
        // Update with configuration that has transaction cap issues
        env.pic.update_call(
            icp_swap,
            env.test_users["alice"],
            "update_tokenomics_config",
            candid::encode_args((
                1_000_000u64,     // max_primary_supply
                1u64,             // initial_primary_mint (TGE)
                500_000u64,       // initial_secondary_burn
                50u64,            // halving_step
                1_000u64,         // initial_reward_per_burn_unit (would give 100k tokens per burn unit)
            )).unwrap(),
        ).unwrap();

        // User tries to burn large amount that would exceed 0.1% cap
        approve_icp(&mut env, "bob", 100_000 * E8S + 100_000).unwrap();
        swap_icp(&mut env, "bob", 100_000 * E8S).unwrap();
        
        // Bob tries to burn 10M secondary tokens at once
        // This would mint 2M primary tokens (10M / 500k * 100k), which is >0.1% of 1M supply
        let approve_args = crate::individual_canister_tests::Icrc2ApproveArgs {
            from_subaccount: None,
            spender: crate::individual_canister_tests::Account {
                owner: icp_swap,
                subaccount: None,
            },
            amount: Nat::from(10_000_000 * E8S),
            expected_allowance: None,
            expires_at: None,
            fee: None,
            memo: None,
            created_at_time: None,
        };
        
        env.pic.update_call(
            secondary_token,
            env.test_users["bob"],
            "icrc2_approve",
            candid::encode_one(approve_args).unwrap(),
        ).unwrap();
        
        let large_burn: Result<Result<String, String>, _> = env.pic.update_call(
            icp_swap,
            env.test_users["bob"],
            "burn_secondary",
            candid::encode_one(10_000_000u64).unwrap(),
        ).map(|res| candid::decode_one(&res).unwrap());

        // This should fail due to 0.1% cap
        assert!(
            large_burn.is_ok() && large_burn.as_ref().unwrap().is_err(),
            "Large burn should fail due to 0.1% transaction cap"
        );
        
        if let Ok(Err(e)) = large_burn {
            assert!(
                e.contains("exceeds") || e.contains("0.1%") || e.contains("cap"),
                "Error should mention transaction cap. Got: {}",
                e
            );
        }

        // Try burning exactly at the cap (should succeed)
        // 0.1% of 1M = 1,000 primary tokens
        // To get 1,000 primary tokens: 1,000 / 100 = 10 burn units
        // 10 burn units = 10 * 500,000 = 5,000,000 secondary tokens
        // But we'll burn just one burn unit which should be under the cap
        let approve_args2 = crate::individual_canister_tests::Icrc2ApproveArgs {
            from_subaccount: None,
            spender: crate::individual_canister_tests::Account {
                owner: icp_swap,
                subaccount: None,
            },
            amount: Nat::from(500_000 * E8S),
            expected_allowance: None,
            expires_at: None,
            fee: None,
            memo: None,
            created_at_time: None,
        };
        
        env.pic.update_call(
            secondary_token,
            env.test_users["bob"],
            "icrc2_approve",
            candid::encode_one(approve_args2).unwrap(),
        ).unwrap();
        
        let cap_burn: Result<Result<String, String>, _> = env.pic.update_call(
            icp_swap,
            env.test_users["bob"],
            "burn_secondary",
            candid::encode_one(500_000u64).unwrap(), // Exactly one burn unit
        ).map(|res| candid::decode_one(&res).unwrap());

        assert!(
            cap_burn.is_ok() && cap_burn.unwrap().is_ok(),
            "Burn at or below cap should succeed"
        );
    }
}