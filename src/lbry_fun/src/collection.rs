use candid::Principal;
use ic_cdk::query;
use ic_cdk_timers::set_timer_interval;
use std::cell::RefCell;
use std::time::Duration;

// Configuration constants
const MIN_ICP_BALANCE: u64 = 100_000_000;  // 1 ICP minimum to trigger forward
const ICP_RESERVE: u64 = 10_000_000;       // 0.1 ICP reserve for fees
const CHECK_INTERVAL: u64 = 3600;          // Check every hour

// Simple state tracking
thread_local! {
    static TOTAL_FORWARDED: RefCell<u64> = RefCell::new(0);
    static LAST_FORWARD_TIME: RefCell<u64> = RefCell::new(0);
    static LAST_FORWARD_AMOUNT: RefCell<u64> = RefCell::new(0);
}

// Initialize simple check timer
pub fn init_swap_timer() {
    set_timer_interval(
        Duration::from_secs(CHECK_INTERVAL),
        || {
            ic_cdk::spawn(async {
                let _ = check_and_forward().await;
            });
        }
    );
}

// Simple check and forward function
async fn check_and_forward() -> Result<String, String> {
    use ic_ledger_types::{AccountBalanceArgs, AccountIdentifier, MAINNET_LEDGER_CANISTER_ID};

    ic_cdk::println!("FORWARD_TIMER: Checking balance for forwarding...");

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
        Err(e) => {
            ic_cdk::println!("FORWARD_TIMER: Failed to check balance: {:?}", e);
            return Ok("Could not check balance".to_string());
        }
    };

    ic_cdk::println!("FORWARD_TIMER: Balance check - {} E8S", icp_balance);

    // Only proceed if we have more than 1 ICP
    if icp_balance < MIN_ICP_BALANCE {
        ic_cdk::println!("FORWARD_TIMER: Balance {} below threshold {}", icp_balance, MIN_ICP_BALANCE);
        return Ok(format!("Balance {} below threshold", icp_balance));
    }

    ic_cdk::println!("FORWARD_TIMER: Proceeding with forward, balance {} exceeds minimum", icp_balance);

    // Execute forward to alex_revshare
    execute_forward().await
}

// Execute ICP transfer to alex_revshare canister
async fn execute_forward() -> Result<String, String> {
    use icrc_ledger_types::icrc1::account::Account;
    use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
    use ic_ledger_types::{AccountBalanceArgs, AccountIdentifier, MAINNET_LEDGER_CANISTER_ID};
    use crate::constants::ALEX_REVSHARE_CANISTER_ID;

    ic_cdk::println!("FORWARD_TIMER: Starting execute_forward...");

    // Get current ICP balance
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

    // Calculate forward amount (leave reserve for fees)
    // Account for transfer fee (10_000)
    let forward_amount = icp_balance.saturating_sub(ICP_RESERVE + 10_000);

    ic_cdk::println!("FORWARD_TIMER: Forwarding {} E8S of ICP to alex_revshare", forward_amount);

    // Get alex_revshare canister principal
    let alex_revshare = Principal::from_text(ALEX_REVSHARE_CANISTER_ID)
        .map_err(|e| format!("Invalid alex_revshare canister ID: {}", e))?;

    // Execute transfer to alex_revshare
    let transfer_args = TransferArg {
        from_subaccount: None,
        to: Account {
            owner: alex_revshare,
            subaccount: None,
        },
        fee: None,
        created_at_time: None,
        memo: None,
        amount: candid::Nat::from(forward_amount),
    };

    let transfer_result: Result<(Result<candid::Nat, TransferError>,), _> = ic_cdk::call(
        MAINNET_LEDGER_CANISTER_ID,
        "icrc1_transfer",
        (transfer_args,),
    ).await;

    // Handle result and update tracking
    match transfer_result {
        Ok((Ok(block_index),)) => {
            // Update tracking state
            TOTAL_FORWARDED.with(|total| {
                *total.borrow_mut() = total.borrow().saturating_add(forward_amount);
            });

            LAST_FORWARD_TIME.with(|t| *t.borrow_mut() = ic_cdk::api::time());
            LAST_FORWARD_AMOUNT.with(|a| *a.borrow_mut() = forward_amount);

            Ok(format!(
                "Successfully forwarded {} ICP to alex_revshare at block {}. Total forwarded: {} ICP",
                forward_amount,
                block_index,
                TOTAL_FORWARDED.with(|t| *t.borrow())
            ))
        }
        Ok((Err(e),)) => {
            Err(format!("Transfer to alex_revshare failed: {:?}", e))
        }
        Err(e) => {
            Err(format!("Transfer call to alex_revshare failed: {:?}", e))
        }
    }
}

// Query functions - simplified to reflect forwarding instead of burning
#[query]
pub fn get_swap_stats() -> (u64, u64, u64) {
    // Returns: (total_forwarded_to_revshare, last_forward_time, last_forward_amount)
    (
        TOTAL_FORWARDED.with(|t| *t.borrow()),
        LAST_FORWARD_TIME.with(|t| *t.borrow()),
        LAST_FORWARD_AMOUNT.with(|a| *a.borrow()),
    )
}
