// Simple distribution test without burning complexity
use crate::integrated_token_tests::TokenTestEnvironment;
use crate::shared_helpers::*;
use candid::{CandidType, Decode, Encode, Principal};
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
        approve_icp(&mut env, "alice", 10 * E8S + 100_000).unwrap();
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
        
        // Check pool after
        let pool_after = get_canister_balance(&env, env.icp_swap, env.icp_ledger);
        println!("Pool after distribution: {}", pool_after);
        
        // Decode the result
        match result {
            Ok(response) => {
                let decoded: Result<String, String> = Decode!(&response, Result<String, String>).expect("Failed to decode");
                println!("Distribution result: {:?}", decoded);
                
                // The distribution returns an error when no stakers exist, but still distributes to SECONDARY and LP
                if decoded.is_err() {
            // Even though it returns an error, SECONDARY fee (1% of distribution) and LP treasury (49.5% of distribution) 
            // should still be distributed before the error
            assert!(pool_after < pool_before, "Pool should decrease even with error");
            
            let distributed = pool_before - pool_after;
            let total_1_percent = pool_before / 100; // 1% of pool to be distributed
            let expected_secondary_fee = total_1_percent / 100; // 1% of the distribution (1% of 1% = 0.01% of pool)
            
            println!("Distributed: {}, Expected SECONDARY fee: ~{}", distributed, expected_secondary_fee);
            
            // Only the SECONDARY fee is transferred out; LP treasury is tracked internally
            // SECONDARY gets 1% of the 1% distribution = 0.01% of total pool
            // Allow for transfer fees
            assert!(distributed >= expected_secondary_fee.saturating_sub(ICP_TRANSFER_FEE));
            assert!(distributed <= expected_secondary_fee + ICP_TRANSFER_FEE);
                } else {
                    panic!("Expected distribution to fail when no stakers exist");
                }
            }
            Err(e) => panic!("Failed to call dev_trigger_distribution: {:?}", e),
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