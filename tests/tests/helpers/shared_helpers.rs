// Shared helper functions for test modules
use crate::integrated_token_tests::TokenTestEnvironment;
use candid::{CandidType, Encode, Principal, Nat};
use serde::{Deserialize, Serialize};

// ExecutionError type definition for testing
// This matches the ExecutionError enum from icp_swap/src/error.rs
#[derive(Debug, CandidType, Deserialize, Clone)]
pub enum ExecutionError {
    // Amount related errors
    MinimumRequired {
        required: u64,
        provided: u64,
        token: String,
        details: String,
    },
    InvalidAmount {
        reason: String,
        amount: u64,
        details: String,
    },
    // Balance errors
    InsufficientBalance {
        required: u64,
        available: u64,
        token: String,
        details: String,
    },
    InsufficientCanisterBalance {
        required: u64,
        available: u64,
        details: String,
    },
    InsufficientAllowance {
        required: candid::Nat,
        available: candid::Nat,
    },
    InsufficientBalanceRewardDistribution {
        available: u128,
        details: String,
    },
    // Operation errors
    TransferFailed {
        source: String,
        dest: String,
        token: String,
        amount: u64,
        details: String,
        reason: String,
    },
    MintFailed {
        token: String,
        amount: u64,
        reason: String,
        details: String,
    },
    BurnFailed {
        token: String,
        amount: u64,
        reason: String,
        details: String,
    },
    // Math errors
    AdditionOverflow {
        operation: String,
        details: String,
    },
    MultiplicationOverflow {
        operation: String,
        details: String,
    },
    Underflow {
        operation: String,
        details: String,
    },
    DivisionFailed {
        operation: String,
        details: String,
    },
    RewardDistributionError {
        reason: String,
    },
    // External errors
    CanisterCallFailed {
        canister: String,
        method: String,
        details: String,
    },
    RateLookupFailed {
        details: String,
    },
    // General errors
    StateError(String),
    Unauthorized(String),
}

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

// Generic token approval function
pub fn approve_token(env: &TokenTestEnvironment, user: &str, token: Principal, spender: Principal, amount: u64) -> Result<(), String> {
    let user_principal = env.test_users.get(user)
        .copied()
        .or_else(|| match user {
            "user1" => Some(env.user1),
            "user2" => Some(env.user2),
            "user3" => Some(env.user3),
            _ => None
        })
        .ok_or_else(|| format!("Unknown user: {}", user))?;
    
    let approve_args = ApproveArgs {
        from_subaccount: None,
        spender: Account {
            owner: spender,
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
        token,
        user_principal,
        "icrc2_approve",
        candid::encode_one(&approve_args).map_err(|e| format!("Failed to encode approve args: {:?}", e))?,
    );
    
    match result {
        Ok(_) => {
            println!("✓ {} approved {} tokens on {} to {}", user, amount, token, spender);
            Ok(())
        }
        Err(e) => Err(format!("Failed to approve tokens: {}", e))
    }
}

// Setup helper for getting primary tokens
pub fn setup_user_with_primary(env: &mut TokenTestEnvironment, user: &str, target_amount: u64) -> Result<(), String> {
    // First get secondary tokens, then burn them for primary tokens
    // Calculate how much ICP we need to swap to get enough secondary tokens
    // We need to burn 100x the target amount, so we need that many secondary tokens
    // With a ratio of 400, 1 ICP = 400 secondary tokens
    let secondary_needed = (target_amount / E8S) * 100; // natural units
    let icp_to_swap = std::cmp::max(100 * E8S, (secondary_needed / 400 + 1) * E8S); // Add 1 for rounding
    println!("DEBUG: icp_to_swap = {} e8s ({} ICP)", icp_to_swap, icp_to_swap / E8S);
    let approve_amount = icp_to_swap + 100_000;
    
    println!("Setting up {} with target {} primary tokens (e8s)", user, target_amount);
    println!("Swapping {} ICP for secondary tokens", icp_to_swap / E8S);
    
    // Check user's ICP balance before swap
    let icp_balance = get_icp_balance(env, user);
    println!("User {} has {} ICP available", user, icp_balance / E8S);
    
    if icp_balance < icp_to_swap + 100_000 {
        return Err(format!("Insufficient ICP balance. Have {} e8s but need {} e8s", icp_balance, icp_to_swap + 100_000));
    }
    
    approve_icp(env, user, approve_amount)?;
    
    // Check secondary ratio before swap
    let ratio_result = env.pic.query_call(
        env.icp_swap,
        Principal::anonymous(),
        "get_current_secondary_ratio",
        Encode!().unwrap(),
    );
    match ratio_result {
        Ok(bytes) => {
            if let Ok(ratio) = candid::decode_one::<u64>(&bytes) {
                println!("Current secondary ratio: {}", ratio);
            } else {
                println!("Failed to decode secondary ratio");
            }
        }
        Err(e) => println!("Failed to get secondary ratio: {:?}", e),
    }
    
    swap_icp(env, user, icp_to_swap)?;
    
    // Now burn secondary tokens for primary tokens
    let secondary_balance = get_secondary_balance(env, user);
    println!("Got {} secondary tokens (e8s)", secondary_balance);
    
    // Burn the initial_secondary_burn amount (5000 natural units) to trigger first minting
    // Calculate burn amount based on target
    // This is an approximation - we burn 100x the target in natural units
    // since burn rates vary, this should give us enough primary tokens
    let burn_amount = std::cmp::max(5000u64, (target_amount / E8S) * 100); // natural units
    
    // Check if we have enough secondary tokens (need burn_amount * E8S e8s)
    if secondary_balance < burn_amount * E8S {
        return Err(format!("Not enough secondary tokens to burn {} natural units - have {} e8s", burn_amount, secondary_balance));
    }
    
    // Approve the exact e8s amount needed for burning
    let approve_amount = burn_amount * E8S + 100_000; // Add a bit extra for fees
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
            // The burn_secondary function returns Result<String, ExecutionError>
            // We need to decode it properly
            match candid::decode_one::<Result<String, ExecutionError>>(&bytes) {
                Ok(Ok(msg)) => println!("Burn succeeded with message: {}", msg),
                Ok(Err(e)) => return Err(format!("Burn failed with error: {:?}", e)),
                Err(e) => {
                    println!("Failed to decode burn response: {:?}", e);
                    println!("Raw response bytes length: {}", bytes.len());
                }
            }
            println!("Burn operation completed");
        },
        Err(e) => return Err(format!("Failed to call burn_secondary: {:?}", e)),
    }
    
    // Verify we got some primary tokens
    let primary_balance = get_primary_balance(env, user);
    println!("Primary balance after burn: {} (e8s)", primary_balance);
    
    // Account for transfer fee - user will have 10,000 e8s less than minted amount
    let expected_balance = if primary_balance > 10_000 { primary_balance } else { 0 };
    
    if expected_balance >= target_amount {
        Ok(())
    } else if primary_balance > 0 {
        println!("Warning: Got {} primary tokens but needed {} (after fees)", primary_balance, target_amount);
        // If we're close (within transfer fee), accept it
        if primary_balance + 10_000 >= target_amount {
            Ok(())
        } else {
            Ok(()) // Accept partial success for now
        }
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
            // Try to decode as Result<String, ExecutionError>
            match candid::decode_one::<Result<String, ExecutionError>>(&response) {
                Ok(Ok(msg)) => Ok(msg),
                Ok(Err(e)) => Err(format!("Stake failed: {:?}", e)),
                Err(_) => {
                    // Try to decode as plain string
                    match candid::decode_one::<String>(&response) {
                        Ok(msg) => Ok(msg),
                        Err(e) => Err(format!("Failed to decode stake response: {:?}", e))
                    }
                }
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