use crate::integrated_token_tests::TokenTestEnvironment;
use crate::shared_helpers::{ExecutionError, E8S, Account, ApproveArgs};
use candid::{Encode, Nat, Principal};

/// Test the EXACT burn_unit=1 vulnerability as described in the master plan
#[cfg(test)]
mod burn_unit_one_exact_tests {
    use super::*;

    #[test]
    fn test_burn_unit_literally_one() {
        let mut env = TokenTestEnvironment::new();
        
        println!("\n=== Testing EXACT burn_unit=1 vulnerability ===");
        
        // Create token with LITERAL burn_unit = 1 (not 1 * E8S)
        let (primary_token, secondary_token, tokenomics, icp_swap, logs) = env
            .create_token_with_config(
                "Literal One Token",
                "VULN",
                1,                   // burn_unit: LITERALLY 1 (not 1 * E8S)
                1_000_000,           // initial_reward: 1M 
                21_000_000 * E8S,    // max_supply: 21M tokens in e8s
                50,                  // halving_step: 50%
            )
            .expect("Failed to create vulnerable token");

        // Use user1 as the attacker
        let attacker = env.user1;
        
        // Get the tokenomics schedule to see actual values
        let schedule_result = env.pic.query_call(
            tokenomics,
            Principal::anonymous(),
            "get_tokenomics_schedule",
            candid::encode_one(()).unwrap(),
        ).unwrap();
        
        #[derive(candid::CandidType, candid::Deserialize, Debug)]
        struct TokenomicsSchedule {
            secondary_burn_thresholds: Vec<u64>,
            primary_mint_per_threshold: Vec<u64>,
        }
        
        let schedule: TokenomicsSchedule = candid::decode_one(&schedule_result).unwrap();
        println!("Tokenomics schedule:");
        println!("  First threshold: {}", schedule.secondary_burn_thresholds[0]);
        println!("  First reward per burn: {}", schedule.primary_mint_per_threshold[0]);
        
        // Approve ICP for swap
        let approve_args = ApproveArgs {
            from_subaccount: None,
            spender: Account {
                owner: icp_swap,
                subaccount: None,
            },
            amount: Nat::from(10 * E8S + 100_000),
            expected_allowance: None,
            expires_at: None,
            fee: None,
            memo: None,
            created_at_time: None,
        };
        
        env.pic.update_call(
            env.icp_ledger,
            attacker,
            "icrc2_approve",
            candid::encode_one(&approve_args).unwrap(),
        ).unwrap();
        
        // Swap for secondary tokens
        let swap_result = env.pic.update_call(
            icp_swap,
            attacker,
            "swap",
            candid::encode_args((10 * E8S, None::<[u8; 32]>)).unwrap(),
        );
        assert!(swap_result.is_ok(), "Swap failed: {:?}", swap_result);
        
        let secondary_balance = env.get_balance("user1", secondary_token);
        println!("Secondary balance after swap: {} e8s", secondary_balance);
        
        // Now the critical test: burn EXACTLY 1 secondary token
        // Note: burn_secondary expects natural units
        approve_token(&env, "user1", secondary_token, icp_swap, 1 * E8S).unwrap();
        
        let initial_primary = env.get_balance("user1", primary_token);
        
        let burn_result: Result<String, ExecutionError> = env.pic.update_call(
            icp_swap,
            attacker,
            "burn_secondary",
            candid::encode_one(1u64).unwrap(), // Burn 1 natural unit
        ).map_err(|e| ExecutionError::StateError(format!("{:?}", e)))
        .and_then(|res| {
            candid::decode_one::<Result<String, String>>(&res)
                .map_err(|e| ExecutionError::StateError(format!("Decode error: {:?}", e)))
                .and_then(|inner| inner.map_err(|e| ExecutionError::StateError(e)))
        });

        println!("Burn result: {:?}", burn_result);
        
        let final_primary = env.get_balance("user1", primary_token);
        let primary_minted = final_primary - initial_primary;
        
        println!("\nRESULTS:");
        println!("  Burned: 1 secondary token (natural unit)");
        println!("  Minted: {} e8s = {} primary tokens", primary_minted, primary_minted / E8S);
        
        // Calculate what the formula would give us:
        // reward = primary_mint_per_threshold[0] * secondary_burn_amount * 10000
        // If primary_mint_per_threshold[0] = 1,000,000 and secondary_burn_amount = 1:
        // reward = 1,000,000 * 1 * 10,000 = 10,000,000,000
        let expected_exploit_mint = schedule.primary_mint_per_threshold[0] * 1 * 10000;
        println!("\nEXPECTED from formula: {} e8s = {} tokens", 
                expected_exploit_mint, expected_exploit_mint / E8S);
        
        // The vulnerability exists if burning 1 token mints an excessive amount
        let max_reasonable_per_burn = 1000 * E8S; // At most 1000 tokens per burn
        
        if primary_minted > max_reasonable_per_burn {
            panic!("VULNERABILITY CONFIRMED: Burning 1 secondary token minted {} primary tokens!", 
                   primary_minted / E8S);
        } else {
            println!("No vulnerability: Only {} tokens minted", primary_minted / E8S);
        }
    }
}

// Helper function
fn approve_token(env: &TokenTestEnvironment, user: &str, token: Principal, spender: Principal, amount: u64) -> Result<(), String> {
    use crate::shared_helpers::approve_token as approve;
    approve(env, user, token, spender, amount)
}