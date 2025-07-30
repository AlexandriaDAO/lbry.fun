# LBRY Fun System Reconciliation Implementation Plan

## Executive Summary

This document outlines the implementation of system-wide reconciliation and monitoring queries for the LBRY Fun canister. These queries will provide visibility into fee collection efficiency, token health, and potential balance discrepancies across all managed tokens.

## Prerequisites

The ICP Swap canister must first implement the `get_reconciliation_status()` query as specified in ICP_SWAP_RECONCILIATION_PLAN.md.

## Implementation Details

### Step 1: Add New Types
**File**: `src/lbry_fun/src/lib.rs`

```rust
// Add to existing types

// Query 1: Pure reconciliation summary
#[derive(CandidType, Deserialize)]
pub struct SystemReconciliationSummary {
    pub total_expected_fees: u64,
    pub total_uncollected_alex: u64,
    pub total_uncollected_lp: u64,
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
    pub uncollected_lp_fees: u64,
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
```

### Step 2: Add Focused Query Functions
**File**: `src/lbry_fun/src/collection.rs`

#### Query 1: System Reconciliation (Balance Focus)
```rust
#[query]
pub async fn get_system_reconciliation() -> SystemReconciliationSummary {
    let mut total_uncollected_alex = 0u64;
    let mut total_uncollected_lp = 0u64;
    let mut tokens_with_discrepancies = Vec::new();
    let mut failed_queries = Vec::new();
    
    // Query all registered tokens
    let tokens = TOKENS.with(|t| t.borrow().clone());
    
    for (token_id, token_record) in tokens.iter() {
        match query_uncollected_fees(token_record.icp_swap_canister_id).await {
            Ok((alex_fees, lp_fees)) => {
                total_uncollected_alex += alex_fees;
                total_uncollected_lp += lp_fees;
            }
            Err(e) => {
                failed_queries.push((*token_id, e.to_string()));
            }
        }
    }
    
    // Consider failed queries as potential discrepancies
    for (token_id, _) in &failed_queries {
        tokens_with_discrepancies.push(*token_id);
    }
    
    SystemReconciliationSummary {
        total_expected_fees: total_uncollected_alex,  // Currently only collecting ALEX fees
        total_uncollected_alex,
        total_uncollected_lp,
        tokens_with_discrepancies,
        timestamp: ic_cdk::api::time(),
    }
}
```

#### Query 2: Collection Metrics (Performance Focus)
```rust
#[query]
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
```

#### Query 3: Token Health (Status Focus)
```rust
#[query]
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
```

#### Query 4: Individual Token Reconciliation
```rust
#[query]
pub async fn get_token_reconciliation(token_id: Principal) -> Result<ReconciliationDetail, String> {
    let token_record = TOKENS.with(|t| {
        t.borrow().get(&token_id).cloned()
            .ok_or_else(|| "Token not found".to_string())
    })?;
    
    // Call the ICP swap canister's reconciliation query
    let result: Result<(ReconciliationStatus,), _> = ic_cdk::call(
        token_record.icp_swap_canister_id,
        "get_reconciliation_status",
        ()
    ).await;
    
    match result {
        Ok((status,)) => Ok(ReconciliationDetail {
            token_id,
            icp_swap_canister: token_record.icp_swap_canister_id,
            reconciliation: status,
        }),
        Err((code, msg)) => Err(format!("Failed to get reconciliation: {:?} - {}", code, msg))
    }
}
```

### Step 3: Integrate with Collection Process
**File**: `src/lbry_fun/src/collection.rs`

Update `collect_all_fees_internal()` around line 96:
```rust
async fn collect_all_fees_internal() -> Result<CollectionSummary, String> {
    // [Existing auto-recovery code lines 98-109]
    
    // NEW: Add reconciliation check before collection
    let reconciliation = get_system_reconciliation().await;
    if !reconciliation.tokens_with_discrepancies.is_empty() {
        ic_cdk::print(format!(
            "Warning: {} tokens have balance discrepancies before collection",
            reconciliation.tokens_with_discrepancies.len()
        ));
    }
    
    // [Continue with existing collection logic...]
```

Update depegging detection around line 190-197:
```rust
// MODIFY: Enhanced depegging detection using integer arithmetic
let de_peg_detected = if expected_value > 0 {
    // Use basis points for precision without floating point
    let actual_basis_points = (actual_value as u128 * 10000 / expected_value as u128) as u32;
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
```

### Step 4: Add Reconciliation Timer
**File**: `src/lbry_fun/src/lib.rs`

```rust
// Add to init() or upgrade() function
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
```

## Implementation Notes

### Cross-Canister Communication
- The `ReconciliationStatus` type in ICP Swap was implemented in `src/icp_swap/src/storage.rs`
- Ensure this type is properly exported from the ICP swap canister's public interface
- The `get_reconciliation_status()` query in ICP swap is already implemented and tested

### Existing Code Structure
The plan references these existing structures in the LBRY Fun canister:
- `TOKENS` - Token registry storage (maps token ID to TokenRecord)
- `TOKEN_REGISTRY` - Collection tracking storage (maps canister ID to TokenCollectionInfo)
- `TOTAL_ACCUMULATED` - Total ICP collected (RefCell<u64>)
- `TOTAL_BURNED` - Total LBRY burned (RefCell<u64>)
- `AUDIT_STATE` - Audit state tracking (RefCell<AuditState>)
- `query_uncollected_fees()` - Existing async function to query ICP swap canisters

### Key Design Decisions
- **Integer-Only Arithmetic**: No floating-point math. Use basis points (0-10000) for percentages
- **Separated Queries**: Three focused queries instead of one complex query for maintainability
- **Constants**: `DE_PEG_THRESHOLD_BASIS_POINTS = 1` represents 0.01% deviation
- **Error Handling**: Failed cross-canister calls should be tracked as discrepancies

### Integration Points
- Timer function `init_reconciliation_timer()` must be called from canister's `init()` or `upgrade()` functions
- Consider adding types to appropriate module (e.g., `types.rs`) if it exists, rather than `lib.rs`
- All new types need `#[derive(CandidType, Deserialize)]` for Candid serialization

### Potential Gotchas
- The `collect_alex_fees` function returns a tuple-wrapped Result: `(Result<CollectionResult, CollectionError>,)`
- Line numbers in the plan are approximate - search for the function names
- Ensure proper imports for all types and functions used
- Test cross-canister calls thoroughly as they can fail for various reasons

## Testing Requirements

1. **Query Tests**: Verify each query returns correct data
2. **Integration Tests**: Test with multiple tokens in various states
3. **Performance Tests**: Ensure queries complete within reasonable time
4. **Error Handling**: Test behavior when ICP Swap queries fail

## Monitoring Dashboard Integration

These queries are designed to support a frontend monitoring dashboard:

1. **System Overview**: `get_system_reconciliation()` + `get_collection_metrics()`
2. **Token Health Grid**: `get_token_health_summary()`
3. **Detailed Token View**: `get_token_reconciliation(token_id)`

## Future Enhancements

1. **Historical Tracking**: Store reconciliation snapshots for trend analysis
2. **Automated Remediation**: Trigger automatic recovery for certain discrepancies
3. **Alert Thresholds**: Configurable thresholds for different alert levels
4. **Collection Strategy**: Optimize collection order based on token health