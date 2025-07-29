# ALEX Staker Rewards Implementation Plan v4 - Production Ready

## Core Engineering Principles

### 1. Conservation of Value
Every unit of value must be accounted for at all times. No funds can be lost due to precision errors, failed transfers, or state transitions. The system maintains exact arithmetic and implements atomic operations with rollback capabilities.

### 2. Fail-Safety
The system defaults to a safe state when failures occur. Failed operations preserve funds, stuck states auto-recover, and partial successes don't cascade into system-wide failures. Every external interaction assumes failure as the default case.

### 3. Simplicity
Complex solutions create attack surfaces. We choose the simplest correct implementation over clever optimizations. Code clarity and auditability take precedence over minor efficiency gains.

## Economic Model

### Distribution Mechanics
Every interval (default: 1 hour), **1% of the reward pool** is distributed.

This 1% is then split:
- **1% of the distribution** (0.01% of pool) → ALEX stakers via LBRY burns
- **99% of the distribution** (0.99% of pool) → Locked LP (future implementation)

### Concrete Example
Starting reward pool: 100 ICP
- Hour 1: Distribute 1 ICP (1% of 100)
  - 0.01 ICP → lbry_fun (for LBRY burn)
  - 0.99 ICP → Locked LP
  - Remaining pool: 99 ICP
- Hour 2: Distribute 0.99 ICP (1% of 99)
  - 0.0099 ICP → lbry_fun
  - 0.9801 ICP → Locked LP
  - Remaining pool: 98.01 ICP

## Architecture: Pull Model

### Overview
Instead of having potentially thousands of `icp_swap` canisters push fees to `lbry_fun`, we implement a pull model where `lbry_fun` collects fees periodically. This reduces complexity and eliminates race conditions.

## ICP Swap Canister Implementation

```rust
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableCell,
};
use std::cell::RefCell;

type Memory = VirtualMemory<DefaultMemoryImpl>;

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );
    
    // Stable storage for uncollected fees - survives upgrades
    static UNCOLLECTED_ALEX_FEES: RefCell<StableCell<u64, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0))),
            0u64
        ).expect("Failed to init UNCOLLECTED_ALEX_FEES")
    );
    
    static UNCOLLECTED_LP_FEES: RefCell<StableCell<u64, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1))),
            0u64
        ).expect("Failed to init UNCOLLECTED_LP_FEES")
    );
    
    // Segregated reward pool - separate from operational funds
    static REWARD_POOL: RefCell<StableCell<u64, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(2))),
            0u64
        ).expect("Failed to init REWARD_POOL")
    );
}

// Constants
const ICP_TRANSFER_FEE: u64 = 10_000; // 0.0001 ICP

// Internal function - only callable by timer
async fn distribute_reward() -> Result<String, DistributionError> {
    // Get current reward pool balance
    let reward_pool = REWARD_POOL.with(|p| p.borrow().get());
    
    if reward_pool == 0 {
        return Ok("No rewards to distribute".to_string());
    }
    
    // Calculate 1% of reward pool
    let total_distribution = reward_pool / 100;
    
    if total_distribution == 0 {
        return Ok("Distribution amount too small".to_string());
    }
    
    // Deduct from reward pool first
    REWARD_POOL.with(|p| {
        p.borrow_mut().set(reward_pool - total_distribution)
            .expect("Failed to update reward pool");
    });
    
    // Calculate exact distribution
    let alex_portion = total_distribution / 100;  // 1% of distribution
    let lp_portion = total_distribution - alex_portion; // Remainder for exact accounting
    
    // Update uncollected fees
    UNCOLLECTED_ALEX_FEES.with(|f| {
        let current = f.borrow().get();
        f.borrow_mut().set(current.saturating_add(alex_portion))
            .expect("Failed to update ALEX fees");
    });
    
    UNCOLLECTED_LP_FEES.with(|f| {
        let current = f.borrow().get();
        f.borrow_mut().set(current.saturating_add(lp_portion))
            .expect("Failed to update LP fees");
    });
    
    Ok(format!("Distributed {} from pool of {}", total_distribution, reward_pool))
}

// Query function for lbry_fun to check available fees
#[query]
pub fn get_uncollected_fees() -> (u64, u64) {
    (
        UNCOLLECTED_ALEX_FEES.with(|f| f.borrow().get()),
        UNCOLLECTED_LP_FEES.with(|f| f.borrow().get())
    )
}

// Collection with CEI pattern and failure reversal
#[update(guard = "only_lbry_fun")]
pub async fn collect_alex_fees() -> Result<CollectionResult, CollectionError> {
    // Check
    let fees = UNCOLLECTED_ALEX_FEES.with(|f| f.borrow().get());
    
    if fees < ICP_TRANSFER_FEE {
        return Err(CollectionError::AmountTooSmall { amount: fees });
    }
    
    // Effect - deduct from balance
    UNCOLLECTED_ALEX_FEES.with(|f| {
        f.borrow_mut().set(0).expect("Failed to clear ALEX fees");
    });
    
    // Interaction - external transfer
    match transfer_icp_to_lbry_fun(fees).await {
        Ok(_) => {
            Ok(CollectionResult { 
                collected: fees,
                timestamp: ic_cdk::api::time()
            })
        }
        Err(e) => {
            // Failure reversal - restore exact balance
            UNCOLLECTED_ALEX_FEES.with(|f| {
                f.borrow_mut().set(fees).expect("Failed to restore ALEX fees");
            });
            Err(CollectionError::TransferFailed { reason: e.to_string() })
        }
    }
}

// Admin function to add funds to reward pool
#[update(guard = "is_admin")]
pub fn add_to_reward_pool(amount: u64) -> Result<u64, String> {
    REWARD_POOL.with(|p| {
        let current = p.borrow().get();
        let new_total = current.saturating_add(amount);
        p.borrow_mut().set(new_total)
            .map_err(|e| format!("Failed to update pool: {:?}", e))?;
        Ok(new_total)
    })
}
```

## LBRY Fun Canister Implementation

```rust
use ic_cdk_timers::set_timer_interval;
use std::collections::BTreeMap;
use std::time::Duration;

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
struct TokenInfo {
    canister_id: Principal,
    registered_at: u64,
    total_collected: u64,
    last_collection_attempt: u64,
    last_successful_collection: u64,
    consecutive_failures: u32,
}

// Main state
thread_local! {
    static TOKEN_REGISTRY: RefCell<BTreeMap<Principal, TokenInfo>> = RefCell::new(BTreeMap::new());
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
#[init]
fn init() {
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
async fn collect_all_fees_internal() -> Result<CollectionSummary, LbryFunError> {
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
            _ => Err(LbryFunError::SwapInProgress),
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
    
    // Get all registered tokens
    let tokens: Vec<Principal> = TOKEN_REGISTRY.with(|reg| {
        reg.borrow().keys().cloned().collect()
    });
    
    // Collect from each token independently
    for token_id in tokens {
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
        set_timer(Duration::from_secs(1), || {
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

// Query audit state
#[query]
pub fn get_audit_state() -> AuditState {
    AUDIT_STATE.with(|a| a.borrow().clone())
}

// Query problematic tokens
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
```

## Operational Requirements

### Monitoring Infrastructure

1. **Real-time Metrics**
   - Collection success rate per hour
   - Total value locked vs expected value
   - Individual token failure rates
   - State machine transition times

2. **Critical Alerts**
   - **De-pegging Alert**: Triggered when collection efficiency drops below 95%
   - **Stagnation Alert**: Triggered when no successful collection occurs for 24 hours
   - **Token Failure Alert**: Triggered when a token fails collection 3 times consecutively
   - **State Timeout Alert**: Triggered when any operation exceeds 10-minute timeout

3. **Automated Responses**
   - Auto-recovery from stuck states
   - Isolation of failing tokens after 5 consecutive failures
   - Emergency pause mechanism for systemic failures

### Operational Runbook

1. **De-pegging Response**
   - Immediately investigate token transfer mechanisms
   - Check for systematic collection failures
   - Verify guard functions and permissions
   - Consider emergency pause if efficiency < 90%

2. **Stagnation Response**
   - Check timer health
   - Verify canister cycles
   - Review recent upgrades or changes
   - Manually trigger collection if needed

3. **Token Failure Response**
   - Query specific token state
   - Check token canister health
   - Verify ICP balance in token canister
   - Consider removing token from registry after investigation

## Testing Requirements

### Unit Tests
1. **Exact Math Verification**
   - Test distribution calculations with various pool sizes
   - Verify zero precision loss
   - Confirm conservation of value

2. **State Persistence**
   - Test upgrade scenarios with stable structures
   - Verify fee accumulation across upgrades
   - Confirm reward pool isolation

### Integration Tests
1. **End-to-End Collection**
   - Simulate 100+ tokens with varying states
   - Test partial collection success
   - Verify audit accuracy

2. **Failure Scenarios**
   - Test transfer failures and reversals
   - Verify timeout recovery
   - Test de-pegging detection

### Performance Tests
1. **Scale Testing**
   - 1000+ registered tokens
   - Measure collection time
   - Verify memory usage

2. **Stress Testing**
   - Rapid state transitions
   - Concurrent operations
   - Network partition simulation

## Migration Path

1. **Pre-deployment Validation**
   - Run comprehensive test suite
   - Verify stable structure compatibility
   - Audit reward pool segregation

2. **Staged Rollout**
   - Deploy to testnet with subset of tokens
   - Monitor for 48 hours
   - Verify all metrics and alerts

3. **Production Deployment**
   - Deploy during low-activity period
   - Initialize with conservative parameters
   - Monitor intensively for first week

4. **Post-deployment**
   - Daily audit reviews for first month
   - Weekly performance optimization
   - Monthly security reviews