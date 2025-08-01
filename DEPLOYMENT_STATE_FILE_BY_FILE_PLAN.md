# Deployment State Simplification - File-by-File Implementation Plan

## Clean Slate Implementation (No Backwards Compatibility Needed)

### Current Problems:
1. Deployment can "succeed" with failed pool creation
2. Trading enabled without liquidity pool
3. State scattered across multiple fields
4. No atomic deployment - partial states possible

## File-by-File Changes

### 1. `src/lbry_fun/src/storage.rs`
**CURRENT:**
```rust
pub struct TokenRecord {
    pub id: u64,
    // ... token fields ...
    pub pool_creation_failed: bool,  // Problem: Only tracks pool failure
    pub pool_created_at: u64,        // Problem: Separate from deployment status
    // MISSING: No deployment_id reference!
}
```

**PROPOSED CHANGE:**
```rust
// ADD new enum at top of file
#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum TokenStatus {
    Deploying {
        deployment_id: u64,
        progress: u8, // 0-100
        created_canisters: Vec<Principal>,
    },
    Failed {
        deployment_id: u64,
        reason: String,
        failed_at: u64,
    },
    Live {
        pool_id: String,
        launched_at: u64,
    },
    Suspended {
        reason: String,
        suspended_at: u64,
    },
}

// REPLACE TokenRecord entirely (no backwards compatibility needed)
pub struct TokenRecord {
    pub id: u64,
    pub deployment_id: u64,           // REQUIRED: Always linked to deployment
    pub status: TokenStatus,          // Single source of truth
    // Core token info
    pub primary_token_id: Principal,
    pub primary_token_name: String,
    pub primary_token_symbol: String,
    pub primary_token_max_supply: u64,
    pub secondary_token_id: Principal,
    pub secondary_token_name: String,
    pub secondary_token_symbol: String,
    // Canister references
    pub tokenomics_canister_id: Principal,
    pub icp_swap_canister_id: Principal,
    pub logs_canister_id: Principal,
    // Configuration
    pub initial_primary_mint: u64,
    pub initial_secondary_burn: u64,
    pub halving_step: u64,
    pub threshold_multiplier: f64,
    pub initial_reward_per_burn_unit: u64,
    pub distribution_interval_seconds: u64,
    pub launch_delay_seconds: u64,
    // Metadata
    pub caller: Principal,
    pub created_time: u64,
    // REMOVED: pool_creation_failed, pool_created_at (now in status)
}
```

### 2. `src/lbry_fun/src/deployment.rs`
**CURRENT:**
```rust
pub enum DeploymentStatus {
    Active,
    Failed,
    Completed,
    Cleaning,
    CleanupFailed,
}

pub struct Deployment {
    pub status: DeploymentStatus,
    pub token_id: Option<u64>,  // Set on completion
    // ... other fields ...
}
```

**PROPOSED CHANGE:**
```rust
// KEEP DeploymentStatus for deployment tracking
// But deployment completion now updates TokenRecord.status

// ADD helper to convert deployment outcome to token status
impl Deployment {
    pub fn to_token_status(&self) -> TokenStatus {
        match self.status {
            DeploymentStatus::Active => TokenStatus::Deploying {
                deployment_id: self.id,
                progress: (self.created_canisters.len() as u8 * 20),
                created_canisters: self.created_canisters.clone(),
            },
            DeploymentStatus::Failed => TokenStatus::Failed {
                deployment_id: self.id,
                reason: self.last_error.clone().unwrap_or_default(),
                failed_at: self.failed_at.unwrap_or_default(),
            },
            DeploymentStatus::Completed => {
                // This should not happen - completed deployments should have pool info
                TokenStatus::Failed {
                    deployment_id: self.id,
                    reason: "Deployment completed but no pool created".to_string(),
                    failed_at: ic_cdk::api::time(),
                }
            },
            _ => TokenStatus::Failed {
                deployment_id: self.id,
                reason: format!("Unexpected deployment status: {:?}", self.status),
                failed_at: ic_cdk::api::time(),
            }
        }
    }
}
```

### 3. `src/lbry_fun/src/deployment_execution.rs`
**CURRENT PROBLEM (line 240-267):**
```rust
// Currently continues deployment even when pool creation fails!
match create_pool_on_kong_swap(...).await {
    Err(e) => {
        token_record.pool_creation_failed = true;
        // Continue with token creation even if pool fails
    }
}
Ok(token_id)  // Returns success even with failed pool!
```

**OPTIMAL CHANGE - Make Pool Creation Atomic:**
```rust
// Start with token in deploying state
let mut token_record = TokenRecord {
    id: 0, // Will be set when inserting
    deployment_id: deployment.id,
    status: TokenStatus::Deploying {
        deployment_id: deployment.id,
        progress: 80, // 5 canisters created = 80%
        created_canisters: deployment.created_canisters.clone(),
    },
    // ... all other fields ...
};

match create_pool_on_kong_swap(...).await {
    Ok(reply) => {
        // Pool created - deployment fully successful
        token_record.status = TokenStatus::Live {
            pool_id: reply.pool_id,
            launched_at: ic_cdk::api::time() + token_record.launch_delay_seconds * 1_000_000_000,
        };
        
        // Save the successful token
        let token_id = TOKENS.with(|tokens| {
            let id = tokens.len() as u64 + 1;
            token_record.id = id;
            tokens.insert(id, token_record);
            id
        });
        
        // Update deployment to completed
        deployment.status = DeploymentStatus::Completed;
        deployment.token_id = Some(token_id);
        DEPLOYMENTS.with(|d| d.borrow_mut().insert(deployment.id, deployment));
        
        Ok(token_id)
    },
    Err(e) => {
        // Pool creation failed - ENTIRE deployment fails
        ic_cdk::println!("[DEPLOYMENT] CRITICAL: Pool creation failed: {}", e);
        
        // DO NOT save token record - deployment failed
        
        // Mark deployment as failed to trigger cleanup + refund
        deployment.status = DeploymentStatus::Failed;
        deployment.failed_at = Some(ic_cdk::api::time());
        deployment.last_error = Some(format!("Pool creation failed: {}", e));
        DEPLOYMENTS.with(|d| d.borrow_mut().insert(deployment.id, deployment));
        
        // Return error - this triggers phase 2 failure handling
        Err(format!("Deployment failed at final step - pool creation: {}", e))
    }
}
```

### 4. `src/lbry_fun/src/queries.rs`
**CURRENT (lines showing get_live/get_upcoming logic):**
```rust
pub fn get_live() -> Vec<(u64, TokenRecord)> {
    TOKENS.with(|tokens| {
        tokens.iter().filter(|(_, token)| {
            !token.pool_creation_failed && 
            (current_time >= token.pool_created_at + launch_delay)
        })
    })
}

pub fn get_upcoming() -> Vec<(u64, TokenRecord)> {
    TOKENS.with(|tokens| {
        tokens.iter().filter(|(_, token)| {
            token.pool_creation_failed || 
            (current_time < token.pool_created_at + launch_delay)
        })
    })
}
```

**PROPOSED CHANGE:**
```rust
pub fn get_live() -> Vec<(u64, TokenRecord)> {
    let current_time = ic_cdk::api::time();
    TOKENS.with(|tokens| {
        tokens.iter().filter(|(_, token)| {
            match &token.status {
                TokenStatus::Live { launched_at, .. } => current_time >= *launched_at,
                _ => false,
            }
        }).collect()
    })
}

pub fn get_upcoming() -> Vec<(u64, TokenRecord)> {
    let current_time = ic_cdk::api::time();
    TOKENS.with(|tokens| {
        tokens.iter().filter(|(_, token)| {
            match &token.status {
                TokenStatus::Live { launched_at, .. } => current_time < *launched_at,
                TokenStatus::Deploying { .. } => true,
                _ => false,
            }
        }).collect()
    })
}

pub fn get_failed() -> Vec<(u64, TokenRecord)> {
    TOKENS.with(|tokens| {
        tokens.iter().filter(|(_, token)| {
            matches!(token.status, TokenStatus::Failed { .. })
        }).collect()
    })
}

// ADD new query for canister status checks
#[query]
pub fn get_token_status(token_id: u64) -> Result<TokenStatus, String> {
    TOKENS.with(|tokens| {
        tokens.get(&token_id)
            .map(|token| token.status.clone())
            .ok_or_else(|| "Token not found".to_string())
    })
}
```

### 5. Critical Missing Pieces to Add

#### A. Pass Token ID to Child Canisters
**FILE: `src/lbry_fun/src/deployment_execution.rs`**
```rust
// When installing icp_swap canister
install_icp_swap_wasm_on_existing_canister(
    swap_canister_id,
    Some(get_principal(&primary_token_id)),
    Some(get_principal(&secondary_token_id)),
    Some(tokenomics_canister_id),
    distribution_interval_seconds,
    launch_delay_seconds,
    Some(token_id), // ADD: Pass the token ID!
)
```

#### B. Quick Fix for Current Stuck Token
**FILE: `src/lbry_fun/src/update.rs` (ADD)**
```rust
#[update(guard = "is_admin")]
async fn fix_stuck_token(token_id: u64) -> Result<String, String> {
    TOKENS.with(|tokens| {
        let mut tokens_mut = tokens.borrow_mut();
        if let Some(token) = tokens_mut.get(&token_id) {
            if token.pool_creation_failed {
                // Remove stuck token
                tokens_mut.remove(&token_id);
                Ok(format!("Removed stuck token {} with failed pool", token_id))
            } else {
                Err("Token not stuck".to_string())
            }
        } else {
            Err("Token not found".to_string())
        }
    })
}
```

#### C. Cleanup Worker Updates
**FILE: `src/lbry_fun/src/deployment_cleanup.rs` (MODIFY)**
```rust
async fn cleanup_deployment_with_progress(deployment: &Deployment) -> Result<(), String> {
    // ... existing canister cleanup code ...
    
    // NEW: Check if token record was created but deployment failed
    if let Some(token_id) = deployment.token_id {
        TOKENS.with(|tokens| {
            let mut tokens_mut = tokens.borrow_mut();
            if let Some(token) = tokens_mut.get(&token_id) {
                // Only remove if it's in failed state
                if matches!(token.status, TokenStatus::Failed { .. }) {
                    tokens_mut.remove(&token_id);
                    ic_cdk::println!("[CLEANUP] Removed failed token record {}", token_id);
                }
            }
        });
    }
    
    // ... continue with refund logic ...
}
```

### 6. `src/icp_swap/src/update.rs`
**CURRENT (line showing burn_secondary check):**
```rust
pub async fn burn_secondary(amount_secondary: u64, from_subaccount: Option<[u8; 32]>) -> Result<String, ExecutionError> {
    // ADD THIS CHECK
    if !is_token_live() {
        // Only checks launch time, not pool status!
```

**PROPOSED CHANGE:**
```rust
// ADD at top of file
use crate::storage::TOKEN_ID;

async fn check_can_trade() -> Result<(), ExecutionError> {
    let token_id = TOKEN_ID.with(|id| *id.borrow());
    let lbry_fun = Principal::from_text(LBRY_FUN_CANISTER_ID)
        .map_err(|_| ExecutionError::StateError("Invalid lbry_fun canister ID".to_string()))?;
    
    // Call lbry_fun to check token status
    let (status,): (TokenStatus,) = ic_cdk::call(lbry_fun, "get_token_status", (token_id,))
        .await
        .map_err(|(code, msg)| ExecutionError::StateError(
            format!("Failed to check token status: {:?} - {}", code, msg)
        ))?;
    
    match status {
        TokenStatus::Live { launched_at, .. } => {
            let current_time = ic_cdk::api::time();
            if current_time < launched_at {
                Err(ExecutionError::StateError(
                    format!("Token not yet launched. Launch time: {}", launched_at)
                ))
            } else {
                Ok(())
            }
        },
        TokenStatus::Failed { reason, .. } => {
            Err(ExecutionError::StateError(
                format!("Token deployment failed: {}", reason)
            ))
        },
        TokenStatus::Suspended { reason, .. } => {
            Err(ExecutionError::StateError(
                format!("Trading suspended: {}", reason)
            ))
        },
        TokenStatus::Deploying { .. } => {
            Err(ExecutionError::StateError(
                "Token deployment still in progress".to_string()
            ))
        },
    }
}

// MODIFY burn_secondary
pub async fn burn_secondary(amount_secondary: u64, from_subaccount: Option<[u8; 32]>) -> Result<String, ExecutionError> {
    // Check if trading is allowed
    check_can_trade().await?;
    
    // Rest of function remains the same...
}

// MODIFY swap function (find it in the file)
pub async fn swap(amount_icp: u64) -> Result<String, ExecutionError> {
    // Check if trading is allowed
    check_can_trade().await?;
    
    // Rest of function remains the same...
}
```

### 6. `src/icp_swap/src/storage.rs`
**CURRENT:**
```rust
// Stores launch time separately
pub static LAUNCH_TIME: RefCell<StableBTreeMap<(), u64, Memory>> = ...
```

**PROPOSED CHANGE:**
```rust
// ADD token ID storage
thread_local! {
    pub static TOKEN_ID: RefCell<u64> = RefCell::new(0);
}

// KEEP LAUNCH_TIME for backwards compatibility during migration
// But it will be deprecated once we fully migrate to status checks
```

### 7. `src/icp_swap/src/lib.rs`
**PROPOSED ADDITION:**
```rust
// ADD import for new types
use lbry_fun::TokenStatus;

// ADD initialization with token ID
#[init]
fn init(args: IcpSwapInitArgs) {
    storage::TOKEN_ID.with(|id| *id.borrow_mut() = args.token_id);
    // Store other init params...
}

// ADD init args struct
#[derive(CandidType, Deserialize)]
pub struct IcpSwapInitArgs {
    pub token_id: u64,
    pub primary_token_id: Option<Principal>,
    pub secondary_token_id: Option<Principal>,
    pub tokenomics_canister_id: Option<Principal>,
    pub distribution_interval_seconds: u64,
    pub launch_delay_seconds: u64,
}
```

### 8. Frontend Changes

**CURRENT (`src/lbry_fun_frontend/src/types/deployment.ts`):**
```typescript
export enum DeploymentStatus {
  INITIATED = 'initiated',
  EXECUTING = 'executing',
  POLLING = 'polling',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RECOVERABLE = 'recoverable',
}
```

**PROPOSED CHANGE:**
```typescript
// ADD matching TokenStatus type
export type TokenStatus = 
  | { Deploying: { deployment_id: bigint; progress: number; created_canisters: Principal[] } }
  | { Failed: { deployment_id: bigint; reason: string; failed_at: bigint } }
  | { Live: { pool_id: string; launched_at: bigint } }
  | { Suspended: { reason: string; suspended_at: bigint } };

// Keep DeploymentStatus for UI state machine
// But add helper to convert backend TokenStatus to UI status
export function tokenStatusToDeploymentStatus(status: TokenStatus): DeploymentStatus {
  if ('Deploying' in status) return DeploymentStatus.EXECUTING;
  if ('Failed' in status) return DeploymentStatus.FAILED;
  if ('Live' in status) return DeploymentStatus.COMPLETED;
  if ('Suspended' in status) return DeploymentStatus.FAILED;
  return DeploymentStatus.INITIATED;
}
```

### 9. Status Caching for Performance
**FILE: `src/icp_swap/src/storage.rs` (ADD)**
```rust
thread_local! {
    pub static TOKEN_ID: RefCell<u64> = RefCell::new(0);
    pub static CACHED_STATUS: RefCell<Option<(TokenStatus, u64)>> = RefCell::new(None);
}
```

**FILE: `src/icp_swap/src/update.rs` (MODIFY check_can_trade)**
```rust
async fn check_can_trade() -> Result<(), ExecutionError> {
    let now = ic_cdk::api::time();
    
    // Check cache first (60 second TTL)
    let cached = CACHED_STATUS.with(|cache| {
        cache.borrow().as_ref().and_then(|(status, timestamp)| {
            if now - timestamp < 60_000_000_000 { // 60 seconds
                Some(status.clone())
            } else {
                None
            }
        })
    });
    
    let status = match cached {
        Some(s) => s,
        None => {
            // Fetch fresh status
            let token_id = TOKEN_ID.with(|id| *id.borrow());
            let lbry_fun = Principal::from_text(LBRY_FUN_CANISTER_ID)?;
            
            let (fresh_status,): (TokenStatus,) = ic_cdk::call(lbry_fun, "get_token_status", (token_id,))
                .await
                .map_err(|(code, msg)| ExecutionError::StateError(
                    format!("Failed to check token status: {:?} - {}", code, msg)
                ))?;
            
            // Cache the status
            CACHED_STATUS.with(|cache| {
                *cache.borrow_mut() = Some((fresh_status.clone(), now));
            });
            
            fresh_status
        }
    };
    
    // Validate status as before...
}
```

### 10. Frontend Deployment Persistence
**FILE: `src/lbry_fun_frontend/src/features/token/thunk/deploymentThunks.ts` (ADD)**
```typescript
// Persist deployment state across page refreshes
const persistDeploymentState = (deploymentId: string, status: DeploymentStatus, tokenId?: bigint) => {
  const key = `deployment_${deploymentId}`;
  localStorage.setItem(key, JSON.stringify({
    status,
    tokenId: tokenId?.toString(),
    timestamp: Date.now(),
    expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  }));
};

// On app load, check persisted deployments
export const checkPersistedDeployments = createAsyncThunk(
  'deployment/checkPersisted',
  async (_, { dispatch }) => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('deployment_'));
    
    for (const key of keys) {
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      
      // Remove expired entries
      if (data.expires < Date.now()) {
        localStorage.removeItem(key);
        continue;
      }
      
      // Re-fetch status from backend
      const deploymentId = key.replace('deployment_', '');
      await dispatch(checkDeploymentStatus(deploymentId));
    }
  }
);

// Call on deployment status changes
dispatch(updateDeploymentStatus({
  deploymentId,
  status: DeploymentStatus.COMPLETED,
  tokenId
}));
persistDeploymentState(deploymentId, DeploymentStatus.COMPLETED, tokenId);
```

## Implementation Order (Based on Current Issue)

### Step 1: Quick Fix for Stuck Token (Immediate)
1. Add `fix_stuck_token` admin function to remove the problematic token
2. Clean up the stuck deployment

### Step 2: Core State Changes
1. Add `TokenStatus` enum to `storage.rs`
2. Replace `TokenRecord` with new structure including `deployment_id`
3. Remove `pool_creation_failed` and `pool_created_at` fields entirely

### Step 3: Make Deployment Atomic
1. Update `deployment_execution.rs` to fail deployment if pool creation fails
2. Only save `TokenRecord` if deployment fully succeeds
3. Update cleanup worker to handle failed tokens

### Step 4: Child Canister Integration
1. Update icp_swap init to receive and store token_id
2. Add `get_token_status` query to lbry_fun
3. Implement status checking with caching in icp_swap

### Step 5: Frontend Updates
1. Add deployment state persistence
2. Update UI to handle new failure states
3. Implement MyDeployments monitoring page

## Key Improvements

1. **No Partial States** - Deployment either fully succeeds or fully fails
2. **Single Truth** - TokenStatus in lbry_fun is authoritative
3. **Safe Trading** - Impossible to trade without successful pool
4. **Clear Recovery** - Failed deployments automatically trigger refunds
5. **Simple Frontend** - Just reflects backend state, no complex logic

## Testing Strategy

1. **Test Pool Failure** - Verify deployment fails and refund triggers
2. **Test Trading Block** - Ensure no operations possible on failed tokens  
3. **Test Status Queries** - Verify child canisters correctly check status
4. **Test Full Success** - End-to-end deployment with pool creation works