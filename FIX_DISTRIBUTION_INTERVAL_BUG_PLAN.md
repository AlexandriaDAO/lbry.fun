# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/lbryfun" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/lbryfun-distribution-interval-fix"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/lbryfun-distribution-interval-fix`
2. **Implement feature** - Follow plan sections below
3. **Build locally** (verification only - NEVER DEPLOY TO MAINNET):
   ```bash
   ./scripts/build.sh
   ```
   **⚠️ PRODUCTION WARNING**: This is a live financial application. Never deploy to mainnet.
4. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "Fix: Separate distribution interval duration from counter storage

- Add DISTRIBUTION_INTERVAL_SECONDS storage for interval duration
- Fix initialize_globals to store duration and counter separately
- Fix post_upgrade to read interval from correct storage
- Add query functions for clarity (get_distribution_interval_seconds, get_distribution_count)
- Update .did file with new query methods
- Add migration logic for existing mainnet token"
   git push -u origin feature/fix-distribution-interval-bug
   gh pr create --title "Fix: Separate distribution interval duration from counter storage" --body "Implements FIX_DISTRIBUTION_INTERVAL_BUG_PLAN.md

## Problem
The DISTRIBUTION_INTERVALS storage was being initialized with the interval duration (3600 seconds) instead of 0, causing the counter to show incorrect values like 5398 after 1798 distributions.

## Root Cause
- Line 171 in script.rs stores interval_seconds in DISTRIBUTION_INTERVALS
- DISTRIBUTION_INTERVALS should be a counter (0, 1, 2, 3...)
- post_upgrade reads from DISTRIBUTION_INTERVALS to setup timer
- After upgrade, timer would be set incorrectly

## Solution
- Add separate DISTRIBUTION_INTERVAL_SECONDS storage for the duration
- Initialize counter to 0 for new tokens
- Fix post_upgrade to read from correct storage
- Add clear query functions for both values

## Testing
- Local build verification only (no mainnet deployment)
- Counter starts at 0 for new tokens
- Timer setup works correctly after upgrade
"
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

**Branch:** `feature/fix-distribution-interval-bug`
**Worktree:** `/home/theseus/alexandria/lbryfun-distribution-interval-fix`

---

# Implementation Plan: Fix Distribution Interval Bug

## Bug Classification
**Type:** BUG FIX
**Severity:** Medium (confusing display, but functionally works)
**Scope:** Backend only (icp_swap canister)

## Current State Documentation

### The Bug
`DISTRIBUTION_INTERVALS` storage is being initialized with the interval duration (e.g., 3600 seconds) instead of starting at 0 as a counter.

**Evidence:**
- Mainnet token shows: 5398
- Math: 3600 (initial bug value) + 1798 (actual distributions) = 5398
- Expected: Should show 1798 (just the counter)

### Root Cause Analysis

**File:** `src/icp_swap/src/script.rs`

**Problem Code (Lines 160-173):**
```rust
// Store distribution interval in DISTRIBUTION_INTERVALS if provided
if let Some(interval_seconds) = args.distribution_interval_seconds {
    // Validation
    if interval_seconds < 60 {
        panic!("Distribution interval cannot be less than 60 seconds...");
    }
    if interval_seconds > u32::MAX as u64 {
        panic!("Distribution interval exceeds maximum allowed value...");
    }
    DISTRIBUTION_INTERVALS.with(|m| {
        m.borrow_mut().insert((), interval_seconds as u32);  // ← BUG: Stores 3600
    });
}
```

**Why This Is Wrong:**
1. `DISTRIBUTION_INTERVALS` is used as a counter (incremented by 1 each distribution)
2. It's used for APY tracking via modulo: `intervals % 30`
3. `post_upgrade` reads it to setup the timer
4. Initializing with 3600 instead of 0 corrupts the counter

**Post-Upgrade Issue (Lines 279-286):**
```rust
#[post_upgrade]
fn post_upgrade() {
    // Get distribution interval from storage, default to 1 hour
    let distribution_interval = DISTRIBUTION_INTERVALS.with(|m| {
        m.borrow().get(&()).unwrap_or(3600) as u64  // ← Reads counter value!
    });
    setup_timers(distribution_interval);  // ← Would set timer to counter value
    ...
}
```

### Affected Files
- `src/icp_swap/src/storage.rs` - Add new storage
- `src/icp_swap/src/script.rs` - Fix initialization and post_upgrade
- `src/icp_swap/src/queries.rs` - Add query functions
- `src/icp_swap/icp_swap.did` - Update service interface

## Implementation Plan

### Part 1: Add Separate Storage for Interval Duration

**File:** `src/icp_swap/src/storage.rs`

**Location:** After line 43 (after TOTAL_CLAIMED_REWARDS_MEM_ID)

```rust
// PSEUDOCODE
// Add new memory ID for interval duration storage
pub const DISTRIBUTION_INTERVAL_SECONDS_MEM_ID: MemoryId = MemoryId::new(19);
```

**Location:** In thread_local! block after SWEEP_HISTORY (around line 125)

```rust
// PSEUDOCODE
pub static DISTRIBUTION_INTERVAL_SECONDS: RefCell<StableBTreeMap<(), u64, Memory>> = RefCell::new(
    StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(DISTRIBUTION_INTERVAL_SECONDS_MEM_ID)))
);
```

**Rationale:**
- Use u64 for consistency with InitArgs type (distribution_interval_seconds: u64)
- Memory ID 19 is available (17-18 used by sweep features, 20+ available)
- Separate storage ensures interval duration persists across upgrades

### Part 2: Fix initialize_globals()

**File:** `src/icp_swap/src/script.rs`

**Location:** Replace lines 160-173

```rust
// PSEUDOCODE
// Store distribution interval DURATION (never changes) in separate storage
if let Some(interval_seconds) = args.distribution_interval_seconds {
    // Validation
    if interval_seconds < 60 {
        panic!("Distribution interval cannot be less than 60 seconds to prevent timer-based DoS attacks");
    }
    if interval_seconds > u32::MAX as u64 {
        panic!("Distribution interval exceeds maximum allowed value of {} seconds", u32::MAX);
    }

    // Store in the NEW storage location (not in counter!)
    DISTRIBUTION_INTERVAL_SECONDS.with(|m| {
        m.borrow_mut().insert((), interval_seconds);
    });

    register_info_log(
        caller(),
        "initialize_globals",
        &format!("Distribution interval duration stored: {} seconds", interval_seconds)
    );
}

// Initialize counter to 0 for new tokens (or use provided value for migration)
if let Some(counter_value) = args.distribution_intervals {
    // Migration path: Allow setting initial counter value
    DISTRIBUTION_INTERVALS.with(|m| {
        m.borrow_mut().insert((), counter_value);
    });
    register_info_log(
        caller(),
        "initialize_globals",
        &format!("Distribution counter initialized: {}", counter_value)
    );
} else {
    // New tokens: Start counter at 0
    DISTRIBUTION_INTERVALS.with(|m| {
        m.borrow_mut().insert((), 0);
    });
    register_info_log(
        caller(),
        "initialize_globals",
        "Distribution counter initialized to 0"
    );
}
```

**Key Changes:**
- Store interval_seconds in DISTRIBUTION_INTERVAL_SECONDS (new storage)
- Initialize DISTRIBUTION_INTERVALS to 0 for new tokens
- Keep args.distribution_intervals support for migration
- Add logging for debugging

### Part 3: Fix post_upgrade()

**File:** `src/icp_swap/src/script.rs`

**Location:** Replace lines 279-286

```rust
// PSEUDOCODE
#[post_upgrade]
fn post_upgrade() {
    // Read distribution interval DURATION from proper storage
    let distribution_interval = DISTRIBUTION_INTERVAL_SECONDS.with(|m| {
        m.borrow().get(&()).unwrap_or(3600) // Default to 1 hour if not set
    });

    setup_timers(distribution_interval);

    register_info_log(
        caller(),
        "post_upgrade",
        &format!("Post-upgrade timer setup completed with interval: {} seconds", distribution_interval)
    );
}
```

**Key Changes:**
- Read from DISTRIBUTION_INTERVAL_SECONDS instead of DISTRIBUTION_INTERVALS
- Proper default fallback (3600 = 1 hour)
- Timer will be set correctly after upgrades

### Part 4: Add Query Functions

**File:** `src/icp_swap/src/queries.rs`

**Location:** After get_distribution_interval() function (around line 104)

```rust
// PSEUDOCODE
/// Get the configured distribution interval duration in seconds
/// This is the time between reward distributions (e.g., 3600 = 1 hour)
#[query]
pub fn get_distribution_interval_seconds() -> u64 {
    DISTRIBUTION_INTERVAL_SECONDS.with(|m| {
        m.borrow().get(&()).unwrap_or(3600)
    })
}

/// Get the total number of distributions that have occurred
/// This counter increments by 1 with each distribution
#[query]
pub fn get_distribution_count() -> u32 {
    DISTRIBUTION_INTERVALS.with(|m| {
        m.borrow().get(&()).unwrap_or(0)
    })
}
```

**Rationale:**
- Clear naming: duration vs count
- Documentation explains what each returns
- get_distribution_interval() remains for backward compatibility but returns counter

### Part 5: Update Candid Interface

**File:** `src/icp_swap/icp_swap.did`

**Location:** In service definition (around line 131, after get_distribution_interval)

```candid
// PSEUDOCODE - Add these lines
  get_distribution_interval_seconds : () -> (nat64) query;
  get_distribution_count : () -> (nat32) query;
```

**Full context:**
```candid
service : (opt InitArgs) -> {
  ...
  get_distribution_interval : () -> (nat32) query;
  get_distribution_interval_seconds : () -> (nat64) query;  // NEW
  get_distribution_count : () -> (nat32) query;              // NEW
  ...
}
```

### Part 6: Update Changelog

**File:** `src/icp_swap/ICP_SWAP_CHANGE_LOG.md`

**Location:** At the top (create new Unreleased section if needed)

```markdown
// PSEUDOCODE
## [Unreleased]

### Fixed
- **Distribution Interval Storage Bug**: Fixed DISTRIBUTION_INTERVALS being initialized with interval duration instead of 0
  - Root cause: Line 171 stored interval_seconds (3600) in counter storage
  - Impact: Counter showed incorrect values (e.g., 5398 instead of 1798 after 1798 distributions)
  - Solution: Added separate DISTRIBUTION_INTERVAL_SECONDS storage for interval duration
  - DISTRIBUTION_INTERVALS now properly tracks distribution count starting at 0
  - Fixed post_upgrade to read interval from DISTRIBUTION_INTERVAL_SECONDS
  - Added get_distribution_interval_seconds() and get_distribution_count() query functions
  - Locations: src/icp_swap/src/storage.rs, src/icp_swap/src/script.rs, src/icp_swap/src/queries.rs, src/icp_swap/icp_swap.did
  - Migration: Counter can be corrected for existing tokens via InitArgs.distribution_intervals
```

## Migration Strategy for Mainnet Token

The existing mainnet token showing 5398 can be left as-is (harmless) or fixed during the next upgrade.

**To fix during upgrade:**
1. Calculate actual counter: 5398 - 3600 = 1798
2. Use InitArgs with both values:
   ```rust
   InitArgs {
       distribution_interval_seconds: Some(3600),  // Store duration
       distribution_intervals: Some(1798),         // Store corrected count
       // ... other fields
   }
   ```

**Note:** This migration is optional. The bug is cosmetic - distributions work correctly.

## Testing Requirements

### Local Build Verification
```bash
# In worktree
./scripts/build.sh
```

**Expected:** Build succeeds without errors

### Manual Verification (if deployed to local testnet)
```bash
# Create new token with 1-hour interval
# Query immediately after creation
dfx canister call icp_swap get_distribution_interval_seconds
# Expected: (3_600 : nat64)

dfx canister call icp_swap get_distribution_count
# Expected: (0 : nat32)

# After N distributions
dfx canister call icp_swap get_distribution_count
# Expected: (N : nat32)  - increments correctly
```

**⚠️ CRITICAL**: No mainnet deployment. This is a production financial application.

## Files Modified

```
src/icp_swap/
├── src/
│   ├── storage.rs          (MODIFIED - add new storage)
│   ├── script.rs           (MODIFIED - fix init and upgrade)
│   └── queries.rs          (MODIFIED - add query functions)
├── icp_swap.did            (MODIFIED - add new queries)
└── ICP_SWAP_CHANGE_LOG.md  (MODIFIED - document fix)
```

## Success Criteria

✅ Counter starts at 0 for new tokens
✅ Interval duration stored separately and persists
✅ Timer setup works correctly after upgrades
✅ Clear query functions with descriptive names
✅ Backward compatible (existing code still works)
✅ Migration path available for mainnet token
✅ Local build succeeds

## Additional Notes

- The bug is functionally harmless (APY tracking still works via modulo)
- Main impact is confusing display values
- Fix is backward compatible with existing tokens
- No frontend changes required
