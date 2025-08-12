use candid::{CandidType, Principal};
use ic_cdk::{query, update};
use ic_cdk_timers::set_timer_interval;
use serde::{Deserialize};
use std::cell::RefCell;
use std::collections::BTreeMap;
use std::time::Duration;

use crate::{TOKENS};

// Constants
const MIN_COLLECTION_AMOUNT: u64 = 1_000_000;     // 0.01 ICP per token
const MIN_SWAP_AMOUNT: u64 = 100_000_000;         // 1 ICP total
const COLLECTION_INTERVAL: u64 = 3600;             // 1 hour
const OPERATION_TIMEOUT: u64 = 600_000_000_000;   // 10 minutes in nanoseconds
const DE_PEG_THRESHOLD: f64 = 0.0001;              // 0.01% price deviation triggers alert
const STAGNATION_THRESHOLD: u64 = 86400;          // 24 hours without collection

// Audit state for monitoring
#[derive(CandidType, Deserialize, Clone)]
pub struct AuditState {
    pub last_successful_collection: u64,
    pub consecutive_failures: u32,
    pub total_value_locked: u64,
    pub expected_value: u64,
    pub de_peg_detected: bool,
}

// State machine for swap operations
#[derive(CandidType, Deserialize, Clone)]
pub enum SwapState {
    Idle,
    Collecting { started_at: u64 },
    Swapping { amount: u64, started_at: u64 },
    Burning { lbry_amount: u64, started_at: u64 },
    Failed { error: String, timestamp: u64 },
}

// Enhanced token info with audit data
#[derive(CandidType, Deserialize)]
pub struct TokenCollectionInfo {
    pub canister_id: Principal,
    pub registered_at: u64,
    pub total_collected: u64,
    pub last_collection_attempt: u64,
    pub last_successful_collection: u64,
    pub consecutive_failures: u32,
}

// Collection summary (defined later in file)

// Query 1: Pure reconciliation summary
#[derive(CandidType, Deserialize)]
pub struct SystemReconciliationSummary {
    pub total_expected_fees: u64,
    pub total_uncollected_alex: u64,
    pub tokens_with_discrepancies: Vec<Principal>,
    pub timestamp: u64,
}

// Query 2: Collection performance metrics
#[derive(CandidType, Deserialize)]
pub struct CollectionMetrics {
    pub total_accumulated_icp: u64,
    pub total_burned_lbry: u64,
    pub collection_efficiency_basis_points: u32,  // 0-10000 (100% = 10000)
    pub last_successful_collection: u64,
    pub average_collection_interval: u64,
    pub failed_collections_24h: u32,
}

// Query 3: Per-token health status
#[derive(CandidType, Deserialize)]
pub struct TokenHealthSummary {
    pub healthy_tokens: u32,
    pub unhealthy_tokens: u32,
    pub stagnant_tokens: Vec<Principal>,
    pub tokens_with_failures: Vec<TokenFailureInfo>,
}

#[derive(CandidType, Deserialize)]
pub struct TokenFailureInfo {
    pub token_id: Principal,
    pub consecutive_failures: u32,
    pub last_error: String,
    pub uncollected_amount: u64,
}

// Mirror of ICP Swap's ReconciliationStatus type for cross-canister calls
#[derive(CandidType, Deserialize)]
pub struct ReconciliationStatus {
    pub icp_balance_actual: u64,
    pub icp_balance_expected: u64,
    pub discrepancy_e8s: i64,
    pub reward_pool: u64,
    pub uncollected_alex_fees: u64,
    pub total_staked: u64,
    pub operational_balance: u64,
    pub timestamp: u64,
    pub canister_id: Principal,
    pub requires_attention: bool,
    pub operational_balance_suspicious: bool,
}

// For individual token reconciliation
#[derive(CandidType, Deserialize)]
pub struct ReconciliationDetail {
    pub token_id: Principal,
    pub icp_swap_canister: Principal,
    pub reconciliation: ReconciliationStatus,
}

// Collection summary for internal use
#[derive(CandidType, Deserialize)]
pub struct CollectionSummary {
    pub total_collected: u64,
    pub successful_collections: u32,
    pub failed_collections: u32,
    pub collection_results: Vec<(Principal, Result<u64, String>)>,
    pub will_swap: bool,
    pub audit_alerts: AuditAlerts,
}

#[derive(CandidType, Deserialize)]
pub struct AuditAlerts {
    pub de_peg_detected: bool,
    pub stagnation_detected: bool,
    pub collection_efficiency: f64,
}

// Main state
thread_local! {
    static TOKEN_REGISTRY: RefCell<BTreeMap<Principal, TokenCollectionInfo>> = RefCell::new(BTreeMap::new());
    static SWAP_STATE: RefCell<SwapState> = RefCell::new(SwapState::Idle);
    static TOTAL_ACCUMULATED: RefCell<u64> = RefCell::new(0);
    static TOTAL_BURNED: RefCell<u64> = RefCell::new(0);
    static AUDIT_STATE: RefCell<AuditState> = RefCell::new(AuditState {
        last_successful_collection: 0,
        consecutive_failures: 0,
        total_value_locked: 0,
        expected_value: 0,
        de_peg_detected: false,
    });
}

// Initialize timer on canister creation
pub fn init_collection_timer() {
    set_timer_interval(
        Duration::from_secs(COLLECTION_INTERVAL), 
        || {
            ic_cdk::spawn(async {
                let _ = collect_all_fees_internal().await;
            });
        }
    );
}

// Internal collection function with auditing
async fn collect_all_fees_internal() -> Result<CollectionSummary, String> {
    // Auto-recover from stuck states
    SWAP_STATE.with(|state| {
        let now = ic_cdk::api::time();
        match state.borrow().clone() {
            SwapState::Collecting { started_at } |
            SwapState::Swapping { started_at, .. } |
            SwapState::Burning { started_at, .. } => {
                if now > started_at + OPERATION_TIMEOUT {
                    *state.borrow_mut() = SwapState::Failed {
                        error: "Operation timed out - auto recovered".to_string(),
                        timestamp: now,
                    };
                    
                    // Update audit state
                    AUDIT_STATE.with(|audit| {
                        let mut a = audit.borrow_mut();
                        a.consecutive_failures += 1;
                    });
                }
            }
            _ => {}
        }
    });
    
    // Check if we can proceed
    SWAP_STATE.with(|state| {
        match &*state.borrow() {
            SwapState::Idle | SwapState::Failed { .. } => Ok(()),
            _ => Err("Collection already in progress".to_string()),
        }
    })?;
    
    // Set state to collecting
    SWAP_STATE.with(|s| *s.borrow_mut() = SwapState::Collecting { 
        started_at: ic_cdk::api::time() 
    });
    
    // NEW: Add reconciliation check before collection
    let reconciliation = get_system_reconciliation().await;
    if !reconciliation.tokens_with_discrepancies.is_empty() {
        ic_cdk::print(format!(
            "Warning: {} tokens have balance discrepancies before collection",
            reconciliation.tokens_with_discrepancies.len()
        ));
    }
    
    let mut total_collected = 0u64;
    let mut successful_collections = 0u32;
    let mut failed_collections = 0u32;
    let mut collection_results = Vec::new();
    let mut expected_total = 0u64;
    
    // Get all registered tokens from TOKENS storage
    let token_ids: Vec<Principal> = TOKENS.with(|tokens| {
        tokens.borrow()
            .iter()
            .map(|(_, record)| record.icp_swap_canister_id)
            .collect()
    });
    
    // Collect from each token independently
    for token_id in token_ids {
        // Query expected amount
        let (alex_fees, _) = match query_uncollected_fees(token_id).await {
            Ok(fees) => fees,
            Err(_) => (0, 0),
        };
        
        expected_total += alex_fees;
        
        match collect_from_token(token_id).await {
            Ok(amount) => {
                if amount > 0 {
                    total_collected = total_collected.saturating_add(amount);
                    successful_collections += 1;
                    
                    // Update registry
                    TOKEN_REGISTRY.with(|reg| {
                        if let Some(info) = reg.borrow_mut().get_mut(&token_id) {
                            info.total_collected = info.total_collected.saturating_add(amount);
                            info.last_successful_collection = ic_cdk::api::time();
                            info.consecutive_failures = 0;
                        }
                    });
                }
                collection_results.push((token_id, Ok(amount)));
            }
            Err(e) => {
                failed_collections += 1;
                collection_results.push((token_id, Err(e.clone())));
                
                // Update failure tracking
                TOKEN_REGISTRY.with(|reg| {
                    if let Some(info) = reg.borrow_mut().get_mut(&token_id) {
                        info.consecutive_failures += 1;
                        info.last_collection_attempt = ic_cdk::api::time();
                    }
                });
            }
        }
    }
    
    // Audit for de-pegging
    // MODIFY: Enhanced depegging detection using integer arithmetic
    let de_peg_detected = if expected_total > 0 {
        // Use basis points for precision without floating point
        let actual_basis_points = (total_collected as u128 * 10000 / expected_total as u128) as u32;
        let deviation_basis_points = if actual_basis_points > 10000 {
            actual_basis_points - 10000
        } else {
            10000 - actual_basis_points
        };
        
        // NEW: Also check for balance discrepancies in individual tokens
        let health_summary = get_token_health_summary();
        let has_unhealthy_tokens = health_summary.unhealthy_tokens > 0 || 
                                  !health_summary.stagnant_tokens.is_empty();
        
        // DE_PEG_THRESHOLD_BASIS_POINTS = 1 (0.01% as basis points)
        deviation_basis_points > 1 || has_unhealthy_tokens
    } else {
        false
    };
    
    // Calculate collection efficiency for the summary (still uses float for audit alerts)
    let collection_efficiency = if expected_total > 0 {
        total_collected as f64 / expected_total as f64
    } else {
        1.0
    };
    
    // Check for stagnation
    let now = ic_cdk::api::time();
    let stagnation_detected = AUDIT_STATE.with(|audit| {
        let last_success = audit.borrow().last_successful_collection;
        now - last_success > STAGNATION_THRESHOLD * 1_000_000_000
    });
    
    // Update audit state
    AUDIT_STATE.with(|audit| {
        let mut a = audit.borrow_mut();
        if total_collected > 0 {
            a.last_successful_collection = now;
            a.consecutive_failures = 0;
        } else {
            a.consecutive_failures += 1;
        }
        a.total_value_locked = TOTAL_ACCUMULATED.with(|t| *t.borrow());
        a.expected_value = expected_total;
        a.de_peg_detected = de_peg_detected;
    });
    
    // Log critical alerts
    if de_peg_detected {
        ic_cdk::println!("CRITICAL: De-pegging detected! Collection efficiency: {:.2}%", 
                         collection_efficiency * 100.0);
    }
    
    if stagnation_detected {
        ic_cdk::println!("CRITICAL: Collection stagnation detected! No successful collection in 24h");
    }
    
    // Update accumulated total
    TOTAL_ACCUMULATED.with(|total| {
        let new_total = total.borrow().saturating_add(total_collected);
        *total.borrow_mut() = new_total;
    });
    
    // Reset to idle - collection phase complete
    SWAP_STATE.with(|s| *s.borrow_mut() = SwapState::Idle);
    
    // Check if we should trigger swap
    let accumulated = TOTAL_ACCUMULATED.with(|t| *t.borrow());
    if accumulated >= MIN_SWAP_AMOUNT {
        ic_cdk_timers::set_timer(Duration::from_secs(1), || {
            ic_cdk::spawn(async {
                let _ = execute_swap_and_burn().await;
            });
        });
    }
    
    Ok(CollectionSummary {
        total_collected,
        successful_collections,
        failed_collections,
        collection_results,
        will_swap: accumulated >= MIN_SWAP_AMOUNT,
        audit_alerts: AuditAlerts {
            de_peg_detected,
            stagnation_detected,
            collection_efficiency,
        },
    })
}

// Query uncollected fees from an ICP Swap canister
async fn query_uncollected_fees(token_id: Principal) -> Result<(u64, u64), String> {
    let (result,): ((u64, u64),) = ic_cdk::call(
        token_id,
        "get_uncollected_fees",
        (),
    ).await
    .map_err(|e| format!("Failed to query fees: {:?}", e))?;
    
    Ok(result)
}

// Collect from a specific token
async fn collect_from_token(token_id: Principal) -> Result<u64, String> {
    #[derive(CandidType, Deserialize)]
    struct CollectionResult {
        collected: u64,
        timestamp: u64,
    }

    #[derive(CandidType, Deserialize)]
    enum CollectionError {
        AmountTooSmall { amount: u64 },
        TransferFailed { reason: String },
    }

    let result: Result<(Result<CollectionResult, CollectionError>,), _> = ic_cdk::call(
        token_id,
        "collect_alex_fees",
        (),
    ).await;
    
    match result {
        Ok((Ok(collection),)) => Ok(collection.collected),
        Ok((Err(CollectionError::AmountTooSmall { amount: _ }),)) => {
            // This is not an error, just not enough to collect yet
            Ok(0)
        }
        Ok((Err(CollectionError::TransferFailed { reason }),)) => {
            Err(format!("Transfer failed: {}", reason))
        }
        Err(e) => Err(format!("Call failed: {:?}", e)),
    }
}

// Execute swap and burn (placeholder - implement based on your DEX integration)
async fn execute_swap_and_burn() -> Result<String, String> {
    // TODO: Implement swap logic with KongSwap or other DEX
    // 1. Swap ICP for LBRY tokens
    // 2. Burn LBRY tokens
    // 3. Update metrics
    Ok("Swap and burn executed".to_string())
}

// Query functions
#[query]
pub fn get_audit_state() -> AuditState {
    AUDIT_STATE.with(|a| a.borrow().clone())
}

#[query]
pub fn get_problematic_tokens() -> Vec<(Principal, u32)> {
    TOKEN_REGISTRY.with(|reg| {
        reg.borrow()
            .iter()
            .filter(|(_, info)| info.consecutive_failures > 3)
            .map(|(id, info)| (*id, info.consecutive_failures))
            .collect()
    })
}

#[query]
pub fn get_collection_status() -> (SwapState, u64) {
    (
        SWAP_STATE.with(|s| s.borrow().clone()),
        TOTAL_ACCUMULATED.with(|t| *t.borrow())
    )
}

// Removed public trigger_collection() - collection should only happen via timer

// Add reconciliation timer function
pub fn init_reconciliation_timer() {
    // Run reconciliation check every 6 hours
    set_timer_interval(
        Duration::from_secs(21600), // 6 hours
        || {
            ic_cdk::spawn(async {
                // Check reconciliation
                let reconciliation = get_system_reconciliation().await;
                if !reconciliation.tokens_with_discrepancies.is_empty() {
                    ic_cdk::print(format!(
                        "Reconciliation Alert - {} tokens have balance discrepancies",
                        reconciliation.tokens_with_discrepancies.len()
                    ));
                }
                
                // Check token health separately
                let health = get_token_health_summary();
                if health.unhealthy_tokens > 0 {
                    ic_cdk::print(format!(
                        "Token Health Alert - {} unhealthy tokens, {} stagnant",
                        health.unhealthy_tokens,
                        health.stagnant_tokens.len()
                    ));
                }
            });
        }
    );
}

// Query 1: System Reconciliation (Balance Focus)
#[update]
pub async fn get_system_reconciliation() -> SystemReconciliationSummary {
    let mut total_uncollected_alex = 0u64;
    let mut tokens_with_discrepancies = Vec::new();
    let mut failed_queries = Vec::new();
    
    // Query all registered tokens
    let token_records: Vec<(u64, Principal)> = TOKENS.with(|t| {
        t.borrow().iter()
            .map(|(id, record)| (id, record.icp_swap_canister_id))
            .collect()
    });
    
    for (_token_id, icp_swap_id) in token_records {
        match query_uncollected_fees(icp_swap_id).await {
            Ok((alex_fees, _)) => {
                total_uncollected_alex += alex_fees;
            }
            Err(e) => {
                failed_queries.push((icp_swap_id, e.to_string()));
            }
        }
    }
    
    // Consider failed queries as potential discrepancies
    for (icp_swap_id, _) in &failed_queries {
        tokens_with_discrepancies.push(*icp_swap_id);
    }
    
    SystemReconciliationSummary {
        total_expected_fees: total_uncollected_alex,  // Currently only collecting ALEX fees
        total_uncollected_alex,
        tokens_with_discrepancies,
        timestamp: ic_cdk::api::time(),
    }
}

// Query 2: Collection Metrics (Performance Focus)
#[update]
pub fn get_collection_metrics() -> CollectionMetrics {
    let total_accumulated = TOTAL_ACCUMULATED.with(|t| *t.borrow());
    let total_burned = TOTAL_BURNED.with(|t| *t.borrow());
    let audit_state = AUDIT_STATE.with(|a| a.borrow().clone());
    
    // Calculate collection efficiency from recent collections
    // This is a simplified calculation - could be enhanced with historical data
    let collection_efficiency_basis_points = if audit_state.expected_value > 0 {
        let efficiency = (audit_state.total_value_locked as u128 * 10000) 
            / audit_state.expected_value as u128;
        efficiency.min(10000) as u32
    } else {
        10000  // 100% if no expected value
    };
    
    CollectionMetrics {
        total_accumulated_icp: total_accumulated,
        total_burned_lbry: total_burned,
        collection_efficiency_basis_points,
        last_successful_collection: audit_state.last_successful_collection,
        average_collection_interval: COLLECTION_INTERVAL,
        failed_collections_24h: audit_state.consecutive_failures,
    }
}

// Query 3: Token Health (Status Focus)
#[update]
pub fn get_token_health_summary() -> TokenHealthSummary {
    let mut healthy_count = 0u32;
    let mut unhealthy_count = 0u32;
    let mut stagnant_tokens = Vec::new();
    let mut tokens_with_failures = Vec::new();
    
    let current_time = ic_cdk::api::time();
    let stagnation_threshold = current_time - (STAGNATION_THRESHOLD * 1_000_000_000);
    
    TOKEN_REGISTRY.with(|registry| {
        for (token_id, info) in registry.borrow().iter() {
            if info.consecutive_failures > 0 {
                unhealthy_count += 1;
                tokens_with_failures.push(TokenFailureInfo {
                    token_id: *token_id,
                    consecutive_failures: info.consecutive_failures,
                    last_error: "Collection failed".to_string(),
                    uncollected_amount: 0,  // Would need async call to get
                });
            } else {
                healthy_count += 1;
            }
            
            if info.last_successful_collection < stagnation_threshold {
                stagnant_tokens.push(*token_id);
            }
        }
    });
    
    TokenHealthSummary {
        healthy_tokens: healthy_count,
        unhealthy_tokens: unhealthy_count,
        stagnant_tokens,
        tokens_with_failures,
    }
}

// Query 4: Individual Token Reconciliation
#[update]
pub async fn get_token_reconciliation(token_id: u64) -> Result<ReconciliationDetail, String> {
    let (icp_swap_canister, primary_token_id) = TOKENS.with(|t| {
        let record = t.borrow().get(&token_id);
        match record {
            Some(r) => Ok((r.icp_swap_canister_id, r.primary_token_id)),
            None => Err("Token not found".to_string())
        }
    })?;
    
    // Call the ICP swap canister's reconciliation query
    let result: Result<(ReconciliationStatus,), _> = ic_cdk::call(
        icp_swap_canister,
        "get_reconciliation_status",
        ()
    ).await;
    
    match result {
        Ok((status,)) => Ok(ReconciliationDetail {
            token_id: primary_token_id,
            icp_swap_canister: icp_swap_canister,
            reconciliation: status,
        }),
        Err((code, msg)) => Err(format!("Failed to get reconciliation: {:?} - {}", code, msg))
    }
}