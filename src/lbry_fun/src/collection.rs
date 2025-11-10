use candid::Principal;
use ic_cdk_timers::set_timer_interval;
use std::time::Duration;

// Configuration constants
const MIN_ICP_BALANCE: u64 = 100_000_000;  // 1 ICP minimum to trigger forward
const ICP_RESERVE: u64 = 10_000_000;       // 0.1 ICP reserve for fees
const MIN_FORWARD_AMOUNT: u64 = 10_000_000; // 0.1 ICP minimum to forward
const CHECK_INTERVAL: u64 = 1800;          // Check every 30 minutes (staggered from treasury timer)

// Initialize forward timer (runs every 30 minutes, offset from hourly treasury timer)
pub fn init_forward_timer() {
    set_timer_interval(
        Duration::from_secs(CHECK_INTERVAL),
        || {
            ic_cdk::spawn(async {
                let _ = check_and_forward().await;
            });
        }
    );
}

// Check balance and forward to alex_revshare if above threshold
async fn check_and_forward() -> Result<String, String> {
    use ic_ledger_types::{AccountBalanceArgs, AccountIdentifier, MAINNET_LEDGER_CANISTER_ID};
    use icrc_ledger_types::icrc1::account::Account;
    use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
    use crate::constants::ALEX_REVSHARE_CANISTER_ID;

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
            let error_msg = format!("Failed to check ICP balance: {:?}", e);
            ic_cdk::println!("FORWARD_TIMER: {}", error_msg);
            return Err(error_msg);
        }
    };

    ic_cdk::println!("FORWARD_TIMER: Balance check - {} E8S", icp_balance);

    // Only proceed if we have more than 1 ICP
    if icp_balance < MIN_ICP_BALANCE {
        ic_cdk::println!("FORWARD_TIMER: Balance {} below threshold {}", icp_balance, MIN_ICP_BALANCE);
        return Ok(format!("Balance {} below threshold", icp_balance));
    }

    // Calculate forward amount (leave reserve for fees)
    let forward_amount = icp_balance.saturating_sub(ICP_RESERVE + 10_000);

    // Validate minimum forward amount to avoid dust transfers
    if forward_amount < MIN_FORWARD_AMOUNT {
        ic_cdk::println!("FORWARD_TIMER: Forward amount {} below minimum {}", forward_amount, MIN_FORWARD_AMOUNT);
        return Ok(format!("Forward amount {} too small", forward_amount));
    }

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

    // Handle result
    match transfer_result {
        Ok((Ok(block_index),)) => {
            Ok(format!(
                "Successfully forwarded {} E8S ICP to alex_revshare at block {}",
                forward_amount,
                block_index
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
