# Deployment State Simplification Plan

## Current State Tracking Issues

### 1. Multiple Sources of Truth
- **Deployment Status** (lbry_fun): Active, Failed, Completed, Cleaning, CleanupFailed
- **Token Record** (lbry_fun): pool_creation_failed flag, is_active flag
- **Launch Time** (icp_swap): Separate LAUNCH_TIME check
- **Frontend Status**: Own state machine (INITIATED, EXECUTING, POLLING, etc.)

### 2. Critical Problems
- Deployment can "succeed" with pool_creation_failed=true
- Trading enabled even when deployment partially failed
- No atomic state - canisters check different conditions
- Users can lose funds in "zombie" deployments

### 3. Current Flow Issues
```
Deployment starts → Canisters created → Pool fails → 
  ├─ lbry_fun: Sets pool_creation_failed=true but deployment "succeeds"
  ├─ icp_swap: Fully operational (only checks launch time)
  └─ Users: Can trade but no liquidity pool exists!
```

## Proposed Simplified State System

### Single Source of Truth: Token Status Enum
```rust
#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum TokenStatus {
    Deploying {
        deployment_id: u64,
        progress: u8, // 0-100%
        created_canisters: Vec<Principal>,
    },
    Failed {
        deployment_id: u64,
        reason: String,
        refund_status: RefundStatus,
    },
    Live {
        launch_time: u64,
        pool_id: String,
    },
    Suspended {
        reason: String,
        suspended_at: u64,
    },
}
```

### Key Principles
1. **No Partial Success** - Either fully deployed or failed
2. **Atomic Transitions** - State changes are all-or-nothing
3. **Single Query** - All canisters check lbry_fun for token status
4. **Trading Gated** - No operations allowed unless status is Live

## Implementation Steps

### Phase 1: Update Core State
```rust
// In lbry_fun storage.rs
pub struct TokenRecord {
    pub id: u64,
    pub status: TokenStatus, // Single authoritative status
    // Remove: is_active, pool_creation_failed flags
    pub primary_token_id: Principal,
    pub secondary_token_id: Principal,
    // ... other fields
}
```

### Phase 2: Deployment Flow Changes
```rust
// In deployment_execution.rs
async fn execute_deployment() -> Result<u64, String> {
    let mut status = TokenStatus::Deploying { 
        deployment_id, 
        progress: 0,
        created_canisters: vec![]
    };
    
    // Create canisters (20% each)
    for canister in [primary, secondary, swap, tokenomics, logs] {
        match create_canister().await {
            Ok(id) => {
                status.add_canister(id);
                status.update_progress(20);
            }
            Err(e) => {
                // Immediate failure - triggers cleanup
                status = TokenStatus::Failed {
                    deployment_id,
                    reason: format!("Canister creation failed: {}", e),
                    refund_status: RefundStatus::Pending,
                };
                return Err("Deployment failed");
            }
        }
    }
    
    // Create pool - MUST succeed
    match create_pool_on_kong_swap().await {
        Ok(pool_id) => {
            status = TokenStatus::Live {
                launch_time: ic_cdk::api::time() + launch_delay,
                pool_id,
            };
        }
        Err(e) => {
            status = TokenStatus::Failed {
                deployment_id,
                reason: format!("Pool creation failed: {}", e),
                refund_status: RefundStatus::Pending,
            };
            return Err("Deployment failed - pool creation");
        }
    }
    
    Ok(token_id)
}
```

### Phase 3: Child Canister Checks
```rust
// In icp_swap update.rs
async fn check_token_status() -> Result<TokenStatus, String> {
    let lbry_fun = Principal::from_text(LBRY_FUN_CANISTER_ID)?;
    let token_id = get_my_token_id()?;
    
    // Single inter-canister call to check status
    call(lbry_fun, "get_token_status", (token_id,)).await
}

#[update]
pub async fn swap() -> Result<String, ExecutionError> {
    // Check trading allowed
    match check_token_status().await? {
        TokenStatus::Live { launch_time, .. } => {
            if ic_cdk::api::time() < launch_time {
                return Err("Token not yet launched");
            }
        }
        TokenStatus::Failed { .. } => return Err("Token deployment failed"),
        TokenStatus::Suspended { reason, .. } => return Err(format!("Trading suspended: {}", reason)),
        TokenStatus::Deploying { .. } => return Err("Token still deploying"),
    }
    
    // Proceed with swap...
}
```

### Phase 4: Frontend Updates
```typescript
// Single status to track
enum TokenStatus {
  DEPLOYING = "deploying",
  FAILED = "failed", 
  LIVE = "live",
  SUSPENDED = "suspended"
}

// Query lbry_fun for authoritative status
const checkTokenStatus = async (tokenId: bigint) => {
  const status = await actor.get_token_status(tokenId);
  // No more frontend state machine - just reflect backend state
  return status;
};
```

### Phase 5: Recovery Simplification
```rust
// Clean recovery flow
pub async fn recover_failed_deployment(deployment_id: u64) -> Result<(), String> {
    let token = get_token_by_deployment(deployment_id)?;
    
    match token.status {
        TokenStatus::Failed { refund_status: RefundStatus::Pending, .. } => {
            // Delete canisters and refund
            cleanup_and_refund(token).await
        }
        _ => Err("Can only recover failed deployments")
    }
}
```

## Migration Plan

1. **Add new TokenStatus enum** while keeping old fields
2. **Update deployment flow** to use new status
3. **Add status check endpoints** to all canisters  
4. **Update frontend** to use single status
5. **Remove old fields** after verification

## Benefits

1. **Single Truth** - One status, one place
2. **Atomic Safety** - No partial states allowing trading
3. **Clear Recovery** - Failed means failed, can refund
4. **Simpler Code** - Remove complex state reconciliation
5. **User Safety** - No risk of trading in zombie tokens

## Testing Strategy

1. Test normal deployment → Live status
2. Test pool failure → Failed status + refund
3. Test canister creation failure → Failed status + cleanup
4. Verify no trading possible in non-Live states
5. Test status transitions are atomic