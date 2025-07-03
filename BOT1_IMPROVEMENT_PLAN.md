# Bot1 Tokenomics Validation Bot - Improvement Plan

## Current State

The bot1 canister has been implemented to validate tokenomics by executing automated swap/burn cycles and collecting metrics for comparison with frontend projections. However, the initial implementation has several issues that need addressing.

## Immediate Issues

### 1. Query vs Update Method Error
**Problem**: `get_token_by_id` is being called but this method doesn't exist in lbry_fun.
```
Error: "Canister has no update method 'get_token_by_id'"
```

**Root Cause**: The lbry_fun canister doesn't expose a `get_token_by_id` method. Available methods are:
- `get_all_token_record() -> Vec<(u64, TokenRecord)>` - Returns all tokens
- `get_token_status(u64) -> Option<TokenStatusDetail>` - Returns limited status info
- `get_live()` and `get_upcomming()` - Return filtered lists

**Solution**: In `src/bot1/src/utils.rs`, update the `get_token_record` function to:
```rust
pub async fn get_token_record(lbry_fun_canister: Principal, pool_id: u64) -> Result<TokenRecord, String> {
    // Option 1: Use get_all_token_record and filter
    let all_records = lbry_fun::get_all_token_record().await?;
    all_records.into_iter()
        .find(|(id, _)| *id == pool_id)
        .map(|(_, record)| record)
        .ok_or_else(|| format!("Pool {} not found", pool_id))
    
    // Option 2: First check status, then get from appropriate list
    let status = lbry_fun::get_token_status(pool_id).await?;
    if let Some(status_detail) = status {
        if status_detail.is_live {
            // Get from live list
        } else {
            // Get from upcoming list
        }
    }
}

### 2. Missing Pool Validation
Before executing any loops, the bot should validate:
- Pool exists in lbry_fun registry
- Pool is live (past launch time)
- All associated canisters are deployed and accessible
- Bot has sufficient ICP balance for requested operations

## Architectural Improvements

### 1. Better Error Handling
```rust
// Instead of generic string errors, use typed errors
#[derive(Debug)]
enum BotError {
    PoolNotFound { pool_id: u64 },
    PoolNotLive { pool_id: u64, launch_time: u64 },
    InsufficientBalance { required: u64, available: u64 },
    SwapFailed { details: String },
    BurnFailed { details: String },
    CanisterCallFailed { canister: String, method: String, error: String },
}
```

### 2. Validation Module
Create a separate validation module that checks prerequisites:
```rust
// src/bot1/src/validation.rs
pub async fn validate_pool_ready(pool_id: u64) -> Result<PoolValidation, BotError> {
    // 1. Check pool exists
    // 2. Verify pool is live
    // 3. Check all canisters accessible
    // 4. Return validation summary
}

pub struct PoolValidation {
    pub pool_exists: bool,
    pub is_live: bool,
    pub launch_time: u64,
    pub canisters_accessible: bool,
    pub bot_icp_balance: u64,
    pub estimated_cost_per_loop: u64,
}
```

### 3. Improved Logging
Add comprehensive logging throughout:
```rust
// Use ic_cdk::println! with structured format
ic_cdk::println!("[BOT1] Loop {}: Starting swap with {} ICP", loop_num, icp_amount);
ic_cdk::println!("[BOT1] Loop {}: Received {} secondary tokens", loop_num, secondary_received);
ic_cdk::println!("[BOT1] Loop {}: ERROR - {}", loop_num, error_details);
```

### 4. State Management
Improve state tracking between loops:
```rust
pub struct LoopState {
    pub loop_number: u32,
    pub retry_count: u32,
    pub last_error: Option<String>,
    pub cumulative_metrics: CumulativeMetrics,
}
```

### 5. Recovery Mechanisms
- Retry logic for transient failures
- Ability to resume from a specific loop
- Dust accumulation strategy (try to burn accumulated dust every N loops)
- Circuit breaker to stop after N consecutive failures

## Code Structure Improvements

### 1. Use Generated Bindings
Instead of raw calls, use the generated candid bindings:
```rust
// Import the generated lbry_fun bindings
use lbry_fun::{get_token_by_id, TokenRecord};

// Use typed calls
let token_record = lbry_fun::get_token_by_id(pool_id).await?;
```

### 2. Modular Design
```
src/bot1/
├── src/
│   ├── lib.rs          # Main entry points
│   ├── types.rs        # All type definitions
│   ├── storage.rs      # State management
│   ├── validation.rs   # NEW: Pool and precondition validation
│   ├── execution.rs    # Loop execution logic
│   ├── metrics.rs      # NEW: Metrics calculation and formatting
│   ├── errors.rs       # NEW: Error types and handling
│   └── client.rs       # NEW: Canister interaction clients
```

### 3. Configuration
Add configurable parameters:
```rust
pub struct BotConfig {
    pub max_loops_per_call: u32,
    pub max_icp_per_loop: u64,
    pub retry_attempts: u32,
    pub loop_delay_seconds: u64,
    pub dust_burn_threshold: u64,
    pub circuit_breaker_threshold: u32,
}
```

## Testing Strategy

### 1. Unit Tests
- Test metric calculations
- Test error handling
- Test state management

### 2. Integration Tests
- Deploy test token with known parameters
- Execute controlled burns
- Verify metrics match expectations

### 3. Debugging Tools
Add query methods for debugging:
```rust
// Get detailed loop history
get_loop_details(pool_id: u64, loop_number: u32) -> LoopDetails

// Get error log
get_error_log(pool_id: u64) -> Vec<ErrorEntry>

// Dry run - simulate without executing
dry_run_loop(pool_id: u64, icp_amount: u64) -> SimulationResult
```

## Migration Path

1. **Phase 1**: Fix immediate issues
   - Fix query/update method calls
   - Add basic pool validation
   - Improve error messages

2. **Phase 2**: Enhance reliability
   - Add retry logic
   - Implement circuit breaker
   - Better state management

3. **Phase 3**: Full refactor
   - Modular architecture
   - Comprehensive testing
   - Advanced features

## Usage Improvements

### Before (original):
```bash
dfx canister call bot1 execute_loops '(1, 100000000, 10)'
# Fails with cryptic error if pool doesn't exist
# 100000000 = 1 ICP in E8S format (confusing)
```

### After (improved):
```bash
# First validate
dfx canister call bot1 validate_pool '(1)'
# Returns: { exists: true, is_live: true, can_execute: true }

# Then execute with human-readable ICP values
dfx canister call bot1 execute_loops '(1, 1, 10)'  # 1 ICP per loop, 10 loops
# Returns: { success: true, loops_completed: 10, metrics_summary: {...} }
```

## Next Steps

1. ✅ Fix the immediate `get_token_by_id` query issue
2. ✅ Add pool validation before execution
3. ✅ Implement structured error types
4. ✅ Add comprehensive logging
5. Create integration tests with test tokens

## Completed Improvements (Phase 1) - 2025-07-02

### 1. Fixed Query Method Error
- Updated `get_token_record` in `utils.rs` to use `get_all_token_record` instead of non-existent `get_token_by_id`
- Bot now properly fetches token records from lbry_fun canister

### 2. Added Pool Validation Module
- Created new `validation.rs` module with comprehensive pool checks
- Added `validate_pool` canister method for pre-execution validation
- Validates: pool existence, live status, canister accessibility, and bot ICP balance
- Integrated validation into `execute_loops` to prevent invalid executions

### 3. Implemented Structured Error Types
- Created `errors.rs` module with `BotError` enum
- Provides clear, typed error messages for different failure scenarios
- Better error context for debugging and user feedback

### 4. Added Comprehensive Logging
- Added `[BOT1]` prefixed logging throughout execution flow
- Logs include: loop start/end, balances, token amounts, and operations
- Helps with debugging and monitoring bot behavior

### 5. Build Verification
- Bot1 canister now builds successfully with the improvements
- Fixed compilation errors related to Account cloning in validation

### 6. Human-Readable ICP Values
- Updated `execute_loops` to accept ICP amounts in natural units
- Now pass `1` for 1 ICP instead of `100000000`
- Makes the bot much easier to use and less error-prone

## Remaining Tasks for Future Phases

### Phase 2: Enhanced Reliability
- Implement retry logic for transient failures
- Add circuit breaker pattern
- Improve state management between loops

### Phase 3: Advanced Features
- Add dry-run simulation capability
- Create integration tests with test tokens
- Implement dust accumulation strategies
- Add more debugging query methods

## Key Files to Modify

1. `src/bot1/src/utils.rs` - Fix query calls
2. `src/bot1/src/execute.rs` - Add validation and better error handling
3. `src/bot1/src/types.rs` - Add error types and validation structs
4. `src/bot1/src/lib.rs` - Add new query methods for debugging

## Success Criteria

- Bot can validate pools before execution
- Clear error messages for all failure cases
- Detailed logs for debugging
- Metrics that accurately match tokenomics predictions
- Resilient to transient failures
- Easy to use and debug

## Context for Next Agent

### What This Bot Does
The bot1 canister simulates a user executing trades to validate that the tokenomics mechanism produces the expected results. It:
1. Swaps ICP for secondary tokens
2. Burns secondary tokens to mint primary tokens
3. Records detailed metrics at each step
4. Provides data formatted for comparison with frontend graphs

### Current Implementation Status
- ✅ Basic structure implemented
- ✅ Can execute loops and collect metrics
- ✅ Deployed with specified ID: `ucwa4-rx777-77774-qaada-cai`
- ❌ Has method call error that needs fixing
- ❌ Lacks proper validation before execution
- ❌ Needs better error handling and logging

### Key Technical Details
- Uses ICRC1/ICRC2 standards for token interactions
- All amounts are in E8S (10^8) internally
- `burn_secondary` expects natural units (not E8S)
- Bot needs to be funded with both cycles (for computation) and ICP (for trades)

### Testing a Deployed Token
1. Deploy a test token through the UI
2. Note the pool ID (starts from 1)
3. Fund bot with ICP: `dfx canister call ryjl3-tyaaa-aaaaa-aaaba-cai icrc1_transfer '(record { to = record { owner = principal "ucwa4-rx777-77774-qaada-cai"; subaccount = null }; amount = 10000000000 })'`
4. Validate pool: `dfx canister call bot1 validate_pool '(1)'`
5. Execute loops: `dfx canister call bot1 execute_loops '(1, 1, 10)'` # 1 ICP per loop, 10 loops
6. Get results: `dfx canister call bot1 get_table '(1)'`

### Immediate Priority
Fix the `get_token_record` function in `utils.rs` to use `get_all_token_record` instead of the non-existent `get_token_by_id` method. This will unblock basic functionality.