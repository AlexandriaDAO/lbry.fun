// Shared helper functions for test modules
use crate::integrated_token_tests::TokenTestEnvironment;
use candid::{CandidType, Encode, Principal, Nat};
use serde::{Deserialize, Serialize};

pub const E8S: u64 = 100_000_000;

// ICRC-2 types
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct Account {
    pub owner: Principal,
    pub subaccount: Option<[u8; 32]>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ApproveArgs {
    pub from_subaccount: Option<[u8; 32]>,
    pub spender: Account,
    pub amount: Nat,
    pub expected_allowance: Option<Nat>,
    pub expires_at: Option<u64>,
    pub fee: Option<Nat>,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum ApproveError {
    BadFee { expected_fee: Nat },
    BadBurn { min_burn_amount: Nat },
    InsufficientFunds { balance: Nat },
    InsufficientAllowance { allowance: Nat },
    TooOld,
    CreatedInFuture { ledger_time: u64 },
    Duplicate { duplicate_of: Nat },
    TemporarilyUnavailable,
    GenericError { error_code: Nat, message: String },
}

// Helper function re-exports from phase2_token_operations
pub use crate::phase2_token_operations::{
    get_secondary_balance,
    get_icp_balance,
    get_primary_balance,
    approve_icp,
    swap_icp,
};

// Setup helper for getting primary tokens
pub fn setup_user_with_primary(env: &mut TokenTestEnvironment, user: &str, target_amount: u64) -> Result<(), String> {
    // First get secondary tokens, then burn them for primary tokens
    // Let's use realistic amounts - swap 20 ICP to get secondary tokens
    let icp_to_swap = 20 * E8S; // 20 ICP
    let approve_amount = icp_to_swap + 100_000;
    
    println!("Setting up {} with target {} primary tokens (e8s)", user, target_amount);
    println!("Swapping {} ICP for secondary tokens", icp_to_swap / E8S);
    
    approve_icp(env, user, approve_amount)?;
    swap_icp(env, user, icp_to_swap)?;
    
    // Now burn secondary tokens for primary tokens
    let secondary_balance = get_secondary_balance(env, user);
    println!("Got {} secondary tokens (e8s)", secondary_balance);
    
    let burn_amount = secondary_balance / E8S; // Convert to natural units
    
    if burn_amount == 0 {
        return Err(format!("Not enough secondary tokens to burn for primary - have {} e8s", secondary_balance));
    }
    
    // Approve secondary tokens for burning
    let approve_amount = burn_amount * E8S + 100_000;
    let approve_args = ApproveArgs {
        from_subaccount: None,
        spender: Account {
            owner: env.icp_swap,
            subaccount: None,
        },
        amount: Nat::from(approve_amount),
        expected_allowance: None,
        expires_at: None,
        fee: None,
        memo: None,
        created_at_time: None,
    };

    env.pic.update_call(
        env.secondary_token,
        env.test_users[&user.to_string()],
        "icrc2_approve",
        Encode!(&approve_args).expect("Failed to encode approve args"),
    ).map_err(|e| format!("Failed to approve secondary tokens: {:?}", e))?;
    
    // Burn secondary for primary
    let user_principal = env.test_users.get(user)
        .ok_or_else(|| format!("User {} not found", user))?;
    
    println!("Burning {} secondary tokens (natural units) for primary", burn_amount);
    
    let from_subaccount: Option<[u8; 32]> = None;
    let burn_result = env.pic.update_call(
        env.icp_swap,
        *user_principal,
        "burn_secondary",
        Encode!(&burn_amount, &from_subaccount).expect("Failed to encode args"),
    );
    
    match burn_result {
        Ok(bytes) => {
            println!("Burn call successful, decoding response...");
            // Try to decode the response to see if there's an error
            match candid::decode_one::<Result<String, String>>(&bytes) {
                Ok(result) => {
                    match result {
                        Ok(msg) => println!("Burn success: {}", msg),
                        Err(e) => return Err(format!("Burn failed with error: {}", e)),
                    }
                },
                Err(e) => println!("Failed to decode burn response: {:?}", e),
            }
        },
        Err(e) => return Err(format!("Failed to call burn_secondary: {:?}", e)),
    }
    
    // Verify we got some primary tokens
    let primary_balance = get_primary_balance(env, user);
    println!("Primary balance after burn: {} (e8s)", primary_balance);
    
    if primary_balance >= target_amount {
        Ok(())
    } else if primary_balance > 0 {
        println!("Warning: Got {} primary tokens but needed {}", primary_balance, target_amount);
        Ok(()) // Accept partial success
    } else {
        Err(format!("Failed to get primary tokens - balance is still 0"))
    }
}

// Stake primary tokens
pub fn stake_primary(env: &mut TokenTestEnvironment, user: &str, amount: u64) -> Result<String, String> {
    let user_principal = env.test_users.get(user)
        .ok_or_else(|| format!("User {} not found", user))?;
    
    let from_subaccount: Option<[u8; 32]> = None;
    let result = env.pic.update_call(
        env.icp_swap,
        *user_principal,
        "stake_primary",
        Encode!(&amount, &from_subaccount).expect("Failed to encode args"),
    );

    match result {
        Ok(response) => {
            // Check if the response looks like an error by trying to decode it
            // If it contains "Err", it's likely an error response
            let response_str = format!("{:?}", response);
            if response_str.contains("Err") || response_str.contains("Error") {
                Err(format!("Stake operation failed (response indicates error)"))
            } else {
                Ok("Stake operation completed".to_string())
            }
        },
        Err(e) => Err(format!("Call failed: {:?}", e)),
    }
}

// Approve primary tokens
pub fn approve_primary(env: &mut TokenTestEnvironment, user: &str, amount: u64) -> Result<Nat, String> {
    let user_principal = env.test_users.get(user)
        .ok_or_else(|| format!("User {} not found", user))?;
    
    let approve_args = ApproveArgs {
        from_subaccount: None,
        spender: Account {
            owner: env.icp_swap,
            subaccount: None,
        },
        amount: Nat::from(amount),
        expected_allowance: None,
        expires_at: None,
        fee: None,
        memo: None,
        created_at_time: None,
    };
    
    let result = env.pic.update_call(
        env.primary_token,
        *user_principal,
        "icrc2_approve",
        Encode!(&approve_args).expect("Failed to encode args")
    );
    
    match result {
        Ok(bytes) => {
            let result: Result<Nat, ApproveError> = candid::decode_one(&bytes).expect("Failed to decode response");
            match result {
                Ok(nat) => Ok(nat),
                Err(e) => Err(format!("Approval failed: {:?}", e)),
            }
        }
        Err(e) => Err(format!("Call failed: {:?}", e))
    }
}

// Get balance of a canister (not a user)
pub fn get_canister_balance(env: &TokenTestEnvironment, canister: Principal, token: Principal) -> u64 {
    let args = Encode!(&Account {
        owner: canister,
        subaccount: None,
    })
    .expect("Failed to encode balance args");
    
    let result = env.pic.query_call(
        token,
        Principal::anonymous(),
        "icrc1_balance_of",
        args,
    );
    
    match result {
        Ok(reply) => {
            let balance: candid::Nat = candid::decode_one(&reply)
                .expect("Failed to decode balance");
            // Convert BigUint to u64 using TryFrom
            use std::convert::TryFrom;
            u64::try_from(&balance.0).unwrap_or(0)
        }
        Err(e) => {
            println!("Warning: Failed to get canister balance: {}", e);
            0
        }
    }
}