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
    TokenInfo, TokenRecord, TokenomicsCanisterInitArgs, TxId, CHAIN_ID, E8S, ICP_CANISTER_ID, ICP_TRANSFER_FEE,
    INTITAL_PRIMARY_MINT, KONG_BACKEND_CANISTER, TOKENS,
    tokenomics_simple::preview_tokenomics_from_frontend,
};

const CANISTER_CREATION_CYCLES: u128 = 2_000_000_000_000u128;
const ICP_LEDGER_CANISTER_ID: &str = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const SECONDARY_SWAP_CANISTER_ID: &str = "54fqz-5iaaa-aaaap-qkmqa-cai";

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
    let user_principal = ic_cdk::api::caller(); // Get the calling user's principal
    ic_cdk::println!("[CREATE_TOKEN] Starting token creation for user: {}", user_principal);
    ic_cdk::println!("[CREATE_TOKEN] Primary: {} ({}), Secondary: {} ({})", 
        primary_token_name, primary_token_symbol, secondary_token_name, secondary_token_symbol);
    
    // Generate the full tokenomics schedule
    ic_cdk::println!("[CREATE_TOKEN] Generating tokenomics schedule...");
    let schedule = preview_tokenomics_from_frontend(
        initial_reward_per_burn_unit,
        primary_max_supply,
        initial_secondary_burn,
        halving_step,
        initial_primary_mint, // TGE amount (usually 0)
        threshold_multiplier,
    );
    
    // Extract arrays from the generated schedule
    let mut secondary_thresholds = Vec::new();
    let mut primary_rewards = Vec::new();
    
    // Convert initial reward rate from E8S to 4-decimal format
    // Frontend sends: 0.105 tokens = 10,500,000 E8S
    // Tokenomics expects: 0.105 tokens = 1,050 in 4-decimal format (0.105 × 10,000)
    // Conversion: E8S / 10,000 = 4-decimal format
    let initial_reward_4decimal = (initial_reward_per_burn_unit / 10_000).max(100); // Minimum 0.01 tokens
    
    ic_cdk::println!("[CREATE_TOKEN] Initial reward conversion: {} E8S -> {} 4-decimal format", 
        initial_reward_per_burn_unit, initial_reward_4decimal);
    
    // Generate rewards array using the same halving logic as tokenomics_simple
    let mut current_reward = initial_reward_4decimal;
    let min_reward_4decimal = 100u64; // 0.01 tokens in 4-decimal format
    
    // Always skip epoch 0 as it's only for TGE and has no mining rewards
    let start_index = 1;
    
    for (i, epoch) in schedule.epochs.iter().enumerate().skip(start_index) {
        // Convert cumulative burned from E8S to natural units
        let threshold_natural = (epoch.cumulative_secondary_burned_e8s / E8S as u128) as u64;
        secondary_thresholds.push(threshold_natural);
        
        // Add the current reward rate (already in 4-decimal format)
        primary_rewards.push(current_reward);
        
        // Debug logging
        if i <= 3 {  // Log first few epochs
            ic_cdk::println!("[CREATE_TOKEN] Epoch {} reward: {} (4-decimal format)", i, current_reward);
        }
        
        // Apply halving for next epoch (same as tokenomics_simple)
        let new_reward = current_reward
            .saturating_mul(halving_step)
            .saturating_div(100);
        
        // Don't go below minimum
        current_reward = new_reward.max(min_reward_4decimal);
    }
    
    // Validate the arrays
    if secondary_thresholds.is_empty() || primary_rewards.is_empty() {
        return Err("Failed to generate tokenomics schedule arrays".to_string());
    }
    
    if secondary_thresholds.len() != primary_rewards.len() {
        return Err("Threshold and reward arrays must have the same length".to_string());
    }
    
    // Validate no values slipped through below minimum
    for (i, reward) in primary_rewards.iter().enumerate() {
        if *reward < 100 {
            return Err(format!("Invalid reward at index {}: {} is below minimum of 100 (0.01 tokens)", i, reward));
        }
    }
    
    // Log for debugging
    ic_cdk::println!("[CREATE_TOKEN] Generated {} epochs with thresholds: {:?}", 
        secondary_thresholds.len(), 
        secondary_thresholds.iter().take(5).collect::<Vec<_>>()
    );
    ic_cdk::println!("[CREATE_TOKEN] Rewards (4-decimal): {:?}", 
        primary_rewards.iter().take(5).collect::<Vec<_>>()
    );
    
    // payment
    ic_cdk::println!("[CREATE_TOKEN] Depositing 5 ICP from user...");
    deposit_icp_in_canister(500_000_000, None)
        .await
        .map_err(|e| {
            ic_cdk::println!("[CREATE_TOKEN] ERROR: ICP deposit failed: {:?}", e);
            format!("Failed to deposit ICP: {:?}", e)
        })?;
    ic_cdk::println!("[CREATE_TOKEN] ICP deposit successful");

    ic_cdk::println!("[CREATE_TOKEN] Creating canisters...");
    let swap_canister_id = create_a_canister(CANISTER_CREATION_CYCLES).await?;
    ic_cdk::println!("[CREATE_TOKEN] Swap canister created: {}", swap_canister_id);
    
    let tokenomics_canister_id = create_a_canister(CANISTER_CREATION_CYCLES).await?;
    ic_cdk::println!("[CREATE_TOKEN] Tokenomics canister created: {}", tokenomics_canister_id);
    
    let logs_canister_id = create_a_canister(CANISTER_CREATION_CYCLES).await?;
    ic_cdk::println!("[CREATE_TOKEN] Logs canister created: {}", logs_canister_id);

    // Create primary token
    // PRIMARY

    // max supply from user
    //
    // Note on Initial Liquidity Pool Token:
    // This call intentionally uses the hardcoded `INTITAL_PRIMARY_MINT` constant.
    // This constant represents exactly 1 token plus the standard transfer fee.
    // This single token is used to seed the initial liquidity pool on the DEX.
    // Because this amount is negligible and its purpose is purely functional (to create the pool),
    // it is considered separate from the main tokenomic calculations, which begin with the TGE
    // and scheduled minting.
    let primary_token_id = match create_icrc1_canister(
        primary_token_symbol.clone(),
        primary_token_name.clone(),
        primary_token_description,
        tokenomics_canister_id,
        tokenomics_canister_id,
        INTITAL_PRIMARY_MINT,
        primary_logo,
        CANISTER_CREATION_CYCLES,
    )
    .await
    {
        Ok(canister_id) => {
            ic_cdk::println!("Primary Token ID: {}", canister_id);
            canister_id.to_string()
        }
        Err(e) => return Err(e.to_string()),
    };

    // Create secondary token
    let secondary_token_id = match create_icrc1_canister(
        secondary_token_symbol.clone(),
        secondary_token_name.clone(),
        secondary_token_description,
        swap_canister_id,
        swap_canister_id,
        0,
        secondary_logo,
        CANISTER_CREATION_CYCLES,
    )
    .await
    {
        Ok(canister_id) => {
            ic_cdk::println!("Secondary Token ID: {}", canister_id);
            canister_id.to_string()
        }
        Err(e) => return Err(e.to_string()),
    };
    install_tokenomics_wasm_on_existing_canister(
        tokenomics_canister_id,
        Some(get_principal(&primary_token_id)),
        Some(get_principal(&secondary_token_id)),
        Some(swap_canister_id),
        primary_max_supply.into(),
        initial_primary_mint,
        initial_secondary_burn,
        halving_step,
        initial_reward_per_burn_unit,
        secondary_thresholds.clone(),
        primary_rewards.clone(),
    )
    .await?;
    install_icp_swap_wasm_on_existing_canister(
        swap_canister_id,
        Some(get_principal(&primary_token_id)),
        Some(get_principal(&secondary_token_id)),
        Some(tokenomics_canister_id),
        distribution_interval_seconds,
        launch_delay_seconds,  // ADD THIS LINE
    )
    .await?;

    install_logs_wasm_on_existing_canister(
        logs_canister_id,
        get_principal(&primary_token_id),
        get_principal(&secondary_token_id),
        swap_canister_id,
        tokenomics_canister_id,
    )
    .await?;

    ic_cdk::println!("[CREATE_TOKEN] Adding primary token to KongSwap...");
    match add_token_to_kong_swap(get_principal(&primary_token_id)).await {
        AddTokenResponse::Ok(token_detail) => {
            ic_cdk::println!("[CREATE_TOKEN] Primary token added to KongSwap successfully: {:?}", token_detail);
        },
        AddTokenResponse::Err(e) => {
            ic_cdk::println!("[CREATE_TOKEN] ERROR: Failed to add token to KongSwap: {}", e);
            return Err(format!("Failed to add token to swap: {}", e));
        }
    };

    // Instead of approving, we'll transfer tokens directly to Kong
    ic_cdk::println!("[CREATE_TOKEN] Transferring tokens to Kong for pool creation...");
    
    // Transfer primary token to Kong
    let primary_transfer_result = transfer_tokens_to_kong(
        get_principal(&primary_token_id),
        E8S.into(), // 1 token for pool
    )
    .await?;
    ic_cdk::println!("[CREATE_TOKEN] Primary token transferred to Kong, block index: {}", primary_transfer_result);

    // Transfer ICP to Kong
    let icp_transfer_result = transfer_tokens_to_kong(
        get_principal(ICP_CANISTER_ID),
        (10_000_000 as u64).into(), // 0.1 ICP for pool
    )
    .await?;
    ic_cdk::println!("[CREATE_TOKEN] ICP transferred to Kong, block index: {}", icp_transfer_result);

    let mut token_record = TokenRecord {
        id: 0, // Will be set when inserting
        primary_token_id: get_principal(&primary_token_id),
        primary_token_name: primary_token_name.clone(),
        primary_token_symbol: primary_token_symbol.clone(),
        primary_token_max_supply: primary_max_supply,
        secondary_token_id: get_principal(&secondary_token_id),
        secondary_token_name: secondary_token_name.clone(),
        secondary_token_symbol: secondary_token_symbol.clone(),
        icp_swap_canister_id: swap_canister_id,
        tokenomics_canister_id,
        logs_canister_id,
        initial_primary_mint,
        initial_secondary_burn,
        halving_step,
        threshold_multiplier,
        initial_reward_per_burn_unit,
        distribution_interval_seconds,
        launch_delay_seconds,
        caller: user_principal,
        created_time: ic_cdk::api::time(),
        pool_creation_failed: false,
        pool_created_at: 0,
    };

    // Attempt to create pool on KongSwap
    ic_cdk::println!("[CREATE_TOKEN] Attempting to create liquidity pool on KongSwap...");
    match create_pool_on_kong_swap(
        get_principal(&primary_token_id), 
        primary_transfer_result,
        icp_transfer_result
    ).await {
        Ok(reply) => {
            ic_cdk::println!("[CREATE_TOKEN] POOL CREATION SUCCESS: Pool ID: {}", reply.pool_id);
            token_record.pool_created_at = ic_cdk::api::time();
            token_record.pool_creation_failed = false;
        },
        Err(e) => {
            ic_cdk::println!("[CREATE_TOKEN] POOL CREATION FAILED: {}", e);
            token_record.pool_creation_failed = true;
            // Continue with token creation even if pool fails
        }
    }

    // Save the token record
    let final_token_id = TOKENS.with(|tokens| {
        let mut tokens = tokens.borrow_mut();
        let token_id = tokens.len() as u64 + 1;
        token_record.id = token_id;
        tokens.insert(token_id, token_record.clone());
        token_id
    });

    // Return appropriate message based on pool creation result
    if token_record.pool_creation_failed {
        Ok(format!(
            "Token created (ID: {}) but pool creation failed. Use retry_pool_creation({}) to try again. Token will not go live until pool is created.",
            final_token_id, final_token_id
        ))
    } else {
        Ok(format!(
            "Token created successfully (ID: {}) with liquidity pool. Minting/burning will be enabled in 24 hours.",
            final_token_id
        ))
    }
}

async fn create_icrc1_canister(
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

async fn create_a_canister(cycles: u128) -> Result<Principal, String> {
    let create_args = CreateCanisterArgument { settings: None };
    let canister_id_record = create_canister(create_args, cycles)
        .await
        .map_err(|e| format!("Failed to create canister: {:?}", e))?;

    let canister_id = canister_id_record.0.canister_id;
    Ok(canister_id)
}

async fn install_tokenomics_wasm_on_existing_canister(
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

async fn install_icp_swap_wasm_on_existing_canister(
    canister_id: Principal,
    primary_token_id: Option<Principal>,
    secondary_token_id: Option<Principal>,
    tokenomics_canister_id: Option<Principal>,
    distribution_interval_seconds: u64,
    launch_delay_seconds: u64,  // ADD THIS PARAMETER
) -> Result<(), String> {
    // Calculate launch_time from current time + delay
    let launch_time = if launch_delay_seconds > 0 {
        Some(ic_cdk::api::time() / 1_000_000_000 + launch_delay_seconds)
    } else {
        None
    };

    let args = IcpSwapInitArgs {
        primary_token_id,
        secondary_token_id,
        tokenomics_canister_id,
        icp_ledger_id: None, // None means use default (our standard ICP ledger)
        distribution_interval_seconds,
        launch_time,  // ADD THIS LINE
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

async fn install_logs_wasm_on_existing_canister(
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

async fn add_token_to_kong_swap(token_id: Principal) -> AddTokenResponse {
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

pub async fn create_pool_on_kong_swap(
    primary_token_id: Principal, 
    primary_tx_id: Nat,
    icp_tx_id: Nat
) -> Result<AddPoolReply, String> {
    // Kong requires token_1 to be ICP or ksUSDT
    let args = AddPoolArgs {
        token_0: format!("{}.{}", CHAIN_ID, primary_token_id), // Custom token as token_0
        amount_0: E8S.into(), // 1 token
        tx_id_0: Some(TxId::BlockIndex(primary_tx_id)), // Provide the transfer tx id
        token_1: "ICP".to_string(), // ICP as token_1
        amount_1: (10_000_000 as u64).into(), // 0.1 ICP
        tx_id_1: Some(TxId::BlockIndex(icp_tx_id)), // Provide the transfer tx id
        lp_fee_bps: Some(100), // 1% LP fee (100 basis points)
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
    
    // Check if pool creation already succeeded
    if !token_record.pool_creation_failed {
        return Err("Pool has already been created successfully".to_string());
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
            // Update the token record
            TOKENS.with(|tokens| {
                let mut tokens_map = tokens.borrow_mut();
                if let Some(mut token) = tokens_map.get(&token_id) {
                    token.pool_creation_failed = false;
                    token.pool_created_at = ic_cdk::api::time();
                    tokens_map.insert(token_id, token);
                }
            });
            
            // Check if token should be live immediately (launch delay has passed)
            let current_time = ic_cdk::api::time();
            let launch_delay_nanos = token_record.launch_delay_seconds * 1_000_000_000;
            
            if current_time >= token_record.created_time + launch_delay_nanos {
                Ok(format!(
                    "Pool created successfully (ID: {}). Token is now live for minting/burning!",
                    reply.pool_id
                ))
            } else {
                let remaining_seconds = (token_record.created_time + launch_delay_nanos - current_time) / 1_000_000_000;
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

async fn transfer_tokens_to_kong(
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
async fn deposit_icp_in_canister(
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

    // Minimum 0.01 ICP to process
    if balance < 1_000_000 {
        let log_msg = "Not enough fees to process. Skipping run.".to_string();
        ic_cdk::println!("{}", log_msg);
        return Ok(log_msg);
    }

    let secondary_swap_principal = Principal::from_text(SECONDARY_SWAP_CANISTER_ID).unwrap();

    // 1. Approve the SECONDARY swap canister to spend our ICP
    match approve_tokens_to_spender(
        Principal::from_text(ICP_LEDGER_CANISTER_ID).unwrap(),
        secondary_swap_principal,
        balance.into(),
    )
    .await
    {
        Ok(_) => ic_cdk::println!("Successfully approved SECONDARY swap canister to spend ICP."),
        Err(e) => return Err(format!("Failed to approve ICP for SECONDARY swap: {}", e)),
    }

    // 2. Call swap on the SECONDARY swap canister
    let swap_args = (balance, None::<Vec<u8>>);
    let result: Result<(Result<String, String>,), _> =
        ic_cdk::call(secondary_swap_principal, "swap", swap_args).await;

    match result {
        Ok((Ok(success_msg),)) => {
            let success_log = format!(
                "Successfully swapped {} e8s of ICP for SECONDARY and burned it: {}",
                balance, success_msg
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

#[ic_cdk::init]
fn init() {
    // Schedule the treasury processing to run every hour.
    let hourly = Duration::from_secs(60 * 60);
    set_timer_interval(hourly, || {
        ic_cdk::spawn(async {
            let _ = _process_fee_treasury().await;
        });
    });

}