use candid::{CandidType, Principal};
use ic_cdk::{update, query};
use ic_cdk_timers::set_timer_interval;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::BTreeMap;
use std::time::Duration;

use crate::{TOKENS, TokenRecord};

// Constants
const MIN_COLLECTION_AMOUNT: u64 = 1_000_000;     // 0.01 ICP per token
const MIN_SWAP_AMOUNT: u64 = 100_000_000;         // 1 ICP total
const COLLECTION_INTERVAL: u64 = 3600;             // 1 hour
const OPERATION_TIMEOUT: u64 = 600_000_000_000;   // 10 minutes in nanoseconds
const DE_PEG_THRESHOLD: f64 = 0.05;                // 5% price deviation triggers alert
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

// Collection summary
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
        let (alex_fees, _lp_fees) = match query_uncollected_fees(token_id).await {
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
                        if let Some(mut info) = reg.borrow_mut().get_mut(&token_id) {
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
                    if let Some(mut info) = reg.borrow_mut().get_mut(&token_id) {
                        info.consecutive_failures += 1;
                        info.last_collection_attempt = ic_cdk::api::time();
                    }
                });
            }
        }
    }
    
    // Audit for de-pegging
    let collection_efficiency = if expected_total > 0 {
        total_collected as f64 / expected_total as f64
    } else {
        1.0
    };
    
    let de_peg_detected = (1.0 - collection_efficiency).abs() > DE_PEG_THRESHOLD;
    
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
        *total.borrow_mut() = total.borrow().saturating_add(total_collected);
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

    let result: Result<Result<CollectionResult, CollectionError>, _> = ic_cdk::call(
        token_id,
        "collect_alex_fees",
        (),
    ).await;
    
    match result {
        Ok(Ok(collection)) => Ok(collection.collected),
        Ok(Err(CollectionError::AmountTooSmall { amount })) => {
            // This is not an error, just not enough to collect yet
            Ok(0)
        }
        Ok(Err(CollectionError::TransferFailed { reason })) => {
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