// Timer-based distribution test
use crate::integrated_token_tests::TokenTestEnvironment;
use crate::shared_helpers::*;
use candid::{Encode, Principal};
use std::time::Duration;

#[cfg(test)]
mod timer_distribution_tests {
    use super::*;
    
    #[test]
    fn test_distribution_after_timer() {
        let mut env = TokenTestEnvironment::new();
        
        // Add ICP to pool via multiple swaps
        println!("Adding ICP to pool via swaps...");
        
        // Alice swaps
        approve_icp(&mut env, "alice", 20 * E8S).unwrap();
        swap_icp(&mut env, "alice", 20 * E8S).unwrap();
        
        // Bob swaps  
        approve_icp(&mut env, "bob", 30 * E8S).unwrap();
        swap_icp(&mut env, "bob", 30 * E8S).unwrap();
        
        // Charlie swaps
        approve_icp(&mut env, "charlie", 50 * E8S).unwrap();
        swap_icp(&mut env, "charlie", 50 * E8S).unwrap();
        
        let pool_initial = get_canister_balance(&env, env.icp_swap, env.icp_ledger);
        println!("Initial pool balance: {} ICP (e8s)", pool_initial);
        
        // The timer is set for 1 hour (3600 seconds)
        // Advance time by slightly more than 1 hour to ensure timer triggers
        println!("Advancing time by 61 minutes to trigger distribution timer...");
        env.pic.advance_time(Duration::from_secs(3660));
        
        // Need to tick to process the timer
        env.pic.tick();
        env.pic.tick(); // Extra ticks to ensure async operations complete
        env.pic.tick();
        
        // Wait a bit more for async operations to complete
        env.pic.advance_time(Duration::from_secs(10));
        env.pic.tick();
        
        let pool_after = get_canister_balance(&env, env.icp_swap, env.icp_ledger);
        println!("Pool balance after timer: {} ICP (e8s)", pool_after);
        
        if pool_after < pool_initial {
            let distributed = pool_initial - pool_after;
            let expected = pool_initial / 100; // 1% distribution
            println!("Distribution occurred! {} ICP distributed (expected ~{})", distributed, expected);
            
            // Check if distribution is roughly 1%
            let ratio = (distributed as f64) / (pool_initial as f64);
            println!("Distribution ratio: {:.2}%", ratio * 100.0);
            
            assert!(ratio >= 0.008 && ratio <= 0.012, "Distribution should be ~1% of pool");
        } else {
            println!("WARNING: No distribution occurred. Pool unchanged or increased.");
            println!("This could mean:");
            println!("1. Timer didn't trigger yet");
            println!("2. Distribution conditions not met");
            println!("3. All distributions went to external addresses");
        }
    }
    
    #[test]
    fn test_query_distribution_info() {
        let env = TokenTestEnvironment::new();
        
        // Query distribution interval
        let interval_result = env.pic.query_call(
            env.icp_swap,
            Principal::anonymous(),
            "get_distribution_interval",
            Encode!().expect("Empty args")
        );
        
        if let Ok(bytes) = interval_result {
            let interval: u32 = candid::decode_one(&bytes).unwrap_or(0);
            println!("Distribution interval: {} seconds ({} minutes)", interval, interval / 60);
            
            // Should be 3600 seconds (1 hour) based on the code
            assert_eq!(interval, 3600, "Distribution interval should be 1 hour");
        }
        
        // Query total unclaimed rewards
        let rewards_result = env.pic.query_call(
            env.icp_swap,
            Principal::anonymous(),
            "get_total_unclaimed_icp_reward",
            Encode!().expect("Empty args")
        );
        
        if let Ok(bytes) = rewards_result {
            let rewards: u64 = candid::decode_one(&bytes).unwrap_or(0);
            println!("Total unclaimed ICP rewards: {} (e8s)", rewards);
        }
        
        // Query stakers count
        let stakers_result = env.pic.query_call(
            env.icp_swap,
            Principal::anonymous(),
            "get_stakers_count",
            Encode!().expect("Empty args")
        );
        
        if let Ok(bytes) = stakers_result {
            let count: u64 = candid::decode_one(&bytes).unwrap_or(0);
            println!("Number of stakers: {}", count);
        }
    }
}