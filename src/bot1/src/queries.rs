use crate::{
    storage::{get_snapshots, get_cached_token_info, get_cumulative_state, add_snapshot, cache_token_info, update_cumulative_state},
    types::*,
    utils::{get_token_record, get_lbry_fun_principal, get_tokenomics_schedule},
};
use ic_cdk::api::call::call;

pub async fn get_table_impl(pool_id: u64) -> Result<ValidationTable, String> {
    // Get snapshots for this pool
    let snapshots = get_snapshots(pool_id);
    if snapshots.is_empty() {
        return Err(format!("No data found for pool {}", pool_id));
    }
    
    // Get cached token info
    let token_info = get_cached_token_info(pool_id)
        .ok_or_else(|| format!("Token info not found for pool {}", pool_id))?;
    
    // Get token record for pool parameters
    let lbry_fun = get_lbry_fun_principal();
    let token_record = get_token_record(lbry_fun, pool_id).await
        .map_err(|e| format!("Failed to get token record: {}", e))?;
    
    // Extract pool parameters
    let pool_parameters = PoolParameters {
        primary_max_supply: token_record.primary_token_max_supply,
        initial_secondary_burn: token_record.initial_secondary_burn,
        halving_step: token_record.halving_step,
        initial_reward_per_burn_unit: token_record.initial_reward_per_burn_unit,
    };
    
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
    
    let mut cumulative_usd_cost_data = GraphData {
        x_axis: vec![0], // Start with 0
        y_axis: vec![0], // Start with 0
    };
    
    let mut cumulative_percentage_supply_data = PercentageGraphData {
        x_axis: vec![0], // Start with 0
        y_axis: vec![0.0], // Start with 0
    };
    
    // Process snapshots to build graph data
    let mut cumulative_usd_cost = 0.0;
    
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
        
        // Cumulative USD cost
        let loop_usd_cost = (snapshot.icp_spent as f64 / E8S as f64) * ICP_USD_RATE * EFFECTIVE_SECONDARY_COST;
        cumulative_usd_cost += loop_usd_cost;
        cumulative_usd_cost_data.x_axis.push(snapshot.cumulative_primary_minted);
        cumulative_usd_cost_data.y_axis.push((cumulative_usd_cost * E8S as f64) as u64); // Store as E8S for consistency
        
        // Percentage of max supply
        let percentage = (snapshot.cumulative_primary_minted as f64 / pool_parameters.primary_max_supply as f64) * 100.0;
        cumulative_percentage_supply_data.x_axis.push(snapshot.cumulative_primary_minted);
        cumulative_percentage_supply_data.y_axis.push(percentage);
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
    
    // Calculate summary data
    let initial_mint_cost = if !snapshots.is_empty() {
        snapshots[0].cost_per_primary
    } else {
        0.0
    };
    
    let final_mint_cost = if !snapshots.is_empty() {
        snapshots[snapshots.len() - 1].cost_per_primary
    } else {
        0.0
    };
    
    let percentage_of_max_supply = (total_primary_minted as f64 / pool_parameters.primary_max_supply as f64) * 100.0;
    let average_cost_per_token = if total_primary_minted > 0 {
        total_usd_cost / (total_primary_minted as f64 / E8S as f64)
    } else {
        0.0
    };
    
    // Count unique epochs reached (based on different mint rates)
    let mut unique_mint_rates = std::collections::HashSet::new();
    for snapshot in &snapshots {
        unique_mint_rates.insert((snapshot.actual_mint_rate * 10000.0) as u64); // Round to 4 decimals
    }
    let epochs_reached = unique_mint_rates.len() as u32;
    
    let summary_data = SummaryData {
        epochs_reached,
        total_minting_valuation: total_usd_cost,
        initial_mint_cost,
        final_mint_cost,
        actual_total_minted: total_primary_minted,
        percentage_of_max_supply,
        average_cost_per_token,
    };
    
    Ok(ValidationTable {
        pool_id,
        token_info,
        pool_parameters,
        snapshots,
        cumulative_supply_data,
        minted_per_epoch_data,
        cost_to_mint_data,
        cumulative_usd_cost_data,
        cumulative_percentage_supply_data,
        summary_data,
        total_loops,
        total_icp_spent,
        total_usd_cost,
        total_secondary_burned,
        total_primary_minted,
        average_mint_rate,
        total_dust_accumulated,
    })
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

pub async fn get_summary_impl(pool_id: u64) -> Result<ValidationSummary, String> {
    // Get snapshots for this pool
    let snapshots = get_snapshots(pool_id);
    if snapshots.is_empty() {
        return Err(format!("No data found for pool {}", pool_id));
    }
    
    // Get cached token info
    let token_info = get_cached_token_info(pool_id)
        .ok_or_else(|| format!("Token info not found for pool {}", pool_id))?;
    
    // Get token record for pool parameters
    let lbry_fun = get_lbry_fun_principal();
    let token_record = get_token_record(lbry_fun, pool_id).await
        .map_err(|e| format!("Failed to get token record: {}", e))?;
    
    // Extract pool parameters
    let pool_parameters = PoolParameters {
        primary_max_supply: token_record.primary_token_max_supply,
        initial_secondary_burn: token_record.initial_secondary_burn,
        halving_step: token_record.halving_step,
        initial_reward_per_burn_unit: token_record.initial_reward_per_burn_unit,
    };
    
    // Detect epochs by tracking unique mint rates
    let mut epoch_data: Vec<EpochSnapshot> = vec![];
    let mut current_epoch = 0u32;
    let mut current_mint_rate = 0.0;
    let mut epoch_start_idx = 0;
    let precision = 10000.0; // Round to 4 decimal places
    
    for (idx, snapshot) in snapshots.iter().enumerate() {
        let rounded_rate = (snapshot.actual_mint_rate * precision).round() / precision;
        
        // Detect epoch change
        if idx == 0 || (rounded_rate - current_mint_rate).abs() > 0.0001 {
            // Save previous epoch data if not first iteration
            if idx > 0 {
                let epoch_snapshots = &snapshots[epoch_start_idx..idx];
                epoch_data.push(build_epoch_snapshot(
                    current_epoch,
                    current_mint_rate,
                    epoch_start_idx > 0, // halving occurred if not first epoch
                    epoch_snapshots,
                    &pool_parameters,
                ));
                current_epoch += 1;
            }
            
            current_mint_rate = rounded_rate;
            epoch_start_idx = idx;
        }
    }
    
    // Don't forget the last epoch
    if epoch_start_idx < snapshots.len() {
        let epoch_snapshots = &snapshots[epoch_start_idx..];
        epoch_data.push(build_epoch_snapshot(
            current_epoch,
            current_mint_rate,
            epoch_start_idx > 0,
            epoch_snapshots,
            &pool_parameters,
        ));
    }
    
    // Calculate summary statistics
    let first_loop = snapshots.first().unwrap().clone();
    let last_loop = snapshots.last().unwrap().clone();
    let cumulative_state = get_cumulative_state(pool_id);
    
    let total_usd_cost = (cumulative_state.total_icp_spent as f64 / E8S as f64) * ICP_USD_RATE;
    let average_cost_per_token = if cumulative_state.total_primary_minted > 0 {
        total_usd_cost / (cumulative_state.total_primary_minted as f64 / E8S as f64)
    } else {
        0.0
    };
    
    let final_percentage_minted = if pool_parameters.primary_max_supply > 0 {
        (cumulative_state.total_primary_minted as f64 / pool_parameters.primary_max_supply as f64) * 100.0
    } else {
        0.0
    };
    
    // NEW: Fetch tokenomics schedule for enhanced analysis
    let tokenomics_schedule = get_tokenomics_schedule(token_record.tokenomics_canister_id).await
        .map_err(|e| format!("Failed to get tokenomics schedule: {}", e))?;
    
    // NEW: Perform epoch crossing analysis
    let epoch_analysis = analyze_epoch_crossings(&snapshots, &tokenomics_schedule);
    
    // NEW: Add rate verification from single-epoch burns
    let rate_verification = verify_halving_rates(
        &epoch_analysis.single_epoch_burns, 
        &tokenomics_schedule,
        pool_parameters.halving_step as u32
    );
    
    // NEW: Find largest multi-epoch burn for detailed display
    let largest_multi_epoch = epoch_analysis.multi_epoch_burns.iter()
        .max_by_key(|b| b.epochs_crossed.len())
        .cloned();
    
    // NEW: Generate analysis warnings
    let analysis_warnings = generate_warnings(&epoch_analysis);
    
    Ok(ValidationSummary {
        pool_id,
        token_info,
        pool_parameters,
        total_loops: snapshots.len() as u32,
        epochs_reached: epoch_data.len() as u32,
        final_percentage_minted,
        epoch_snapshots: epoch_data,
        first_loop,
        last_loop,
        total_icp_spent: cumulative_state.total_icp_spent,
        total_usd_cost,
        average_mint_rate: cumulative_state.total_primary_minted as f64 / cumulative_state.total_secondary_burned as f64,
        average_cost_per_token,
        // NEW: Enhanced analysis fields
        epoch_analysis: Some(epoch_analysis),
        rate_verification: Some(rate_verification),
        largest_multi_epoch_burn: largest_multi_epoch,
        analysis_warnings,
    })
}

fn build_epoch_snapshot(
    epoch_number: u32,
    mint_rate: f64,
    halving_occurred: bool,
    snapshots: &[LoopSnapshot],
    pool_parameters: &PoolParameters,
) -> EpochSnapshot {
    let total_loops_in_epoch = snapshots.len() as u32;
    let total_secondary_burned_in_epoch: u64 = snapshots.iter().map(|s| s.secondary_burned).sum();
    let total_primary_minted_in_epoch: u64 = snapshots.iter().map(|s| s.primary_received).sum();
    let total_icp_spent_in_epoch: u64 = snapshots.iter().map(|s| s.icp_spent).sum();
    
    let costs: Vec<f64> = snapshots.iter().map(|s| s.cost_per_primary).collect();
    let min_cost_in_epoch = costs.iter().cloned().fold(f64::INFINITY, f64::min);
    let max_cost_in_epoch = costs.iter().cloned().fold(0.0, f64::max);
    let avg_cost_per_token_in_epoch = if !costs.is_empty() {
        costs.iter().sum::<f64>() / costs.len() as f64
    } else {
        0.0
    };
    
    let last_snapshot = snapshots.last().unwrap();
    let percentage_of_max_supply = if pool_parameters.primary_max_supply > 0 {
        (last_snapshot.cumulative_primary_minted as f64 / pool_parameters.primary_max_supply as f64) * 100.0
    } else {
        0.0
    };
    
    EpochSnapshot {
        epoch_number,
        mint_rate,
        halving_occurred,
        total_loops_in_epoch,
        total_secondary_burned_in_epoch,
        total_primary_minted_in_epoch,
        total_icp_spent_in_epoch,
        avg_cost_per_token_in_epoch,
        min_cost_in_epoch,
        max_cost_in_epoch,
        cumulative_primary_minted: last_snapshot.cumulative_primary_minted,
        cumulative_secondary_burned: last_snapshot.cumulative_secondary_burned,
        cumulative_icp_spent: last_snapshot.cumulative_icp_spent,
        percentage_of_max_supply,
    }
}

// NEW: Analysis functions for enhanced tracking

// Calculate theoretical epoch breakdown for any burn
fn calculate_theoretical_breakdown(
    start_burned: u64,        // Cumulative before this burn
    burn_amount: u64,         // Amount being burned
    schedule: &TokenomicsSchedule,
) -> Vec<TheoreticalEpochContribution> {
    let mut contributions = Vec::new();
    let mut remaining_burn = burn_amount;
    let mut current_position = start_burned;
    
    // Find starting epoch
    let mut epoch_idx = 0;
    for (i, &threshold) in schedule.thresholds.iter().enumerate() {
        if current_position < threshold {
            epoch_idx = i;
            break;
        }
    }
    
    // Process burn through epochs
    while remaining_burn > 0 && epoch_idx < schedule.thresholds.len() {
        let epoch_end = schedule.thresholds[epoch_idx];
        let burn_in_epoch = (epoch_end - current_position).min(remaining_burn);
        
        if burn_in_epoch > 0 {
            let rate_4decimal = schedule.rewards[epoch_idx];
            // Calculate minted: (burn * rate * 10_000) / E8S
            let minted = (burn_in_epoch as u128 * rate_4decimal as u128 * 10_000) / E8S as u128;
            
            contributions.push(TheoreticalEpochContribution {
                epoch_number: epoch_idx as u32,
                amount_burned: burn_in_epoch,
                rate_4decimal,
                rate_human: rate_4decimal as f64 / 10_000.0,
                amount_minted: minted as u64,
                percentage_of_burn: (burn_in_epoch as f64 / burn_amount as f64) * 100.0,
            });
        }
        
        current_position += burn_in_epoch;
        remaining_burn -= burn_in_epoch;
        epoch_idx += 1;
    }
    
    // Handle any remaining burn in the last epoch
    if remaining_burn > 0 && epoch_idx > 0 {
        let rate_4decimal = schedule.rewards[epoch_idx - 1];
        let minted = (remaining_burn as u128 * rate_4decimal as u128 * 10_000) / E8S as u128;
        
        contributions.push(TheoreticalEpochContribution {
            epoch_number: (epoch_idx - 1) as u32,
            amount_burned: remaining_burn,
            rate_4decimal,
            rate_human: rate_4decimal as f64 / 10_000.0,
            amount_minted: minted as u64,
            percentage_of_burn: (remaining_burn as f64 / burn_amount as f64) * 100.0,
        });
    }
    
    contributions
}

// Find which epoch a cumulative burn amount falls into
fn find_epoch(cumulative_burned: u64, thresholds: &[u64]) -> u32 {
    for (i, &threshold) in thresholds.iter().enumerate() {
        if cumulative_burned < threshold {
            return i as u32;
        }
    }
    thresholds.len() as u32 - 1
}

// Analyze all burns to categorize single vs multi-epoch
fn analyze_epoch_crossings(
    snapshots: &[LoopSnapshot], 
    schedule: &TokenomicsSchedule
) -> EpochCrossingAnalysis {
    let mut single_epoch_burns = Vec::new();
    let mut multi_epoch_burns = Vec::new();
    
    for snapshot in snapshots {
        let start_burned = snapshot.cumulative_secondary_burned - snapshot.secondary_burned;
        let start_epoch = find_epoch(start_burned, &schedule.thresholds);
        let end_epoch = find_epoch(snapshot.cumulative_secondary_burned, &schedule.thresholds);
        
        if start_epoch == end_epoch {
            // Single epoch burn - perfect for rate verification
            let expected_rate = schedule.rewards[start_epoch as usize] as f64 / 10_000.0;
            let actual_rate = snapshot.primary_received as f64 / snapshot.secondary_burned as f64;
            
            single_epoch_burns.push(SingleEpochBurn {
                loop_number: snapshot.loop_number,
                epoch: start_epoch,
                actual_rate,
                expected_rate,
                deviation_percent: ((actual_rate - expected_rate) / expected_rate * 100.0).abs(),
            });
        } else {
            // Multi-epoch burn - calculate theoretical breakdown
            let theoretical_breakdown = calculate_theoretical_breakdown(
                start_burned,
                snapshot.secondary_burned,
                &schedule
            );
            
            let theoretical_total: u64 = theoretical_breakdown.iter()
                .map(|e| e.amount_minted)
                .sum();
            
            multi_epoch_burns.push(MultiEpochBurn {
                loop_number: snapshot.loop_number,
                epochs_crossed: (start_epoch..=end_epoch).map(|e| e as u32).collect(),
                actual_total: snapshot.primary_received,
                theoretical_total,
                theoretical_breakdown,
                deviation_percent: ((theoretical_total as f64 - snapshot.primary_received as f64) / snapshot.primary_received as f64 * 100.0).abs(),
            });
        }
    }
    
    EpochCrossingAnalysis {
        single_epoch_burns,
        multi_epoch_burns,
    }
}

// Verify halving rates from single-epoch burns
fn verify_halving_rates(
    single_epoch_burns: &[SingleEpochBurn], 
    _schedule: &TokenomicsSchedule,
    halving_step: u32,
) -> RateVerification {
    let mut observed_halvings = Vec::new();
    
    // Group burns by epoch
    let mut epochs_data: std::collections::HashMap<u32, Vec<f64>> = std::collections::HashMap::new();
    for burn in single_epoch_burns {
        epochs_data.entry(burn.epoch)
            .or_insert_with(Vec::new)
            .push(burn.actual_rate);
    }
    
    // Calculate average rate per epoch
    let mut epoch_rates: Vec<(u32, f64)> = epochs_data.into_iter()
        .map(|(epoch, rates)| {
            let avg_rate = rates.iter().sum::<f64>() / rates.len() as f64;
            (epoch, avg_rate)
        })
        .collect();
    epoch_rates.sort_by_key(|(epoch, _)| *epoch);
    
    // Check halving between consecutive epochs
    for i in 0..epoch_rates.len().saturating_sub(1) {
        let (epoch1, rate1) = epoch_rates[i];
        let (epoch2, rate2) = epoch_rates[i+1];
        
        let observed_percentage = (rate2 / rate1 * 100.0).round();
        observed_halvings.push(ObservedHalving {
            from_epoch: epoch1,
            to_epoch: epoch2,
            observed_percentage,
        });
    }
    
    // Determine status
    let configured_halving = halving_step; 
    let all_match = observed_halvings.iter()
        .all(|h| (h.observed_percentage - configured_halving as f64).abs() < 2.0);
    
    let status = if observed_halvings.is_empty() {
        VerificationStatus::InsufficientData
    } else if all_match {
        VerificationStatus::Verified
    } else {
        let avg_observed = observed_halvings.iter()
            .map(|h| h.observed_percentage)
            .sum::<f64>() / observed_halvings.len() as f64;
        VerificationStatus::Mismatch { 
            expected: configured_halving as f64, 
            observed: avg_observed 
        }
    };
    
    RateVerification {
        configured_halving,
        observed_halvings,
        status,
    }
}

// Generate warnings based on analysis
fn generate_warnings(analysis: &EpochCrossingAnalysis) -> Vec<String> {
    let mut warnings = Vec::new();
    
    // Check for high deviations in single-epoch burns
    let high_deviation_burns: Vec<_> = analysis.single_epoch_burns.iter()
        .filter(|b| b.deviation_percent > 1.0)
        .collect();
    
    if !high_deviation_burns.is_empty() {
        warnings.push(format!(
            "Found {} single-epoch burns with >1% deviation from expected rates", 
            high_deviation_burns.len()
        ));
    }
    
    // Check for high deviations in multi-epoch burns
    let high_deviation_multi: Vec<_> = analysis.multi_epoch_burns.iter()
        .filter(|b| b.deviation_percent > 1.0)
        .collect();
    
    if !high_deviation_multi.is_empty() {
        warnings.push(format!(
            "Found {} multi-epoch burns with >1% deviation from theoretical calculations", 
            high_deviation_multi.len()
        ));
    }
    
    // Recommend single-epoch burns if insufficient data
    if analysis.single_epoch_burns.len() < 3 {
        warnings.push(
            "Insufficient single-epoch burns for rate verification. Consider performing burns that stay within single epochs.".to_string()
        );
    }
    
    warnings
}