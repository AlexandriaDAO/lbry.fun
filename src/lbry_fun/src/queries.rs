use ic_cdk::{query, update};
use candid::{CandidType, Principal};
use serde::Deserialize;
use crate::{TokenRecord, TOKENS, get_self_icp_balance};
use crate::simulation_new::{GraphData, PreviewArgs};
use crate::tokenomics_simple::{preview_tokenomics_from_frontend, TokenomicsSchedule};

#[query]
pub fn get_all_token_record() -> Vec<(u64, TokenRecord)> {
    TOKENS.with(|tokens| {
        let tokens_map = tokens.borrow();

        // return a Vec of tuples
        tokens_map
            .iter()
            .map(|(principal, stake)| (principal.clone(), stake.clone())) // Clone to ensure ownership
            .collect()
    })
}


#[query]
pub fn get_upcomming() -> Vec<(u64, TokenRecord)> {
    let current_time = ic_cdk::api::time();
    
    TOKENS.with(|tokens| {
        let tokens_map = tokens.borrow();

        tokens_map
            .iter()
            .filter(|(_, token)| {
                // Not live if: pool creation failed, pool not created yet, or still within launch delay
                let launch_delay_nanos = token.launch_delay_seconds * 1_000_000_000;
                token.pool_creation_failed || 
                token.pool_created_at == 0 || 
                current_time < token.created_time + launch_delay_nanos
            })
            .map(|(id, token)| (id.clone(), token.clone()))
            .collect()
    })
}

#[query]
pub fn get_live() -> Vec<(u64, TokenRecord)> {
    let current_time = ic_cdk::api::time();
    
    TOKENS.with(|tokens| {
        let tokens_map = tokens.borrow();

        tokens_map
            .iter()
            .filter(|(_, token)| {
                // Live if: pool created successfully AND launch delay has passed
                let launch_delay_nanos = token.launch_delay_seconds * 1_000_000_000;
                !token.pool_creation_failed && 
                token.pool_created_at > 0 && 
                current_time >= token.created_time + launch_delay_nanos
            })
            .map(|(id, token)| (id.clone(), token.clone()))
            .collect()
    })
}

#[query]
async fn get_treasury_balance() -> Result<u64, String> {
    let canister_principal = ic_cdk::api::id();
    get_self_icp_balance(canister_principal).await
}

#[update]
async fn preview_tokenomics_graphs(args: PreviewArgs) -> GraphData {
    // Use the fixed simulation that matches the actual tokenomics formula
    use crate::simulation_new::preview_tokenomics;
    preview_tokenomics(args)
}

#[update]
async fn preview_tokenomics_schedule(
    primary_per_threshold: u64,      // Natural units (e.g., 5 tokens)
    max_primary_supply: u64,         // E8S (e.g., 21_000_000 * 10^8)
    initial_secondary_burn: u64,     // Natural units (e.g., 21000 tokens)
    halving_step: u64,               // Percentage (e.g., 50 for 50%)
    tge_allocation: u64,             // E8S
) -> TokenomicsSchedule {
    preview_tokenomics_from_frontend(
        primary_per_threshold,
        max_primary_supply,
        initial_secondary_burn,
        halving_step,
        tge_allocation,
    )
}

// Token status structure for icp_swap canister
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TokenStatus {
    pub created_time: u64,
    pub pool_creation_failed: bool,
    pub pool_created_at: u64,
    pub launch_delay_seconds: u64,
}

#[query]
pub fn get_token_status_by_swap_canister(swap_canister_id: Principal) -> Option<TokenStatus> {
    TOKENS.with(|tokens| {
        let tokens_map = tokens.borrow();
        
        // Find token by swap canister ID
        for (_, token) in tokens_map.iter() {
            if token.icp_swap_canister_id == swap_canister_id {
                return Some(TokenStatus {
                    created_time: token.created_time,
                    pool_creation_failed: token.pool_creation_failed,
                    pool_created_at: token.pool_created_at,
                    launch_delay_seconds: token.launch_delay_seconds,
                });
            }
        }
        
        None
    })
}

#[query]
pub fn get_token_status(token_id: u64) -> Option<TokenStatusDetail> {
    TOKENS.with(|tokens| {
        let tokens_map = tokens.borrow();
        tokens_map.get(&token_id).map(|token| {
            let current_time = ic_cdk::api::time();
            let launch_delay_nanos = token.launch_delay_seconds * 1_000_000_000;
            let time_until_live = if token.pool_creation_failed || token.pool_created_at == 0 {
                0 // Not applicable if pool creation failed or hasn't been created
            } else if current_time >= token.created_time + launch_delay_nanos {
                0 // Already live
            } else {
                (token.created_time + launch_delay_nanos) - current_time
            };
            
            TokenStatusDetail {
                token_id,
                created_time: token.created_time,
                pool_creation_failed: token.pool_creation_failed,
                pool_created_at: token.pool_created_at,
                is_live: !token.pool_creation_failed && 
                        token.pool_created_at > 0 && 
                        current_time >= token.created_time + launch_delay_nanos,
                time_until_live_nanos: time_until_live,
                primary_token_symbol: token.primary_token_symbol.clone(),
                secondary_token_symbol: token.secondary_token_symbol.clone(),
            }
        })
    })
}

#[query]
pub fn get_tokenomics_graphs(pool_id: u64) -> Result<GraphData, String> {
    // 1. Look up the token record
    let token_record = TOKENS.with(|tokens| {
        tokens.borrow().get(&pool_id)
    }).ok_or_else(|| format!("Token with ID {} not found", pool_id))?;
    
    // 2. For old tokens, values are stored as natural units, not E8S
    // The comments in preview_tokenomics_from_frontend are incorrect
    let args = PreviewArgs {
        primary_max_supply: token_record.primary_token_max_supply,
        tge_allocation: token_record.initial_primary_mint,
        initial_secondary_burn: token_record.initial_secondary_burn,
        halving_step: token_record.halving_step,
        initial_reward_per_burn_unit: token_record.initial_reward_per_burn_unit,
    };
    
    // 3. Use the existing preview logic
    use crate::simulation_new::preview_tokenomics;
    Ok(preview_tokenomics(args))
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TokenStatusDetail {
    pub token_id: u64,
    pub created_time: u64,
    pub pool_creation_failed: bool,
    pub pool_created_at: u64,
    pub is_live: bool,
    pub time_until_live_nanos: u64,
    pub primary_token_symbol: String,
    pub secondary_token_symbol: String,
}

