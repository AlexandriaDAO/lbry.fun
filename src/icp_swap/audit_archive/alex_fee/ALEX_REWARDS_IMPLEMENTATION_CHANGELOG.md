# ALEX Rewards Implementation Change Log

## Overview
This document tracks all changes made to implement the ALEX staker rewards system as specified in ALEX_STAKER_REWARDS_PLAN.md.

## ICP Swap Canister Changes

### Storage (src/icp_swap/src/storage.rs)
- Added new memory IDs (12-14) for reward system storage
- Added `UNCOLLECTED_ALEX_FEES` stable storage for tracking uncollected fees for ALEX stakers
- Added `UNCOLLECTED_LP_FEES` stable storage for tracking uncollected fees for LP providers
- Added `REWARD_POOL` stable storage for segregated reward pool funds
- Added getter functions for all new storage structures

### Reward Distribution (src/icp_swap/src/update.rs)
- Replaced existing `distribute_reward` function with new implementation following the 1% of 1% model
- New `distribute_reward` function:
  - Calculates 1% of reward pool per interval
  - Splits distribution: 1% to ALEX stakers (via lbry_fun), 99% to LP providers
  - Updates uncollected fees atomically
  - Returns early if pool is empty or distribution amount too small
- Renamed original function to `distribute_reward_to_stakers` for legacy support

### Collection Endpoints (src/icp_swap/src/update.rs)
- Added `CollectionResult` and `CollectionError` types for collection responses
- Added `collect_alex_fees()` function:
  - Guard: `only_lbry_fun` - ensures only lbry_fun canister can collect
  - Implements CEI (Check-Effect-Interaction) pattern
  - Includes failure reversal to restore exact balance on transfer failure
  - Minimum collection amount: ICP_TRANSFER_FEE (10,000 E8S)
- Added `add_to_reward_pool()` function:
  - Guard: `only_lbry_fun` - ensures only lbry_fun canister can add funds
  - Allows adding funds to the segregated reward pool
- Added `transfer_icp_to_lbry_fun()` helper function for ICP transfers

### Query Functions (src/icp_swap/src/queries.rs)
- Added imports for new storage structures
- Added `get_uncollected_fees()` query - returns (alex_fees, lp_fees) tuple
- Added `get_reward_pool_status()` query - returns current reward pool balance

### Guards (src/icp_swap/src/guard.rs)
- Added `only_lbry_fun()` guard - restricts calls to lbry_fun canister

### Interface (src/icp_swap/icp_swap.did)
- Added `get_uncollected_fees : () -> (nat64, nat64) query`
- Added `get_reward_pool_status : () -> (nat64) query`
- Added `collect_alex_fees` with proper Result types
- Added `add_to_reward_pool : (nat64) -> (variant { Ok : nat64; Err : text })`

## LBRY Fun Canister Changes

### Collection Module (src/lbry_fun/src/collection.rs)
- Created new module for collection infrastructure
- Implements pull model where lbry_fun collects from all registered tokens
- Key features:
  - Automatic hourly collection via timer
  - State machine for operation tracking
  - Audit system with de-pegging detection
  - Stagnation alerts (24h without successful collection)
  - Auto-recovery from stuck states (10-minute timeout)
  - Problematic token tracking (consecutive failures)
- Query endpoints:
  - `get_audit_state()` - returns current audit information
  - `get_problematic_tokens()` - returns tokens with >3 consecutive failures
  - `get_collection_status()` - returns current state and accumulated amount
- Update endpoint:
  - `trigger_collection()` - manual collection trigger

### Integration (src/lbry_fun/src/lib.rs, src/lbry_fun/src/update.rs)
- Added collection module to exports
- Updated init function to initialize collection timer
- Collection runs every hour automatically

## Configuration Updates

The following values have been configured:

1. In `src/icp_swap/src/update.rs`:
   - Set lbry_fun canister ID to `"oni4e-oyaaa-aaaap-qp2pq-cai"`
   - Changed `add_to_reward_pool` guard from `is_admin` to `only_lbry_fun`
   - Fixed TODO comment on line 337 - now uses E8S constant for clarity

2. In `src/icp_swap/src/guard.rs`:
   - Set lbry_fun canister ID to `"oni4e-oyaaa-aaaap-qp2pq-cai"`
   - Removed `is_admin` guard function (all reward pool operations go through lbry_fun)

## Testing Requirements

The following tests should be implemented:

1. Unit tests for exact math verification (1% calculations)
2. Integration tests for end-to-end collection
3. Failure scenario tests (transfer failures, timeouts)
4. Audit accuracy tests
5. Scale tests with 1000+ tokens
6. Stress tests for concurrent operations

## Deployment Notes

1. The distribute_reward timer is already configured in script.rs
2. Collection timer initializes automatically on lbry_fun init
3. Reward pool must be funded via `add_to_reward_pool` before distributions begin
4. Monitor audit alerts for de-pegging and stagnation issues

## Bug Fixes

### Distribution Threshold Fix (2025-07-29)
- Fixed integer division issue in `distribute_reward()` that caused unfair distribution
- Previous behavior: When reward pool was between 100-99,999,999 E8S, only LP providers received rewards
- Root cause: `alex_portion = total_distribution / 100` would round to 0 for small amounts
- Fix: Changed minimum distribution check from `total_distribution < 100` to `total_distribution < 1_000_000`
- Result: Now requires 100,000,000 E8S (1 ICP) in reward pool before distribution
- This ensures both ALEX stakers and LP providers receive their fair 1%/99% split
- Matches the existing threshold used in `distribute_reward_to_stakers`

## Security Considerations

1. All fee updates use atomic operations
2. Collection implements CEI pattern with failure reversal
3. Guards prevent unauthorized access to critical functions
4. Reward pool is segregated from operational funds
5. Auto-recovery prevents permanent stuck states

## Future Enhancements

1. Implement actual swap and burn logic in lbry_fun collection module
2. Add LP distribution mechanism (currently accumulates in UNCOLLECTED_LP_FEES)
3. Enhanced monitoring dashboard for audit states
4. Configurable thresholds for alerts

## Threshold Adjustments

### Depegging Threshold Update (2025-07-30)
- Changed DE_PEG_THRESHOLD from 0.05 (5%) to 0.0001 (0.01%)
- Rationale: The 5% threshold was too liberal given that actual failure occurs at >99.99% deviation
- The 0.01% threshold provides much earlier warning of collection issues
- This gives operators more time to investigate and resolve problems before they become critical
- Updated in `src/lbry_fun/src/collection.rs`









# Git Commit Changelog:

```
theseus@evan:~/alexandria/lbryfun$ git show 6bf347fba3f8f78236bf61f1c3d61a605b342ed5
commit 6bf347fba3f8f78236bf61f1c3d61a605b342ed5 (HEAD -> main, origin/main, origin/HEAD)
Author: evanmcfarland <evanmcfarland.aa@gmail.com>
Date:   Tue Jul 29 14:39:00 2025 -0400

    1% fee to lbry_fun implementation.

diff --git a/ALEX_STAKER_REWARDS_PLAN.md b/ALEX_STAKER_REWARDS_PLAN.md
new file mode 100644
index 00000000..cdeefdf6
--- /dev/null
+++ b/ALEX_STAKER_REWARDS_PLAN.md
@@ -0,0 +1,532 @@
+# ALEX Staker Rewards Implementation Plan v4 - Production Ready
+
+## Core Engineering Principles
+
+### 1. Conservation of Value
+Every unit of value must be accounted for at all times. No funds can be lost due to precision errors, failed transfers, or state transitions. The system maintains exact arithmetic and implements atomic operations with rollback capabilities.
+
+### 2. Fail-Safety
+The system defaults to a safe state when failures occur. Failed operations preserve funds, stuck states auto-recover, and partial successes don't cascade into system-wide failures. Every external interaction assumes failure as the default case.
+
+### 3. Simplicity
+Complex solutions create attack surfaces. We choose the simplest correct implementation over clever optimizations. Code clarity and auditability take precedence over minor efficiency gains.
+
+## Economic Model
+
+### Distribution Mechanics
+Every interval (default: 1 hour), **1% of the reward pool** is distributed.
+
+This 1% is then split:
+- **1% of the distribution** (0.01% of pool) → ALEX stakers via LBRY burns
+- **99% of the distribution** (0.99% of pool) → Locked LP (future implementation)
+
+### Concrete Example
+Starting reward pool: 100 ICP
+- Hour 1: Distribute 1 ICP (1% of 100)
+  - 0.01 ICP → lbry_fun (for LBRY burn)
+  - 0.99 ICP → Locked LP
+  - Remaining pool: 99 ICP
+- Hour 2: Distribute 0.99 ICP (1% of 99)
+  - 0.0099 ICP → lbry_fun
+  - 0.9801 ICP → Locked LP
+  - Remaining pool: 98.01 ICP
+
+## Architecture: Pull Model
+
+### Overview
+Instead of having potentially thousands of `icp_swap` canisters push fees to `lbry_fun`, we implement a pull model where `lbry_fun` collects fees periodically. This reduces complexity and eliminates race conditions.
+
+## ICP Swap Canister Implementation
+
+```rust
+use ic_stable_structures::{
+    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
+    DefaultMemoryImpl, StableCell,
+};
+use std::cell::RefCell;
+
+type Memory = VirtualMemory<DefaultMemoryImpl>;
+
+thread_local! {
+    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
+        MemoryManager::init(DefaultMemoryImpl::default())
+    );
+    
+    // Stable storage for uncollected fees - survives upgrades
+    static UNCOLLECTED_ALEX_FEES: RefCell<StableCell<u64, Memory>> = RefCell::new(
+        StableCell::init(
+            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0))),
+            0u64
+        ).expect("Failed to init UNCOLLECTED_ALEX_FEES")
+    );
+    
+    static UNCOLLECTED_LP_FEES: RefCell<StableCell<u64, Memory>> = RefCell::new(
+        StableCell::init(
+            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1))),
+            0u64
+        ).expect("Failed to init UNCOLLECTED_LP_FEES")
+    );
+    
+    // Segregated reward pool - separate from operational funds
+    static REWARD_POOL: RefCell<StableCell<u64, Memory>> = RefCell::new(
+        StableCell::init(
+            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(2))),
+            0u64
+        ).expect("Failed to init REWARD_POOL")
+    );
+}
+
+// Constants
+const ICP_TRANSFER_FEE: u64 = 10_000; // 0.0001 ICP
+
+// Internal function - only callable by timer
+async fn distribute_reward() -> Result<String, DistributionError> {
+    // Get current reward pool balance
+    let reward_pool = REWARD_POOL.with(|p| p.borrow().get());
+    
+    if reward_pool == 0 {
+        return Ok("No rewards to distribute".to_string());
+    }
+    
+    // Calculate 1% of reward pool
+    let total_distribution = reward_pool / 100;
+    
+    if total_distribution == 0 {
+        return Ok("Distribution amount too small".to_string());
+    }
+    
+    // Deduct from reward pool first
+    REWARD_POOL.with(|p| {
+        p.borrow_mut().set(reward_pool - total_distribution)
+            .expect("Failed to update reward pool");
+    });
+    
+    // Calculate exact distribution
+    let alex_portion = total_distribution / 100;  // 1% of distribution
+    let lp_portion = total_distribution - alex_portion; // Remainder for exact accounting
+    
+    // Update uncollected fees
+    UNCOLLECTED_ALEX_FEES.with(|f| {
+        let current = f.borrow().get();
+        f.borrow_mut().set(current.saturating_add(alex_portion))
+            .expect("Failed to update ALEX fees");
+    });
+    
+    UNCOLLECTED_LP_FEES.with(|f| {
+        let current = f.borrow().get();
+        f.borrow_mut().set(current.saturating_add(lp_portion))
+            .expect("Failed to update LP fees");
+    });
+    
+    Ok(format!("Distributed {} from pool of {}", total_distribution, reward_pool))
+}
+
+// Query function for lbry_fun to check available fees
+#[query]
+pub fn get_uncollected_fees() -> (u64, u64) {
+    (
+        UNCOLLECTED_ALEX_FEES.with(|f| f.borrow().get()),
+        UNCOLLECTED_LP_FEES.with(|f| f.borrow().get())
+    )
+}
+
+// Collection with CEI pattern and failure reversal
+#[update(guard = "only_lbry_fun")]
+pub async fn collect_alex_fees() -> Result<CollectionResult, CollectionError> {
+    // Check
+    let fees = UNCOLLECTED_ALEX_FEES.with(|f| f.borrow().get());
+    
+    if fees < ICP_TRANSFER_FEE {
+        return Err(CollectionError::AmountTooSmall { amount: fees });
+    }
+    
+    // Effect - deduct from balance
+    UNCOLLECTED_ALEX_FEES.with(|f| {
+        f.borrow_mut().set(0).expect("Failed to clear ALEX fees");
+    });
+    
+    // Interaction - external transfer
+    match transfer_icp_to_lbry_fun(fees).await {
+        Ok(_) => {
+            Ok(CollectionResult { 
+                collected: fees,
+                timestamp: ic_cdk::api::time()
+            })
+        }
+        Err(e) => {
+            // Failure reversal - restore exact balance
+            UNCOLLECTED_ALEX_FEES.with(|f| {
+                f.borrow_mut().set(fees).expect("Failed to restore ALEX fees");
+            });
+            Err(CollectionError::TransferFailed { reason: e.to_string() })
+        }
+    }
+}
+
+// Admin function to add funds to reward pool
+#[update(guard = "is_admin")]
+pub fn add_to_reward_pool(amount: u64) -> Result<u64, String> {
+    REWARD_POOL.with(|p| {
+        let current = p.borrow().get();
+        let new_total = current.saturating_add(amount);
+        p.borrow_mut().set(new_total)
+            .map_err(|e| format!("Failed to update pool: {:?}", e))?;
+        Ok(new_total)
+    })
+}
+```
+
+## LBRY Fun Canister Implementation
+
+```rust
+use ic_cdk_timers::set_timer_interval;
+use std::collections::BTreeMap;
+use std::time::Duration;
+
+// Constants
+const MIN_COLLECTION_AMOUNT: u64 = 1_000_000;     // 0.01 ICP per token
+const MIN_SWAP_AMOUNT: u64 = 100_000_000;         // 1 ICP total
+const COLLECTION_INTERVAL: u64 = 3600;             // 1 hour
+const OPERATION_TIMEOUT: u64 = 600_000_000_000;   // 10 minutes in nanoseconds
+const DE_PEG_THRESHOLD: f64 = 0.0001;              // 0.01% price deviation triggers alert
+const STAGNATION_THRESHOLD: u64 = 86400;          // 24 hours without collection
+
+// Audit state for monitoring
+#[derive(CandidType, Deserialize, Clone)]
+pub struct AuditState {
+    pub last_successful_collection: u64,
+    pub consecutive_failures: u32,
+    pub total_value_locked: u64,
+    pub expected_value: u64,
+    pub de_peg_detected: bool,
+}
+
+// State machine for swap operations
+#[derive(CandidType, Deserialize, Clone)]
+pub enum SwapState {
+    Idle,
+    Collecting { started_at: u64 },
+    Swapping { amount: u64, started_at: u64 },
+    Burning { lbry_amount: u64, started_at: u64 },
+    Failed { error: String, timestamp: u64 },
+}
+
+// Enhanced token info with audit data
+#[derive(CandidType, Deserialize)]
+struct TokenInfo {
+    canister_id: Principal,
+    registered_at: u64,
+    total_collected: u64,
+    last_collection_attempt: u64,
+    last_successful_collection: u64,
+    consecutive_failures: u32,
+}
+
+// Main state
+thread_local! {
+    static TOKEN_REGISTRY: RefCell<BTreeMap<Principal, TokenInfo>> = RefCell::new(BTreeMap::new());
+    static SWAP_STATE: RefCell<SwapState> = RefCell::new(SwapState::Idle);
+    static TOTAL_ACCUMULATED: RefCell<u64> = RefCell::new(0);
+    static TOTAL_BURNED: RefCell<u64> = RefCell::new(0);
+    static AUDIT_STATE: RefCell<AuditState> = RefCell::new(AuditState {
+        last_successful_collection: 0,
+        consecutive_failures: 0,
+        total_value_locked: 0,
+        expected_value: 0,
+        de_peg_detected: false,
+    });
+}
+
+// Initialize timer on canister creation
+#[init]
+fn init() {
+    set_timer_interval(
+        Duration::from_secs(COLLECTION_INTERVAL), 
+        || {
+            ic_cdk::spawn(async {
+                let _ = collect_all_fees_internal().await;
+            });
+        }
+    );
+}
+
+// Internal collection function with auditing
+async fn collect_all_fees_internal() -> Result<CollectionSummary, LbryFunError> {
+    // Auto-recover from stuck states
+    SWAP_STATE.with(|state| {
+        let now = ic_cdk::api::time();
+        match state.borrow().clone() {
+            SwapState::Collecting { started_at } |
+            SwapState::Swapping { started_at, .. } |
+            SwapState::Burning { started_at, .. } => {
+                if now > started_at + OPERATION_TIMEOUT {
+                    *state.borrow_mut() = SwapState::Failed {
+                        error: "Operation timed out - auto recovered".to_string(),
+                        timestamp: now,
+                    };
+                    
+                    // Update audit state
+                    AUDIT_STATE.with(|audit| {
+                        let mut a = audit.borrow_mut();
+                        a.consecutive_failures += 1;
+                    });
+                }
+            }
+            _ => {}
+        }
+    });
+    
+    // Check if we can proceed
+    SWAP_STATE.with(|state| {
+        match &*state.borrow() {
+            SwapState::Idle | SwapState::Failed { .. } => Ok(()),
+            _ => Err(LbryFunError::SwapInProgress),
+        }
+    })?;
+    
+    // Set state to collecting
+    SWAP_STATE.with(|s| *s.borrow_mut() = SwapState::Collecting { 
+        started_at: ic_cdk::api::time() 
+    });
+    
+    let mut total_collected = 0u64;
+    let mut successful_collections = 0u32;
+    let mut failed_collections = 0u32;
+    let mut collection_results = Vec::new();
+    let mut expected_total = 0u64;
+    
+    // Get all registered tokens
+    let tokens: Vec<Principal> = TOKEN_REGISTRY.with(|reg| {
+        reg.borrow().keys().cloned().collect()
+    });
+    
+    // Collect from each token independently
+    for token_id in tokens {
+        // Query expected amount
+        let (alex_fees, _lp_fees) = match query_uncollected_fees(token_id).await {
+            Ok(fees) => fees,
+            Err(_) => (0, 0),
+        };
+        
+        expected_total += alex_fees;
+        
+        match collect_from_token(token_id).await {
+            Ok(amount) => {
+                if amount > 0 {
+                    total_collected = total_collected.saturating_add(amount);
+                    successful_collections += 1;
+                    
+                    // Update registry
+                    TOKEN_REGISTRY.with(|reg| {
+                        if let Some(mut info) = reg.borrow_mut().get_mut(&token_id) {
+                            info.total_collected = info.total_collected.saturating_add(amount);
+                            info.last_successful_collection = ic_cdk::api::time();
+                            info.consecutive_failures = 0;
+                        }
+                    });
+                }
+                collection_results.push((token_id, Ok(amount)));
+            }
+            Err(e) => {
+                failed_collections += 1;
+                collection_results.push((token_id, Err(e.clone())));
+                
+                // Update failure tracking
+                TOKEN_REGISTRY.with(|reg| {
+                    if let Some(mut info) = reg.borrow_mut().get_mut(&token_id) {
+                        info.consecutive_failures += 1;
+                        info.last_collection_attempt = ic_cdk::api::time();
+                    }
+                });
+            }
+        }
+    }
+    
+    // Audit for de-pegging
+    let collection_efficiency = if expected_total > 0 {
+        total_collected as f64 / expected_total as f64
+    } else {
+        1.0
+    };
+    
+    let de_peg_detected = (1.0 - collection_efficiency).abs() > DE_PEG_THRESHOLD;
+    
+    // Check for stagnation
+    let now = ic_cdk::api::time();
+    let stagnation_detected = AUDIT_STATE.with(|audit| {
+        let last_success = audit.borrow().last_successful_collection;
+        now - last_success > STAGNATION_THRESHOLD * 1_000_000_000
+    });
+    
+    // Update audit state
+    AUDIT_STATE.with(|audit| {
+        let mut a = audit.borrow_mut();
+        if total_collected > 0 {
+            a.last_successful_collection = now;
+            a.consecutive_failures = 0;
+        } else {
+            a.consecutive_failures += 1;
+        }
+        a.total_value_locked = TOTAL_ACCUMULATED.with(|t| *t.borrow());
+        a.expected_value = expected_total;
+        a.de_peg_detected = de_peg_detected;
+    });
+    
+    // Log critical alerts
+    if de_peg_detected {
+        ic_cdk::println!("CRITICAL: De-pegging detected! Collection efficiency: {:.2}%", 
+                         collection_efficiency * 100.0);
+    }
+    
+    if stagnation_detected {
+        ic_cdk::println!("CRITICAL: Collection stagnation detected! No successful collection in 24h");
+    }
+    
+    // Update accumulated total
+    TOTAL_ACCUMULATED.with(|total| {
+        *total.borrow_mut() = total.borrow().saturating_add(total_collected);
+    });
+    
+    // Reset to idle - collection phase complete
+    SWAP_STATE.with(|s| *s.borrow_mut() = SwapState::Idle);
+    
+    // Check if we should trigger swap
+    let accumulated = TOTAL_ACCUMULATED.with(|t| *t.borrow());
+    if accumulated >= MIN_SWAP_AMOUNT {
+        set_timer(Duration::from_secs(1), || {
+            ic_cdk::spawn(async {
+                let _ = execute_swap_and_burn().await;
+            });
+        });
+    }
+    
+    Ok(CollectionSummary {
+        total_collected,
+        successful_collections,
+        failed_collections,
+        collection_results,
+        will_swap: accumulated >= MIN_SWAP_AMOUNT,
+        audit_alerts: AuditAlerts {
+            de_peg_detected,
+            stagnation_detected,
+            collection_efficiency,
+        },
+    })
+}
+
+// Query audit state
+#[query]
+pub fn get_audit_state() -> AuditState {
+    AUDIT_STATE.with(|a| a.borrow().clone())
+}
+
+// Query problematic tokens
+#[query]
+pub fn get_problematic_tokens() -> Vec<(Principal, u32)> {
+    TOKEN_REGISTRY.with(|reg| {
+        reg.borrow()
+            .iter()
+            .filter(|(_, info)| info.consecutive_failures > 3)
+            .map(|(id, info)| (*id, info.consecutive_failures))
+            .collect()
+    })
+}
+```
+
+## Operational Requirements
+
+### Monitoring Infrastructure
+
+1. **Real-time Metrics**
+   - Collection success rate per hour
+   - Total value locked vs expected value
+   - Individual token failure rates
+   - State machine transition times
+
+2. **Critical Alerts**
+   - **De-pegging Alert**: Triggered when collection efficiency drops below 99.99%
+   - **Stagnation Alert**: Triggered when no successful collection occurs for 24 hours
+   - **Token Failure Alert**: Triggered when a token fails collection 3 times consecutively
+   - **State Timeout Alert**: Triggered when any operation exceeds 10-minute timeout
+
+3. **Automated Responses**
+   - Auto-recovery from stuck states
+   - Isolation of failing tokens after 5 consecutive failures
+   - Emergency pause mechanism for systemic failures
+
+### Operational Runbook
+
+1. **De-pegging Response**
+   - Immediately investigate token transfer mechanisms
+   - Check for systematic collection failures
+   - Verify guard functions and permissions
+   - Consider emergency pause if efficiency < 99.9%
+
+2. **Stagnation Response**
+   - Check timer health
+   - Verify canister cycles
+   - Review recent upgrades or changes
+   - Manually trigger collection if needed
+
+3. **Token Failure Response**
+   - Query specific token state
+   - Check token canister health
+   - Verify ICP balance in token canister
+   - Consider removing token from registry after investigation
+
+## Testing Requirements
+
+### Unit Tests
+1. **Exact Math Verification**
+   - Test distribution calculations with various pool sizes
+   - Verify zero precision loss
+   - Confirm conservation of value
+
+2. **State Persistence**
+   - Test upgrade scenarios with stable structures
+   - Verify fee accumulation across upgrades
+   - Confirm reward pool isolation
+
+### Integration Tests
+1. **End-to-End Collection**
+   - Simulate 100+ tokens with varying states
+   - Test partial collection success
+   - Verify audit accuracy
+
+2. **Failure Scenarios**
+   - Test transfer failures and reversals
+   - Verify timeout recovery
+   - Test de-pegging detection
+
+### Performance Tests
+1. **Scale Testing**
+   - 1000+ registered tokens
+   - Measure collection time
+   - Verify memory usage
+
+2. **Stress Testing**
+   - Rapid state transitions
+   - Concurrent operations
+   - Network partition simulation
+
+## Migration Path
+
+1. **Pre-deployment Validation**
+   - Run comprehensive test suite
+   - Verify stable structure compatibility
+   - Audit reward pool segregation
+
+2. **Staged Rollout**
+   - Deploy to testnet with subset of tokens
+   - Monitor for 48 hours
+   - Verify all metrics and alerts
+
+3. **Production Deployment**
+   - Deploy during low-activity period
+   - Initialize with conservative parameters
+   - Monitor intensively for first week
+
+4. **Post-deployment**
+   - Daily audit reviews for first month
+   - Weekly performance optimization
+   - Monthly security reviews
\ No newline at end of file
diff --git a/CLAUDE.md b/CLAUDE.md
index e1d377db..cf2f01a2 100644
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -54,8 +54,7 @@ Instead of being an LBP, it uses a dual token system. The secondary token is min
 All ICP collected from minting secondary tokens is distributed accordingly (1% of the whole pool every hour):
 
 - 1% to buy back and burn $LBRY, which is the secondary token of the parent project of which this is a fork.
-- 49.5% to stakers of the primary token.
-- 49.5% to buyback and provide locked liquidity in kongswap (which we deploy locally from a separate repo).
+99% → Primary token stakers (will later be replaced with Permanently Locked Kongswap Liquidity)
 
 ## Project Architecture
 
@@ -123,8 +122,7 @@ Each token launch creates two tokens: Primary (reward) and Secondary (mining).
 
 ### ICP Distribution (1% of pool hourly)
 - 1% → Buy/burn $LBRY (parent project token)
-- 49.5% → Primary token stakers
-- 49.5% → Kongswap liquidity (locked)
+- 99% → Primary token stakers (will later be replaced with Permanently Locked Kongswap Liquidity)
 
 ## Common Error Patterns & Solutions
 
diff --git a/plan.md b/plan.md
index 126a9bf2..947f1c94 100644
--- a/plan.md
+++ b/plan.md
@@ -1,45 +1,13 @@
-First thing tomorrow: 
-- We don't enforce the stake requirement or login for accepting proposals. We should, and make it look like an actual vote.
-- Remove the DAO tab. Just make it two tabs.
-- We should show the same lbry_fun kind of canister data.
-- You should have to have staked tokens to be added as an operator.
-- 
-
-
-
-
-
-
-
-
-
-
-
-
-
-
-The question is, for the hackathon, should I do the locked liquidity thing or just leave it as is.
-
-
-
-
-
-When you come back: 
-- Do some stress integrationtesting with the bot1 canister and make sure the graphs align.
-- Audit the existing code based on the changelogs.
-- Remove the changelogs and declare things safe before moving on to switching staking for locked liquidity.
-- Done.
-
 
+- Implement the 1% fee to ALEX stakers, and the 5ICP To alex stakers.
 - Minor vulnerability. There is a minor concern where if the XRC oracle fails, the tokens become permanently untradable. Why don't we look into using our core canister's XRC rate instead of having each one use its own.
+- Move on to locked lp.
 
 
 
 
 
 
-Good test: Conservation analysis: (start with a set amount of ICP, mint, burn, lock lp, collect, sell, and repeat). Add up the locations of all the ICP at the end and ensure that all is conserved.
-
 
 
 
diff --git a/src/icp_swap/audit_archive/alex_fee/ALEX_REWARDS_IMPLEMENTATION_CHANGELOG.md b/src/icp_swap/audit_archive/alex_fee/ALEX_REWARDS_IMPLEMENTATION_CHANGELOG.md
new file mode 100644
index 00000000..23fbf00c
--- /dev/null
diff --git a/src/icp_swap/icp_swap.did b/src/icp_swap/icp_swap.did
index 9bf1b26b..eb1e9d34 100644
--- a/src/icp_swap/icp_swap.did
+++ b/src/icp_swap/icp_swap.did
@@ -124,4 +124,8 @@ service : (opt InitArgs) -> {
   stake_primary : (nat64, opt blob) -> (Result);
   swap : (nat64, opt blob) -> (Result);
   un_stake_all_primary : (opt blob) -> (Result);
+  get_uncollected_fees : () -> (nat64, nat64) query;
+  get_reward_pool_status : () -> (nat64) query;
+  collect_alex_fees : () -> (variant { Ok : record { collected : nat64; timestamp : nat64 }; Err : variant { AmountTooSmall : record { amount : nat64 }; TransferFailed : record { reason : text } } });
+  add_to_reward_pool : (nat64) -> (variant { Ok : nat64; Err : text });
 }
diff --git a/src/icp_swap/src/guard.rs b/src/icp_swap/src/guard.rs
index 9aa9d010..3aba5544 100644
--- a/src/icp_swap/src/guard.rs
+++ b/src/icp_swap/src/guard.rs
@@ -38,3 +38,15 @@ pub fn not_anon() -> Result<(), String> {
         Err("Anonymous principal not allowed to make calls.".to_string())
     }
 }
+
+pub fn only_lbry_fun() -> Result<(), String> {
+    let caller = ic_cdk::api::caller();
+    let lbry_fun_id = Principal::from_text("oni4e-oyaaa-aaaap-qp2pq-cai")
+        .map_err(|_| "Invalid lbry_fun canister ID")?;
+    
+    if caller == lbry_fun_id {
+        Ok(())
+    } else {
+        Err("Only lbry_fun canister can make this call".to_string())
+    }
+}
diff --git a/src/icp_swap/src/queries.rs b/src/icp_swap/src/queries.rs
index 0bfd42de..82e0594c 100644
--- a/src/icp_swap/src/queries.rs
+++ b/src/icp_swap/src/queries.rs
@@ -6,6 +6,9 @@ use crate::{
     Configs,
     CONFIGS,
     LAUNCH_TIME,
+    UNCOLLECTED_ALEX_FEES,
+    UNCOLLECTED_LP_FEES,
+    REWARD_POOL,
 };
 use candid::{CandidType, Principal};
 use ic_cdk::{api::caller, query};
@@ -172,3 +175,18 @@ pub fn get_launch_status() -> (bool, Option<u64>) {
     let launch_time = LAUNCH_TIME.with(|m| m.borrow().get(&()));
     (is_live, launch_time)
 }
+
+// Query function for lbry_fun to check available fees
+#[query]
+pub fn get_uncollected_fees() -> (u64, u64) {
+    (
+        UNCOLLECTED_ALEX_FEES.with(|f| f.borrow().get(&()).unwrap_or(0)),
+        UNCOLLECTED_LP_FEES.with(|f| f.borrow().get(&()).unwrap_or(0))
+    )
+}
+
+// Query function to get reward pool status
+#[query]
+pub fn get_reward_pool_status() -> u64 {
+    REWARD_POOL.with(|p| p.borrow().get(&()).unwrap_or(0))
+}
diff --git a/src/icp_swap/src/storage.rs b/src/icp_swap/src/storage.rs
index 048f3892..e4cef4ae 100644
--- a/src/icp_swap/src/storage.rs
+++ b/src/icp_swap/src/storage.rs
@@ -25,6 +25,9 @@ pub const LOGS_MEM_ID: MemoryId = MemoryId::new(8);
 pub const LOGS_COUNTER_ID: MemoryId = MemoryId::new(9);
 pub const CONFIGS_MEM_ID: MemoryId = MemoryId::new(10);
 pub const LAUNCH_TIME_MEM_ID: MemoryId = MemoryId::new(11);
+pub const UNCOLLECTED_ALEX_FEES_MEM_ID: MemoryId = MemoryId::new(12);
+pub const UNCOLLECTED_LP_FEES_MEM_ID: MemoryId = MemoryId::new(13);
+pub const REWARD_POOL_MEM_ID: MemoryId = MemoryId::new(14);
 
 thread_local! {
     static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
@@ -71,6 +74,20 @@ thread_local! {
     pub static LAUNCH_TIME: RefCell<StableBTreeMap<(), u64, Memory>> = RefCell::new(
         StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(LAUNCH_TIME_MEM_ID)))
     );
+    
+    // Uncollected fees for ALEX stakers - survives upgrades
+    pub static UNCOLLECTED_ALEX_FEES: RefCell<StableBTreeMap<(), u64, Memory>> = RefCell::new(
+        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(UNCOLLECTED_ALEX_FEES_MEM_ID)))
+    );
+    
+    pub static UNCOLLECTED_LP_FEES: RefCell<StableBTreeMap<(), u64, Memory>> = RefCell::new(
+        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(UNCOLLECTED_LP_FEES_MEM_ID)))
+    );
+    
+    // Segregated reward pool - separate from operational funds
+    pub static REWARD_POOL: RefCell<StableBTreeMap<(), u64, Memory>> = RefCell::new(
+        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(REWARD_POOL_MEM_ID)))
+    );
 }
 
 pub fn get_total_unclaimed_icp_reward_mem() -> StableBTreeMap<(), u128, Memory> {
@@ -110,6 +127,24 @@ pub fn get_launch_time_mem() -> StableBTreeMap<(), u64, Memory> {
     })
 }
 
+pub fn get_uncollected_alex_fees_mem() -> StableBTreeMap<(), u64, Memory> {
+    UNCOLLECTED_ALEX_FEES.with(|_fees_map| {
+        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(UNCOLLECTED_ALEX_FEES_MEM_ID)))
+    })
+}
+
+pub fn get_uncollected_lp_fees_mem() -> StableBTreeMap<(), u64, Memory> {
+    UNCOLLECTED_LP_FEES.with(|_fees_map| {
+        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(UNCOLLECTED_LP_FEES_MEM_ID)))
+    })
+}
+
+pub fn get_reward_pool_mem() -> StableBTreeMap<(), u64, Memory> {
+    REWARD_POOL.with(|_pool_map| {
+        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(REWARD_POOL_MEM_ID)))
+    })
+}
+
 #[derive(CandidType, Deserialize, Clone)]
 pub struct Stake {
     pub amount: u64,
diff --git a/src/icp_swap/src/update.rs b/src/icp_swap/src/update.rs
index cf288238..54b4210e 100644
--- a/src/icp_swap/src/update.rs
+++ b/src/icp_swap/src/update.rs
@@ -334,7 +334,7 @@ pub async fn burn_secondary(
     }
 
     let amount_secondary_e8s = amount_secondary
-        .checked_mul(100_000_000) //todo
+        .checked_mul(E8S) // Convert to E8S (smallest unit)
         .ok_or_else(||
             ExecutionError::new_with_log(
                 caller,
@@ -877,8 +877,57 @@ fn safe_reward_to_transfer_amount(reward: u128) -> Result<u64, ExecutionError> {
         })
 }
 
+// Internal function - only callable by timer
 pub async fn distribute_reward() -> Result<String, ExecutionError> {
-    register_info_log(caller(), "distribute_reward", "distribute_reward initiated.");
+    // Get current reward pool balance
+    let reward_pool = REWARD_POOL.with(|p| {
+        p.borrow().get(&()).unwrap_or(0)
+    });
+    
+    if reward_pool == 0 {
+        return Ok("No rewards to distribute".to_string());
+    }
+    
+    // Calculate 1% of reward pool
+    let total_distribution = reward_pool / 100;
+    
+    if total_distribution == 0 {
+        return Ok("Distribution amount too small".to_string());
+    }
+    
+    // Deduct from reward pool first
+    REWARD_POOL.with(|p| {
+        let new_pool = reward_pool.saturating_sub(total_distribution);
+        p.borrow_mut().insert((), new_pool);
+    });
+    
+    // Calculate exact distribution
+    let alex_portion = total_distribution / 100;  // 1% of distribution
+    let lp_portion = total_distribution - alex_portion; // Remainder for exact accounting
+    
+    // Update uncollected fees
+    UNCOLLECTED_ALEX_FEES.with(|f| {
+        let current = f.borrow().get(&()).unwrap_or(0);
+        f.borrow_mut().insert((), current.saturating_add(alex_portion));
+    });
+    
+    UNCOLLECTED_LP_FEES.with(|f| {
+        let current = f.borrow().get(&()).unwrap_or(0);
+        f.borrow_mut().insert((), current.saturating_add(lp_portion));
+    });
+    
+    register_info_log(
+        caller(),
+        "distribute_reward",
+        &format!("Distributed {} from pool of {}", total_distribution, reward_pool)
+    );
+    
+    Ok(format!("Distributed {} from pool of {}", total_distribution, reward_pool))
+}
+
+// Legacy distribute_reward_to_stakers function (to be removed when staking is deprecated)
+pub async fn distribute_reward_to_stakers() -> Result<String, ExecutionError> {
+    register_info_log(caller(), "distribute_reward_to_stakers", "distribute_reward_to_stakers initiated.");
     let intervals = get_distribution_interval();
     let staking_percentage = STAKING_REWARD_PERCENTAGE;
     let total_icp_available: u64 = match fetch_canister_icp_balance().await {
@@ -1597,3 +1646,95 @@ async fn burn_token(
 
     result // Return the inner Result<BlockIndex, TransferFromError>
 }
+
+// Collection result structure
+#[derive(CandidType, Deserialize)]
+pub struct CollectionResult {
+    pub collected: u64,
+    pub timestamp: u64,
+}
+
+// Collection error structure
+#[derive(CandidType, Deserialize)]
+pub enum CollectionError {
+    AmountTooSmall { amount: u64 },
+    TransferFailed { reason: String },
+}
+
+// Collection with CEI pattern and failure reversal
+#[update(guard = "only_lbry_fun")]
+pub async fn collect_alex_fees() -> Result<CollectionResult, CollectionError> {
+    // Check
+    let fees = UNCOLLECTED_ALEX_FEES.with(|f| f.borrow().get(&()).unwrap_or(0));
+    
+    if fees < ICP_TRANSFER_FEE {
+        return Err(CollectionError::AmountTooSmall { amount: fees });
+    }
+    
+    // Effect - deduct from balance
+    UNCOLLECTED_ALEX_FEES.with(|f| {
+        f.borrow_mut().insert((), 0);
+    });
+    
+    // Interaction - external transfer
+    match transfer_icp_to_lbry_fun(fees).await {
+        Ok(_) => {
+            Ok(CollectionResult { 
+                collected: fees,
+                timestamp: ic_cdk::api::time()
+            })
+        }
+        Err(e) => {
+            // Failure reversal - restore exact balance
+            UNCOLLECTED_ALEX_FEES.with(|f| {
+                f.borrow_mut().insert((), fees);
+            });
+            Err(CollectionError::TransferFailed { reason: e.to_string() })
+        }
+    }
+}
+
+// Function to add funds to reward pool (only callable by lbry_fun)
+#[update(guard = "only_lbry_fun")]
+pub fn add_to_reward_pool(amount: u64) -> Result<u64, String> {
+    REWARD_POOL.with(|p| {
+        let current = p.borrow().get(&()).unwrap_or(0);
+        let new_total = current.saturating_add(amount);
+        p.borrow_mut().insert((), new_total);
+        Ok(new_total)
+    })
+}
+
+// Helper function to transfer ICP to lbry_fun canister
+async fn transfer_icp_to_lbry_fun(amount: u64) -> Result<BlockIndex, String> {
+    // Get lbry_fun canister ID from environment or configuration
+    let lbry_fun_id = Principal::from_text("oni4e-oyaaa-aaaap-qp2pq-cai")
+        .map_err(|e| format!("Invalid lbry_fun canister ID: {}", e))?;
+    
+    // Get ICP ledger ID from configs or default
+    let icp_ledger_id = CONFIGS.with(|configs| {
+        configs.borrow()
+            .get(&())
+            .map(|c| c.icp_ledger_id)
+            .unwrap_or(MAINNET_LEDGER_CANISTER_ID)
+    });
+    
+    let transfer_args = TransferArg {
+        from_subaccount: None,
+        to: lbry_fun_id.into(),
+        fee: None,
+        created_at_time: None,
+        memo: None,
+        amount: Nat::from(amount),
+    };
+    
+    let (result,) = ic_cdk::call::<(TransferArg,), (Result<BlockIndex, TransferError>,)>(
+        icp_ledger_id,
+        "icrc1_transfer",
+        (transfer_args,)
+    ).await
+    .map_err(|e| format\!("Transfer call failed: {:?}", e))?;
+    
+    result.map_err(|e| format\!("Transfer failed: {:?}", e))
+}
+EOF < /dev/null
diff --git a/src/icp_swap/src/utils.rs b/src/icp_swap/src/utils.rs
index c8238850..dc76a6c2 100644
--- a/src/icp_swap/src/utils.rs
+++ b/src/icp_swap/src/utils.rs
@@ -86,48 +86,6 @@ pub fn principal_to_subaccount(principal_id: &Principal) -> [u8; 32] {
     subaccount
 }
 
-// // This logic is removed because of a known bug, whereby failed burns still increase burn_amount.
-// // It was kept as a pre-audit minting limit precaution.
-
-// pub async fn within_max_limit(burn_amount: u64) -> Result<u64, ExecutionError> {
-//     let result: Result<(u64, u64), String> = ic_cdk
-//         ::call::<(), (u64, u64)>(
-//             Principal::from_text(TOKENOMICS_CANISTER_ID).map_err(|e|
-//                 ExecutionError::new_with_log(
-//                     caller(),
-//                     "within_max_limit",
-//                     ExecutionError::StateError(format!("Invalid tokenomics canister ID: {}", e))
-//                 )
-//             )?,
-//             "get_max_stats",
-//             ()
-//         ).await
-//         .map_err(|e: (ic_cdk::api::call::RejectionCode, String)| {
-//             format!("failed to call tokenomics canister: {:?}", e)
-//         });
-
-//     match result {
-//         Ok((max_threshold, total_burned)) => {
-//             //Todo
-//             if burn_amount + total_burned <= max_threshold {
-//                 Ok(burn_amount)
-//             } else {
-//                 Ok(max_threshold - total_burned)
-//             }
-//         }
-//         Err(e) =>
-//             Err(
-//                 ExecutionError::new_with_log(
-//                     caller(),
-//                     "within_max_limit",
-//                     ExecutionError::StateError(e)
-//                 )
-//             ),
-//     }
-// }
-
-
-// pub static TOTAL_ARCHIVED_BALANCE: RefCell<u64> = RefCell::new(0);
 pub(crate) fn add_to_distribution_intervals(amount: u32) -> Result<(), ExecutionError> {
     let current_total = get_distribution_interval();
     let new_total = current_total.checked_add(amount).ok_or_else(||
diff --git a/src/lbry_fun/LBRY_FUN_CANISTER_OVERVIEW.md b/src/lbry_fun/LBRY_FUN_CANISTER_OVERVIEW.md
index ee9e29c8..bc2ec5f1 100644
--- a/src/lbry_fun/LBRY_FUN_CANISTER_OVERVIEW.md
+++ b/src/lbry_fun/LBRY_FUN_CANISTER_OVERVIEW.md
@@ -222,8 +222,7 @@ Primary Token:
 
 Fee Distribution (from secondary token sales):
   - 1%: Buy and burn LBRY tokens
-  - 49.5%: To primary token stakers
-  - 49.5%: Buyback and locked liquidity
+  - 99% → Primary token stakers (will later be replaced with Permanently Locked Kongswap Liquidity)
 ```
 
 ### Halving Mechanism
diff --git a/src/lbry_fun/LBRY_FUN_CHANGE_LOG.md b/src/lbry_fun/LBRY_FUN_CHANGE_LOG.md
deleted file mode 100644
index e5a633e3..00000000
--- a/src/lbry_fun/LBRY_FUN_CHANGE_LOG.md
+++ /dev/null
@@ -1,64 +0,0 @@
-# LBRY_FUN Canister Change Log
-
-## Overview
-This file tracks all changes made to the lbry_fun canister, which is the main canister that spawns and tracks new token launches.
-
-## Risk Levels
-- **LOW**: Safe conversions (comments, documentation, analysis tools)
-- **MEDIUM**: Bounded changes (calculations, preview functions)
-- **HIGH**: Core logic modifications (token creation, reward calculations)
-
-## Change Log
-
-### 3X Multiplier Removal (2025-01-08)
-
-| Change ID | File | Risk | Description | Details | Test Status |
-|-----------|------|------|-------------|---------|-------------|
-| LBRY-001 | src/tokenomics_simple.rs | HIGH | Removed legacy 3x multiplier from calculate_primary_minted | The 3x multiplier was creating a circular dependency preventing initialRewardPerBurnUnit from having any effect. Changed lines 38-46 to remove .saturating_mul(3) | Completed |
-| LBRY-002 | src/update.rs | HIGH | Removed division by 3 in token creation | Removed the division by 3 when extracting reward rates from tokenomics schedule. Changed lines 85-95 to remove step3 calculation | Completed |
-| LBRY-003 | src/update.rs | LOW | Updated comments to remove 3x references | Updated comments at lines 78-80 to remove references to "× 3" in the tokenomics formula | Completed |
-| LBRY-004 | src/preview_canister.rs | MEDIUM | Removed division by 3 in preview calculations | Removed .and_then(|r| r.checked_div(3)) at line 85 to align preview with actual tokenomics | Completed |
-
-**Justification**: The 3x multiplier created a circular dependency where:
-1. Preview calculation multiplied by 3
-2. Token creation divided by 3 to extract "base rate"
-3. Actual minting multiplied by 3 again
-
-This meant the `initialRewardPerBurnUnit` parameter had no effect on the tokenomics graphs. Removing this multiplier:
-- Makes the parameter functional
-- Simplifies the system
-- Aligns preview calculations with actual minting
-- Removes hidden multipliers that confused users
-
-**Security Impact**: These changes only affect emission rate calculations. No security implications as they simplify calculations and reduce potential for manipulation.
-
-**Related Changes**: 
-- Tokenomics canister changes documented in src/tokenomics/TOKENOMICS_CHANGE_LOG.md (TOK-032, TOK-033)
-- Test assertions updated in tests/tests/unit/test_tokenomics_simple.rs
-- Analysis tool updated in analyze_threshold_pattern.rs (line 32)
-
-### Halving Rate Fix (2025-01-08)
-
-| Change ID | File | Risk | Description | Details | Test Status |
-|-----------|------|------|-------------|---------|-------------|
-| LBRY-005 | src/update.rs | HIGH | Fixed double halving issue in tokenomics schedule processing | Removed the else branch (lines 106-125) that was incorrectly applying additional halving to epochs. All mining epochs have burning data from the schedule generator, so this branch should never execute. Replaced with error handling. | Pending |
-| LBRY-006 | src/update.rs | LOW | Removed unused variable | Removed `is_first_mining_epoch` variable (line 69) as it's no longer needed after removing the problematic else branch | Pending |
-
-**Issue**: When configured with 85% halving step, actual execution showed rates like 58% retention instead.
-
-**Root Cause**: The tokenomics schedule generator already applies halving correctly. The removed else branch was applying halving AGAIN to certain epochs, causing double halving (85% × ~68% ≈ 58%).
-
-**Solution**: 
-- Removed the else branch that applies halving to epochs without burning data
-- Added error handling to catch invalid tokenomics schedules
-- All halving is now correctly applied only once in the schedule generation
-
-**Security Impact**: No security implications. This fix ensures the configured halving rate is applied correctly without double application.
-
-**Related Documentation**: 
-- Investigation details in TOKENOMICS_DISCREPANCY_INVESTIGATION.md
-
-## Implementation Notes
-- All changes must preserve E8S precision handling
-- Changes should align with the overall dual token system mechanics
-- Test coverage should include edge cases for reward calculations
\ No newline at end of file
diff --git a/src/lbry_fun/src/collection.rs b/src/lbry_fun/src/collection.rs
new file mode 100644
index 00000000..d42d1764
--- /dev/null
+++ b/src/lbry_fun/src/collection.rs
@@ -0,0 +1,345 @@
+use candid::{CandidType, Principal};
+use ic_cdk::{update, query};
+use ic_cdk_timers::set_timer_interval;
+use serde::{Deserialize, Serialize};
+use std::cell::RefCell;
+use std::collections::BTreeMap;
+use std::time::Duration;
+
+use crate::{TOKENS, TokenRecord};
+
+// Constants
+const MIN_COLLECTION_AMOUNT: u64 = 1_000_000;     // 0.01 ICP per token
+const MIN_SWAP_AMOUNT: u64 = 100_000_000;         // 1 ICP total
+const COLLECTION_INTERVAL: u64 = 3600;             // 1 hour
+const OPERATION_TIMEOUT: u64 = 600_000_000_000;   // 10 minutes in nanoseconds
+const DE_PEG_THRESHOLD: f64 = 0.0001;              // 0.01% price deviation triggers alert
+const STAGNATION_THRESHOLD: u64 = 86400;          // 24 hours without collection
+
+// Audit state for monitoring
+#[derive(CandidType, Deserialize, Clone)]
+pub struct AuditState {
+    pub last_successful_collection: u64,
+    pub consecutive_failures: u32,
+    pub total_value_locked: u64,
+    pub expected_value: u64,
+    pub de_peg_detected: bool,
+}
+
+// State machine for swap operations
+#[derive(CandidType, Deserialize, Clone)]
+pub enum SwapState {
+    Idle,
+    Collecting { started_at: u64 },
+    Swapping { amount: u64, started_at: u64 },
+    Burning { lbry_amount: u64, started_at: u64 },
+    Failed { error: String, timestamp: u64 },
+}
+
+// Enhanced token info with audit data
+#[derive(CandidType, Deserialize)]
+pub struct TokenCollectionInfo {
+    pub canister_id: Principal,
+    pub registered_at: u64,
+    pub total_collected: u64,
+    pub last_collection_attempt: u64,
+    pub last_successful_collection: u64,
+    pub consecutive_failures: u32,
+}
+
+// Collection summary
+#[derive(CandidType, Deserialize)]
+pub struct CollectionSummary {
+    pub total_collected: u64,
+    pub successful_collections: u32,
+    pub failed_collections: u32,
+    pub collection_results: Vec<(Principal, Result<u64, String>)>,
+    pub will_swap: bool,
+    pub audit_alerts: AuditAlerts,
+}
+
+#[derive(CandidType, Deserialize)]
+pub struct AuditAlerts {
+    pub de_peg_detected: bool,
+    pub stagnation_detected: bool,
+    pub collection_efficiency: f64,
+}
+
+// Main state
+thread_local! {
+    static TOKEN_REGISTRY: RefCell<BTreeMap<Principal, TokenCollectionInfo>> = RefCell::new(BTreeMap::new());
+    static SWAP_STATE: RefCell<SwapState> = RefCell::new(SwapState::Idle);
+    static TOTAL_ACCUMULATED: RefCell<u64> = RefCell::new(0);
+    static TOTAL_BURNED: RefCell<u64> = RefCell::new(0);
+    static AUDIT_STATE: RefCell<AuditState> = RefCell::new(AuditState {
+        last_successful_collection: 0,
+        consecutive_failures: 0,
+        total_value_locked: 0,
+        expected_value: 0,
+        de_peg_detected: false,
+    });
+}
+
+// Initialize timer on canister creation
+pub fn init_collection_timer() {
+    set_timer_interval(
+        Duration::from_secs(COLLECTION_INTERVAL), 
+        || {
+            ic_cdk::spawn(async {
+                let _ = collect_all_fees_internal().await;
+            });
+        }
+    );
+}
+
+// Internal collection function with auditing
+async fn collect_all_fees_internal() -> Result<CollectionSummary, String> {
+    // Auto-recover from stuck states
+    SWAP_STATE.with(|state| {
+        let now = ic_cdk::api::time();
+        match state.borrow().clone() {
+            SwapState::Collecting { started_at } |
+            SwapState::Swapping { started_at, .. } |
+            SwapState::Burning { started_at, .. } => {
+                if now > started_at + OPERATION_TIMEOUT {
+                    *state.borrow_mut() = SwapState::Failed {
+                        error: "Operation timed out - auto recovered".to_string(),
+                        timestamp: now,
+                    };
+                    
+                    // Update audit state
+                    AUDIT_STATE.with(|audit| {
+                        let mut a = audit.borrow_mut();
+                        a.consecutive_failures += 1;
+                    });
+                }
+            }
+            _ => {}
+        }
+    });
+    
+    // Check if we can proceed
+    SWAP_STATE.with(|state| {
+        match &*state.borrow() {
+            SwapState::Idle | SwapState::Failed { .. } => Ok(()),
+            _ => Err("Collection already in progress".to_string()),
+        }
+    })?;
+    
+    // Set state to collecting
+    SWAP_STATE.with(|s| *s.borrow_mut() = SwapState::Collecting { 
+        started_at: ic_cdk::api::time() 
+    });
+    
+    let mut total_collected = 0u64;
+    let mut successful_collections = 0u32;
+    let mut failed_collections = 0u32;
+    let mut collection_results = Vec::new();
+    let mut expected_total = 0u64;
+    
+    // Get all registered tokens from TOKENS storage
+    let token_ids: Vec<Principal> = TOKENS.with(|tokens| {
+        tokens.borrow()
+            .iter()
+            .map(|(_, record)| record.icp_swap_canister_id)
+            .collect()
+    });
+    
+    // Collect from each token independently
+    for token_id in token_ids {
+        // Query expected amount
+        let (alex_fees, _lp_fees) = match query_uncollected_fees(token_id).await {
+            Ok(fees) => fees,
+            Err(_) => (0, 0),
+        };
+        
+        expected_total += alex_fees;
+        
+        match collect_from_token(token_id).await {
+            Ok(amount) => {
+                if amount > 0 {
+                    total_collected = total_collected.saturating_add(amount);
+                    successful_collections += 1;
+                    
+                    // Update registry
+                    TOKEN_REGISTRY.with(|reg| {
+                        if let Some(mut info) = reg.borrow_mut().get_mut(&token_id) {
+                            info.total_collected = info.total_collected.saturating_add(amount);
+                            info.last_successful_collection = ic_cdk::api::time();
+                            info.consecutive_failures = 0;
+                        }
+                    });
+                }
+                collection_results.push((token_id, Ok(amount)));
+            }
+            Err(e) => {
+                failed_collections += 1;
+                collection_results.push((token_id, Err(e.clone())));
+                
+                // Update failure tracking
+                TOKEN_REGISTRY.with(|reg| {
+                    if let Some(mut info) = reg.borrow_mut().get_mut(&token_id) {
+                        info.consecutive_failures += 1;
+                        info.last_collection_attempt = ic_cdk::api::time();
+                    }
+                });
+            }
+        }
+    }
+    
+    // Audit for de-pegging
+    let collection_efficiency = if expected_total > 0 {
+        total_collected as f64 / expected_total as f64
+    } else {
+        1.0
+    };
+    
+    let de_peg_detected = (1.0 - collection_efficiency).abs() > DE_PEG_THRESHOLD;
+    
+    // Check for stagnation
+    let now = ic_cdk::api::time();
+    let stagnation_detected = AUDIT_STATE.with(|audit| {
+        let last_success = audit.borrow().last_successful_collection;
+        now - last_success > STAGNATION_THRESHOLD * 1_000_000_000
+    });
+    
+    // Update audit state
+    AUDIT_STATE.with(|audit| {
+        let mut a = audit.borrow_mut();
+        if total_collected > 0 {
+            a.last_successful_collection = now;
+            a.consecutive_failures = 0;
+        } else {
+            a.consecutive_failures += 1;
+        }
+        a.total_value_locked = TOTAL_ACCUMULATED.with(|t| *t.borrow());
+        a.expected_value = expected_total;
+        a.de_peg_detected = de_peg_detected;
+    });
+    
+    // Log critical alerts
+    if de_peg_detected {
+        ic_cdk::println!("CRITICAL: De-pegging detected! Collection efficiency: {:.2}%", 
+                         collection_efficiency * 100.0);
+    }
+    
+    if stagnation_detected {
+        ic_cdk::println!("CRITICAL: Collection stagnation detected! No successful collection in 24h");
+    }
+    
+    // Update accumulated total
+    TOTAL_ACCUMULATED.with(|total| {
+        *total.borrow_mut() = total.borrow().saturating_add(total_collected);
+    });
+    
+    // Reset to idle - collection phase complete
+    SWAP_STATE.with(|s| *s.borrow_mut() = SwapState::Idle);
+    
+    // Check if we should trigger swap
+    let accumulated = TOTAL_ACCUMULATED.with(|t| *t.borrow());
+    if accumulated >= MIN_SWAP_AMOUNT {
+        ic_cdk_timers::set_timer(Duration::from_secs(1), || {
+            ic_cdk::spawn(async {
+                let _ = execute_swap_and_burn().await;
+            });
+        });
+    }
+    
+    Ok(CollectionSummary {
+        total_collected,
+        successful_collections,
+        failed_collections,
+        collection_results,
+        will_swap: accumulated >= MIN_SWAP_AMOUNT,
+        audit_alerts: AuditAlerts {
+            de_peg_detected,
+            stagnation_detected,
+            collection_efficiency,
+        },
+    })
+}
+
+// Query uncollected fees from an ICP Swap canister
+async fn query_uncollected_fees(token_id: Principal) -> Result<(u64, u64), String> {
+    let (result,): ((u64, u64),) = ic_cdk::call(
+        token_id,
+        "get_uncollected_fees",
+        (),
+    ).await
+    .map_err(|e| format!("Failed to query fees: {:?}", e))?;
+    
+    Ok(result)
+}
+
+// Collect from a specific token
+async fn collect_from_token(token_id: Principal) -> Result<u64, String> {
+    #[derive(CandidType, Deserialize)]
+    struct CollectionResult {
+        collected: u64,
+        timestamp: u64,
+    }
+
+    #[derive(CandidType, Deserialize)]
+    enum CollectionError {
+        AmountTooSmall { amount: u64 },
+        TransferFailed { reason: String },
+    }
+
+    let result: Result<Result<CollectionResult, CollectionError>, _> = ic_cdk::call(
+        token_id,
+        "collect_alex_fees",
+        (),
+    ).await;
+    
+    match result {
+        Ok(Ok(collection)) => Ok(collection.collected),
+        Ok(Err(CollectionError::AmountTooSmall { amount })) => {
+            // This is not an error, just not enough to collect yet
+            Ok(0)
+        }
+        Ok(Err(CollectionError::TransferFailed { reason })) => {
+            Err(format!("Transfer failed: {}", reason))
+        }
+        Err(e) => Err(format!("Call failed: {:?}", e)),
+    }
+}
+
+// Execute swap and burn (placeholder - implement based on your DEX integration)
+async fn execute_swap_and_burn() -> Result<String, String> {
+    // TODO: Implement swap logic with KongSwap or other DEX
+    // 1. Swap ICP for LBRY tokens
+    // 2. Burn LBRY tokens
+    // 3. Update metrics
+    Ok("Swap and burn executed".to_string())
+}
+
+// Query functions
+#[query]
+pub fn get_audit_state() -> AuditState {
+    AUDIT_STATE.with(|a| a.borrow().clone())
+}
+
+#[query]
+pub fn get_problematic_tokens() -> Vec<(Principal, u32)> {
+    TOKEN_REGISTRY.with(|reg| {
+        reg.borrow()
+            .iter()
+            .filter(|(_, info)| info.consecutive_failures > 3)
+            .map(|(id, info)| (*id, info.consecutive_failures))
+            .collect()
+    })
+}
+
+#[query]
+pub fn get_collection_status() -> (SwapState, u64) {
+    (
+        SWAP_STATE.with(|s| s.borrow().clone()),
+        TOTAL_ACCUMULATED.with(|t| *t.borrow())
+    )
+}
+
+// Manual collection trigger
+#[update]
+pub async fn trigger_collection() -> Result<CollectionSummary, String> {
+    collect_all_fees_internal().await
+}
\ No newline at end of file
diff --git a/src/lbry_fun/src/lib.rs b/src/lbry_fun/src/lib.rs
index 61b63d4a..7ba34482 100644
--- a/src/lbry_fun/src/lib.rs
+++ b/src/lbry_fun/src/lib.rs
@@ -2,6 +2,8 @@ mod storage;
 pub use storage::*;
 mod deployment;
 pub use deployment::*;
+mod collection;
+pub use collection::*;
 mod deployment_updates;
 pub use deployment_updates::{
     initiate_token_deployment, execute_token_deployment, 
diff --git a/src/lbry_fun/src/update.rs b/src/lbry_fun/src/update.rs
index 8525abf7..00816ee3 100644
--- a/src/lbry_fun/src/update.rs
+++ b/src/lbry_fun/src/update.rs
@@ -958,5 +958,8 @@ fn init() {
             let _ = _process_fee_treasury().await;
         });
     });
+    
+    // Initialize the collection timer for ALEX rewards
+    crate::collection::init_collection_timer();
 
 }
\ No newline at end of file
diff --git a/src/lbry_fun_frontend/src/features/icp-ledger/thunks/getIcpPrice.ts b/src/lbry_fun_frontend/src/features/icp-ledger/thunks/getIcpPrice.ts
index 947320bf..f961d43f 100644
--- a/src/lbry_fun_frontend/src/features/icp-ledger/thunks/getIcpPrice.ts
+++ b/src/lbry_fun_frontend/src/features/icp-ledger/thunks/getIcpPrice.ts
@@ -21,8 +21,8 @@ const getIcpPrice = createAsyncThunk<
 
   // Check if we have an active swap pool to get the ICP price from
   if (!state.swap.activeSwapPool) {
-    console.warn("No active swap pool found, using fallback ICP price of $10.00");
-    return 10.0;
+    console.warn("No active swap pool found, using fallback ICP price of $4.00");
+    return 4.0;
   }
 
   // Fetching fresh ICP price from XRC canister via icp_swap canister
@@ -31,8 +31,8 @@ const getIcpPrice = createAsyncThunk<
     
     // Validate actor before using it
     if (!validateActor(actor, "ICP Swap")) {
-      console.warn("Unable to connect to swap canister, using fallback ICP price of $10.00");
-      return 10.0;
+      console.warn("Unable to connect to swap canister, using fallback ICP price of $4.00");
+      return 4.0;
     }
 
     // Get the secondary ratio (ICP price in cents) from the canister
@@ -54,8 +54,8 @@ const getIcpPrice = createAsyncThunk<
     }
 
     // As a last resort, return a fallback price to prevent complete failure
-    console.warn("No cached price available, using fallback ICP price of $10.00");
-    return 10.0;
+    console.warn("No cached price available, using fallback ICP price of $4.00");
+    return 4.0;
   }
 });
 
diff --git a/src/lbry_fun_frontend/src/features/swap/components/Insights.tsx b/src/lbry_fun_frontend/src/features/swap/components/Insights.tsx
index d58ac798..6551c479 100644
--- a/src/lbry_fun_frontend/src/features/swap/components/Insights.tsx
+++ b/src/lbry_fun_frontend/src/features/swap/components/Insights.tsx
@@ -207,7 +207,7 @@ const Insights: React.FC = () => {
                             </div>
                             <div className="terminal-row">
                                 <span className="terminal-label">protocol:</span>
-                                <span className="terminal-accent">1%_alexandria | 49.5%_lp_treasury | 49.5%_stakers</span>
+                                <span className="terminal-accent">1%_alexandria | 99%_locked_lp</span>
                             </div>
                         </div>
                         <DistributionTracker icpSwapCanisterId={poolData[1].icp_swap_canister_id} />
diff --git a/src/lbry_fun_frontend/src/features/swap/components/distribution/PoolAllocationChart.tsx b/src/lbry_fun_frontend/src/features/swap/components/distribution/PoolAllocationChart.tsx
index b7beed07..b45e34a7 100644
--- a/src/lbry_fun_frontend/src/features/swap/components/distribution/PoolAllocationChart.tsx
+++ b/src/lbry_fun_frontend/src/features/swap/components/distribution/PoolAllocationChart.tsx
@@ -38,7 +38,7 @@ const PoolAllocationChart: React.FC<PoolAllocationChartProps> = ({ data }) => {
         {/* LP Treasury Pool */}
         <div className="terminal-info">
           <div className="flex items-center justify-between mb-2">
-            <span className="terminal-label">lp_treasury (49.5%):</span>
+            <span className="terminal-label">locked_lp (99%):</span>
             <span className="terminal-accent">{formatDistributionAmount(data.lp_treasury_total)}</span>
           </div>
           <div className="terminal-progress-bar">
@@ -52,22 +52,6 @@ const PoolAllocationChart: React.FC<PoolAllocationChartProps> = ({ data }) => {
           </div>
         </div>
 
-        {/* Stakers Pool */}
-        <div className="terminal-info">
-          <div className="flex items-center justify-between mb-2">
-            <span className="terminal-label">stakers_pool (49.5%):</span>
-            <span className="terminal-accent">{formatDistributionAmount(data.stakers_total)}</span>
-          </div>
-          <div className="terminal-progress-bar">
-            <div 
-              className="terminal-progress-fill terminal-pool-badge-stakers"
-              style={{ width: `${stakersPercent}%` }}
-            />
-          </div>
-          <div className="mt-1 text-xs terminal-dim">
-            {stakersPercent.toFixed(2)}% of total distributions
-          </div>
-        </div>
       </div>
       
       <div className="mt-4 pt-4 border-t border-terminal-primary/20">
diff --git a/src/lbry_fun_frontend/src/features/token/components/terminal/TerminalCreateToken.tsx b/src/lbry_fun_frontend/src/features/token/components/terminal/TerminalCreateToken.tsx
index 4d8b49df..20072c93 100644
--- a/src/lbry_fun_frontend/src/features/token/components/terminal/TerminalCreateToken.tsx
+++ b/src/lbry_fun_frontend/src/features/token/components/terminal/TerminalCreateToken.tsx
@@ -367,9 +367,8 @@ const TerminalCreateToken: React.FC = () => {
             <span className="terminal-label">icp_revenue_flow:</span>
             <div className="pl-4">
               - every interval, 1% of ICP pool distributed:
-              - 1% to LBRY buyback
-              - 49.5% to primary staking rewards
-              - 49.5% to primary buybacks + locked liquidity
+              - 1% to ALEX stakers wallet
+              - 99% to locked kongswap liquidity
             </div>
           </div>
         </div>
@@ -638,7 +637,7 @@ const TerminalCreateToken: React.FC = () => {
                 <div className="flex items-center mb-1">
                   <span className="terminal-label">distribution_interval</span>
                   <TooltipIcon
-                    text="Controls how often rewards are distributed. Every interval, exactly 1% of the total ICP pool is split: 1% to LBRY buyback, 49.5% to stakers, and 49.5% to liquidity. DEFAULT: 1 hour. WARNING: Only change if you understand the implications."
+                    text="Controls how often rewards are distributed. Every interval, exactly 1% of the total ICP pool is split: 1% to ALEX stakers wallet, 99% to locked kongswap liquidity. DEFAULT: 1 hour. WARNING: Only change if you understand the implications."
                   />
                 </div>
                 <TerminalSelect
(END)
```