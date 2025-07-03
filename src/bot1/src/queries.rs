use crate::{
    storage::*,
    types::*,
    utils::{get_token_record, get_lbry_fun_principal},
};
use ic_cdk::api::call::call;

pub fn get_table_impl(pool_id: u64) -> Result<ValidationTable, String> {
    // Get snapshots for this pool
    let snapshots = get_snapshots(pool_id);
    if snapshots.is_empty() {
        return Err(format!("No data found for pool {}", pool_id));
    }
    
    // Get cached token info
    let token_info = get_cached_token_info(pool_id)
        .ok_or_else(|| format!("Token info not found for pool {}", pool_id))?;
    
    // Get cumulative state
    let cumulative_state = get_cumulative_state(pool_id);
    
    // Build graph data
    let mut cumulative_supply_data = GraphData {
        x_axis: vec![0], // Start with 0
        y_axis: vec![0], // Start with 0
    };
    
    let mut minted_per_epoch_data = EpochData {
        x_axis: vec![],
        y_axis: vec![],
    };
    
    let mut cost_to_mint_data = CostData {
        x_axis: vec![0], // Start with 0
        y_axis: vec![0.0], // Start with 0
    };
    
    // Process snapshots to build graph data
    for snapshot in &snapshots {
        // Cumulative supply data
        cumulative_supply_data.x_axis.push(snapshot.cumulative_secondary_burned);
        cumulative_supply_data.y_axis.push(snapshot.cumulative_primary_minted);
        
        // Minted per epoch
        minted_per_epoch_data.x_axis.push(format!("Loop {}", snapshot.loop_number));
        minted_per_epoch_data.y_axis.push(snapshot.primary_received);
        
        // Cost to mint data
        cost_to_mint_data.x_axis.push(snapshot.cumulative_primary_minted);
        cost_to_mint_data.y_axis.push(snapshot.cost_per_primary);
    }
    
    // Calculate summary metrics
    let total_loops = snapshots.len() as u32;
    let total_icp_spent = cumulative_state.total_icp_spent;
    let total_usd_cost = (total_icp_spent as f64 / E8S as f64) * ICP_USD_RATE * EFFECTIVE_SECONDARY_COST;
    let total_secondary_burned = cumulative_state.total_secondary_burned;
    let total_primary_minted = cumulative_state.total_primary_minted;
    
    let average_mint_rate = if total_secondary_burned > 0 {
        total_primary_minted as f64 / total_secondary_burned as f64
    } else {
        0.0
    };
    
    let total_dust_accumulated = cumulative_state.total_dust;
    
    Ok(ValidationTable {
        pool_id,
        token_info,
        snapshots,
        cumulative_supply_data,
        minted_per_epoch_data,
        cost_to_mint_data,
        total_loops,
        total_icp_spent,
        total_usd_cost,
        total_secondary_burned,
        total_primary_minted,
        average_mint_rate,
        total_dust_accumulated,
    })
}

pub fn clear_pool_data_impl(pool_id: u64) -> Result<String, String> {
    clear_pool_data(pool_id);
    Ok(format!("Cleared all data for pool {}", pool_id))
}

pub fn get_pool_summary(pool_id: u64) -> Result<String, String> {
    let snapshots = get_snapshots(pool_id);
    let cumulative_state = get_cumulative_state(pool_id);
    
    if snapshots.is_empty() {
        return Ok(format!("No data for pool {}", pool_id));
    }
    
    let summary = format!(
        "Pool {} Summary:\n\
        Total Loops: {}\n\
        Total ICP Spent: {} ICP\n\
        Total Secondary Burned: {} tokens\n\
        Total Primary Minted: {} tokens\n\
        Total Dust: {} tokens\n\
        Last Loop: {}",
        pool_id,
        snapshots.len(),
        cumulative_state.total_icp_spent / E8S,
        cumulative_state.total_secondary_burned / E8S,
        cumulative_state.total_primary_minted / E8S,
        cumulative_state.total_dust / E8S,
        snapshots.last().map(|s| s.loop_number).unwrap_or(0)
    );
    
    Ok(summary)
}

pub async fn get_pool_logs_impl(
    pool_id: u64, 
    page: Option<u64>, 
    page_size: Option<u64>
) -> Result<PoolLogs, String> {
    // Get token record from lbry_fun to find canister IDs
    let lbry_fun = get_lbry_fun_principal();
    let token_record = match get_token_record(lbry_fun, pool_id).await {
        Ok(record) => record,
        Err(e) => return Err(format!("Failed to get token record: {}", e)),
    };
    
    // Query logs from tokenomics canister
    let tokenomics_logs = match call::<(Option<u64>, Option<u64>), (PaginatedTokenLogs,)>(
        token_record.tokenomics_canister_id,
        "get_token_logs",
        (page, page_size),
    ).await {
        Ok((logs,)) => Some(logs),
        Err(e) => {
            ic_cdk::println!("Failed to get tokenomics logs: {:?}", e);
            None
        }
    };
    
    // Query logs from icp_swap canister
    let icp_swap_logs = match call::<(Option<u64>, Option<u64>), (PaginatedLogs,)>(
        token_record.icp_swap_canister_id,
        "get_logs",
        (page, page_size),
    ).await {
        Ok((logs,)) => Some(logs),
        Err(e) => {
            ic_cdk::println!("Failed to get icp_swap logs: {:?}", e);
            None
        }
    };
    
    Ok(PoolLogs {
        tokenomics_logs,
        icp_swap_logs,
    })
}