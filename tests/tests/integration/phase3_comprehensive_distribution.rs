// Comprehensive distribution test with proper initialization and manual trigger
use crate::integrated_token_tests::TokenTestEnvironment;
use crate::shared_helpers::*;
use candid::{CandidType, Encode, Principal, Nat};
use serde::Deserialize;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};

#[derive(CandidType, Deserialize, Debug)]
struct Stake {
    amount: u64,
    time: u64,
    reward_icp: u64,
}

const ICP_TRANSFER_FEE: u64 = 10_000;

// Helper to mint primary tokens directly for testing
fn mint_primary_tokens(env: &mut TokenTestEnvironment, user: &str, amount: u64) -> Result<(), String> {
    let user_principal = env.test_users[&user.to_string()];
    
    // The icp_swap canister is the minting account for primary token
    // We'll mint directly from the minting account
    let mint_args = TransferArg {
        from_subaccount: None,
        to: Account {
            owner: user_principal,
            subaccount: None,
        },
        fee: None,
        created_at_time: None,
        memo: None,
        amount: Nat::from(amount),
    };
    
    // Use the icp_swap canister as it's the minting account
    let result = env.pic.update_call(
        env.primary_token,
        env.icp_swap,  // icp_swap is the minting account
        "icrc1_transfer",
        Encode!(&mint_args).expect("Failed to encode transfer args"),
    );
    
    match result {
        Ok(bytes) => {
            // Check if transfer succeeded
            match candid::decode_one::<Result<Nat, TransferError>>(&bytes) {
                Ok(Ok(_)) => Ok(()),
                Ok(Err(e)) => Err(format!("Transfer failed: {:?}", e)),
                Err(e) => Err(format!("Failed to decode response: {:?}", e))
            }
        },
        Err(e) => Err(format!("Failed to mint primary tokens: {:?}", e))
    }
}

// Helper to trigger distribution manually
fn dev_trigger_distribution(env: &mut TokenTestEnvironment) -> Result<String, String> {
    let result = env.pic.update_call(
        env.icp_swap,
        env.test_users[&"alice".to_string()],
        "dev_trigger_distribution",
        Encode!().expect("Empty args")
    );
    
    match result {
        Ok(bytes) => {
            let response: Result<String, String> = candid::decode_one(&bytes)
                .expect("Failed to decode response");
            response
        },
        Err(e) => Err(format!("Call failed: {:?}", e))
    }
}

// Helper to get stake info for a user
fn get_stake_info(env: &TokenTestEnvironment, user: &str) -> Option<Stake> {
    let user_principal = env.test_users[&user.to_string()];
    let result = env.pic.query_call(
        env.icp_swap,
        Principal::anonymous(),
        "get_stake",
        Encode!(&user_principal).expect("Failed to encode")
    ).expect("Query failed");
    
    candid::decode_one(&result).expect("Failed to decode stake")
}

// Helper to claim ICP rewards
fn claim_icp_reward(env: &mut TokenTestEnvironment, user: &str) -> Result<String, String> {
    let user_principal = env.test_users[&user.to_string()];
    let result = env.pic.update_call(
        env.icp_swap,
        user_principal,
        "claim_icp_reward",
        Encode!(&None::<[u8; 32]>).expect("Failed to encode")
    );
    
    match result {
        Ok(bytes) => {
            // Try to decode as Result
            match candid::decode_one::<Result<String, String>>(&bytes) {
                Ok(res) => res,
                Err(_) => Ok("Claim succeeded".to_string())
            }
        },
        Err(e) => Err(format!("Claim failed: {:?}", e))
    }
}

#[cfg(test)]
mod comprehensive_distribution_tests {
    use super::*;
    
    #[test]
    fn test_full_distribution_flow() {
        let mut env = TokenTestEnvironment::new();
        
        println!("\n=== Phase 1: Setup ICP Pool ===");
        // Add ICP to the pool via swaps
        approve_icp(&mut env, "alice", 100 * E8S).unwrap();
        swap_icp(&mut env, "alice", 100 * E8S).unwrap();
        
        approve_icp(&mut env, "bob", 200 * E8S).unwrap();
        swap_icp(&mut env, "bob", 200 * E8S).unwrap();
        
        let pool_balance = get_canister_balance(&env, env.icp_swap, env.icp_ledger);
        println!("ICP pool balance: {} e8s ({} ICP)", pool_balance, pool_balance / E8S);
        assert!(pool_balance >= 300 * E8S, "Pool should have at least 300 ICP");
        
        println!("\n=== Phase 2: Setup Stakers ===");
        // Setup users with primary tokens
        setup_user_with_primary(&mut env, "alice", 1000 * E8S).unwrap();
        setup_user_with_primary(&mut env, "bob", 2000 * E8S).unwrap();
        setup_user_with_primary(&mut env, "charlie", 3000 * E8S).unwrap();
        
        // Verify primary balances
        let alice_primary = get_primary_balance(&env, "alice");
        let bob_primary = get_primary_balance(&env, "bob");
        let charlie_primary = get_primary_balance(&env, "charlie");
        
        println!("Alice primary balance: {} e8s", alice_primary);
        println!("Bob primary balance: {} e8s", bob_primary);
        println!("Charlie primary balance: {} e8s", charlie_primary);
        
        // Stake primary tokens - leave some for transfer fees
        println!("\nStaking primary tokens...");
        
        // Alice stakes her balance minus fee
        approve_primary(&mut env, "alice", alice_primary).unwrap();
        stake_primary(&mut env, "alice", alice_primary.saturating_sub(10_000)).unwrap();
        println!("Alice staked: {} e8s", alice_primary.saturating_sub(10_000));
        
        // Bob stakes his balance minus fee
        approve_primary(&mut env, "bob", bob_primary).unwrap();
        stake_primary(&mut env, "bob", bob_primary.saturating_sub(10_000)).unwrap();
        println!("Bob staked: {} e8s", bob_primary.saturating_sub(10_000));
        
        // Charlie stakes his balance minus fee
        approve_primary(&mut env, "charlie", charlie_primary).unwrap();
        stake_primary(&mut env, "charlie", charlie_primary.saturating_sub(10_000)).unwrap();
        println!("Charlie staked: {} e8s", charlie_primary.saturating_sub(10_000));
        
        // Check icp_swap primary token balance (should have received staked tokens)
        let icp_swap_primary = get_canister_balance(&env, env.icp_swap, env.primary_token);
        println!("ICP Swap primary token balance after staking: {} e8s", icp_swap_primary);
        
        // Verify stakes
        let alice_stake = get_stake_info(&env, "alice");
        println!("Alice stake info: {:?}", alice_stake);
        let alice_stake = alice_stake.expect("Alice should have stake");
        let bob_stake = get_stake_info(&env, "bob").expect("Bob should have stake");
        let charlie_stake = get_stake_info(&env, "charlie").expect("Charlie should have stake");
        
        println!("\nStake amounts:");
        println!("Alice: {} e8s", alice_stake.amount);
        println!("Bob: {} e8s", bob_stake.amount);
        println!("Charlie: {} e8s", charlie_stake.amount);
        
        let total_staked = alice_stake.amount + bob_stake.amount + charlie_stake.amount;
        println!("Total staked: {} e8s", total_staked);
        
        println!("\n=== Phase 3: Trigger Distribution ===");
        let pool_before = get_canister_balance(&env, env.icp_swap, env.icp_ledger);
        println!("Pool balance before distribution: {} e8s", pool_before);
        
        // Manually trigger distribution
        let dist_result = dev_trigger_distribution(&mut env);
        match &dist_result {
            Ok(msg) => println!("Distribution succeeded: {}", msg),
            Err(e) => println!("Distribution failed: {}", e),
        }
        assert!(dist_result.is_ok(), "Distribution should succeed");
        
        let pool_after = get_canister_balance(&env, env.icp_swap, env.icp_ledger);
        println!("Pool balance after distribution: {} e8s", pool_after);
        
        let distributed = pool_before.saturating_sub(pool_after);
        println!("Total distributed: {} e8s ({} ICP)", distributed, distributed / E8S);
        
        // Verify distribution - only LBRY fee (1% of 1%) leaves the canister
        let expected_external_distribution = pool_before / 10000; // 0.01% (LBRY fee)
        let tolerance = expected_external_distribution / 10; // 10% tolerance
        
        assert!(
            distributed >= expected_external_distribution - tolerance && 
            distributed <= expected_external_distribution + tolerance,
            "External distribution should be ~0.01% of pool (LBRY fee). Expected: {}, Got: {}", 
            expected_external_distribution, distributed
        );
        
        println!("\n=== Phase 4: Check Rewards ===");
        // Check updated stake info with rewards
        let alice_stake_after = get_stake_info(&env, "alice").expect("Alice should have stake");
        let bob_stake_after = get_stake_info(&env, "bob").expect("Bob should have stake");
        let charlie_stake_after = get_stake_info(&env, "charlie").expect("Charlie should have stake");
        
        println!("Rewards distributed:");
        println!("Alice: {} e8s", alice_stake_after.reward_icp);
        println!("Bob: {} e8s", bob_stake_after.reward_icp);
        println!("Charlie: {} e8s", charlie_stake_after.reward_icp);
        
        let total_rewards = alice_stake_after.reward_icp + 
                           bob_stake_after.reward_icp + 
                           charlie_stake_after.reward_icp;
        println!("Total rewards: {} e8s", total_rewards);
        
        // Verify proportional distribution
        // Alice has 1/6, Bob has 2/6, Charlie has 3/6 of total stake
        let alice_ratio = alice_stake.amount as f64 / total_staked as f64;
        let bob_ratio = bob_stake.amount as f64 / total_staked as f64;
        let charlie_ratio = charlie_stake.amount as f64 / total_staked as f64;
        
        let alice_expected = (total_rewards as f64 * alice_ratio) as u64;
        let bob_expected = (total_rewards as f64 * bob_ratio) as u64;
        let charlie_expected = (total_rewards as f64 * charlie_ratio) as u64;
        
        println!("\nExpected rewards based on stake ratios:");
        println!("Alice: {} e8s (ratio: {:.2})", alice_expected, alice_ratio);
        println!("Bob: {} e8s (ratio: {:.2})", bob_expected, bob_ratio);
        println!("Charlie: {} e8s (ratio: {:.2})", charlie_expected, charlie_ratio);
        
        // Allow for rounding differences
        assert!((alice_stake_after.reward_icp as i64 - alice_expected as i64).abs() <= 10000);
        assert!((bob_stake_after.reward_icp as i64 - bob_expected as i64).abs() <= 10000);
        assert!((charlie_stake_after.reward_icp as i64 - charlie_expected as i64).abs() <= 10000);
        
        println!("\n=== Phase 5: Claim Rewards ===");
        // Test claiming rewards
        let alice_icp_before = get_icp_balance(&env, "alice");
        let claim_result = claim_icp_reward(&mut env, "alice");
        assert!(claim_result.is_ok(), "Alice should be able to claim rewards");
        
        let alice_icp_after = get_icp_balance(&env, "alice");
        let alice_icp_gained = alice_icp_after.saturating_sub(alice_icp_before);
        
        println!("Alice ICP gained from claim: {} e8s", alice_icp_gained);
        assert!(
            alice_icp_gained >= alice_stake_after.reward_icp - ICP_TRANSFER_FEE,
            "Alice should receive rewards minus fee"
        );
        
        // Verify rewards are cleared after claim
        let alice_stake_final = get_stake_info(&env, "alice").expect("Alice should have stake");
        assert_eq!(alice_stake_final.reward_icp, 0, "Rewards should be cleared after claim");
        
        println!("\n✅ All distribution tests passed!");
    }
    
    #[test]
    fn test_distribution_edge_cases() {
        let mut env = TokenTestEnvironment::new();
        
        println!("\n=== Test: Distribution with Single Staker ===");
        
        // Setup pool
        approve_icp(&mut env, "alice", 50 * E8S).unwrap();
        swap_icp(&mut env, "alice", 50 * E8S).unwrap();
        
        // Setup single staker
        setup_user_with_primary(&mut env, "alice", 1000 * E8S).unwrap();
        let alice_balance = get_primary_balance(&env, "alice");
        approve_primary(&mut env, "alice", alice_balance).unwrap();
        stake_primary(&mut env, "alice", alice_balance.saturating_sub(10_000)).unwrap();
        
        let pool_before = get_canister_balance(&env, env.icp_swap, env.icp_ledger);
        
        // Trigger distribution
        let result = dev_trigger_distribution(&mut env);
        assert!(result.is_ok(), "Distribution should work with single staker");
        
        let alice_stake = get_stake_info(&env, "alice").expect("Alice should have stake");
        println!("Single staker reward: {} e8s", alice_stake.reward_icp);
        
        // With single staker, they get 49.5% of the 1% distribution
        let expected_reward = (pool_before / 100) * 495 / 1000; // 49.5% of 1%
        assert!(alice_stake.reward_icp > 0, "Single staker should get rewards");
        assert!(
            (alice_stake.reward_icp as i64 - expected_reward as i64).abs() < 100000,
            "Reward should be close to expected"
        );
    }
}