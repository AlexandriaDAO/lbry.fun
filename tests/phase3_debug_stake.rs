// Debug staking issue
use crate::integrated_token_tests::TokenTestEnvironment;
use crate::shared_helpers::*;
use candid::{CandidType, Encode, Principal, Nat};
use serde::Deserialize;
use icrc_ledger_types::icrc1::account::Account;

#[cfg(test)]
mod debug_staking {
    use super::*;
    
    #[test]
    fn test_stake_debug() {
        let mut env = TokenTestEnvironment::new();
        
        // Give alice primary tokens
        let transfer_args = icrc_ledger_types::icrc1::transfer::TransferArg {
            from_subaccount: None,
            to: Account {
                owner: env.test_users[&"alice".to_string()],
                subaccount: None,
            },
            fee: None,
            created_at_time: None,
            memo: None,
            amount: Nat::from(10000 * E8S),
        };
        
        env.pic.update_call(
            env.primary_token,
            env.icp_swap,
            "icrc1_transfer",
            Encode!(&transfer_args).expect("Failed to encode"),
        ).expect("Transfer should work");
        
        // Check balances
        let alice_balance = get_primary_balance(&env, "alice");
        let icp_swap_balance = get_canister_balance(&env, env.icp_swap, env.primary_token);
        println!("Alice balance: {} e8s", alice_balance);
        println!("ICP Swap balance before: {} e8s", icp_swap_balance);
        
        // Approve a large amount
        approve_primary(&mut env, "alice", 5000 * E8S).unwrap();
        
        // Now let's manually call stake_primary with raw candid
        let stake_amount = 1000 * E8S;
        let from_subaccount: Option<[u8; 32]> = None;
        
        println!("\nCalling stake_primary with amount: {}", stake_amount);
        
        let result = env.pic.update_call(
            env.icp_swap,
            env.test_users[&"alice".to_string()],
            "stake_primary",
            Encode!(&stake_amount, &from_subaccount).expect("Failed to encode"),
        );
        
        match result {
            Ok(bytes) => {
                println!("Raw response bytes length: {}", bytes.len());
                println!("First 200 bytes: {:?}", &bytes[..bytes.len().min(200)]);
                
                // Try to decode as variant
                #[derive(CandidType, Deserialize, Debug)]
                enum StakeResponse {
                    Ok(String),
                    Err(serde_bytes::ByteBuf), // Use ByteBuf for complex error type
                }
                
                match candid::decode_one::<StakeResponse>(&bytes) {
                    Ok(response) => println!("Decoded response: {:?}", response),
                    Err(e) => println!("Failed to decode: {}", e),
                }
            },
            Err(e) => println!("Call failed: {:?}", e),
        }
        
        // Check balances after
        let alice_after = get_primary_balance(&env, "alice");
        let icp_swap_after = get_canister_balance(&env, env.icp_swap, env.primary_token);
        
        println!("\nAfter stake:");
        println!("Alice balance: {} e8s (change: {})", alice_after, alice_balance - alice_after);
        println!("ICP Swap balance: {} e8s (change: {})", icp_swap_after, icp_swap_after - icp_swap_balance);
        
        // Check if stake was recorded
        let stake_result = env.pic.query_call(
            env.icp_swap,
            Principal::anonymous(),
            "get_stake",
            Encode!(&env.test_users[&"alice".to_string()]).expect("Failed to encode")
        );
        
        match stake_result {
            Ok(bytes) => {
                println!("\nget_stake response length: {}", bytes.len());
                println!("Raw bytes: {:?}", &bytes[..bytes.len().min(50)]);
            },
            Err(e) => println!("get_stake failed: {:?}", e),
        }
    }
}