// Test just the staking functionality in isolation
use crate::integrated_token_tests::TokenTestEnvironment;
use crate::shared_helpers::*;
use candid::{CandidType, Encode, Principal, Nat};
use serde::Deserialize;
use icrc_ledger_types::icrc1::account::Account;

#[derive(CandidType, Deserialize, Debug)]
struct Stake {
    amount: u64,
    time: u64,
    reward_icp: u64,
}

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

#[cfg(test)]
mod staking_tests {
    use super::*;
    
    #[test]
    fn test_basic_staking() {
        let mut env = TokenTestEnvironment::new();
        
        // Give alice primary tokens using the proper helper
        setup_user_with_primary(&mut env, "alice", 1000 * E8S).expect("Failed to setup alice with primary tokens");
        
        // Check alice's balance
        let alice_balance = get_primary_balance(&env, "alice");
        println!("Alice primary balance: {} e8s", alice_balance);
        assert!(alice_balance > 0, "Alice should have primary tokens");
        
        // Check primary token fee first
        let fee_result = env.pic.query_call(
            env.primary_token,
            Principal::anonymous(),
            "icrc1_fee",
            Encode!().expect("Empty args")
        );
        
        match fee_result {
            Ok(bytes) => {
                let fee: Nat = candid::decode_one(&bytes).expect("Failed to decode fee");
                println!("Primary token fee: {:?}", fee);
            },
            Err(e) => println!("Failed to get fee: {:?}", e),
        }
        
        // Now try to stake
        let stake_amount = 100 * E8S;
        
        // Approve
        let approval = approve_primary(&mut env, "alice", stake_amount * 2);
        println!("Approval result: {:?}", approval);
        assert!(approval.is_ok(), "Approval should succeed");
        
        // Get balance before
        let balance_before = get_primary_balance(&env, "alice");
        
        // Stake
        let stake_result = stake_primary(&mut env, "alice", stake_amount);
        println!("Stake result: {:?}", stake_result);
        
        // Tick to ensure async operations complete
        env.pic.tick();
        env.pic.tick();
        
        // Check logs to see what happened
        let logs_result = env.pic.query_call(
            env.icp_swap,
            Principal::anonymous(),
            "get_logs",
            Encode!(&None::<u64>, &None::<u64>).expect("Failed to encode")
        );
        
        match logs_result {
            Ok(bytes) => {
                println!("Raw logs response length: {}", bytes.len());
                // Just print raw bytes for now
                println!("First 100 bytes of logs: {:?}", &bytes[..bytes.len().min(100)]);
            },
            Err(e) => println!("Failed to get logs: {:?}", e),
        }
        
        // Get balance after
        let balance_after = get_primary_balance(&env, "alice");
        println!("Balance before: {}, after: {}", balance_before, balance_after);
        
        // Check if tokens were transferred
        let tokens_moved = balance_before.saturating_sub(balance_after);
        println!("Tokens moved: {} e8s", tokens_moved);
        
        // Check stake info
        let stake_info = get_stake_info(&env, "alice");
        println!("Stake info: {:?}", stake_info);
        
        // Also check icp_swap balance
        let icp_swap_balance = get_canister_balance(&env, env.icp_swap, env.primary_token);
        println!("ICP Swap primary balance: {} e8s", icp_swap_balance);
        
        // Try to get all stakes
        let all_stakes_result = env.pic.query_call(
            env.icp_swap,
            Principal::anonymous(),
            "get_all_stakes",
            Encode!().expect("Empty args")
        );
        
        match all_stakes_result {
            Ok(bytes) => {
                let stakes: Vec<(Principal, Stake)> = candid::decode_one(&bytes)
                    .expect("Failed to decode all stakes");
                println!("All stakes: {:?}", stakes);
            },
            Err(e) => println!("Failed to get all stakes: {:?}", e),
        }
        
        assert!(stake_info.is_some(), "Alice should have stake info");
        if let Some(stake) = stake_info {
            // The staked amount will be less by the transfer fee (10,000 e8s)
            assert_eq!(stake.amount, stake_amount - 10_000, "Stake amount should match (minus fee)");
        }
    }
}