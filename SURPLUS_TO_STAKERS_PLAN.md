# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/lbryfun" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/lbryfun-surplus-to-stakers"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/lbryfun-surplus-to-stakers`
2. **Implement feature** - Follow plan sections below
3. **Build locally** (verification only - NEVER DEPLOY TO MAINNET):
   ```bash
   ./scripts/build.sh
   ```
   **⚠️ PRODUCTION WARNING**: This is a live financial application. Never deploy to mainnet.
4. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "Refactor: Redirect surplus ICP to stakers via REWARD_POOL

- Rename sweep_surplus_to_revshare() to process_surplus()
- Remove external transfer to lbry_fun platform canister
- Add surplus directly to REWARD_POOL for staker distribution
- Lower threshold from 1 ICP to 0.01 ICP (internal ops don't need buffer)
- Remove operational buffer requirement
- Call process_surplus() BEFORE distribute_reward() in timer
- Update all logging messages and documentation

Benefits:
- Parent companies can send ICP directly to icp_swap canisters
- ICP automatically flows to stakers in next distribution
- Platform still gets 1% through normal distribution mechanism
- Zero tokenomics interference
- Cleaner architecture (no external transfers)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
   git push -u origin feature/surplus-to-stakers
   gh pr create --title "Refactor: Redirect surplus ICP to reward pool for stakers" --body "$(cat <<'EOF'
## Summary
Refactors surplus ICP handling to redirect deposits directly to stakers via REWARD_POOL instead of transferring to platform canister.

### Key Changes
- **Renamed**: `sweep_surplus_to_revshare()` → `process_surplus()`
- **Removed**: External transfer logic to lbry_fun canister
- **Added**: Direct addition to REWARD_POOL with checked arithmetic
- **Lowered**: Threshold from 1 ICP (100M E8S) to 0.01 ICP (1M E8S)
- **Removed**: Operational buffer (not needed for internal accounting)
- **Reordered**: Call process_surplus() BEFORE distribute_reward() in timer
- **Deleted**: `transfer_surplus_to_revshare()` helper function
- **Updated**: All logging messages and comments

### Architecture Benefits
1. **Direct Staker Rewards**: External ICP sent to icp_swap automatically flows to stakers
2. **No Tokenomics Interference**: No token buying/burning logic
3. **Platform Still Gets Share**: 1% flows through normal distribution mechanism
4. **Cleaner Design**: Internal accounting only, no external transfers
5. **Better UX**: Parent companies can fund rewards by sending to icp_swap

### Safety Guarantees
- Checked arithmetic prevents overflow
- Lower threshold safe since no transfer fees for internal ops
- Sweep before distribution ensures deposits included in same cycle
- Comprehensive logging maintained

### Test Plan
- [x] Build verification: `./scripts/build.sh`
- [ ] Manual testing: Send ICP to icp_swap canister
- [ ] Verify: ICP appears in REWARD_POOL via `get_icp_pool_balance()` query
- [ ] Verify: Next distribution includes deposited ICP
- [ ] Verify: Platform gets 1% of distribution as expected

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
   ```
5. **Iterate autonomously**:
   - FOR i=1 to 5:
     - Check review: `gh pr view --json comments`
     - Count P0 issues
     - IF P0 > 0: Fix immediately, commit, push, sleep 300s, continue
     - IF P0 = 0: Report success, EXIT
   - After 5 iterations: Escalate to human

## CRITICAL RULES
- ❌ NO questions ("should I?", "want me to?", "is it done?")
- ❌ NO skipping PR creation - it's MANDATORY
- ❌ NO stopping after implementation - create PR immediately
- ✅ After sleep: IMMEDIATELY continue (no pause)
- ✅ ONLY stop at: approved, max iterations, or error

**Branch:** `feature/surplus-to-stakers`
**Worktree:** `/home/theseus/alexandria/lbryfun-surplus-to-stakers`

---

# Implementation Plan: Surplus to Reward Pool Refactoring

## Task Classification
**REFACTORING** - Improving existing code to redirect surplus ICP to stakers instead of platform

## Context

Currently, `icp_swap` canister sweeps surplus ICP (unexpected positive balances) to the `lbry_fun` platform canister. This refactor redirects that surplus to go directly to stakers via the REWARD_POOL, enabling parent companies to send ICP directly to icp_swap canisters for staker rewards.

### Current Flow (TO BE REMOVED)
```
Surplus ICP detected → Transfer to lbry_fun canister → Platform distributes
```

### New Flow (TO BE IMPLEMENTED)
```
Surplus ICP detected → Add to REWARD_POOL → Next distribution to stakers (99% stakers + 1% platform)
```

### Key Benefits
1. Parent companies can send ICP directly to icp_swap canisters
2. ICP automatically flows to stakers in next distribution
3. Platform still gets 1% through normal distribution mechanism
4. Zero tokenomics interference (no token buying/burning)
5. Cleaner architecture (internal accounting only)

## Current State Documentation

### File: `src/icp_swap/src/update.rs`

**Function to be refactored:** `sweep_surplus_to_revshare()` (lines 1850-2007)
- Current threshold: 100,000,000 E8S (1 ICP)
- Operational buffer: 10,000,000 E8S (0.1 ICP)
- Transfers surplus externally to lbry_fun canister
- Uses helper function `transfer_surplus_to_revshare()` (lines 2009-2046)

**Function to keep:** `distribute_reward()` (lines 887-1010)
- Already uses REWARD_POOL for distribution
- Distributes 1% of pool hourly: 1% to ALEX, 99% to stakers
- Perfect fit for receiving surplus ICP

### File: `src/icp_swap/src/script.rs`

**Timer function:** `distribute_reward_wrapper()` (lines 347-381)
- Currently: distribute_reward() FIRST, then sweep_surplus_to_revshare()
- Needs change: process_surplus() FIRST, then distribute_reward()
- Reasoning: Include deposits in same distribution cycle

**Import statement:** (line 363)
```rust
use crate::update::sweep_surplus_to_revshare;
```
Needs update to:
```rust
use crate::update::process_surplus;
```

### File: `src/icp_swap/src/storage.rs`

**Constants (lines 15-17):**
```rust
pub const SURPLUS_SWEEP_THRESHOLD_E8S: u64 = 100_000_000;  // 1 ICP
pub const OPERATIONAL_BUFFER_E8S: u64 = 10_000_000;        // 0.1 ICP
pub const MIN_SWEEP_AMOUNT_E8S: u64 = 1_000_000;           // 0.01 ICP
```

**State:** (lines 117-119)
```rust
pub static REWARD_POOL: RefCell<StableBTreeMap<(), u64, Memory>> = RefCell::new(
    StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(REWARD_POOL_MEM_ID)))
);
```

**Sweep tracking:** (lines 122-128, 212-229, 329-337)
- SweepRecord struct definition
- get_last_sweep_timestamp() function
- record_sweep() function
- These remain unchanged (still useful for tracking)

## Implementation Details

### CHANGE 1: Refactor sweep_surplus_to_revshare() → process_surplus()

**Location:** `src/icp_swap/src/update.rs` (replace lines 1842-2046)

**PSEUDOCODE:**
```rust
/// Processes surplus ICP by adding it to the reward pool for staker distribution
///
/// This function detects positive discrepancies between actual and expected ICP balance
/// and adds the surplus to REWARD_POOL. External deposits (e.g., from parent companies)
/// automatically flow to stakers in the next distribution cycle.
///
/// Safety guarantees:
/// - Checked arithmetic prevents overflow
/// - Comprehensive logging
/// - Lower threshold (0.01 ICP) appropriate for internal accounting
/// - No transfer fees since this is internal state update
pub async fn process_surplus() -> Result<String, ExecutionError> {
    // 1. CHECK PHASE - Gather state and validate conditions
    
    // Get actual balance from ledger
    let actual_balance = fetch_canister_icp_balance().await
        .map_err(|e| ExecutionError::StateError(
            format!("Failed to fetch balance for surplus processing: {:?}", e)
        ))?;
    
    // Calculate expected balance (all tracked obligations)
    let reward_pool = REWARD_POOL.with(|p| p.borrow().get(&()).unwrap_or(0));
    let uncollected_alex = UNCOLLECTED_ALEX_FEES.with(|f| f.borrow().get(&()).unwrap_or(0));
    let total_staked = STAKES.with(|s| {
        s.borrow().iter().map(|(_, stake)| stake.reward_icp as u64).sum::<u64>()
    });
    let archived_balance = crate::queries::get_total_archived_balance();
    
    let expected_balance = reward_pool + uncollected_alex + total_staked + archived_balance;
    
    // Calculate surplus (positive discrepancy only)
    if actual_balance <= expected_balance {
        register_info_log(
            Principal::anonymous(),
            "process_surplus",
            &format!("No surplus to process. Actual: {} <= Expected: {}", actual_balance, expected_balance)
        );
        return Ok("No surplus to process".to_string());
    }
    
    let surplus = actual_balance - expected_balance;
    
    // Check if surplus exceeds threshold (lowered to 0.01 ICP for internal ops)
    const SURPLUS_THRESHOLD_E8S: u64 = 1_000_000; // 0.01 ICP (was 1 ICP)
    
    if surplus < SURPLUS_THRESHOLD_E8S {
        register_info_log(
            Principal::anonymous(),
            "process_surplus",
            &format!("Surplus {} below threshold {}. Will process when threshold met.", surplus, SURPLUS_THRESHOLD_E8S)
        );
        return Ok(format!("Surplus {} below threshold", surplus));
    }
    
    // Check time since last processing (prevent rapid repeated processing - 1 hour minimum)
    let last_process = get_last_sweep_timestamp(); // Reuse existing timestamp tracker
    let now = ic_cdk::api::time();
    let one_hour_nanos = 3_600_000_000_000u64; // 1 hour in nanoseconds
    
    if last_process > 0 && now >= last_process {
        let time_since = now.saturating_sub(last_process);
        if time_since < one_hour_nanos {
            register_info_log(
                Principal::anonymous(),
                "process_surplus",
                &format!("Last processing was {} nanos ago (< 1 hour). Skipping to prevent rapid processing.", time_since)
            );
            return Ok("Too soon since last processing".to_string());
        }
    }
    
    register_info_log(
        Principal::anonymous(),
        "process_surplus",
        &format!("Processing {} E8S surplus by adding to reward pool", surplus)
    );
    
    // 2. EFFECT PHASE - Update REWARD_POOL with checked arithmetic
    REWARD_POOL.with(|p| -> Result<(), ExecutionError> {
        let current = p.borrow().get(&()).unwrap_or(0);
        let new_total = current.checked_add(surplus).ok_or_else(||
            ExecutionError::AdditionOverflow {
                operation: "Adding surplus to reward pool".to_string(),
                details: format!("Current pool: {}, Surplus: {}", current, surplus)
            }
        )?;
        p.borrow_mut().insert((), new_total);
        Ok(())
    })?;
    
    register_info_log(
        Principal::anonymous(),
        "process_surplus",
        &format!("Successfully added {} E8S to reward pool. New pool balance: {}", 
                 surplus, 
                 REWARD_POOL.with(|p| p.borrow().get(&()).unwrap_or(0)))
    );
    
    // 3. RECORD PHASE - Track for historical purposes
    let process_record = SweepRecord {
        timestamp: now,
        amount_swept: surplus,
        surplus_before: surplus,
        operational_buffer_kept: 0, // No buffer needed for internal accounting
        transfer_block_index: 0, // No transfer, internal state update
        success: true,
        error_message: None,
    };
    
    record_sweep(process_record); // Reuse existing tracking mechanism
    
    Ok(format!("Processed {} E8S surplus to reward pool", surplus))
}
```

### CHANGE 2: Delete transfer_surplus_to_revshare() helper

**Location:** `src/icp_swap/src/update.rs` (delete lines 2009-2046)

**Action:** Remove entire function - no longer needed as we don't transfer externally

### CHANGE 3: Update timer call order in script.rs

**Location:** `src/icp_swap/src/script.rs` (modify lines 347-381)

**PSEUDOCODE:**
```rust
async fn distribute_reward_wrapper() {
    // SURPLUS PROCESSING FIRST - add any external deposits to pool
    use crate::update::process_surplus; // Updated import
    
    match process_surplus().await {
        Ok(msg) => {
            register_info_log(
                Principal::anonymous(),
                "distribute_reward_wrapper",
                &format!("Surplus processing: {}", msg)
            );
        }
        Err(e) => {
            // Log but don't fail - surplus processing is opportunistic
            register_error_log(
                Principal::anonymous(),
                "distribute_reward_wrapper",
                e
            );
        }
    }
    
    // DISTRIBUTION SECOND - includes any just-processed surplus
    match distribute_reward().await {
        Ok(_) => {
            register_info_log(
                Principal::anonymous(),
                "distribute_reward_wrapper",
                "Distribution completed successfully"
            );
        }
        Err(e) => {
            register_error_log(
                Principal::anonymous(),
                "distribute_reward_wrapper",
                e
            );
        }
    }
}
```

### CHANGE 4: Update constants documentation

**Location:** `src/icp_swap/src/storage.rs` (update comments at lines 15-17)

**PSEUDOCODE:**
```rust
// Surplus processing configuration
// Note: Threshold lowered to 0.01 ICP since internal accounting has no transfer fees
pub const SURPLUS_SWEEP_THRESHOLD_E8S: u64 = 100_000_000;  // 1 ICP (unused - see process_surplus)
pub const OPERATIONAL_BUFFER_E8S: u64 = 10_000_000;        // 0.1 ICP (unused - no buffer for internal ops)
pub const MIN_SWEEP_AMOUNT_E8S: u64 = 1_000_000;           // 0.01 ICP (minimum surplus to process)
```

## Edge Cases & Safety Considerations

### Ultrathinking: Critical Edge Cases

1. **Overflow Protection**
   - Use `checked_add()` when adding surplus to REWARD_POOL
   - Return descriptive error if overflow would occur
   - Extremely unlikely but prevents undefined behavior

2. **Timing Race Conditions**
   - process_surplus() runs BEFORE distribute_reward()
   - Ensures deposits included in same distribution cycle
   - No risk of distributing before accounting for new ICP

3. **Negative Discrepancies**
   - If actual < expected, function returns early
   - No attempt to "fix" negative balances (separate concern)
   - Maintains conservative approach

4. **Rapid Repeated Processing**
   - 1-hour minimum between processing attempts
   - Prevents timer-based processing loops
   - Reuses existing timestamp tracking

5. **Zero Balance States**
   - Handle unwrap_or(0) for all state reads
   - Safe initialization for empty states
   - No assumptions about existing balances

6. **Distribution Percentage Math**
   - Platform still gets 1% through normal distribution
   - No change to distribution logic itself
   - External deposits simply increase pool size

7. **Historical Tracking**
   - Reuse existing SweepRecord structure
   - Set transfer_block_index to 0 (no transfer)
   - Set operational_buffer_kept to 0 (not applicable)
   - Maintains audit trail

8. **Error Recovery**
   - If process_surplus() fails, distribution continues
   - Opportunistic processing model
   - No critical path dependency

## Testing Strategy

### Build Verification
```bash
./scripts/build.sh
```
**Critical**: Must compile without errors. This refactor touches audited code.

### Manual Testing Sequence
1. Deploy to local dfx environment
2. Create test token with icp_swap canister
3. Send ICP directly to icp_swap canister (simulate parent company deposit)
4. Query `get_icp_pool_balance()` - should show increased REWARD_POOL
5. Wait for distribution timer (or trigger manually)
6. Verify stakers received 99% of pool distribution
7. Verify platform received 1% of pool distribution

### Query Endpoints (existing, for verification)
- `get_icp_pool_balance()` - Check REWARD_POOL balance
- `get_surplus_info()` - Check surplus detection
- `get_sweep_history()` - Verify processing recorded

## Files Modified Summary

1. **src/icp_swap/src/update.rs**
   - Rename: `sweep_surplus_to_revshare()` → `process_surplus()`
   - Delete: `transfer_surplus_to_revshare()` function
   - Change: Internal REWARD_POOL addition instead of external transfer
   - Change: Lower threshold to 0.01 ICP
   - Change: Remove operational buffer logic

2. **src/icp_swap/src/script.rs**
   - Change: Import `process_surplus` instead of `sweep_surplus_to_revshare`
   - Change: Call `process_surplus()` BEFORE `distribute_reward()`
   - Update: Logging messages

3. **src/icp_swap/src/storage.rs**
   - Update: Comments for constants (actual values unchanged for compatibility)

## Rollback Plan

If issues arise:
1. Revert PR (single commit)
2. Old behavior: surplus transfers to platform
3. New behavior reversible without data loss
4. REWARD_POOL additions are normal accounting operations

## Deployment Notes

**CRITICAL**: This is an audited canister. All changes must be logged in `ICP_SWAP_CHANGE_LOG.md`

**Change Log Entry:**
```markdown
## [Date] - Surplus to Reward Pool Refactoring

### Changed
- Renamed `sweep_surplus_to_revshare()` to `process_surplus()`
- Changed surplus handling: now adds to REWARD_POOL instead of external transfer
- Lowered threshold from 1 ICP to 0.01 ICP (safe for internal accounting)
- Reordered timer: process_surplus() BEFORE distribute_reward()

### Removed
- `transfer_surplus_to_revshare()` helper function
- Operational buffer logic (not needed for internal ops)
- External transfer to lbry_fun canister

### Added
- Direct REWARD_POOL addition with checked arithmetic
- Enhanced logging for surplus processing

### Rationale
- Enables parent companies to send ICP directly to icp_swap canisters
- ICP automatically flows to stakers via REWARD_POOL distribution
- Platform still receives 1% through normal distribution mechanism
- Zero tokenomics interference
- Cleaner architecture (internal accounting only)

### Security Review
- Checked arithmetic prevents overflow
- No new external calls (removed one)
- Maintains existing sweep history tracking
- Conservative threshold and rate limiting preserved
```

## Review Checklist

- [ ] Code compiles: `./scripts/build.sh`
- [ ] Function renamed: `sweep_surplus_to_revshare` → `process_surplus`
- [ ] Helper deleted: `transfer_surplus_to_revshare` removed
- [ ] Threshold lowered: 1 ICP → 0.01 ICP
- [ ] Buffer removed: No operational buffer logic
- [ ] Order changed: process_surplus() BEFORE distribute_reward()
- [ ] Imports updated: script.rs uses new function name
- [ ] Logging updated: All messages reference "process" not "sweep"
- [ ] Comments updated: Explain new architecture
- [ ] ICP_SWAP_CHANGE_LOG.md updated with changes

---

**End of Implementation Plan**

This plan is ready for autonomous execution. The implementing agent should:
1. Verify isolation in worktree
2. Make all changes as specified
3. Build for verification
4. Create PR with provided commit message and description
5. Iterate on feedback autonomously
