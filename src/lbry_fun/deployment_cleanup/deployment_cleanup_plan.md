# Token Deployment Cleanup Mechanism Plan

## Problem Statement
When token deployment fails in the lbry_fun canister, partially created canisters are left orphaned with no cleanup mechanism. Users lose their 5 ICP payment with no recovery option.

## Current Deployment Flow
1. Collect 5 ICP payment
2. Create 3 management canisters: swap, tokenomics, logs
3. Create 2 token canisters: primary, secondary
4. Install WASM on all canisters
5. Setup KongSwap integration
6. Save TokenRecord

## Proposed Solution

### 1. Deployment State Tracking
Add a new `DeploymentState` enum to track progress:

```rust
#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum DeploymentState {
    NotStarted,
    PaymentCollected,
    SwapCanisterCreated(Principal),
    TokenomicsCanisterCreated(Principal),
    LogsCanisterCreated(Principal),
    PrimaryTokenCreated(Principal),
    SecondaryTokenCreated(Principal),
    WasmInstalled,
    KongSwapIntegrated,
    Completed,
    Failed(String, Vec<Principal>), // error message + canisters to cleanup
}
```

### 2. Partial Deployment Record
Create a new storage structure for tracking in-progress deployments:

```rust
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PartialDeployment {
    pub id: u64,
    pub caller: Principal,
    pub payment_amount: u64,
    pub state: DeploymentState,
    pub created_canisters: Vec<Principal>,
    pub timestamp: u64,
}
```

### 3. Cleanup Function
Implement a cleanup function that:
- Stops all created canisters
- Deletes all created canisters
- Refunds user payment (minus cycles used)
- Removes partial deployment record

```rust
pub async fn cleanup_failed_deployment(deployment_id: u64) -> Result<(), String> {
    // 1. Get partial deployment record
    // 2. Stop all canisters in created_canisters list
    // 3. Delete all canisters
    // 4. Calculate refund (5 ICP minus cycles used)
    // 5. Transfer refund to caller
    // 6. Remove partial deployment record
}
```

### 4. Modified create_token Function
Update create_token to:
- Create PartialDeployment record before payment
- Update state after each successful step
- Wrap entire process in try/catch
- Call cleanup on any failure
- Convert PartialDeployment to TokenRecord on success

### 5. Manual Cleanup Endpoint
Add public function for users to trigger cleanup of their failed deployments:

```rust
#[update]
pub async fn cleanup_my_failed_deployment() -> Result<String, String> {
    // Find user's failed deployment
    // Call cleanup_failed_deployment
    // Return status message
}
```

### 6. Automatic Cleanup Timer
Add periodic timer to cleanup abandoned deployments older than 1 hour:

```rust
#[heartbeat]
fn cleanup_abandoned_deployments() {
    // Find deployments older than 1 hour in Failed state
    // Cleanup each one
}
```

## Implementation Steps
1. Add DeploymentState enum and PartialDeployment struct to storage.rs
2. Create new StableBTreeMap for partial deployments
3. Implement cleanup_failed_deployment function
4. Modify create_token to use deployment state tracking
5. Add cleanup_my_failed_deployment endpoint
6. Add heartbeat function for automatic cleanup
7. Update tests to verify cleanup works correctly

## Benefits
- Users get refunded on deployment failures
- No orphaned canisters consuming cycles
- Clear visibility into deployment progress
- Ability to retry failed deployments
- Better error diagnostics

## Risks & Mitigations
- **Risk**: Cleanup could fail leaving canisters
  - **Mitigation**: Log cleanup failures, admin override function
- **Risk**: Refund calculation complexity
  - **Mitigation**: Simple refund of remaining ICP, track exact cycles used
- **Risk**: State inconsistency during cleanup
  - **Mitigation**: Use atomic operations, verify state before cleanup

## Testing Strategy
1. Simulate failures at each deployment stage
2. Verify cleanup removes all canisters
3. Verify refunds are processed correctly
4. Test concurrent deployments don't interfere
5. Test automatic cleanup timer
6. Test edge cases (double cleanup, missing canisters, etc)