use candid::Principal;
use ic_cdk::query;
use ic_cdk_timers::set_timer_interval;
use std::cell::RefCell;
use std::time::Duration;

// Constants
const MIN_ICP_BALANCE: u64 = 100_000_000;  // 1 ICP threshold
const ICP_RESERVE: u64 = 10_000_000;       // 0.1 ICP reserve for fees
// const CHECK_INTERVAL: u64 = 3600;          // Check every hour
const CHECK_INTERVAL: u64 = 60;   // Once per minute for testing.
const CORE_ICP_SWAP_CANISTER: &str = "54fqz-5iaaa-aaaap-qkmqa-cai"; // Core LBRY swap
const LBRY_CANISTER_ID: &str = "y33wz-myaaa-aaaap-qkmna-cai";
const LBRY_BURN_PRINCIPAL: &str = "54fqz-5iaaa-aaaap-qkmqa-cai"; // Same as core swap (minting account)

// Main state
thread_local! {
    static TOTAL_BURNED: RefCell<u64> = RefCell::new(0);
    static LAST_SWAP_TIME: RefCell<u64> = RefCell::new(0);
    static LAST_SWAP_AMOUNT: RefCell<u64> = RefCell::new(0);
}

// Initialize simple check timer
pub fn init_swap_timer() {
    set_timer_interval(
        Duration::from_secs(CHECK_INTERVAL), 
        || {
            ic_cdk::spawn(async {
                let _ = check_and_swap().await;
            });
        }
    );
}

// Simple check and swap function
async fn check_and_swap() -> Result<String, String> {
    use ic_ledger_types::{AccountBalanceArgs, AccountIdentifier, MAINNET_LEDGER_CANISTER_ID};
    
    // Check ICP balance
    let canister_id = ic_cdk::api::id();
    let account_id = AccountIdentifier::new(&canister_id, &ic_ledger_types::DEFAULT_SUBACCOUNT);
    
    let balance_args = AccountBalanceArgs { account: account_id };
    let icp_balance_result: Result<(ic_ledger_types::Tokens,), _> = ic_cdk::call(
        MAINNET_LEDGER_CANISTER_ID,
        "account_balance",
        (balance_args,),
    ).await;
    
    let icp_balance = match icp_balance_result {
        Ok((tokens,)) => tokens.e8s(),
        Err(_) => return Ok("Could not check balance".to_string()),
    };
    
    // Only proceed if we have more than 1 ICP
    if icp_balance < MIN_ICP_BALANCE {
        return Ok(format!("Balance {} below threshold", icp_balance));
    }
    
    // Execute swap and burn
    execute_swap_and_burn().await
}

// Execute swap and burn - simplified balance-based approach
async fn execute_swap_and_burn() -> Result<String, String> {
    use icrc_ledger_types::icrc1::account::Account;
    use ic_ledger_types::{AccountBalanceArgs, AccountIdentifier, MAINNET_LEDGER_CANISTER_ID};
    
    // Step 1: Check ICP balance
    let canister_id = ic_cdk::api::id();
    let account_id = AccountIdentifier::new(&canister_id, &ic_ledger_types::DEFAULT_SUBACCOUNT);
    
    let balance_args = AccountBalanceArgs { account: account_id };
    let icp_balance_result: Result<(ic_ledger_types::Tokens,), _> = ic_cdk::call(
        MAINNET_LEDGER_CANISTER_ID,
        "account_balance",
        (balance_args,),
    ).await;
    
    let icp_balance = match icp_balance_result {
        Ok((tokens,)) => tokens.e8s(),
        Err(e) => return Err(format!("Failed to get ICP balance: {:?}", e)),
    };
    
    // Only proceed if balance is above minimum threshold
    if icp_balance < MIN_ICP_BALANCE {
        return Ok(format!("ICP balance {} below minimum {}", icp_balance, MIN_ICP_BALANCE));
    }
    
    // Calculate swap amount (leave some reserve for fees)
    let swap_amount = icp_balance.saturating_sub(ICP_RESERVE);
    
    // Swap ICP for LBRY using the core project's ICP_SWAP canister
    let core_swap_canister = Principal::from_text(CORE_ICP_SWAP_CANISTER)
        .map_err(|e| format!("Invalid core ICP swap canister ID: {}", e))?;
    
    // Call the swap function on the core project's ICP_SWAP canister
    let swap_result: Result<(Result<String, String>,), _> = ic_cdk::call(
        core_swap_canister,
        "swap",
        (swap_amount, None::<[u8; 32]>),
    ).await;
    
    match swap_result {
        Ok((Ok(success_msg),)) => {
            ic_cdk::println!("Successfully swapped {} ICP: {}", swap_amount, success_msg);
        }
        Ok((Err(e),)) => {
            return Err(format!("Swap failed: {}", e));
        }
        Err(e) => {
            return Err(format!("Swap call failed: {:?}", e));
        }
    }
    
    // Check actual LBRY balance and burn all of it
    let lbry_principal = Principal::from_text(LBRY_CANISTER_ID)
        .map_err(|e| format!("Invalid LBRY canister ID: {}", e))?;
    
    let lbry_account = Account {
        owner: canister_id,
        subaccount: None,
    };
    
    // Check LBRY balance
    let balance_result: Result<(candid::Nat,), _> = ic_cdk::call(
        lbry_principal,
        "icrc1_balance_of",
        (lbry_account,),
    ).await;
    
    let lbry_balance = match balance_result {
        Ok((balance,)) => {
            // Convert Nat to u64
            let balance_str = balance.to_string();
            balance_str.parse::<u64>().unwrap_or(0)
        }
        Err(e) => {
            // Non-fatal: LBRY may not have arrived yet
            return Ok(format!("Swap completed but couldn't check LBRY balance: {:?}", e));
        }
    };
    
    if lbry_balance == 0 {
        return Ok("Swap completed but no LBRY balance to burn".to_string());
    }
    
    // Burn ALL LBRY tokens
    let burn_principal = Principal::from_text(LBRY_BURN_PRINCIPAL)
        .map_err(|e| format!("Invalid burn principal: {}", e))?;
    
    let burn_args = icrc_ledger_types::icrc1::transfer::TransferArg {
        from_subaccount: None,
        to: Account {
            owner: burn_principal,
            subaccount: None,
        },
        fee: None,
        created_at_time: None,
        memo: None,
        amount: candid::Nat::from(lbry_balance),
    };
    
    // Execute burn transfer
    let burn_result: Result<(Result<candid::Nat, icrc_ledger_types::icrc1::transfer::TransferError>,), _> = ic_cdk::call(
        lbry_principal,
        "icrc1_transfer",
        (burn_args,),
    ).await;
    
    match burn_result {
        Ok((Ok(_block_index),)) => {
            // Update total burned tracking
            TOTAL_BURNED.with(|total| {
                *total.borrow_mut() = total.borrow().saturating_add(lbry_balance);
            });
            
            LAST_SWAP_TIME.with(|t| *t.borrow_mut() = ic_cdk::api::time());
            LAST_SWAP_AMOUNT.with(|a| *a.borrow_mut() = swap_amount);
            
            Ok(format!(
                "Successfully swapped {} ICP and burned {} LBRY. Total burned: {} LBRY",
                swap_amount,
                lbry_balance,
                TOTAL_BURNED.with(|t| *t.borrow())
            ))
        }
        Ok((Err(e),)) => {
            // Non-fatal: LBRY will be burned in next cycle
            Ok(format!("Swap succeeded, burn will retry next cycle: {:?}", e))
        }
        Err(e) => {
            // Non-fatal: LBRY will be burned in next cycle
            Ok(format!("Swap succeeded, burn will retry next cycle: {:?}", e))
        }
    }
}

// Query functions
#[query]
pub fn get_swap_stats() -> (u64, u64, u64) {
    (
        TOTAL_BURNED.with(|t| *t.borrow()),
        LAST_SWAP_TIME.with(|t| *t.borrow()),
        LAST_SWAP_AMOUNT.with(|a| *a.borrow()),
    )
}