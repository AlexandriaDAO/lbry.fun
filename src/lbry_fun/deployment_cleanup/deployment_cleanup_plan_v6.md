# Token Deployment V6 - Maximum Robustness Through Saga Pattern

## Core Design Principles

1. **Deployment as a Saga**: Each deployment is a series of compensatable transactions
2. **Event Sourcing**: Every action is logged before execution
3. **Eventual Consistency**: Accept distributed reality, design for it
4. **Self-Healing**: System automatically retries and recovers
5. **Zero Lost Resources**: Every canister is tracked from creation to deletion

## Architecture

### 1. Deployment Saga State Machine

```rust
#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum SagaState {
    // Initial states
    Initiated { payment_block: BlockIndex },
    PaymentVerified { amount: u64 },
    
    // Canister creation states
    CreatingSwapCanister,
    SwapCanisterCreated { canister_id: Principal },
    CreatingTokenomicsCanister { swap_id: Principal },
    TokenomicsCanisterCreated { swap_id: Principal, tokenomics_id: Principal },
    CreatingLogsCanister { previous_ids: Vec<Principal> },
    LogsCanisterCreated { management_canisters: Vec<Principal> },
    
    // Token creation states  
    CreatingPrimaryToken { management_canisters: Vec<Principal> },
    PrimaryTokenCreated { management_canisters: Vec<Principal>, primary_id: Principal },
    CreatingSecondaryToken { all_ids: Vec<Principal> },
    SecondaryTokenCreated { all_canisters: Vec<Principal> },
    
    // Installation states
    InstallingSwapWasm { all_canisters: Vec<Principal> },
    SwapWasmInstalled { all_canisters: Vec<Principal> },
    InstallingTokenomicsWasm { all_canisters: Vec<Principal> },
    TokenomicsWasmInstalled { all_canisters: Vec<Principal> },
    InstallingLogsWasm { all_canisters: Vec<Principal> },
    AllWasmInstalled { all_canisters: Vec<Principal> },
    
    // Pool creation states
    TransferringTokensToKong { all_canisters: Vec<Principal> },
    TokensTransferred { all_canisters: Vec<Principal>, transfer_blocks: Vec<BlockIndex> },
    CreatingPool { all_canisters: Vec<Principal>, transfers: Vec<BlockIndex> },
    PoolCreated { all_canisters: Vec<Principal>, pool_id: Nat },
    
    // Final states
    Completed { token_id: u64 },
    Failed { reason: String, last_successful_state: Box<SagaState> },
    RolledBack { reason: String },
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct DeploymentSaga {
    pub saga_id: u128,  // Unique ID using raw_rand
    pub user: Principal,
    pub params: CreateTokenParams,
    pub state: SagaState,
    pub events: Vec<SagaEvent>,
    pub created_at: u64,
    pub last_updated: u64,
    pub retry_count: u32,
    pub next_retry_at: Option<u64>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct SagaEvent {
    pub timestamp: u64,
    pub event_type: EventType,
    pub details: String,
}
```

### 2. Idempotent Operations

Every operation checks if it's already completed:

```rust
async fn create_swap_canister(saga: &mut DeploymentSaga) -> Result<Principal, String> {
    // Check if already created
    if let SagaState::SwapCanisterCreated { canister_id } = &saga.state {
        return Ok(*canister_id);
    }
    
    // Log intent
    saga.add_event(EventType::CreatingSwapCanister, "Attempting to create swap canister");
    
    // Create with specific cycles
    match create_canister_with_settings(CanisterSettings {
        controllers: Some(vec![ic_cdk::id()]),
        compute_allocation: None,
        memory_allocation: None,
        freezing_threshold: Some(30_days_in_seconds),
    }).await {
        Ok(canister_id) => {
            saga.state = SagaState::SwapCanisterCreated { canister_id };
            saga.add_event(EventType::SwapCanisterCreated, format!("Created: {}", canister_id));
            Ok(canister_id)
        }
        Err(e) => {
            saga.add_event(EventType::Error, format!("Failed to create swap canister: {}", e));
            Err(e)
        }
    }
}
```

### 3. Saga Execution Engine

```rust
#[update]
async fn create_token(params: CreateTokenParams) -> Result<String, String> {
    // Create new saga
    let saga_id = raw_rand().as_slice().try_into().unwrap();
    let saga = DeploymentSaga {
        saga_id,
        user: caller(),
        params,
        state: SagaState::Initiated { payment_block: 0 },
        events: vec![],
        created_at: time(),
        last_updated: time(),
        retry_count: 0,
        next_retry_at: None,
    };
    
    // Store saga immediately
    DEPLOYMENT_SAGAS.with(|s| s.borrow_mut().insert(saga_id, saga));
    
    // Execute saga
    execute_saga_with_id(saga_id).await
}

async fn execute_saga_with_id(saga_id: u128) -> Result<String, String> {
    loop {
        let saga = get_saga(saga_id)?;
        
        match execute_next_step(&saga).await {
            Ok(NextStep::Continue(updated_saga)) => {
                save_saga(updated_saga);
                continue;
            }
            Ok(NextStep::Completed(token_id)) => {
                return Ok(format!("Token {} created successfully", token_id));
            }
            Err(e) if e.is_transient() => {
                schedule_retry(saga_id, calculate_backoff(saga.retry_count));
                return Err(format!("Temporary failure: {}. Will retry automatically.", e));
            }
            Err(e) => {
                initiate_rollback(saga_id, e.to_string()).await?;
                return Err(format!("Deployment failed and rolled back: {}", e));
            }
        }
    }
}
```

### 4. Background Recovery Worker

```rust
#[heartbeat]
async fn saga_recovery_worker() {
    let now = time();
    
    // Find stuck or retry-ready sagas
    let sagas_to_process = DEPLOYMENT_SAGAS.with(|s| {
        s.borrow()
            .iter()
            .filter(|(_, saga)| {
                match saga.state {
                    SagaState::Completed { .. } | SagaState::RolledBack { .. } => false,
                    _ => saga.next_retry_at.map_or(false, |t| t <= now)
                        || saga.last_updated < now - 300_000_000_000 // 5 minutes
                }
            })
            .map(|(id, _)| id)
            .collect::<Vec<_>>()
    });
    
    for saga_id in sagas_to_process {
        ic_cdk::spawn(async move {
            let _ = execute_saga_with_id(saga_id).await;
        });
    }
}
```

### 5. Rollback/Compensation Logic

```rust
async fn rollback_saga(saga: &DeploymentSaga) -> Result<(), String> {
    let mut errors = vec![];
    
    // Extract all created resources from any state
    let canisters = extract_all_canisters(&saga.state);
    
    // Best-effort cleanup in reverse order
    for canister_id in canisters.iter().rev() {
        match stop_and_delete_canister(*canister_id).await {
            Ok(_) => {
                saga.add_event(EventType::CanisterDeleted, format!("Deleted {}", canister_id));
            }
            Err(e) => {
                errors.push(format!("Failed to delete {}: {}", canister_id, e));
            }
        }
    }
    
    // Refund calculation based on progress
    let refund_amount = calculate_refund(&saga.state);
    if refund_amount > 0 {
        match transfer_icp(saga.user, refund_amount).await {
            Ok(block) => {
                saga.add_event(EventType::Refunded, format!("Refunded {} at block {}", refund_amount, block));
            }
            Err(e) => {
                errors.push(format!("Refund failed: {}", e));
                // Store in separate failed refunds table
                store_failed_refund(saga.user, refund_amount, saga.saga_id);
            }
        }
    }
    
    if errors.is_empty() {
        Ok(())
    } else {
        Err(format!("Rollback completed with errors: {}", errors.join("; ")))
    }
}
```

### 6. Robust State Storage

```rust
thread_local! {
    // Primary storage - stable memory
    static DEPLOYMENT_SAGAS: RefCell<StableBTreeMap<u128, DeploymentSaga, Memory>> = 
        RefCell::new(StableBTreeMap::init(get_saga_memory()));
    
    // Index for quick lookups
    static USER_SAGAS: RefCell<StableBTreeMap<Principal, Vec<u128>, Memory>> = 
        RefCell::new(StableBTreeMap::init(get_user_saga_memory()));
    
    // Canister ownership tracking
    static CANISTER_TO_SAGA: RefCell<StableBTreeMap<Principal, u128, Memory>> = 
        RefCell::new(StableBTreeMap::init(get_canister_saga_memory()));
}

// Every canister creation records ownership
fn record_canister_ownership(canister_id: Principal, saga_id: u128) {
    CANISTER_TO_SAGA.with(|c| c.borrow_mut().insert(canister_id, saga_id));
    
    // Also log to IC output for absolute safety
    ic_cdk::println!("CANISTER_CREATED: {} for saga {}", canister_id, saga_id);
}
```

### 7. Circuit Breakers

```rust
static CIRCUIT_BREAKER: RefCell<CircuitBreaker> = RefCell::new(CircuitBreaker::new());

struct CircuitBreaker {
    kongswap_failures: u32,
    canister_creation_failures: u32,
    last_reset: u64,
}

impl CircuitBreaker {
    fn check_kongswap(&mut self) -> Result<(), String> {
        if self.kongswap_failures > 5 {
            if time() - self.last_reset > 3600_000_000_000 { // 1 hour
                self.reset();
            } else {
                return Err("KongSwap circuit breaker open - too many failures".to_string());
            }
        }
        Ok(())
    }
    
    fn record_kongswap_failure(&mut self) {
        self.kongswap_failures += 1;
    }
}
```

### 8. Admin Monitoring & Tools

```rust
#[query]
fn get_deployment_health() -> DeploymentHealth {
    DeploymentHealth {
        total_sagas: count_all_sagas(),
        in_progress: count_by_state_type(StateType::InProgress),
        failed: count_by_state_type(StateType::Failed),
        stuck: count_stuck_sagas(),
        circuit_breaker_status: get_circuit_status(),
        orphaned_canisters: find_orphaned_canisters(),
    }
}

#[update(guard = "is_admin")]
async fn force_saga_transition(saga_id: u128, new_state: SagaState) -> Result<(), String> {
    // Admin override with full audit trail
    let mut saga = get_saga(saga_id)?;
    saga.add_event(EventType::AdminOverride, format!("Forced transition to {:?}", new_state));
    saga.state = new_state;
    save_saga(saga);
    
    // Resume execution
    execute_saga_with_id(saga_id).await
}

#[update(guard = "is_admin")]  
async fn cleanup_orphaned_canister(canister_id: Principal) -> Result<(), String> {
    // Check if truly orphaned
    if let Some(saga_id) = CANISTER_TO_SAGA.with(|c| c.borrow().get(&canister_id)) {
        return Err(format!("Canister belongs to saga {}", saga_id));
    }
    
    // Delete with full logging
    stop_and_delete_canister(canister_id).await
}
```

## Key Robustness Features

1. **No Lost Canisters**: Every canister is tracked from creation with saga ID
2. **Resumable From Any Point**: State machine can continue from any state
3. **Self-Healing**: Background worker automatically retries stuck deployments
4. **Audit Trail**: Complete event log for every deployment
5. **Circuit Breakers**: Prevent cascade failures from external services
6. **Idempotent Operations**: Safe to retry any operation
7. **Graceful Degradation**: Continues working even if some subsystems fail
8. **Admin Escape Hatches**: Manual overrides for edge cases

## Failure Scenarios Handled

1. **Power loss during deployment**: Saga resumes from last state
2. **KongSwap down for hours**: Circuit breaker prevents attempts, retries when healthy
3. **Canister creation fails mid-way**: Rollback cleans up partial deployment
4. **Memory corruption**: Stable memory + IC logs allow reconstruction
5. **Admin mistake**: All actions logged, reversible with audit trail
6. **Upgrade during deployment**: Sagas continue after upgrade
7. **Network partition**: Eventually consistent, will complete when network heals
8. **Malicious user**: Rollback ensures no resource leaks

## Trade-offs

- **Complexity**: More complex than V5, but handles all edge cases
- **Storage**: Uses more memory for event logs and indexes
- **Latency**: Slightly slower due to state persistence
- **But**: Near-zero chance of lost funds or orphaned resources

This design acknowledges the distributed nature of IC and builds robustness through eventual consistency rather than impossible atomicity.