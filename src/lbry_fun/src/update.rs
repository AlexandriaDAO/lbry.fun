use candid::{Encode, Nat, Principal};
use ic_cdk::{api::management_canister::main::{
    create_canister, install_code, CanisterInstallMode, CreateCanisterArgument, InstallCodeArgument,
}, update};
use icrc_ledger_types::{
    icrc1::account::Account,
    icrc2::transfer_from::{TransferFromArgs, TransferFromError},
};
use num_bigint::BigUint;
use icrc_ledger_types::icrc1::transfer::BlockIndex ;

use crate::{
    get_principal, AddPoolArgs, AddPoolReply, AddPoolResult, AddTokenArgs, AddTokenReply,
    AddTokenResponse, AddTokenResult, ApproveArgs, ApproveResult, ArchiveOptions, FeatureFlags,
    IcpSwapInitArgs, InitArgs, LedgerArg, MetadataValue, TokenDetail, TokenInfo, TokenRecord,
    TokenomicsInitArgs, CHAIN_ID, E8S, ICP_CANISTER_ID, ICP_TRANSFER_FEE, INTITAL_PRIMARY_MINT,
    KONG_BACKEND_CANISTER, TOKENS,
};

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
    primary_max_phase_mint: u64,
    initial_primary_mint: u64,
    initial_secondary_burn: u64,
) -> Result<String, String> {
    let user_principal = ic_cdk::api::caller(); // Get the calling user's principal
                                                // payment
    // deposit_icp_in_canister(100_000_000, None)
    //     .await
    //     .map_err(|e| format!("Failed to deposit ICP: {:?}", e))?;

    let swap_canister_id = create_a_canister().await?;
    let tokenomics_canister_id = create_a_canister().await?;
    let frontend_canister_id = create_a_canister().await?;

    // Create primary token
    // ALEX

    // max supply from user
    //
    let primary_token_id = match create_icrc1_canister(
        primary_token_symbol.clone(),
        primary_token_name.clone(),
        primary_token_description,
        tokenomics_canister_id,
        tokenomics_canister_id,
        INTITAL_PRIMARY_MINT,
        primary_logo,
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
        Some(frontend_canister_id),
        primary_max_supply.into(),
        initial_primary_mint,
        initial_secondary_burn,
        primary_max_phase_mint,
    )
    .await?;
    install_icp_swap_wasm_on_existing_canister(
        swap_canister_id,
        Some(get_principal(&primary_token_id)),
        Some(get_principal(&secondary_token_id)),
        Some(tokenomics_canister_id),
    )
    .await?;

    match add_token_to_kong_swap(get_principal(&primary_token_id)).await {
        AddTokenResponse::Ok(_) => (),
        AddTokenResponse::Err(e) => return Err(format!("Failed to add token to swap: {}", e)),
    };

    approve_tokens_to_spender(
        get_principal(&primary_token_id),
        get_principal(KONG_BACKEND_CANISTER),
        INTITAL_PRIMARY_MINT.into(),
    )
    .await?;

    approve_tokens_to_spender(
        get_principal(ICP_CANISTER_ID),
        get_principal(KONG_BACKEND_CANISTER),
        INTITAL_PRIMARY_MINT.into(),
    )
    .await?;
    ic_cdk::println!("Tokens approved!");
    // Logic for scheduling within a 24-hour window:
    //
    // We have two options:
    // 1. Run the scheduler once every 24 hours.
    // 2. Run the scheduler every hour.
    //
    // Problem with option 1:
    // Let's say the scheduler runs at 12:00 AM.
    // A token is registered at 1:00 AM (1 hour later).
    // The next scheduler run is 24 hours after the first (i.e., the next 12:00 AM).
    // At that point, only 23 hours have passed since the token was registered.
    // So the scheduler skips it, thinking it's not ready yet.
    //
    // As a result, the token gets picked up in the next run —
    // which is **47 hours** after registration instead of 24.
    // That’s a problem if we want token pools to be created **after exactly 24 hours**.
    //

    // create_pool_on_kong_swap(get_principal(&primary_token_id))
    //     .await
    //     .map_err(|e| format!("Failed to create pool on Kong swap: {}", e))?;
    // ic_cdk::println!("Pool created!");

    TOKENS.with(|tokens| {
        let mut tokens = tokens.borrow_mut();
        let token_id = tokens.len() as u64 + 1; // Generate a new token ID
        let token_record = TokenRecord {
            id: token_id,
            primary_token_id: get_principal(&primary_token_id),
            primary_token_name: primary_token_name.clone(),
            primary_token_symbol: primary_token_symbol.clone(),
            primary_token_max_supply: primary_max_supply,
            secondary_token_id: get_principal(&secondary_token_id),
            secondary_token_name: secondary_token_name.clone(),
            secondary_token_symbol: secondary_token_symbol.clone(),
            icp_swap_canister_id: swap_canister_id,
            tokenomics_canister_id,
            initial_primary_mint,
            initial_secondary_burn,
            primary_max_phase_mint,
            caller: user_principal,
            created_time: ic_cdk::api::time(),
            liquidity_provided_at: 0,
            is_live: false,
        };
        tokens.insert(token_id, token_record);
    });

    Ok("Tokens created and stored!".to_string())
}

async fn create_icrc1_canister(
    token_symbol: String,
    token_name: String,
    token_description: String,
    minting_account_owner: Principal,
    archive_controller: Principal,
    intital_amount: u64,
    logo: String,
) -> Result<String, String> {
    let create_args = CreateCanisterArgument { settings: None };
    let canister_id_record = create_canister(create_args, 2_000_000_000)
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
            num_blocks_to_archive: 1000,
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

async fn create_a_canister() -> Result<Principal, String> {
    let create_args = CreateCanisterArgument { settings: None };
    let canister_id_record = create_canister(create_args, 2_000_000_000)
        .await
        .map_err(|e| format!("Failed to create canister: {:?}", e))?;

    let canister_id = canister_id_record.0.canister_id;
    Ok(canister_id)
}

async fn install_tokenomics_wasm_on_existing_canister(
    canister_id: Principal,
    primary_token_id: Option<Principal>,
    secondary_token_id: Option<Principal>,
    swap_canister_id: Option<Principal>,
    frontend_canister_id: Option<Principal>,
    max_primary_supply: u64,
    initial_primary_mint: u64,
    initial_secondary_burn: u64,
    max_primary_phase: u64,
) -> Result<(), String> {
    let args = TokenomicsInitArgs {
        primary_token_id,
        secondary_token_id,
        swap_canister_id,
        frontend_canister_id,
        max_primary_supply,
        initial_primary_mint,
        initial_secondary_burn,
        max_primary_phase,
    };
    let encoded_args = Encode!(&Some(args))
        .map_err(|e: candid::Error| format!("Failed to encode args: {:?}", e))?;

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
) -> Result<(), String> {
    let args = IcpSwapInitArgs {
        primary_token_id,
        secondary_token_id,
        tokenomics_canister_id,
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

async fn add_token_to_kong_swap(token_id: Principal) -> AddTokenResponse {
    let args: AddTokenArgs = AddTokenArgs {
        token: format!("IC.{}", token_id),
    };

    let result: Result<(AddTokenResult,), _> =
        ic_cdk::call(get_principal(KONG_BACKEND_CANISTER), "add_token", (args,)).await;

    match result {
        Ok((AddTokenResult::Ok(AddTokenReply::IC(token_info)),)) => {
            ic_cdk::println!("Token added: {:?}", token_info);
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
            AddTokenResponse::Err(format!("Add token failed: {}", err_msg))
        }
        Err(e) => {
            ic_cdk::println!("Error calling backend: {:?}", e);
            AddTokenResponse::Err("Call failed".to_string())
        }
    }
}

pub async fn create_pool_on_kong_swap(primary_token_id: Principal) -> Result<AddPoolReply, String> {
    let args = AddPoolArgs {
        token_0: format!("{}.{}", CHAIN_ID, primary_token_id),
        amount_0: (E8S).into(),
        token_1: format!("{}.{}", CHAIN_ID, ICP_CANISTER_ID), //ICP PAIR
        amount_1: (10_000_000 as u64).into(),
        on_kong: true,
    };

    let (result,): (AddPoolResult,) =
        ic_cdk::call(get_principal(KONG_BACKEND_CANISTER), "add_pool", (args,))
            .await
            .map_err(|e| format!("Call failed: {:?}", e))?;

    match result {
        AddPoolResult::Ok(reply) => Ok(reply),
        AddPoolResult::Err(e) => Err(format!("Pool creation failed: {}", e)),
    }
}

pub async fn approve_tokens_to_spender(
    ledger_canister_id: Principal,
    spender: Principal,
    amount: Nat,
) -> Result<Nat, String> {
    let args: ApproveArgs = ApproveArgs {
        fee: None,
        memo: None,
        from_subaccount: None,
        amount,
        spender: Account {
            owner: spender,
            subaccount: None,
        },
    };

    let (result,): (ApproveResult,) = ic_cdk::call(ledger_canister_id, "icrc2_approve", (args,))
        .await
        .map_err(|e| format!("Call to icrc2_approve failed: {:?}", e))?;

    match result {
        ApproveResult::Ok(block_index) => Ok(block_index),
        ApproveResult::Err(e) => Err(format!("Approval failed: {:?}", e)),
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





async fn deposit_ksicp_in_canister(
    amount: u64,
    from_subaccount: Option<[u8; 32]>
) -> Result<BlockIndex, TransferFromError> {
    let canister_id: Principal = ic_cdk::api::id();

    let big_int_amount: BigUint = BigUint::from(amount);
    let amount: Nat = Nat(big_int_amount);

    let transfer_from_args = TransferFromArgs {
        from: Account {
            owner: ic_cdk::caller(),
            subaccount: from_subaccount,
        },
        // can be used to distinguish between transactions
        memo: None,
        // the amount we want to transfer
        amount,
        // the subaccount we want to spend the tokens from (in this case we assume the default subaccount has been approved)
        spender_subaccount: None,
        // if not specified, the default fee for the canister is used
        fee: None,
        // the account we want to transfer tokens to
        to: canister_id.into(),
        // a timestamp indicating when the transaction was created by the caller; if it is not specified by the caller then this is set to the current ICP time
        created_at_time: None,
    };

    // 1. Asynchronously call another canister function using `ic_cdk::call`.
    let (result,) = ic_cdk
        ::call::<(TransferFromArgs,), (Result<BlockIndex, TransferFromError>,)>(
            // 2. Convert a textual representation of a Principal into an actual `Principal` object. The principal is the one we specified in `dfx.json`.
            //    `expect` will panic if the conversion fails, ensuring the code does not proceed with an invalid principal.
            Principal::from_text(ICP_CANISTER_ID).expect("Could not decode the principal."),
            // 3. Specify the method name on the target canister to be called, in this case, "icrc1_transfer".
            "icrc2_transfer_from",
            // 4. Provide the arguments for the call in a tuple, here `transfer_args` is encapsulated as a single-element tuple.
            (transfer_from_args,)
        ).await
        .map_err(|_| TransferFromError::GenericError {
            message: "Call failed".to_string(),
            error_code: Nat::from(0 as u32),
        })?;

    result // Return the inner Result<BlockIndex, TransferFromError>
}



pub async fn publish_eligible_tokens_on_kongswap() ->Result<String,String>{
    let time = ic_cdk::api::time(); // current time in nanoseconds
    let twenty_four_hours_in_nanos: u64 = 24*60*60*1_000_000_000;
    
    let result = TOKENS.with(|tokens| {
        let mut tokens_map = tokens.borrow_mut();
        // Step 1: Get a list of token IDs
        let keys: Vec<u64> = tokens_map.iter().map(|(id, _)| id).collect();

        keys
    });
    
    for token_id in result {
        let token_opt = TOKENS.with(|tokens| {
            let tokens_map = tokens.borrow();
            tokens_map.get(&token_id)
        });
        
        if let Some(mut token) = token_opt {
            if token.created_time + twenty_four_hours_in_nanos <= time && !token.is_live {
                match create_pool_on_kong_swap(token.primary_token_id).await {
                    Ok(_) => {
                        ic_cdk::println!("Pool created!");
                        token.is_live = true;
                        
                        TOKENS.with(|tokens| {
                            let mut tokens_map = tokens.borrow_mut();
                            tokens_map.insert(token_id, token.clone());
                        });
                        
                        ic_cdk::print(format!(
                            "Token '{}' (ID {}) is now marked as live.",
                            token.primary_token_name, token.id
                        ));
                    },
                    Err(e) => {
                        ic_cdk::print(format!("Failed to create pool on Kong swap: {}", e));
                        return Err(format!("Failed to create pool on Kong swap: {}", e));
                    }
                }
            }
        }
    }
    Ok("Published eligible tokens on KongSwap successfully.".to_string())
}