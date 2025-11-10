# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/lbryfun" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/lbryfun-delegate-buyburn"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/lbryfun-delegate-buyburn`
2. **Implement feature** - Follow plan sections below
3. **Build locally** (verification only - NEVER DEPLOY TO MAINNET):
   ```bash
   ./scripts/build.sh
   ```
   **⚠️ PRODUCTION WARNING**: This is a live financial application. Never deploy to mainnet.
4. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "Refactor: Delegate buy/burn logic to alex_revshare canister"
   git push -u origin feature/delegate-buyburn-to-revshare
   gh pr create --title "Refactor: Delegate buy/burn to alex_revshare" --body "Implements PLAN_DELEGATE_BUYBURN_TO_REVSHARE.md - Simplifies lbry_fun by delegating ICP→LBRY swap/burn to existing alex_revshare canister. Removes 254 lines of duplicate logic."
   ```
5. **Iterate autonomously**:
   - FOR i=1 to 5:
     - Check review: `gh pr view [NUM] --json comments`
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

**Branch:** `feature/delegate-buyburn-to-revshare`
**Worktree:** `/home/theseus/alexandria/lbryfun-delegate-buyburn`

---

# Refactoring Plan: Delegate Buy/Burn to alex_revshare

## Context & Problem Statement

Currently, both `lbryfun/src/lbry_fun/src/collection.rs` (254 lines) and `alexandria/core/src/alex_revshare/src/process.rs` (167 lines) perform **identical** ICP→LBRY swap and burn operations:

1. Check ICP balance hourly
2. If balance ≥ 1 ICP, swap via `CORE_ICP_SWAP` canister
3. Burn all received LBRY tokens

This duplication is unnecessary complexity. The `alex_revshare` canister already exists in the Alexandria parent project to aggregate platform fees from multiple sources and handle buy/burn.

## Current Architecture Flow

```
Token Launch (N instances)
├── icp_swap canister
│   ├── Accumulates platform fees (1% of distributions) in UNCOLLECTED_ALEX_FEES
│   └── Every 4 hours: push_alex_fees_wrapper() → transfers to lbry_fun
│
lbry_fun canister (factory)
├── Receives ICP from all token launches
├── collection.rs timer (hourly)
│   ├── Checks balance
│   ├── If ≥ 1 ICP: Approve CORE_ICP_SWAP
│   ├── Call CORE_ICP_SWAP.swap(amount)
│   └── Burn received LBRY (254 lines of logic)
└── Stats tracking (TOTAL_BURNED, LAST_SWAP_TIME, LAST_SWAP_AMOUNT)

alex_revshare canister (parent project)
├── Receives ICP from Alexandria sources
└── process.rs timer (hourly) - EXACT SAME LOGIC
    ├── Check balance
    ├── If ≥ 1 ICP: Swap via CORE_ICP_SWAP
    └── Burn LBRY (167 lines)
```

## Proposed Simplified Architecture

```
Token Launch (N instances)
├── icp_swap canister
│   └── Every 4 hours: transfers to lbry_fun (UNCHANGED)
│
lbry_fun canister (factory)
├── Receives ICP from all token launches
└── NEW: Simple forwarder (hourly)
    ├── Check balance
    └── If ≥ threshold: Transfer to alex_revshare
    (Delete 254 lines of swap/burn logic)

alex_revshare canister (single source of truth)
└── Handles ALL buy/burn (UNCHANGED - already working)
    ├── Receives from lbryfun + other Alexandria sources
    ├── Hourly: swap ICP → LBRY
    └── Burn all LBRY
```

## Benefits of This Refactoring

1. **Remove 254 lines** of duplicate logic from lbryfun
2. **Single source of truth** for buy/burn operations (alex_revshare)
3. **Simpler maintenance** - changes only needed in one place
4. **Cleaner separation** - lbryfun focuses on factory, alex_revshare on revenue
5. **No backward compatibility concerns** (project not live)

## Current State Documentation

### Files to Modify

**Primary Changes:**
- `src/lbry_fun/src/collection.rs` (254 lines) → **REPLACE** with simple ICP forwarder (~50 lines)
- `src/lbry_fun/src/constants.rs` (7 lines) → **ADD** alex_revshare canister ID
- `src/lbry_fun/lbry_fun.did` (154 lines) → **UPDATE** query function signature

**No Changes Needed:**
- `src/icp_swap/src/update.rs` - Platform fee collection unchanged
- `src/icp_swap/src/script.rs` - Timer setup unchanged
- `../../alexandria/core/src/alex_revshare/` - Already working perfectly

### Line Count Analysis

**Before:**
- `collection.rs`: 254 lines (complex swap/burn logic)
- Total duplication: 254 lines in lbryfun + 167 lines in alex_revshare

**After:**
- `collection.rs`: ~50 lines (simple ICP forwarder)
- **Net reduction: 204 lines removed from lbryfun**
- Single implementation in alex_revshare

### Current collection.rs Structure (Lines to Delete)

```
Lines 1-14:   Imports and constants (CORE_ICP_SWAP, LBRY_CANISTER, etc.) ❌ DELETE
Lines 16-20:  State tracking (TOTAL_BURNED, LAST_SWAP_TIME, etc.) ❌ DELETE
Lines 22-32:  init_swap_timer() ✅ KEEP (modified)
Lines 34-71:  check_and_swap() - balance checking ⚠️ SIMPLIFY
Lines 73-245: execute_swap_and_burn() - swap/burn logic ❌ DELETE
Lines 247-255: get_swap_stats() query ⚠️ SIMPLIFY
```

## Implementation Plan (Pseudocode)

### Step 1: Add alex_revshare Constant

**File:** `src/lbry_fun/src/constants.rs`

```rust
// PSEUDOCODE

// Existing constants (unchanged)
pub const CODEBASE_VERSION: &str = "0.1.0";
pub const LBRY_FUN_CANISTER_ID: &str = "oni4e-oyaaa-aaaap-qp2pq-cai";
pub const KONG_BACKEND_CANISTER_ID: &str = "2ipq2-uqaaa-aaaar-qailq-cai";
pub const ICP_LEDGER_CANISTER_ID: &str = "ryjl3-tyaaa-aaaaa-aaaba-cai";

// NEW: Add alex_revshare canister ID
pub const ALEX_REVSHARE_CANISTER_ID: &str = "TODO_GET_MAINNET_CANISTER_ID";
// Note: This will need to be updated with the actual mainnet canister ID
// during deployment. The local canister ID may differ.
```

### Step 2: Replace collection.rs with Simple Forwarder

**File:** `src/lbry_fun/src/collection.rs` (FULL REPLACEMENT)

```rust
// PSEUDOCODE - Complete file replacement

use candid::Principal;
use ic_cdk::query;
use ic_cdk_timers::set_timer_interval;
use std::cell::RefCell;
use std::time::Duration;

// Configuration constants
const MIN_ICP_BALANCE: u64 = 100_000_000;  // 1 ICP minimum to trigger forward
const ICP_RESERVE: u64 = 10_000_000;       // 0.1 ICP reserve for fees
const CHECK_INTERVAL: u64 = 3600;          // Check every hour
const ALEX_REVSHARE_CANISTER: &str = "TODO_ACTUAL_CANISTER_ID";

// Simple state tracking (much simpler than before)
thread_local! {
    static TOTAL_FORWARDED: RefCell<u64> = RefCell::new(0);
    static LAST_FORWARD_TIME: RefCell<u64> = RefCell::new(0);
    static LAST_FORWARD_AMOUNT: RefCell<u64> = RefCell::new(0);
}

// Initialize simple check timer
pub fn init_swap_timer() {
    set_timer_interval(
        Duration::from_secs(CHECK_INTERVAL),
        || {
            ic_cdk::spawn(async {
                let _ = check_and_forward().await;
            });
        }
    );
}

// Simple check and forward function (replaces complex swap logic)
async fn check_and_forward() -> Result<String, String> {
    use ic_ledger_types::{AccountBalanceArgs, AccountIdentifier, MAINNET_LEDGER_CANISTER_ID};

    ic_cdk::println!("FORWARD_TIMER: Checking balance for forwarding...");

    // Step 1: Check ICP balance
    let canister_id = ic_cdk::api::id();
    let account_id = AccountIdentifier::new(&canister_id, &ic_ledger_types::DEFAULT_SUBACCOUNT);

    let balance_args = AccountBalanceArgs { account: account_id };
    let icp_balance_result: Result<(ic_ledger_types::Tokens,), _> = ic_cdk::call(
        MAINNET_LEDGER_CANISTER_ID,
        "account_balance",
        (balance_args,),
    ).await;

    let icp_balance = match icp_balance_result {
        Ok((tokens,)) => tokens.e8s(),
        Err(e) => {
            ic_cdk::println!("FORWARD_TIMER: Failed to check balance: {:?}", e);
            return Ok("Could not check balance".to_string());
        }
    };

    ic_cdk::println!("FORWARD_TIMER: Balance check - {} E8S", icp_balance);

    // Step 2: Only proceed if we have more than 1 ICP
    if icp_balance < MIN_ICP_BALANCE {
        ic_cdk::println!("FORWARD_TIMER: Balance {} below threshold {}", icp_balance, MIN_ICP_BALANCE);
        return Ok(format!("Balance {} below threshold", icp_balance));
    }

    ic_cdk::println!("FORWARD_TIMER: Proceeding with forward, balance {} exceeds minimum", icp_balance);

    // Step 3: Execute forward to alex_revshare
    execute_forward().await
}

// Execute ICP transfer to alex_revshare canister
async fn execute_forward() -> Result<String, String> {
    use icrc_ledger_types::icrc1::account::Account;
    use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
    use ic_ledger_types::{AccountBalanceArgs, AccountIdentifier, MAINNET_LEDGER_CANISTER_ID};

    ic_cdk::println!("FORWARD_TIMER: Starting execute_forward...");

    // Step 1: Get current ICP balance
    let canister_id = ic_cdk::api::id();
    let account_id = AccountIdentifier::new(&canister_id, &ic_ledger_types::DEFAULT_SUBACCOUNT);

    let balance_args = AccountBalanceArgs { account: account_id };
    let icp_balance_result: Result<(ic_ledger_types::Tokens,), _> = ic_cdk::call(
        MAINNET_LEDGER_CANISTER_ID,
        "account_balance",
        (balance_args,),
    ).await;

    let icp_balance = match icp_balance_result {
        Ok((tokens,)) => tokens.e8s(),
        Err(e) => return Err(format!("Failed to get ICP balance: {:?}", e)),
    };

    // Step 2: Only proceed if balance is above minimum threshold
    if icp_balance < MIN_ICP_BALANCE {
        return Ok(format!("ICP balance {} below minimum {}", icp_balance, MIN_ICP_BALANCE));
    }

    // Step 3: Calculate forward amount (leave reserve for fees)
    // Account for transfer fee (10_000)
    let forward_amount = icp_balance.saturating_sub(ICP_RESERVE + 10_000);

    ic_cdk::println!("FORWARD_TIMER: Forwarding {} E8S of ICP to alex_revshare", forward_amount);

    // Step 4: Get alex_revshare canister principal
    let alex_revshare = Principal::from_text(ALEX_REVSHARE_CANISTER)
        .map_err(|e| format!("Invalid alex_revshare canister ID: {}", e))?;

    // Step 5: Execute transfer to alex_revshare
    let transfer_args = TransferArg {
        from_subaccount: None,
        to: Account {
            owner: alex_revshare,
            subaccount: None,
        },
        fee: None,
        created_at_time: None,
        memo: None,
        amount: candid::Nat::from(forward_amount),
    };

    let transfer_result: Result<(Result<candid::Nat, TransferError>,), _> = ic_cdk::call(
        MAINNET_LEDGER_CANISTER_ID,
        "icrc1_transfer",
        (transfer_args,),
    ).await;

    // Step 6: Handle result and update tracking
    match transfer_result {
        Ok((Ok(block_index),)) => {
            // Update tracking state
            TOTAL_FORWARDED.with(|total| {
                *total.borrow_mut() = total.borrow().saturating_add(forward_amount);
            });

            LAST_FORWARD_TIME.with(|t| *t.borrow_mut() = ic_cdk::api::time());
            LAST_FORWARD_AMOUNT.with(|a| *a.borrow_mut() = forward_amount);

            Ok(format!(
                "Successfully forwarded {} ICP to alex_revshare at block {}. Total forwarded: {} ICP",
                forward_amount,
                block_index,
                TOTAL_FORWARDED.with(|t| *t.borrow())
            ))
        }
        Ok((Err(e),)) => {
            Err(format!("Transfer to alex_revshare failed: {:?}", e))
        }
        Err(e) => {
            Err(format!("Transfer call to alex_revshare failed: {:?}", e))
        }
    }
}

// Query functions - simplified to reflect forwarding instead of burning
#[query]
pub fn get_swap_stats() -> (u64, u64, u64) {
    // Returns: (total_forwarded_to_revshare, last_forward_time, last_forward_amount)
    (
        TOTAL_FORWARDED.with(|t| *t.borrow()),
        LAST_FORWARD_TIME.with(|t| *t.borrow()),
        LAST_FORWARD_AMOUNT.with(|a| *a.borrow()),
    )
}
```

### Step 3: Update DID File (Query Signature Unchanged)

**File:** `src/lbry_fun/lbry_fun.did`

```candid
// PSEUDOCODE - NO CHANGES NEEDED

// The get_swap_stats signature remains unchanged:
// get_swap_stats : () -> (nat64, nat64, nat64) query;
//
// Semantics change but signature is identical:
// - Before: (total_burned, last_swap_time, last_swap_amount)
// - After: (total_forwarded, last_forward_time, last_forward_amount)
//
// Frontend can interpret these values in context
```

### Step 4: Update Frontend Display (Optional Polish)

**File:** `src/lbry_fun_frontend/src/features/swap/components/TreasuryTab.tsx` (or similar)

```typescript
// PSEUDOCODE - Optional frontend update

// If frontend displays "Total LBRY Burned" from get_swap_stats:
// Update label to "Total ICP Forwarded to Revenue Share"
// or "Platform Fees Collected"
//
// The numeric values remain valid, just semantic change
```

## Testing Strategy

### Local Build Verification
```bash
# Build all canisters to verify compilation
./scripts/build.sh
```

**⚠️ CRITICAL**: This is a production financial application. Never deploy to mainnet from worktrees.

### Manual Testing (Local Network Only)
1. Deploy to local dfx network
2. Create test token launch
3. Wait for platform fees to accumulate in lbry_fun
4. Verify ICP forwarded to alex_revshare (check logs)
5. Verify alex_revshare executes swap/burn as normal

### Verification Checklist
- [ ] Code compiles without errors
- [ ] No breaking changes to public API (get_swap_stats signature unchanged)
- [ ] Constants properly defined
- [ ] Canister ID placeholder documented (needs mainnet ID)
- [ ] Timer logic preserved (hourly checks)
- [ ] Proper error handling maintained
- [ ] Logs indicate forwarding behavior

## Migration Notes

### Canister ID Configuration
The `ALEX_REVSHARE_CANISTER_ID` constant contains a placeholder. Before mainnet deployment:

1. Deploy alex_revshare canister to mainnet (if not already deployed)
2. Update `src/lbry_fun/src/constants.rs` with actual canister ID
3. Update `src/lbry_fun/src/collection.rs` ALEX_REVSHARE_CANISTER constant
4. Rebuild and deploy

### State Migration
- Existing `TOTAL_BURNED` stats in old deployments are preserved in query results
- New deployments track `TOTAL_FORWARDED` instead
- No backward compatibility issues (project not live)

### Expected Behavior Changes
- **Before**: lbryfun holds LBRY tokens briefly (between swap and burn)
- **After**: lbryfun only holds ICP, forwards to alex_revshare
- **Result**: Identical end behavior (ICP → burned LBRY), simpler architecture

## Files Summary

**Modified:**
- `src/lbry_fun/src/collection.rs` - Complete replacement (~204 lines removed)
- `src/lbry_fun/src/constants.rs` - Add ALEX_REVSHARE_CANISTER_ID

**Unchanged:**
- `src/lbry_fun/lbry_fun.did` - Signature compatible
- `src/icp_swap/src/update.rs` - Platform fee collection unchanged
- `src/icp_swap/src/script.rs` - Timer setup unchanged
- All other lbryfun files

**Impact:**
- **Negative LOC**: -204 lines net reduction
- **Duplication eliminated**: Single source of truth for buy/burn
- **Maintenance simplified**: Changes only in alex_revshare

## Success Criteria

- [ ] Code compiles successfully
- [ ] collection.rs reduced from 254 to ~50 lines
- [ ] No duplicate swap/burn logic in lbryfun
- [ ] Timer continues to run hourly
- [ ] ICP forwarded to alex_revshare when balance ≥ 1 ICP
- [ ] get_swap_stats() query still works (semantic change only)
- [ ] All tests pass (if applicable)
- [ ] PR created and ready for review

---

## Implementation Checklist

- [ ] Verify in worktree `/home/theseus/alexandria/lbryfun-delegate-buyburn`
- [ ] Update `src/lbry_fun/src/constants.rs` with ALEX_REVSHARE_CANISTER_ID
- [ ] Replace `src/lbry_fun/src/collection.rs` with forwarder implementation
- [ ] Verify `lbry_fun.did` signature unchanged
- [ ] Build locally: `./scripts/build.sh`
- [ ] Commit changes
- [ ] Push to feature branch
- [ ] Create PR with description
- [ ] Iterate on feedback autonomously
