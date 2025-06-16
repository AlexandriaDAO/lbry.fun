// tests/phase3_distribution.rs
use crate::integrated_token_tests::TokenTestEnvironment;
use crate::shared_helpers::*;
use crate::shared_helpers::{ApproveArgs, Account};
use candid::{CandidType, Encode, Principal, Nat};
use std::time::Duration;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Debug)]
struct Stake {
    amount: u64,
    time: u64,
    reward_icp: u64,
}

const ICP_TRANSFER_FEE: u64 = 10_000;

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

// Helper to trigger distribution
fn trigger_distribution(env: &mut TokenTestEnvironment) -> Result<String, String> {
    let result = env.pic.update_call(
        env.icp_swap,
        env.test_users[&"alice".to_string()],
        "dev_trigger_distribution",
        Encode!().expect("Empty args")
    );
    
    match result {
        Ok(_) => Ok("Distribution triggered".to_string()),
        Err(e) => Err(format!("Distribution failed: {:?}", e))
    }
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
        Ok(_) => Ok("Rewards claimed".to_string()),
        Err(e) => Err(format!("Claim failed: {:?}", e))
    }
}

// Helper to unstake all primary tokens
fn un_stake_all_primary(env: &mut TokenTestEnvironment, user: &str) -> Result<String, String> {
    let user_principal = env.test_users[&user.to_string()];
    let result = env.pic.update_call(
        env.icp_swap,
        user_principal,
        "un_stake_all_primary",
        Encode!(&None::<[u8; 32]>).expect("Failed to encode")
    );
    
    match result {
        Ok(_) => Ok("Unstaked all".to_string()),
        Err(e) => Err(format!("Unstake failed: {:?}", e))
    }
}

#[cfg(test)]
mod distribution_tests {
    use super::*;
    
    #[test]
    fn test_distribution_basic() {
        // Step 1: Setup environment
        let mut env = TokenTestEnvironment::new();
        
        // Step 2: Setup alice with primary tokens and stake them
        // Use the helper function which handles the full flow properly
        setup_user_with_primary(&mut env, "alice", 100 * E8S).unwrap();
        println!("Alice has primary tokens");
        
        // Stake Alice's primary tokens
        let alice_primary = get_primary_balance(&env, "alice");
        println!("Alice primary balance: {}", alice_primary);
        
        if alice_primary >= 100 * E8S {
            approve_primary(&mut env, "alice", alice_primary).unwrap();
            stake_primary(&mut env, "alice", 100 * E8S).unwrap();
            println!("Alice staked 100 primary tokens");
        }
        
        // Setup Bob with twice as many primary tokens
        setup_user_with_primary(&mut env, "bob", 200 * E8S).unwrap();
        println!("Bob has primary tokens");
        
        // Stake Bob's primary tokens
        let bob_primary = get_primary_balance(&env, "bob");
        println!("Bob primary balance: {}", bob_primary);
        
        if bob_primary >= 200 * E8S {
            approve_primary(&mut env, "bob", bob_primary).unwrap();
            stake_primary(&mut env, "bob", 200 * E8S).unwrap();
            println!("Bob staked 200 primary tokens");
        }
        
        // Step 3: Check initial ICP pool balance
        let initial_pool = get_canister_balance(&env, env.icp_swap, env.icp_ledger);
        println!("Initial pool ICP: {}", initial_pool);
        
        // Step 4: Advance time by 1 hour
        env.pic.advance_time(Duration::from_secs(3600));
        
        // Step 5: Call trigger_distribution
        let result = trigger_distribution(&mut env);
        assert!(result.is_ok(), "Distribution should succeed");
        
        // Step 6: Verify distribution happened
        // Expected: 1% of pool distributed, with 49.5% going to stakers
        let expected_total_distribution = initial_pool / 100; // 1% of pool
        let expected_staker_distribution = (expected_total_distribution * 495) / 1000; // 49.5% of the 1%
        // Alice has 100 tokens staked, Bob has 200, so 1:2 ratio
        let alice_expected = expected_staker_distribution / 3; // 1/3 of staker distribution
        let bob_expected = (expected_staker_distribution * 2) / 3; // 2/3 of staker distribution
        
        // Step 7: Check reward balances via get_stake
        let alice_stake = get_stake_info(&env, "alice").expect("Alice should have a stake");
        let bob_stake = get_stake_info(&env, "bob").expect("Bob should have a stake");
        
        println!("Alice reward: {}, expected: {}", alice_stake.reward_icp, alice_expected);
        println!("Bob reward: {}, expected: {}", bob_stake.reward_icp, bob_expected);
        
        // Allow for small rounding differences
        assert!((alice_stake.reward_icp as i64 - alice_expected as i64).abs() <= 1);
        assert!((bob_stake.reward_icp as i64 - bob_expected as i64).abs() <= 1);
    }
    
    #[test]
    fn test_distribution_no_stakers() {
        // Create fresh environment
        let mut env = TokenTestEnvironment::new();
        
        // Add ICP to pool via swap without staking
        approve_icp(&mut env, "alice", 100 * E8S).unwrap();
        swap_icp(&mut env, "alice", 100 * E8S).unwrap();
        
        let pool_before = get_canister_balance(&env, env.icp_swap, env.icp_ledger);
        println!("Pool before distribution: {}", pool_before);
        
        // Advance time 1 hour
        env.pic.advance_time(Duration::from_secs(3600));
        
        // Call trigger_distribution
        let result = trigger_distribution(&mut env);
        assert!(result.is_ok(), "Distribution should succeed even with no stakers");
        
        // Verify pool balance changed (1% should still be distributed to other destinations)
        let pool_after = get_canister_balance(&env, env.icp_swap, env.icp_ledger);
        println!("Pool after distribution: {}", pool_after);
        assert!(pool_after < pool_before, "Pool should decrease even with no stakers");
    }
    
    #[test]
    fn test_distribution_timing() {
        let mut env = TokenTestEnvironment::new();
        
        // Setup stakers
        setup_user_with_primary(&mut env, "alice", 1000 * E8S).unwrap();
        approve_primary(&mut env, "alice", 1000 * E8S + 10_000).unwrap();
        stake_primary(&mut env, "alice", 1000 * E8S).unwrap();
        
        // Advance time and trigger first distribution
        env.pic.advance_time(Duration::from_secs(3600));
        let result1 = trigger_distribution(&mut env);
        assert!(result1.is_ok(), "First distribution should succeed");
        
        // Advance only 30 minutes
        env.pic.advance_time(Duration::from_secs(1800));
        
        // Try to trigger again - should fail
        let result2 = trigger_distribution(&mut env);
        assert!(result2.is_err(), "Distribution should fail - not enough time passed");
        
        // Advance 31 more minutes (total 61 minutes since last distribution)
        env.pic.advance_time(Duration::from_secs(1860));
        
        // Trigger again - should succeed
        let result3 = trigger_distribution(&mut env);
        assert!(result3.is_ok(), "Distribution should succeed after 1 hour");
    }
    
    #[test]
    fn test_claim_rewards() {
        let mut env = TokenTestEnvironment::new();
        
        // Setup alice with staked tokens
        setup_user_with_primary(&mut env, "alice", 1000 * E8S).unwrap();
        approve_primary(&mut env, "alice", 1000 * E8S + 10_000).unwrap();
        stake_primary(&mut env, "alice", 1000 * E8S).unwrap();
        
        // Trigger distribution to generate rewards
        env.pic.advance_time(Duration::from_secs(3600));
        trigger_distribution(&mut env).unwrap();
        
        // Check alice has unclaimed rewards
        let stake_info = get_stake_info(&env, "alice").expect("Alice should have a stake");
        assert!(stake_info.reward_icp > 0, "Alice should have rewards");
        let reward_amount = stake_info.reward_icp;
        println!("Alice's reward amount: {}", reward_amount);
        
        // Record alice's ICP balance before claim
        let alice_icp_before = get_icp_balance(&env, "alice");
        
        // Call claim_icp_reward
        let result = claim_icp_reward(&mut env, "alice");
        assert!(result.is_ok(), "Claim should succeed");
        
        // Verify ICP transferred
        let alice_icp_after = get_icp_balance(&env, "alice");
        let expected_after = alice_icp_before + reward_amount - ICP_TRANSFER_FEE;
        println!("Alice ICP before: {}, after: {}, expected: {}", alice_icp_before, alice_icp_after, expected_after);
        assert_eq!(alice_icp_after, expected_after, "ICP balance should increase by reward minus fee");
        
        // Verify rewards reset to 0
        let stake_info_after = get_stake_info(&env, "alice").expect("Alice should still have a stake");
        assert_eq!(stake_info_after.reward_icp, 0, "Rewards should be reset after claim");
    }
    
    #[test]
    fn test_unstake_all() {
        let mut env = TokenTestEnvironment::new();
        
        // Setup user with 1000 staked tokens
        setup_user_with_primary(&mut env, "alice", 1000 * E8S).unwrap();
        approve_primary(&mut env, "alice", 1000 * E8S + 10_000).unwrap();
        stake_primary(&mut env, "alice", 1000 * E8S).unwrap();
        
        // Record primary token balance before unstaking
        let primary_before = get_primary_balance(&env, "alice");
        
        // Verify stake exists
        let stake_before = get_stake_info(&env, "alice").expect("Alice should have a stake");
        assert_eq!(stake_before.amount, 1000 * E8S, "Should have 1000 tokens staked");
        
        // Call un_stake_all_primary
        let result = un_stake_all_primary(&mut env, "alice");
        assert!(result.is_ok(), "Unstake should succeed");
        
        // Verify all tokens returned
        let primary_after = get_primary_balance(&env, "alice");
        assert_eq!(primary_after, primary_before + 1000 * E8S, "All staked tokens should be returned");
        
        // Verify stake record shows 0
        let stake_after = get_stake_info(&env, "alice");
        assert!(stake_after.is_none() || stake_after.unwrap().amount == 0, "Stake should be removed or have 0 amount after unstaking");
    }
    
    #[test]
    fn test_unstake_with_rewards() {
        let mut env = TokenTestEnvironment::new();
        
        // Setup staker with rewards
        setup_user_with_primary(&mut env, "alice", 1000 * E8S).unwrap();
        approve_primary(&mut env, "alice", 1000 * E8S + 10_000).unwrap();
        stake_primary(&mut env, "alice", 1000 * E8S).unwrap();
        
        // Generate rewards via distribution
        env.pic.advance_time(Duration::from_secs(3600));
        trigger_distribution(&mut env).unwrap();
        
        // Verify rewards exist
        let stake_info = get_stake_info(&env, "alice").expect("Alice should have a stake");
        let reward_amount = stake_info.reward_icp;
        assert!(reward_amount > 0, "Should have rewards before unstaking");
        
        // Unstake all
        let result = un_stake_all_primary(&mut env, "alice");
        assert!(result.is_ok(), "Unstake should succeed");
        
        // Verify tokens returned
        let primary_balance = get_primary_balance(&env, "alice");
        assert!(primary_balance >= 1000 * E8S, "Tokens should be returned");
        
        // Verify rewards still claimable
        let stake_info_after = get_stake_info(&env, "alice").expect("Alice should still have stake info");
        assert_eq!(stake_info_after.reward_icp, reward_amount, "Rewards should persist after unstaking");
        
        // Claim rewards
        let alice_icp_before = get_icp_balance(&env, "alice");
        claim_icp_reward(&mut env, "alice").unwrap();
        
        // Verify ICP transferred
        let alice_icp_after = get_icp_balance(&env, "alice");
        let expected_icp = alice_icp_before + reward_amount - ICP_TRANSFER_FEE;
        assert_eq!(alice_icp_after, expected_icp, "ICP rewards should be claimed");
    }
}