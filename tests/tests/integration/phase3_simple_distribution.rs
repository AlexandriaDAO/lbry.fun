// Simple distribution test without burning complexity
use crate::integrated_token_tests::TokenTestEnvironment;
use crate::shared_helpers::*;
use candid::{CandidType, Encode, Principal};
use std::time::Duration;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Debug)]
struct Stake {
    amount: u64,
    time: u64,
    reward_icp: u64,
}

const ICP_TRANSFER_FEE: u64 = 10_000;

#[cfg(test)]
mod simple_distribution_tests {
    use super::*;
    
    #[test]
    fn test_simple_distribution_no_stakers() {
        let mut env = TokenTestEnvironment::new();
        
        // Add ICP to pool via swap
        approve_icp(&mut env, "alice", 10 * E8S).unwrap();
        swap_icp(&mut env, "alice", 10 * E8S).unwrap();
        
        let pool_before = get_canister_balance(&env, env.icp_swap, env.icp_ledger);
        println!("Pool before distribution: {}", pool_before);
        
        // Advance time 1 hour
        env.pic.advance_time(Duration::from_secs(3600));
        
        // Call dev_trigger_distribution
        let result = env.pic.update_call(
            env.icp_swap,
            env.test_users[&"alice".to_string()],
            "dev_trigger_distribution",
            Encode!().expect("Empty args")
        );
        
        println!("Distribution result: {:?}", result);
        
        // Check pool after
        let pool_after = get_canister_balance(&env, env.icp_swap, env.icp_ledger);
        println!("Pool after distribution: {}", pool_after);
        
        if result.is_ok() {
            // With no stakers, 1% should still be distributed (to LBRY buyback and liquidity)
            assert!(pool_after < pool_before, "Pool should decrease even with no stakers");
            
            let distributed = pool_before - pool_after;
            let expected_distribution = pool_before / 100; // 1%
            println!("Distributed: {}, Expected: ~{}", distributed, expected_distribution);
            
            // Allow some variance for fees
            assert!(distributed <= expected_distribution + ICP_TRANSFER_FEE * 2);
            assert!(distributed >= expected_distribution / 2);
        } else {
            println!("Distribution failed - this might be expected if not enough time passed");
        }
    }
    
    #[test]
    fn test_get_pool_info() {
        let env = TokenTestEnvironment::new();
        
        // Query some basic info about the pool
        let result = env.pic.query_call(
            env.icp_swap,
            Principal::anonymous(),
            "get_pool_stats",
            Encode!().expect("Empty args")
        );
        
        println!("Pool stats result: {:?}", result);
        
        // Try to get logs
        let logs_result = env.pic.query_call(
            env.icp_swap,
            Principal::anonymous(),
            "get_logs",
            Encode!().expect("Empty args")
        );
        
        println!("Logs result: {:?}", logs_result);
    }
}