# Complete UNCOLLECTED_LP_FEES Removal Plan

## Overview
This plan removes all references to UNCOLLECTED_LP_FEES across the entire codebase since:
1. We're distributing the 99% directly to stakers instead of accumulating it
2. This canister is not deployed, so no backwards compatibility needed
3. The locked LP design will be implemented in a different fork

## All References Found

### ICP Swap Canister Files:
1. `/src/icp_swap/src/storage.rs` - Memory ID, storage variable, getter function
2. `/src/icp_swap/src/queries.rs` - Import, query functions, reconciliation
3. `/src/icp_swap/src/update.rs` - Commented code in distribute_reward
4. `/src/icp_swap/icp_swap.did` - Candid interface definition
5. `/src/icp_swap/changelogs/2025-08-06-staking-distribution-fix.md` - Documentation

### LBRY Fun Canister Files:
6. `/src/lbry_fun/src/collection.rs` - Collection audit structures
7. `/src/lbry_fun/lbry_fun.did` - Candid interface definition

### Frontend Files:
8. `/src/lbry_fun_frontend/src/features/swap/components/TreasuryTab.tsx` - UI display

### Audit Archives (Historical - No changes needed):
- `/src/icp_swap/audit_archive/alex_fee/*` - Historical documentation

## Detailed Removal Plan

### 1. Storage Memory ID (`/src/icp_swap/src/storage.rs:32`)

**Current:**
```rust
pub const UNCOLLECTED_LP_FEES_MEM_ID: MemoryId = MemoryId::new(13);
```

**Change to:**
```diff
- pub const UNCOLLECTED_LP_FEES_MEM_ID: MemoryId = MemoryId::new(13);
+ // Memory ID 13 is intentionally unused (previously UNCOLLECTED_LP_FEES)
```

---

### 2. Storage Variable (`/src/icp_swap/src/storage.rs:93-97`)

**Current:**
```rust
// DEPRECATED: Not used - the 99% is distributed directly to stakers
// Kept only to maintain memory ID sequence
pub static UNCOLLECTED_LP_FEES: RefCell<StableBTreeMap<(), u64, Memory>> = RefCell::new(
    StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(UNCOLLECTED_LP_FEES_MEM_ID)))
);
```

**Change to:**
```diff
- // DEPRECATED: Not used - the 99% is distributed directly to stakers
- // Kept only to maintain memory ID sequence
- pub static UNCOLLECTED_LP_FEES: RefCell<StableBTreeMap<(), u64, Memory>> = RefCell::new(
-     StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(UNCOLLECTED_LP_FEES_MEM_ID)))
- );
+ // The 99% portion is now distributed directly to stakers
```

---

### 3. Getter Function (`/src/icp_swap/src/storage.rs:148-152`)

**Current:**
```rust
pub fn get_uncollected_lp_fees_mem() -> StableBTreeMap<(), u64, Memory> {
    UNCOLLECTED_LP_FEES.with(|_fees_map| {
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(UNCOLLECTED_LP_FEES_MEM_ID)))
    })
}
```

**Change to:**
```diff
- pub fn get_uncollected_lp_fees_mem() -> StableBTreeMap<(), u64, Memory> {
-     UNCOLLECTED_LP_FEES.with(|_fees_map| {
-         StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(UNCOLLECTED_LP_FEES_MEM_ID)))
-     })
- }
```

---

### 4. ReconciliationStatus Struct (`/src/icp_swap/src/storage.rs:243`)

**Current:**
```rust
pub struct ReconciliationStatus {
    // ... other fields ...
    pub uncollected_lp_fees: u64,
    // ... other fields ...
}
```

**Change to:**
```diff
pub struct ReconciliationStatus {
    // ... other fields ...
-   pub uncollected_lp_fees: u64,
    // ... other fields ...
}
```

---

### 5. Import Statement (`/src/icp_swap/src/queries.rs:10`)

**Current:**
```rust
use crate::{
    // ... other imports ...
    UNCOLLECTED_ALEX_FEES,
    UNCOLLECTED_LP_FEES,
    REWARD_POOL,
    // ... other imports ...
};
```

**Change to:**
```diff
use crate::{
    // ... other imports ...
    UNCOLLECTED_ALEX_FEES,
-   UNCOLLECTED_LP_FEES,
    REWARD_POOL,
    // ... other imports ...
};
```

---

### 6. get_uncollected_fees Query (`/src/icp_swap/src/queries.rs:183-188`)

**Current:**
```rust
#[query]
pub fn get_uncollected_fees() -> (u64, u64) {
    (
        UNCOLLECTED_ALEX_FEES.with(|f| f.borrow().get(&()).unwrap_or(0)),
        UNCOLLECTED_LP_FEES.with(|f| f.borrow().get(&()).unwrap_or(0))
    )
}
```

**Change to:**
```diff
#[query]
pub fn get_uncollected_fees() -> (u64, u64) {
    (
        UNCOLLECTED_ALEX_FEES.with(|f| f.borrow().get(&()).unwrap_or(0)),
-       UNCOLLECTED_LP_FEES.with(|f| f.borrow().get(&()).unwrap_or(0))
+       0  // LP fees are distributed directly to stakers, not accumulated
    )
}
```

---

### 7. Reconciliation Status Query (`/src/icp_swap/src/queries.rs:208,221,232,240,259`)

**Current (multiple locations):**
```rust
// Line 208 (early return):
uncollected_lp_fees: 0,

// Line 221:
let uncollected_lp = UNCOLLECTED_LP_FEES.with(|f| f.borrow().get(&()).unwrap_or(0));

// Line 232:
let accounted_balance = reward_pool + uncollected_alex + uncollected_lp + total_staked;

// Line 240:
let expected_balance = reward_pool + uncollected_alex + uncollected_lp + total_staked + operational_balance;

// Line 259:
uncollected_lp_fees: uncollected_lp,
```

**Change to:**
```diff
// Line 208 - Remove field from early return struct:
- uncollected_lp_fees: 0,

// Line 221:
- let uncollected_lp = UNCOLLECTED_LP_FEES.with(|f| f.borrow().get(&()).unwrap_or(0));

// Line 232:
- let accounted_balance = reward_pool + uncollected_alex + uncollected_lp + total_staked;
+ let accounted_balance = reward_pool + uncollected_alex + total_staked;

// Line 240:
- let expected_balance = reward_pool + uncollected_alex + uncollected_lp + total_staked + operational_balance;
+ let expected_balance = reward_pool + uncollected_alex + total_staked + operational_balance;

// Line 259 - Remove field from return struct:
- uncollected_lp_fees: uncollected_lp,
```

---

### 8. Commented Code in distribute_reward (`/src/icp_swap/src/update.rs:919-925`)

**Current:**
```rust
// NOTE: UNCOLLECTED_LP_FEES is no longer used - we distribute directly to stakers
// The locked LP design will be implemented in a different fork
// Original code that accumulated LP fees:
// UNCOLLECTED_LP_FEES.with(|f| {
//     let current = f.borrow().get(&()).unwrap_or(0);
//     f.borrow_mut().insert((), current.saturating_add(lp_portion));
// });
```

**Change to:**
```diff
- // NOTE: UNCOLLECTED_LP_FEES is no longer used - we distribute directly to stakers
- // The locked LP design will be implemented in a different fork
- // Original code that accumulated LP fees:
- // UNCOLLECTED_LP_FEES.with(|f| {
- //     let current = f.borrow().get(&()).unwrap_or(0);
- //     f.borrow_mut().insert((), current.saturating_add(lp_portion));
- // });
+ // The LP portion (99% of distribution) is distributed directly to stakers
```

---

### 9. Candid Interface (`/src/icp_swap/icp_swap.did:109`)

**Current:**
```candid
type ReconciliationStatus = record {
  // ... other fields ...
  uncollected_lp_fees : nat64;
  // ... other fields ...
};
```

**Change to:**
```diff
type ReconciliationStatus = record {
  // ... other fields ...
- uncollected_lp_fees : nat64;
  // ... other fields ...
};
```

---

### 10. Collection Module (`/src/lbry_fun/src/collection.rs`)

**Lines 57, 98, 225, 471, 484, 486, 502:**

**Current (line 57):**
```rust
pub struct SystemAudit {
    // ... other fields ...
    pub total_uncollected_lp: u64,
    // ... other fields ...
}
```

**Change to:**
```diff
pub struct SystemAudit {
    // ... other fields ...
-   pub total_uncollected_lp: u64,
    // ... other fields ...
}
```

**Current (line 98):**
```rust
pub struct TokenReconciliation {
    // ... other fields ...
    pub uncollected_lp_fees: u64,
    // ... other fields ...
}
```

**Change to:**
```diff
pub struct TokenReconciliation {
    // ... other fields ...
-   pub uncollected_lp_fees: u64,
    // ... other fields ...
}
```

**Current (line 225):**
```rust
let (alex_fees, _lp_fees) = match query_uncollected_fees(token_id).await {
```

**Change to:**
```diff
- let (alex_fees, _lp_fees) = match query_uncollected_fees(token_id).await {
+ let (alex_fees, _) = match query_uncollected_fees(token_id).await {
```

**Current (lines 471, 484-486, 502):**
```rust
// Line 471:
let mut total_uncollected_lp = 0u64;

// Lines 484-486:
Ok((alex_fees, lp_fees)) => {
    total_uncollected_alex += alex_fees;
    total_uncollected_lp += lp_fees;
}

// Line 502:
total_uncollected_lp,
```

**Change to:**
```diff
// Line 471:
- let mut total_uncollected_lp = 0u64;

// Lines 484-486:
- Ok((alex_fees, lp_fees)) => {
+ Ok((alex_fees, _)) => {
    total_uncollected_alex += alex_fees;
-   total_uncollected_lp += lp_fees;
}

// Line 502 - Remove from struct initialization:
- total_uncollected_lp,
```

---

### 11. LBRY Fun Candid Interface (`/src/lbry_fun/lbry_fun.did`)

**Lines 85, 127:**

**Current (line 85):**
```candid
type ReconciliationStatus = record {
  // ... other fields ...
  uncollected_lp_fees : nat64;
  // ... other fields ...
};
```

**Change to:**
```diff
type ReconciliationStatus = record {
  // ... other fields ...
- uncollected_lp_fees : nat64;
  // ... other fields ...
};
```

**Current (line 127):**
```candid
type SystemAudit = record {
  // ... other fields ...
  total_uncollected_lp : nat64;
  // ... other fields ...
};
```

**Change to:**
```diff
type SystemAudit = record {
  // ... other fields ...
- total_uncollected_lp : nat64;
  // ... other fields ...
};
```

---

### 12. Frontend TreasuryTab (`/src/lbry_fun_frontend/src/features/swap/components/TreasuryTab.tsx`)

**Lines 184, 296:**

**Current (line 184):**
```tsx
tokenReconciliation.reconciliation.uncollected_alex_fees + 
tokenReconciliation.reconciliation.uncollected_lp_fees
```

**Change to:**
```diff
- tokenReconciliation.reconciliation.uncollected_alex_fees + 
- tokenReconciliation.reconciliation.uncollected_lp_fees
+ tokenReconciliation.reconciliation.uncollected_alex_fees
```

**Current (line 296):**
```tsx
systemReconciliation.total_uncollected_alex + 
systemReconciliation.total_uncollected_lp
```

**Change to:**
```diff
- systemReconciliation.total_uncollected_alex + 
- systemReconciliation.total_uncollected_lp
+ systemReconciliation.total_uncollected_alex
```

---

### 13. Changelog Documentation (`/src/icp_swap/changelogs/2025-08-06-staking-distribution-fix.md`)

Update lines 11, 104, 222 to reflect the complete removal rather than backwards compatibility.

**Change to:**
```diff
Line 11:
- - The 99% portion (of the 1% distribution) was just accumulating in UNCOLLECTED_LP_FEES
+ - The 99% portion (of the 1% distribution) is now distributed directly to stakers

Line 104:
- UNCOLLECTED_LP_FEES.with(|f| {
+ // Removed - LP fees now distributed directly to stakers

Line 222:
- - **No changes to UNCOLLECTED_LP_FEES**: Kept for backwards compatibility
+ - **UNCOLLECTED_LP_FEES removed**: LP fees now distributed directly to stakers
```

---

## Testing After Removal

1. **Compilation**: Ensure all Rust code compiles without errors
2. **Candid Interface**: Regenerate TypeScript bindings from updated .did files
3. **Frontend**: Update TypeScript interfaces to match new Candid types
4. **Integration Tests**: Verify:
   - `get_uncollected_fees()` returns (alex_amount, 0)
   - Reconciliation calculates correctly without LP fees
   - Distribution works properly to stakers
   - Collection module in lbry_fun handles the changes

## Summary

This removes approximately **50+ lines of code** and simplifies the system by:
- Eliminating unused storage and associated overhead
- Clarifying that the 99% goes directly to stakers
- Removing confusion about where LP fees accumulate
- Preparing for a cleaner implementation in future forks