use candid::{Encode, Nat, Principal};
use ic_cdk::{
    api::management_canister::main::{
        canister_status, create_canister, install_code, CanisterInstallMode, CreateCanisterArgument,
        InstallCodeArgument, CanisterIdRecord,
    },
    update,
};
use ic_cdk_timers::set_timer_interval;
use icrc_ledger_types::{
    icrc1::account::Account,
    icrc2::transfer_from::{TransferFromArgs, TransferFromError},
};
use icrc_ledger_types::icrc1::transfer::BlockIndex;
use std::time::Duration;

use crate::{
    get_principal, get_self_icp_balance, AddPoolArgs, AddPoolReply, AddPoolResult, AddTokenArgs,
    AddTokenReply, AddTokenResponse, AddTokenResult, ApproveArgs, ApproveResult, ArchiveOptions,
    FeatureFlags, IcpSwapInitArgs, InitArgs, LedgerArg, LogsInitArgs, MetadataValue, TokenDetail,
    TokenInfo, TokenomicsCanisterInitArgs, TxId, CHAIN_ID, E8S, ICP_CANISTER_ID, ICP_TRANSFER_FEE,
    KONG_BACKEND_CANISTER, TOKENS,
    CreateTokenParams, initiate_token_deployment, execute_token_deployment,
};

const CANISTER_CREATION_CYCLES: u128 = 2_000_000_000_000u128;
const ICP_LEDGER_CANISTER_ID: &str = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const SECONDARY_SWAP_CANISTER_ID: &str = "54fqz-5iaaa-aaaap-qkmqa-cai";
const MINIMUM_TREASURY_RESERVE: u64 = 500_000_000; // 5 ICP reserve for token creation

#[ic_cdk::update]
async fn create_token(
    primary_token_name: String,
    primary_token_symbol: String,
    primary_token_description: String,
    primary_logo: String,
    secondary_token_name: String,
    secondary_token_symbol: String,
    secondary_token_description: String,
    secondary_logo: String,
    primary_max_supply: u64,
    initial_primary_mint: u64,
    initial_secondary_burn: u64,
    halving_step: u64,
    threshold_multiplier: f64,
    initial_reward_per_burn_unit: u64,
    distribution_interval_seconds: u64,
    launch_delay_seconds: u64,
) -> Result<String, String> {
    // Use the new two-phase deployment system internally
    let params = CreateTokenParams {
        primary_token_name,
        primary_token_symbol,
        primary_token_description,
        primary_logo,
        secondary_token_name,
        secondary_token_symbol,
        secondary_token_description,
        secondary_logo,
        primary_max_supply,
        initial_primary_mint,
        initial_secondary_burn,
        halving_step,
        threshold_multiplier,
        initial_reward_per_burn_unit,
        distribution_interval_seconds,
        launch_delay_seconds,
    };
    
    // Phase 1: Initiate deployment
    let deployment_id = initiate_token_deployment(params).await?;
    
    // Phase 2: Execute deployment
    let result = execute_token_deployment(deployment_id).await?;
    
    // Return appropriate message based on result
    Ok(format!("Token created successfully (ID: {})", result.token_id))
}

// Removed old create_token_old function - now using deployment system

pub async fn create_icrc1_canister(
    token_symbol: String,
    token_name: String,
    token_description: String,
    minting_account_owner: Principal,
    archive_controller: Principal,
    intital_amount: u64,
    logo: String,
    cycles: u128,
) -> Result<String, String> {
    let create_args = CreateCanisterArgument { settings: None };
    let canister_id_record = create_canister(create_args, cycles)
        .await
        .map_err(|e| format!("Failed to create canister: {:?}", e))?;

    let canister_id = canister_id_record.0.canister_id;

    let wasm_bytes = include_bytes!("ic-icrc1-ledger.wasm");

    let minter_account = Account {
        owner: minting_account_owner,
        subaccount: None,
    };

    let canister_account = Account {
        owner: ic_cdk::api::id(),
        subaccount: None,
    };

    let init_args = InitArgs {
        minting_account: minter_account.clone(),
        fee_collector_account: None,
        transfer_fee: Nat::from(10_000 as u32),
        decimals: Some(8),
        max_memo_length: Some(32),
        initial_balances: vec![(canister_account, Nat::from(intital_amount))],
        maximum_number_of_accounts: Some(1_000_000),
        accounts_overflow_trim_quantity: Some(10_000),
        token_symbol: token_symbol.clone(),
        token_name: token_name.clone(),
        metadata: vec![
            (
                "description".to_string(),
                MetadataValue::Text(token_description),
            ),
            (
                "logo".to_string(),
                MetadataValue::Text(format!("data:image/svg+xml;base64,{}", logo)),
            ),
        ],
        feature_flags: Some(FeatureFlags { icrc2: true }),
        archive_options: ArchiveOptions {
            num_blocks_to_archive: 0,
            max_transactions_per_response: None,
            trigger_threshold: 2000,
            max_message_size_bytes: None,
            cycles_for_archive_creation: None,
            node_max_memory_size_bytes: None,
            controller_id: archive_controller,
            more_controller_ids: None,
        },
    };

    // Encode as LedgerArg::Init
    let encoded_args = Encode!(&LedgerArg::Init(init_args))
        .map_err(|e| format!("Failed to encode init args: {:?}", e))?;

    let install_args = InstallCodeArgument {
        mode: CanisterInstallMode::Install,
        canister_id,
        wasm_module: wasm_bytes.to_vec(),
        arg: encoded_args,
    };

    install_code(install_args)
        .await
        .map_err(|e| format!("Failed to install ICRC-1 token: {:?}", e))?;

    Ok(canister_id.to_string())
}

pub async fn create_a_canister(cycles: u128) -> Result<Principal, String> {
    let create_args = CreateCanisterArgument { settings: None };
    let canister_id_record = create_canister(create_args, cycles)
        .await
        .map_err(|e| format!("Failed to create canister: {:?}", e))?;

    let canister_id = canister_id_record.0.canister_id;
    Ok(canister_id)
}

pub async fn install_tokenomics_wasm_on_existing_canister(
    canister_id: Principal,
    primary_token_id: Option<Principal>,
    secondary_token_id: Option<Principal>,
    _swap_canister_id: Option<Principal>,
    _max_primary_supply: u64,
    _initial_primary_mint: u64,
    _initial_secondary_burn: u64,
    _halving_step: u64,
    _initial_reward_per_burn_unit: u64,
    secondary_thresholds: Vec<u64>,
    primary_rewards: Vec<u64>,
) -> Result<(), String> {
    // Create the init args for the tokenomics canister
    let init_args = TokenomicsCanisterInitArgs {
        primary_token_ledger: primary_token_id.ok_or("Primary token ID required")?,
        secondary_token_ledger: secondary_token_id.ok_or("Secondary token ID required")?,
        icp_swap_canister_id: _swap_canister_id.ok_or("ICP swap canister ID required")?,
        max_primary_supply: _max_primary_supply,
        secondary_thresholds,
        primary_rewards,
    };
    
    let encoded_args = Encode!(&init_args)
        .map_err(|e: candid::Error| format!("Failed to encode init args: {:?}", e))?;

    let wasm_module = include_bytes!("tokenomics.wasm").to_vec(); // Path must be valid in your project

    let install_args = InstallCodeArgument {
        mode: CanisterInstallMode::Install,
        canister_id,
        wasm_module,
        arg: encoded_args,
    };

    install_code(install_args)
        .await
        .map_err(|e| format!("Wasm install failed: {:?}", e))?;

    Ok(())
}

pub async fn install_icp_swap_wasm_on_existing_canister(
    canister_id: Principal,
    primary_token_id: Option<Principal>,
    secondary_token_id: Option<Principal>,
    tokenomics_canister_id: Option<Principal>,
    distribution_interval_seconds: u64,
    launch_delay_seconds: u64,
    token_id: Option<u64>,  // Add token_id parameter
) -> Result<(), String> {
    // Calculate launch_time from current time + delay
    let launch_time = if launch_delay_seconds > 0 {
        Some(ic_cdk::api::time() / 1_000_000_000 + launch_delay_seconds)
    } else {
        None
    };

    let args = IcpSwapInitArgs {
        token_id,  // Pass token_id to icp_swap
        primary_token_id,
        secondary_token_id,
        tokenomics_canister_id,
        icp_ledger_id: None, // None means use default (our standard ICP ledger)
        distribution_interval_seconds,
        launch_time,
    };

    let encoded_args =
        Encode!(&Some(args)).map_err(|e| format!("Failed to encode args: {:?}", e))?;

    let wasm_module = include_bytes!("icp_swap.wasm").to_vec(); // Path must be valid in your project

    let install_args = InstallCodeArgument {
        mode: CanisterInstallMode::Install,
        canister_id,
        wasm_module,
        arg: encoded_args,
    };

    install_code(install_args)
        .await
        .map_err(|e| format!("Wasm install failed: {:?}", e))?;

    Ok(())
}

pub async fn install_logs_wasm_on_existing_canister(
    canister_id: Principal,
    primary_token_id: Principal,
    secondary_token_id: Principal,
    icp_swap_id: Principal,
    tokenomics_id: Principal,
) -> Result<(), String> {
    let args = LogsInitArgs {
        primary_token_id,
        secondary_token_id,
        icp_swap_id,
        tokenomics_id,
    };
    let encoded_args =
        Encode!(&args).map_err(|e: candid::Error| format!("Failed to encode args: {:?}", e))?;

    let wasm_module = include_bytes!("logs.wasm").to_vec();

    let install_args = InstallCodeArgument {
        mode: CanisterInstallMode::Install,
        canister_id,
        wasm_module,
        arg: encoded_args,
    };

    install_code(install_args)
        .await
        .map_err(|e| format!("Wasm install failed: {:?}", e))?;

    Ok(())
}

pub async fn add_token_to_kong_swap(token_id: Principal) -> AddTokenResponse {
    let args: AddTokenArgs = AddTokenArgs {
        token: format!("IC.{}", token_id),
    };
    
    ic_cdk::println!("[ADD_TOKEN_TO_KONG] Calling KongSwap to add token: {}", args.token);
    ic_cdk::println!("[ADD_TOKEN_TO_KONG] Kong backend canister: {}", KONG_BACKEND_CANISTER);

    let result: Result<(AddTokenResult,), _> =
        ic_cdk::call(get_principal(KONG_BACKEND_CANISTER), "add_token", (args,)).await;

    match result {
        Ok((AddTokenResult::Ok(AddTokenReply::IC(token_info)),)) => {
            ic_cdk::println!("[ADD_TOKEN_TO_KONG] SUCCESS: Token added to KongSwap");
            ic_cdk::println!("[ADD_TOKEN_TO_KONG] Token details: ID={}, Symbol={}, Name={}, Decimals={}", 
                token_info.token_id, token_info.symbol, token_info.name, token_info.decimals);
            AddTokenResponse::Ok(TokenDetail::IC(TokenInfo {
                token_id: token_info.token_id,
                chain: token_info.chain,
                canister_id: token_info.canister_id,
                name: token_info.name,
                symbol: token_info.symbol,
                decimals: token_info.decimals,
                fee: 0, // safely handle Nat
                icrc1: token_info.icrc1,
                icrc2: token_info.icrc2,
                icrc3: token_info.icrc3,
                is_removed: token_info.is_removed,
            }))
        }
        Ok((AddTokenResult::Err(err_msg),)) => {
            ic_cdk::println!("[ADD_TOKEN_TO_KONG] ERROR: KongSwap rejected token: {}", err_msg);
            AddTokenResponse::Err(format!("Add token failed: {}", err_msg))
        }
        Err(e) => {
            ic_cdk::println!("[ADD_TOKEN_TO_KONG] ERROR: Inter-canister call failed: {:?}", e);
            AddTokenResponse::Err("Call failed".to_string())
        }
    }
}

/// Creates a liquidity pool on KongSwap for a new token paired with ICP.
/// All new tokens launched through lbryfun are paired with ICP by default.
/// 
/// # Arguments
/// * `primary_token_id` - The Principal ID of the new token to create a pool for
/// * `primary_tx_id` - The block index of the new token transfer to Kong
/// * `icp_tx_id` - The block index of the ICP transfer to Kong
pub async fn create_pool_on_kong_swap(
    primary_token_id: Principal, 
    primary_tx_id: Nat,
    icp_tx_id: Nat
) -> Result<AddPoolReply, String> {
    // Always create pools with ICP as the pair token
    let args = AddPoolArgs {
        token_0: format!("{}.{}", CHAIN_ID, primary_token_id), // New meme token
        amount_0: E8S.into(), // 1 token
        tx_id_0: Some(TxId::BlockIndex(primary_tx_id)),
        token_1: "ICP".to_string(), // Always pair with ICP
        amount_1: (10_000_000 as u64).into(), // 0.1 ICP
        tx_id_1: Some(TxId::BlockIndex(icp_tx_id)),
        lp_fee_bps: Some(100), // 1% LP fee
    };
    
    ic_cdk::println!("[CREATE_POOL] Calling KongSwap to create pool");
    ic_cdk::println!("[CREATE_POOL] Pool parameters: token_0={} ({}), token_1={} ({})", 
        args.token_0, args.amount_0, args.token_1, args.amount_1);
    ic_cdk::println!("[CREATE_POOL] Transaction IDs: tx_id_0={:?}, tx_id_1={:?}", 
        args.tx_id_0, args.tx_id_1);
    ic_cdk::println!("[CREATE_POOL] Kong backend canister: {}", KONG_BACKEND_CANISTER);

    let (result,): (AddPoolResult,) =
        ic_cdk::call(get_principal(KONG_BACKEND_CANISTER), "add_pool", (args,))
            .await
            .map_err(|e| {
                ic_cdk::println!("[CREATE_POOL] ERROR: Inter-canister call failed: {:?}", e);
                format!("Call failed: {:?}", e)
            })?;

    match result {
        AddPoolResult::Ok(reply) => {
            ic_cdk::println!("[CREATE_POOL] SUCCESS: Pool created successfully");
            ic_cdk::println!("[CREATE_POOL] Pool details: ID={}, Symbol={}, Name={}", 
                reply.pool_id, reply.symbol, reply.name);
            Ok(reply)
        },
        AddPoolResult::Err(e) => {
            ic_cdk::println!("[CREATE_POOL] ERROR: KongSwap rejected pool creation: {}", e);
            Err(format!("Pool creation failed: {}", e))
        },
    }
}

#[update]
async fn retry_pool_creation(token_id: u64) -> Result<String, String> {
    let caller = ic_cdk::caller();
    
    // Get the token record
    let token_record = TOKENS.with(|tokens| {
        tokens.borrow().get(&token_id)
    }).ok_or_else(|| format!("Token with ID {} not found", token_id))?;
    
    // Verify caller is the token creator
    if token_record.caller != caller {
        return Err("Only the token creator can retry pool creation".to_string());
    }
    
    // Check token status
    match &token_record.status {
        crate::storage::TokenStatus::Failed { .. } => {
            // Can retry failed tokens
        },
        crate::storage::TokenStatus::Live { .. } => {
            return Err("Pool has already been created successfully".to_string());
        },
        _ => {
            return Err("Token is not in a failed state".to_string());
        }
    }
    
    // Transfer tokens to Kong first
    let primary_transfer_result = transfer_tokens_to_kong(
        token_record.primary_token_id,
        E8S.into(),
    )
    .await
    .map_err(|e| format!("Failed to transfer primary token: {}", e))?;
    
    let icp_transfer_result = transfer_tokens_to_kong(
        get_principal(ICP_CANISTER_ID),
        (10_000_000 as u64).into(),
    )
    .await
    .map_err(|e| format!("Failed to transfer ICP: {}", e))?;
    
    // Attempt to create the pool again
    match create_pool_on_kong_swap(
        token_record.primary_token_id,
        primary_transfer_result,
        icp_transfer_result
    ).await {
        Ok(reply) => {
            // Update the token record to live status
            TOKENS.with(|tokens| {
                let mut tokens_map = tokens.borrow_mut();
                if let Some(mut token) = tokens_map.get(&token_id) {
                    token.status = crate::storage::TokenStatus::Live {
                        pool_id: reply.pool_id.to_string(),
                    };
                    tokens_map.insert(token_id, token);
                }
            });
            
            // Check if token should be live immediately (launch delay has passed)
            let current_time = ic_cdk::api::time();
            
            if current_time >= token_record.launched_at {
                Ok(format!(
                    "Pool created successfully (ID: {}). Token is now live for minting/burning!",
                    reply.pool_id
                ))
            } else {
                let remaining_seconds = (token_record.launched_at - current_time) / 1_000_000_000;
                let hours_remaining = remaining_seconds / 3600;
                let minutes_remaining = (remaining_seconds % 3600) / 60;
                Ok(format!(
                    "Pool created successfully (ID: {}). Token will go live in approximately {} hours {} minutes.",
                    reply.pool_id, hours_remaining, minutes_remaining
                ))
            }
        },
        Err(e) => {
            Err(format!("Pool creation failed again: {}. Please try again later.", e))
        }
    }
}

pub async fn transfer_tokens_to_kong(
    ledger_canister_id: Principal,
    amount: Nat,
) -> Result<Nat, String> {
    let kong_account = Account {
        owner: get_principal(KONG_BACKEND_CANISTER),
        subaccount: None,
    };
    
    ic_cdk::println!("[TRANSFER] Transferring {} from ledger {} to Kong", 
        amount, ledger_canister_id);
        
    let args = icrc_ledger_types::icrc1::transfer::TransferArg {
        to: kong_account,
        amount: amount.clone(),
        fee: None,
        memo: None,
        from_subaccount: None,
        created_at_time: None,
    };

    let (result,): (Result<BlockIndex, icrc_ledger_types::icrc1::transfer::TransferError>,) = 
        ic_cdk::call(ledger_canister_id, "icrc1_transfer", (args,))
        .await
        .map_err(|e| {
            ic_cdk::println!("[TRANSFER] ERROR: Call to icrc1_transfer failed: {:?}", e);
            format!("Call to icrc1_transfer failed: {:?}", e)
        })?;

    match result {
        Ok(block_index) => {
            ic_cdk::println!("[TRANSFER] SUCCESS: Transfer completed, block index: {}", block_index);
            Ok(block_index)
        },
        Err(e) => {
            ic_cdk::println!("[TRANSFER] ERROR: Transfer failed: {:?}", e);
            Err(format!("Transfer failed: {:?}", e))
        },
    }
}

pub async fn approve_tokens_to_spender(
    ledger_canister_id: Principal,
    spender: Principal,
    amount: Nat,
) -> Result<Nat, String> {
    ic_cdk::println!("[APPROVE] Approving {} to spend {} from ledger {}", 
        spender, amount, ledger_canister_id);
        
    let args: ApproveArgs = ApproveArgs {
        fee: None,
        memo: None,
        from_subaccount: None,
        amount: amount.clone(),
        spender: Account {
            owner: spender,
            subaccount: None,
        },
    };

    let (result,): (ApproveResult,) = ic_cdk::call(ledger_canister_id, "icrc2_approve", (args,))
        .await
        .map_err(|e| {
            ic_cdk::println!("[APPROVE] ERROR: Call to icrc2_approve failed: {:?}", e);
            format!("Call to icrc2_approve failed: {:?}", e)
        })?;

    match result {
        ApproveResult::Ok(block_index) => {
            ic_cdk::println!("[APPROVE] SUCCESS: Approval granted, block index: {}", block_index);
            Ok(block_index)
        },
        ApproveResult::Err(e) => {
            ic_cdk::println!("[APPROVE] ERROR: Approval failed: {:?}", e);
            Err(format!("Approval failed: {:?}", e))
        },
    }
}

#[update]
async fn get_canister_cycle_balance(canister_id: Principal) -> Result<Nat, String> {
    match canister_status(CanisterIdRecord { canister_id }).await {
        Ok((status,)) => Ok(status.cycles),
        Err((_code, msg)) => Err(format!("Failed to get canister status: {}", msg)),
    }
}

#[update]
pub async fn deposit_icp_in_canister(
    amount: u64,
    from_subaccount: Option<[u8; 32]>,
) -> Result<BlockIndex, TransferFromError> {
    let canister_id = ic_cdk::api::id();
    let caller = ic_cdk::caller();

    let transfer_args = TransferFromArgs {
        from: Account {
            owner: caller,
            subaccount: from_subaccount,
        },
        to: Account {
            owner: canister_id,
            subaccount: None,
        },
        amount: amount.into(),
        fee: Some(Nat::from(ICP_TRANSFER_FEE)),
        memo: None,
        created_at_time: None,
        spender_subaccount: None,
    };

    let (result,): (Result<BlockIndex, TransferFromError>,) = ic_cdk::call(
        get_principal(ICP_CANISTER_ID),
        "icrc2_transfer_from",
        (transfer_args,),
    )
    .await
    .map_err(|e| TransferFromError::GenericError {
        message: e.1.into(),
        error_code: Nat::from(0 as u32),
    })?;

    result // Return the inner Result<BlockIndex, TransferFromError>
}



async fn _process_fee_treasury() -> Result<String, String> {
    let canister_principal = ic_cdk::api::id();
    let balance = match get_self_icp_balance(canister_principal).await {
        Ok(b) => b,
        Err(e) => {
            let err_msg = format!("Failed to get treasury balance: {}", e);
            ic_cdk::println!("{}", err_msg);
            return Err(err_msg);
        }
    };

    // Only process if we have more than the minimum reserve
    if balance <= MINIMUM_TREASURY_RESERVE {
        let log_msg = format!("Balance {} is below minimum reserve of {}. Skipping.", balance, MINIMUM_TREASURY_RESERVE);
        ic_cdk::println!("{}", log_msg);
        return Ok(log_msg);
    }

    // Calculate excess above reserve
    let excess = balance - MINIMUM_TREASURY_RESERVE;
    
    // Only process if excess is at least 0.01 ICP
    if excess < 1_000_000 {
        let log_msg = format!("Excess {} is too small to process. Skipping.", excess);
        ic_cdk::println!("{}", log_msg);
        return Ok(log_msg);
    }

    let secondary_swap_principal = Principal::from_text(SECONDARY_SWAP_CANISTER_ID).unwrap();

    // 1. Approve the SECONDARY swap canister to spend our excess ICP
    match approve_tokens_to_spender(
        Principal::from_text(ICP_LEDGER_CANISTER_ID).unwrap(),
        secondary_swap_principal,
        excess.into(),
    )
    .await
    {
        Ok(_) => ic_cdk::println!("Successfully approved SECONDARY swap canister to spend {} ICP.", excess),
        Err(e) => return Err(format!("Failed to approve ICP for SECONDARY swap: {}", e)),
    }

    // 2. Call swap on the SECONDARY swap canister with only the excess
    let swap_args = (excess, None::<Vec<u8>>);
    let result: Result<(Result<String, String>,), _> =
        ic_cdk::call(secondary_swap_principal, "swap", swap_args).await;

    match result {
        Ok((Ok(success_msg),)) => {
            let success_log = format!(
                "Successfully swapped {} e8s of ICP (from total balance {}) for SECONDARY and burned it: {}",
                excess, balance, success_msg
            );
            ic_cdk::println!("{}", success_log);
            Ok(success_log)
        }
        Ok((Err(err_msg),)) => {
            let error_log = format!(
                "Swap failed after approval. ICP remains in treasury. Error: {}",
                err_msg
            );
            ic_cdk::println!("{}", error_log);
            Err(error_log)
        }
        Err((code, msg)) => {
            let error_log = format!(
                "Failed to call swap on SECONDARY canister: (code: {:?}, message: '{}'). ICP remains in treasury.",
                code, msg
            );
            ic_cdk::println!("{}", error_log);
            Err(error_log)
        }
    }
}

/// Admin guard function - checks if caller is authorized admin
fn is_admin() -> Result<(), String> {
    let caller = ic_cdk::caller();
    
    if crate::is_admin_principal(&caller) {
        Ok(())
    } else {
        Err("Not authorized".to_string())
    }
}

/// Quick fix to remove stuck tokens with failed pool creation
#[update(guard = "is_admin")]
async fn fix_stuck_token(token_id: u64) -> Result<String, String> {
    TOKENS.with(|tokens| {
        let mut tokens_mut = tokens.borrow_mut();
        if let Some(token) = tokens_mut.get(&token_id) {
            match &token.status {
                crate::storage::TokenStatus::Failed { .. } => {
                    // Remove stuck token
                    tokens_mut.remove(&token_id);
                    Ok(format!("Removed stuck token {} with failed deployment", token_id))
                },
                _ => {
                    Err("Token not stuck - only failed tokens can be removed".to_string())
                }
            }
        } else {
            Err("Token not found".to_string())
        }
    })
}

#[ic_cdk::init]
fn init() {
    // Schedule the treasury processing to run every hour.
    let hourly = Duration::from_secs(60 * 60);
    set_timer_interval(hourly, || {
        ic_cdk::spawn(async {
            let _ = _process_fee_treasury().await;
        });
    });
    
    // Initialize the collection timer for ALEX rewards
    crate::collection::init_collection_timer();
    
    // Initialize the reconciliation timer
    crate::collection::init_reconciliation_timer();
}

#[ic_cdk::post_upgrade]
fn post_upgrade() {
    // Re-initialize timers after upgrade
    // Schedule the treasury processing to run every hour.
    let hourly = Duration::from_secs(60 * 60);
    set_timer_interval(hourly, || {
        ic_cdk::spawn(async {
            let _ = _process_fee_treasury().await;
        });
    });
    
    // Initialize the collection timer for ALEX rewards
    crate::collection::init_collection_timer();
    
    // Initialize the reconciliation timer
    crate::collection::init_reconciliation_timer();
}