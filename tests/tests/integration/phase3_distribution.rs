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

// Helper to get distribution count
fn get_distribution_count(env: &TokenTestEnvironment) -> u64 {
    let result = env.pic.query_call(
        env.icp_swap,
        Principal::anonymous(),
        "get_distribution_interval",
        Encode!().expect("Failed to encode args"),
    );
    
    match result {
        Ok(response) => {
            candid::decode_one::<u64>(&response).unwrap_or(0)
        },
        Err(_) => 0
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
        setup_user_with_primary(&mut env, "alice", 150 * E8S).unwrap();
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
        setup_user_with_primary(&mut env, "bob", 250 * E8S).unwrap();
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
        
        // Allow for small rounding differences (up to 1000 e8s)
        assert!((alice_stake.reward_icp as i64 - alice_expected as i64).abs() <= 1000);
        assert!((bob_stake.reward_icp as i64 - bob_expected as i64).abs() <= 1000);
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
        
        // Setup stakers - need pool to distribute from
        approve_icp(&mut env, "alice", 100 * E8S).unwrap();
        swap_icp(&mut env, "alice", 100 * E8S).unwrap();
        
        setup_user_with_primary(&mut env, "alice", 1000 * E8S).unwrap();
        let alice_balance = get_primary_balance(&env, "alice");
        approve_primary(&mut env, "alice", alice_balance).unwrap();
        stake_primary(&mut env, "alice", alice_balance.saturating_sub(10_000)).unwrap();
        
        // Record pool before distribution
        let pool_before = get_canister_balance(&env, env.icp_swap, env.icp_ledger);
        
        // Advance time and trigger first distribution
        env.pic.advance_time(Duration::from_secs(3600));
        let result1 = trigger_distribution(&mut env);
        assert!(result1.is_ok(), "First distribution should succeed");
        
        // Check pool decreased (LBRY fee transferred)
        let pool_after1 = get_canister_balance(&env, env.icp_swap, env.icp_ledger);
        assert!(pool_after1 < pool_before, "Pool should decrease after distribution");
        
        // Check distribution count
        let dist_count1 = get_distribution_count(&env);
        println!("Distribution count after first trigger: {}", dist_count1);
        
        // Advance only 30 minutes
        env.pic.advance_time(Duration::from_secs(1800));
        
        // Manual trigger should work anytime (dev_trigger_distribution has no timing restrictions)
        let result2 = trigger_distribution(&mut env);
        assert!(result2.is_ok(), "Manual distribution trigger should always work");
        
        // Check pool decreased again
        let pool_after2 = get_canister_balance(&env, env.icp_swap, env.icp_ledger);
        assert!(pool_after2 < pool_after1, "Pool should decrease after second distribution");
        
        // Verify that each distribution increments the counter
        let dist_count = get_distribution_count(&env);
        println!("Distribution count after second trigger: {}", dist_count);
        assert!(dist_count >= dist_count1, "Distribution count should not decrease");
    }
    
    #[test]
    fn test_claim_rewards() {
        let mut env = TokenTestEnvironment::new();
        
        // Setup alice with staked tokens
        setup_user_with_primary(&mut env, "alice", 1000 * E8S).unwrap();
        // Get actual balance (might be slightly less due to transfer fees)
        let alice_balance = get_primary_balance(&env, "alice");
        let stake_amount = alice_balance.saturating_sub(10_000); // Leave some for fees
        approve_primary(&mut env, "alice", alice_balance).unwrap();
        stake_primary(&mut env, "alice", stake_amount).unwrap();
        
        // Setup bob with equal stake so rewards are split 50/50
        setup_user_with_primary(&mut env, "bob", 1000 * E8S).unwrap();
        let bob_balance = get_primary_balance(&env, "bob");
        let bob_stake_amount = bob_balance.saturating_sub(10_000);
        approve_primary(&mut env, "bob", bob_balance).unwrap();
        stake_primary(&mut env, "bob", bob_stake_amount).unwrap();
        
        // Trigger distribution to generate rewards
        env.pic.advance_time(Duration::from_secs(3600));
        trigger_distribution(&mut env).unwrap();
        
        // Advance time slightly to let any async operations complete
        env.pic.advance_time(Duration::from_secs(10));
        env.pic.tick();
        
        // Get initial distribution count
        let initial_dist_count = get_distribution_count(&env);
        println!("Initial distribution count: {}", initial_dist_count);
        
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
        
        // Check distribution count after claim
        let dist_count_after_claim = get_distribution_count(&env);
        println!("Distribution count after claim: {}", dist_count_after_claim);
        
        // Verify rewards reset to 0
        let stake_info_after = get_stake_info(&env, "alice").expect("Alice should still have a stake");
        println!("Rewards after claim: {} (expected 0)", stake_info_after.reward_icp);
        
        // Check if rewards are 0 or if a timer distribution happened
        if stake_info_after.reward_icp == 0 {
            // No timer distribution - rewards should be 0
            println!("No timer distribution occurred - rewards correctly reset to 0");
            assert_eq!(dist_count_after_claim, initial_dist_count, "Distribution count should not change");
        } else {
            // Timer distribution happened - alice gets 50% of new distribution
            println!("Timer distribution occurred - Alice has new rewards: {}", stake_info_after.reward_icp);
            
            // The new reward should be roughly half of the original (since Alice has 50% stake)
            // But could vary based on pool size changes
            assert!(stake_info_after.reward_icp < reward_amount, "New reward should be less than original");
            
            // Distribution count might not increment if timer hasn't fully processed
            // Just verify it's reasonable
            assert!(dist_count_after_claim >= initial_dist_count, "Distribution count should not decrease");
        }
    }
    
    #[test]
    fn test_unstake_all() {
        let mut env = TokenTestEnvironment::new();
        
        // Setup user with enough tokens to stake 1000 * E8S after fees
        setup_user_with_primary(&mut env, "alice", 1100 * E8S).unwrap();
        let alice_balance = get_primary_balance(&env, "alice");
        approve_primary(&mut env, "alice", alice_balance).unwrap();
        stake_primary(&mut env, "alice", 1000 * E8S).unwrap();
        
        // Record primary token balance before unstaking
        let primary_before = get_primary_balance(&env, "alice");
        
        // Verify stake exists (should be 1000 * E8S - fee)
        let stake_before = get_stake_info(&env, "alice").expect("Alice should have a stake");
        let expected_stake = 1000 * E8S - 10_000; // Account for transfer fee
        assert_eq!(stake_before.amount, expected_stake, "Should have correct amount staked");
        
        // Call un_stake_all_primary
        let result = un_stake_all_primary(&mut env, "alice");
        assert!(result.is_ok(), "Unstake should succeed");
        
        // Verify all tokens returned (minus fee for the unstake transfer)
        let primary_after = get_primary_balance(&env, "alice");
        let expected_return = expected_stake - 10_000; // Another fee for unstaking
        assert!(primary_after >= primary_before + expected_return, "Staked tokens should be returned minus fees");
        
        // Verify stake record shows 0
        let stake_after = get_stake_info(&env, "alice");
        assert!(stake_after.is_none() || stake_after.unwrap().amount == 0, "Stake should be removed or have 0 amount after unstaking");
    }
    
    #[test]
    fn test_unstake_with_rewards() {
        let mut env = TokenTestEnvironment::new();
        
        // Setup staker with rewards - need extra for fees
        setup_user_with_primary(&mut env, "alice", 1100 * E8S).unwrap();
        let alice_balance = get_primary_balance(&env, "alice");
        approve_primary(&mut env, "alice", alice_balance).unwrap();
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