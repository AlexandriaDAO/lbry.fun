use candid::{CandidType, Deserialize, Encode, Principal};
use ic_cdk::api::management_canister::main::{
    create_canister, delete_canister, install_code, stop_canister,
    CanisterIdRecord, CanisterInstallMode, CreateCanisterArgument, InstallCodeArgument,
};
use crate::{TokenomicsInitArgs, E8S};
use crate::simulation_new::{PreviewArgs, GraphData};

const TEMP_CANISTER_CYCLES: u128 = 500_000_000_000; // 0.5T cycles for temporary canister

#[derive(CandidType, Deserialize, Clone, Debug, Default)]
pub struct TokenomicsSchedule {
    pub secondary_burn_thresholds: Vec<u64>,
    pub primary_mint_per_threshold: Vec<u64>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Configs {
    pub primary_token_id: Principal,
    pub secondary_token_id: Principal,
    pub swap_canister_id: Principal,
    pub max_primary_supply: u64,
    pub initial_primary_mint: u64,
    pub initial_secondary_burn: u64,
    pub halving_step: u64,
}

pub async fn preview_tokenomics_with_real_canister(args: PreviewArgs) -> Result<GraphData, String> {
    // Deploy temporary tokenomics canister
    let temp_canister_id = deploy_preview_tokenomics(args.clone()).await?;
    
    // Get the schedule from the canister
    let schedule = get_schedule_from_canister(temp_canister_id).await?;
    
    // Get the config for additional info
    let config = get_config_from_canister(temp_canister_id).await?;
    
    // Convert to graph data
    let graph_data = schedule_to_graph_data(schedule, config, args);
    
    // Clean up - delete the temporary canister
    delete_temp_canister(temp_canister_id).await?;
    
    Ok(graph_data)
}

async fn deploy_preview_tokenomics(args: PreviewArgs) -> Result<Principal, String> {
    // Create a new canister
    let create_args = CreateCanisterArgument {
        settings: None,
    };
    
    let (canister_id,): (CanisterIdRecord,) = create_canister(create_args, TEMP_CANISTER_CYCLES)
        .await
        .map_err(|(code, msg)| format!("Failed to create canister: {:?} - {}", code, msg))?;
    
    let canister_principal = canister_id.canister_id;
    
    // Install tokenomics wasm
    let init_args = TokenomicsInitArgs {
        primary_token_id: Some(Principal::anonymous()), // Use dummy values for preview
        secondary_token_id: Some(Principal::anonymous()),
        swap_canister_id: Some(Principal::anonymous()),
        max_primary_supply: args.primary_max_supply,
        initial_primary_mint: args.tge_allocation,
        initial_secondary_burn: args.initial_secondary_burn,
        halving_step: args.halving_step,
        initial_reward_per_burn_unit: args.initial_reward_per_burn_unit,
    };
    
    let encoded_args = Encode!(&Some(init_args))
        .map_err(|e| format!("Failed to encode args: {:?}", e))?;
    
    let wasm_module = include_bytes!("tokenomics.wasm").to_vec();
    
    let install_args = InstallCodeArgument {
        mode: CanisterInstallMode::Install,
        canister_id: canister_principal,
        wasm_module,
        arg: encoded_args,
    };
    
    install_code(install_args)
        .await
        .map_err(|(code, msg)| format!("Failed to install code: {:?} - {}", code, msg))?;
    
    Ok(canister_principal)
}

async fn get_schedule_from_canister(canister_id: Principal) -> Result<TokenomicsSchedule, String> {
    let result: Result<(TokenomicsSchedule,), _> = 
        ic_cdk::call(canister_id, "get_tokenomics_schedule", ())
        .await
        .map_err(|e| format!("Failed to get schedule: {:?}", e));
    
    match result {
        Ok((schedule,)) => Ok(schedule),
        Err(e) => Err(e),
    }
}

async fn get_config_from_canister(canister_id: Principal) -> Result<Configs, String> {
    let result: Result<(Configs,), _> = 
        ic_cdk::call(canister_id, "get_config", ())
        .await
        .map_err(|e| format!("Failed to get config: {:?}", e));
    
    match result {
        Ok((config,)) => Ok(config),
        Err(e) => Err(e),
    }
}

fn schedule_to_graph_data(schedule: TokenomicsSchedule, _config: Configs, args: PreviewArgs) -> GraphData {
    let mut graph_data = GraphData::default();
    
    let secondary_thresholds = &schedule.secondary_burn_thresholds;
    let primary_rewards = &schedule.primary_mint_per_threshold;
    
    if secondary_thresholds.is_empty() || primary_rewards.is_empty() {
        return graph_data;
    }
    
    let mut cumulative_primary: u64 = 0;
    let mut previous_threshold: u64 = 0;
    
    // Add initial point (0,0)
    graph_data.cumulative_supply_data_x.push(0);
    graph_data.cumulative_supply_data_y.push(0);
    
    // Add TGE if present
    if args.tge_allocation > 0 {
        cumulative_primary = args.tge_allocation;
        graph_data.cumulative_supply_data_x.push(0);
        graph_data.cumulative_supply_data_y.push(cumulative_primary);
    }
    
    // Process each epoch
    for i in 0..secondary_thresholds.len() {
        let threshold = secondary_thresholds[i];
        let reward_per_threshold = primary_rewards[i];
        
        // Calculate secondary burned in this epoch
        let secondary_in_epoch = threshold - previous_threshold;
        
        // Calculate primary minted in this epoch
        // Using the actual tokenomics formula from the canister (script.rs line 144)
        let reward_e8s = (reward_per_threshold * secondary_in_epoch * 10000);
        let primary_in_epoch = reward_e8s / E8S;
        
        cumulative_primary += primary_in_epoch;
        
        // Add to cumulative supply data
        graph_data.cumulative_supply_data_x.push(threshold);
        graph_data.cumulative_supply_data_y.push(cumulative_primary);
        
        // Add to minted per epoch data (skip epoch 0)
        if i > 0 || args.tge_allocation == 0 {
            let epoch_num = if args.tge_allocation > 0 { i + 1 } else { i + 1 };
            graph_data.minted_per_epoch_data_x.push(format!("Epoch {}", epoch_num));
            graph_data.minted_per_epoch_data_y.push(primary_in_epoch);
        }
        
        // Calculate cost per token for this epoch
        let cost_per_token = if primary_in_epoch > 0 {
            (secondary_in_epoch as f64 / E8S as f64) * 0.01 / (primary_in_epoch as f64 / E8S as f64)
        } else {
            0.0
        };
        
        // Add cost to mint data
        if i == 0 && graph_data.cost_to_mint_data_x.is_empty() {
            graph_data.cost_to_mint_data_x.push(0);
            graph_data.cost_to_mint_data_y.push(0.0);
        }
        
        if cumulative_primary > 0 {
            graph_data.cost_to_mint_data_x.push(cumulative_primary - primary_in_epoch);
            graph_data.cost_to_mint_data_y.push(cost_per_token);
            graph_data.cost_to_mint_data_x.push(cumulative_primary);
            graph_data.cost_to_mint_data_y.push(cost_per_token);
        }
        
        // Calculate cumulative USD cost
        let cumulative_usd = (threshold as f64 / E8S as f64) * 0.01;
        graph_data.cumulative_usd_cost_data_x.push(cumulative_primary);
        graph_data.cumulative_usd_cost_data_y.push(cumulative_usd);
        
        previous_threshold = threshold;
    }
    
    graph_data
}

async fn delete_temp_canister(canister_id: Principal) -> Result<(), String> {
    // First stop the canister
    stop_canister(CanisterIdRecord { canister_id })
        .await
        .map_err(|(code, msg)| format!("Failed to stop canister: {:?} - {}", code, msg))?;
    
    // Then delete it
    delete_canister(CanisterIdRecord { canister_id })
        .await
        .map_err(|(code, msg)| format!("Failed to delete canister: {:?} - {}", code, msg))?;
    
    Ok(())
}