

# TOKENOMICS Canister Change Log

## Overview
This file tracks all changes made to convert the audited tokenomics canister into a configurable launchpad canister.

## Risk Levels
- **LOW**: Safe conversions (renaming, read-only functions, organization)
- **MEDIUM**: Bounded changes (configurability, events, initialization)
- **HIGH**: Core logic modifications (minting formulas, distribution ratios, algorithms)

## Change Log

### Completed Changes

#### TOK-011: Distribution Model Change (HIGH RISK)
- **File**: tokenomics.did
- **Change**: Removed get_two_random_nfts function
- **Timestamp**: 2025-01-30
- **Security Impact**: Simplifies distribution logic by removing NFT dependencies
- **Test Status**: Pending

#### TOK-001 to TOK-005: Token Renaming (LOW RISK)
- **File**: tokenomics.did
- **Changes**: 
  - Renamed ALEX → primary, LBRY → secondary in all type names and function names
  - Renamed types: MaxAlexPerTrnxReached → MaxPrimaryPerTrnxReached, etc.
  - Renamed functions: mint_ALEX → mint_primary, fetch_total_minted_ALEX → fetch_total_minted_primary, etc.
- **Timestamp**: 2025-01-30
- **Security Impact**: None - cosmetic changes only
- **Test Status**: Pending

#### TOK-006 to TOK-008: Added Configuration Types (LOW RISK)
- **File**: tokenomics.did
- **Changes**:
  - Added Config type with primary_token_ledger and secondary_token_ledger fields
  - Added get_configs query function
  - Added get_tokenomics_schedule query function
- **Timestamp**: 2025-01-30
- **Security Impact**: None - read-only configuration access
- **Test Status**: Pending

#### TOK-012: Fix Variable Scope for Dynamic Rewards (LOW RISK)
- **File**: src/update.rs
- **Change**: Moved `let rewards = get_rewards();` to function scope level
- **Details**: 
  - Fixed compilation error where `rewards` was used outside its declared scope
  - Moved declaration to line 80 (after `let thresholds = get_thresholds();`)
  - Removed duplicate declarations inside inner scopes (lines ~105 and ~264)
- **Timestamp**: 2025-01-02
- **Security Impact**: None - scope fix only, no logic changes
- **Test Status**: Compilation fixed

### Planned Changes

#### Token Renaming (ALEX/LBRY → primary/secondary)

| Change ID | File | Risk | Description | Original | New | Justification | Security Impact | Test Status |
|-----------|------|------|-------------|----------|-----|---------------|-----------------|-------------|
| TOK-001 | tokenomics.did | LOW | Rename type | `type MintAlex` | `type MintPrimary` | Generic token naming | None | Planned |
| TOK-002 | tokenomics.did | LOW | Rename function | `mint_ALEX : (principal, nat) -> (MintAlex)` | `mint_primary : (principal, nat) -> (MintPrimary)` | Generic token naming | None | Planned |
| TOK-003 | src/lib.rs | LOW | Update function | `async fn mint_ALEX()` | `async fn mint_primary()` | Generic token naming | None | Planned |
| TOK-004 | src/lib.rs | LOW | Update variables | `alex_amount`, `alex_minted` | `primary_amount`, `primary_minted` | Generic token naming | None | Planned |
| TOK-005 | src/lib.rs | LOW | Update strings | `"ALEX"`, `"LBRY"` | `"primary"`, `"secondary"` | Generic token naming | None | Planned |

#### Minimal Configuration Changes

| Change ID | File | Risk | Description | Original | New | Justification | Security Impact | Test Status |
|-----------|------|------|-------------|----------|-----|---------------|-----------------|-------------|
| TOK-006 | tokenomics.did | LOW | Add type | N/A | `type Configs { primary_token_ledger, secondary_token_ledger }` | Store token IDs only | None | Planned |
| TOK-007 | tokenomics.did | LOW | Add init fields | N/A | `primary_token_ledger, secondary_token_ledger` | Token ID configuration | None | Planned |
| TOK-008 | tokenomics.did | LOW | Add query | N/A | `get_configs : () -> (Configs) query` | Read configuration | None | Planned |
| TOK-009 | src/lib.rs | LOW | Add storage | Hardcoded token IDs | Configuration struct | Token ID flexibility | None | Planned |

#### Deferred to Future Enhancement

| Deferred | File | Risk | Description | Why Deferred |
|----------|------|------|-------------|--------------|
| ⏸️ | src/lib.rs | HIGH | Configurable thresholds | Preserve audited economic model |
| ⏸️ | src/lib.rs | HIGH | Configurable rewards | Complex validation needed |
| ⏸️ | src/lib.rs | HIGH | Custom halving curves | Requires economic modeling |
| ⏸️ | tokenomics.did | HIGH | TokenomicsConfig struct | Full configurability too risky |

#### CRITICAL Decimal Handling (MUST KEEP)

| Change ID | File | Risk | Description | Original | New | Justification | Security Impact | Test Status |
|-----------|------|------|-------------|----------|-----|---------------|-----------------|-------------|
| TOK-010 | src/lib.rs | LOW | Add comment | `* 10000` | `* 10000 // Convert 4 decimals to 8` | Clarify purpose | None | Planned |

#### Distribution Model Change (REQUIRED for Launchpad)

| Change ID | File | Risk | Description | Original | New | Justification | Security Impact | Test Status |
|-----------|------|------|-------------|----------|-----|---------------|-----------------|-------------|
| TOK-011 | src/lib.rs | HIGH | Change distribution | 33.3%/33.3%/33.3% split | 100% to burner | Launchpad has no NFTs | Simplifies logic | Planned |
| TOK-012 | src/lib.rs | MEDIUM | Remove function | `get_two_random_nfts()` | Remove entirely | No NFT integration | Reduces complexity | Planned |
| TOK-013 | src/lib.rs | MEDIUM | Remove parameter | `nft_canister_id` | Remove from config | No NFT integration | Simplifies config | Planned |

## Changes to AVOID ❌

| Avoided | File | Risk | Description | Why Avoided |
|---------|------|------|-------------|-------------|
| ❌ | src/lib.rs | HIGH | Remove 10,000 multiplication | Would break decimal conversion |

#### Implementation Changes Completed

| Change ID | File | Risk | Description | Details | Test Status |
|-----------|------|------|-------------|---------|-------------|
| TOK-011 | src/update.rs | HIGH | Changed distribution model | Removed NFT distribution, 100% to burner | Pending |
| TOK-012 | src/queries.rs | MEDIUM | Removed get_two_random_nfts | Eliminated NFT dependency | Pending |
| TOK-001-005 | Multiple files | LOW | Token renaming | ALEX→primary, LBRY→secondary throughout | Pending |
| TOK-006-009 | Multiple files | LOW | Added configuration | Config struct, get_configs, initialization | Pending |
| TOK-010 | src/update.rs | LOW | Added decimal comment | Documented 10,000 multiplication purpose | Pending |
| TOK-ADD-1 | src/lib.rs | MEDIUM | Added initialization | InitArgs struct and init function | Pending |
| TOK-ADD-2 | src/storage.rs | LOW | Added config storage | CONFIG memory and accessors | Pending |
| TOK-ADD-3 | src/queries.rs | LOW | Added get_tokenomics_schedule | Returns hardcoded thresholds/rewards | Pending |

#### Bug Fixes and Code Cleanup (2025-06-30)

| Change ID | File | Risk | Description | Details | Test Status |
|-----------|------|------|-------------|---------|-------------|
| FIX-001 | src/update.rs | LOW | Fixed unsafe static access | Replaced `get_principal(PRIMARY_TOKEN_CANISTER_ID)` with `get_config().primary_token_ledger` to avoid unsafe static access | Completed |
| FIX-002 | src/queries.rs | LOW | Removed unused imports | Removed `get_principal`, `PRIMARY_TOKEN_CANISTER_ID`, and `CallResult` imports | Completed |
| FIX-003 | src/update.rs | LOW | Removed unused imports | Removed `update_log`, `PRIMARY_TOKEN_CANISTER_ID`, `DEFAULT_DIVISION_ERROR`, and `get_principal` imports | Completed |
| FIX-004 | src/lib.rs | LOW | Removed unused import | Removed `CallResult` import | Completed |
| FIX-005 | src/storage.rs | LOW | Fixed unused variable warnings | Prefixed unused closure parameters with underscore | Completed |
| FIX-006 | src/update.rs | LOW | Fixed unused assignment warnings | Changed `minted_primary` and `total_primary_minted` from mutable with default values to immutable without defaults | Completed |

#### Dynamic Tokenomics Configuration (2025-01-01)

| Change ID | File | Risk | Description | Details | Test Status |
|-----------|------|------|-------------|---------|-------------|
| TOK-014 | src/lib.rs | MEDIUM | Updated InitArgs | Added secondary_thresholds and primary_rewards Vec<u64> fields | Pending |
| TOK-015 | src/storage.rs | LOW | Added memory IDs | Added THRESHOLDS_MEM_ID (5) and REWARDS_MEM_ID (6) | Pending |
| TOK-016 | src/storage.rs | LOW | Added dynamic storage | Added DYNAMIC_THRESHOLDS and DYNAMIC_REWARDS thread-local storage | Pending |
| TOK-017 | src/storage.rs | LOW | Added helper functions | get_thresholds(), get_rewards(), set_thresholds(), set_rewards() with fallback | Pending |
| TOK-018 | src/lib.rs | MEDIUM | Updated init function | Added set_thresholds() and set_rewards() calls to store arrays | Pending |
| TOK-019 | src/queries.rs | LOW | Updated imports | Replaced SECONDARY_THRESHOLDS, PRIMARY_PER_THRESHOLD with get_thresholds, get_rewards | Pending |
| TOK-020 | src/queries.rs | LOW | Updated array access | Replaced all hardcoded array access with dynamic getters in 5 functions | Pending |
| TOK-021 | src/update.rs | HIGH | Updated mint_primary | Replaced all SECONDARY_THRESHOLDS access with get_thresholds() | Pending |
| TOK-022 | src/update.rs | HIGH | Updated mint_primary | Replaced all PRIMARY_PER_THRESHOLD access with get_rewards() | Pending |
| TOK-023 | tokenomics.did | LOW | Updated InitArgs | Added secondary_thresholds and primary_rewards fields to interface | Pending |

## Summary Statistics
- Total Implemented Changes: 37
- Low Risk: 27
- Medium Risk: 5
- High Risk: 3 (1 distribution model + 2 dynamic config)
- Avoided High Risk: 1
- Deferred: 4 (full configurability)
- Tested: 0
- Pending: 31
- Completed Bug Fixes: 6

## Implementation Order
1. First: Token renaming (TOK-001 to TOK-005) - Low risk
2. Second: Distribution model change (TOK-011 to TOK-013) - High/Medium risk but required
3. Third: Add minimal configuration (TOK-006 to TOK-009) - Low risk (token IDs only)
4. Fourth: Add decimal conversion comment (TOK-010) - Low risk

## Notes
- All changes must preserve the original minting formula with 10,000 multiplication
- Distribution model changes to 100% burner for launchpad (no NFT integration)
- Economic parameters (thresholds, rewards, halving) remain hardcoded to preserve audited model
- Only token canister IDs are configurable
- Full configurability deferred to future enhancement to minimize risk

#### Critical Bug Fix: Restore Original Emission Schedule (2025-01-01)

| Change ID | File | Risk | Description | Details | Test Status |
|-----------|------|------|-------------|---------|-------------|
| FIX-007 | src/update.rs | HIGH | Restored 3x multiplication in minting | When removing NFT distribution, the 3x multiplier was accidentally removed, reducing emissions by 67%. Now multiply by 3 to maintain original schedule while giving 100% to burner | Pending |

**Code Change for FIX-007:**
```rust
// BEFORE (line 331-332):
// SIMPLIFIED DISTRIBUTION: 100% to burner (no NFT splitting)
let primary_to_mint = phase_mint_primary.min(remaining_primary);

// AFTER (line 331-344):
// SIMPLIFIED DISTRIBUTION: 100% to burner (no NFT splitting)
// Multiply by 3 to maintain original emission schedule (was split 3 ways, now all to burner)
let primary_to_mint = phase_mint_primary
    .checked_mul(3)
    .ok_or_else(|| {
        ExecutionError::new_with_log(
            actual_caller,
            "mint_primary",
            ExecutionError::MultiplicationOverflow {
                operation: "phase_mint_primary * 3".to_string(),
                details: "Overflow during 3x multiplication for emission schedule".to_string(),
            }
        )
    })?
    .min(remaining_primary);
```

**Explanation**: The original code multiplied `phase_mint_primary` by 3 because it was designed to mint tokens for 3 recipients (burner + 2 NFT holders). When simplifying to 100% burner distribution, this multiplication was accidentally removed, causing only 1/3 of the intended tokens to be minted. This fix restores the 3x multiplication to maintain the original emission schedule.

## Related Changes
- **ICP_SWAP Error Synchronization**: The ICP_SWAP canister has been updated to properly decode ExecutionError responses from this tokenomics canister (SWAP-086, SWAP-087)
- This ensures users see meaningful error messages when tokenomics operations fail (e.g., "Maximum primary token supply reached" instead of "Failed to decode successful response")

### Overview
Implemented dynamic configuration support for tokenomics thresholds and rewards arrays, replacing hardcoded values while preserving all audited minting logic. This allows customizable tokenomics parameters to be set during canister initialization.

### Changes Implemented

#### DYN-001: Updated InitArgs Structure (MEDIUM RISK)
- **File**: src/lib.rs
- **Change**: Added dynamic array fields to InitArgs
- **Timestamp**: 2025-01-01
- **Security Impact**: Requires validation of input arrays during initialization
- **Test Status**: Pending

**Code Change:**
```rust
// BEFORE (line 18-22):
#[derive(CandidType, Deserialize)]
pub struct InitArgs {
    pub primary_token_ledger: Principal,
    pub secondary_token_ledger: Principal,
}

// AFTER (line 18-24):
#[derive(CandidType, Deserialize)]
pub struct InitArgs {
    pub primary_token_ledger: Principal,
    pub secondary_token_ledger: Principal,
    pub secondary_thresholds: Vec<u64>,      // NEW: Dynamic thresholds array
    pub primary_rewards: Vec<u64>,           // NEW: Dynamic rewards array
}
```

#### DYN-002: Added Storage for Dynamic Arrays (LOW RISK)
- **File**: src/storage.rs
- **Change**: Added memory IDs and thread-local storage for dynamic arrays
- **Timestamp**: 2025-01-01
- **Security Impact**: None - storage only
- **Test Status**: Pending

**Code Changes:**
```rust
// ADDED (line 65-66):
pub const THRESHOLDS_MEM_ID: MemoryId = MemoryId::new(5);  // NEW: Dynamic thresholds storage
pub const REWARDS_MEM_ID: MemoryId = MemoryId::new(6);     // NEW: Dynamic rewards storage

// ADDED (line 111-112):
// NEW: Dynamic arrays for configurable tokenomics
pub static DYNAMIC_THRESHOLDS: RefCell<Vec<u64>> = RefCell::new(Vec::new());
pub static DYNAMIC_REWARDS: RefCell<Vec<u64>> = RefCell::new(Vec::new());
```

#### DYN-003: Added Helper Functions for Dynamic Arrays (LOW RISK)
- **File**: src/storage.rs
- **Change**: Added getter/setter functions for dynamic arrays with fallback to hardcoded values
- **Timestamp**: 2025-01-01
- **Security Impact**: None - includes safe fallback mechanism
- **Test Status**: Pending

**Code Added (line 170-201):**
```rust
// NEW: Helper functions for dynamic arrays
pub fn get_thresholds() -> Vec<u64> {
    DYNAMIC_THRESHOLDS.with(|t| {
        let thresholds = t.borrow();
        if thresholds.is_empty() {
            // Fallback to hardcoded values if not initialized
            SECONDARY_THRESHOLDS.to_vec()
        } else {
            thresholds.clone()
        }
    })
}

pub fn get_rewards() -> Vec<u64> {
    DYNAMIC_REWARDS.with(|r| {
        let rewards = r.borrow();
        if rewards.is_empty() {
            // Fallback to hardcoded values if not initialized
            PRIMARY_PER_THRESHOLD.to_vec()
        } else {
            rewards.clone()
        }
    })
}

pub fn set_thresholds(thresholds: Vec<u64>) {
    DYNAMIC_THRESHOLDS.with(|t| *t.borrow_mut() = thresholds);
}

pub fn set_rewards(rewards: Vec<u64>) {
    DYNAMIC_REWARDS.with(|r| *r.borrow_mut() = rewards);
}
```

#### DYN-004: Updated Init Function (MEDIUM RISK)
- **File**: src/lib.rs
- **Change**: Store dynamic arrays during initialization
- **Timestamp**: 2025-01-01
- **Security Impact**: Requires proper validation of input arrays
- **Test Status**: Pending

**Code Change:**
```rust
// ADDED (line 49-51):
// Store dynamic arrays for configurable tokenomics
set_thresholds(args.secondary_thresholds);
set_rewards(args.primary_rewards);
```

#### DYN-005: Replaced Hardcoded Array Access in Queries (LOW RISK)
- **File**: src/queries.rs
- **Change**: Replaced direct array access with dynamic getters
- **Timestamp**: 2025-01-01
- **Security Impact**: None - read-only operations
- **Test Status**: Pending

**Code Changes:**
```rust
// 1. Updated imports (line 4):
get_thresholds, get_rewards,  // Use dynamic getters instead of constants

// 2. get_current_primary_rate function (line 100-105):
// BEFORE:
PRIMARY_PER_THRESHOLD[current_threshold as usize]
// AFTER:
let rewards = get_rewards();
rewards[current_threshold as usize]

// 3. get_current_secondary_threshold function (line 107-112):
// BEFORE:
SECONDARY_THRESHOLDS[current_threshold as usize]
// AFTER:
let thresholds = get_thresholds();
thresholds[current_threshold as usize]

// 4. get_max_stats function (line 114-119):
// BEFORE:
let max_threshold = SECONDARY_THRESHOLDS[SECONDARY_THRESHOLDS.len() - 1];
// AFTER:
let thresholds = get_thresholds();
let max_threshold = thresholds[thresholds.len() - 1];

// 5. get_tokenomics_schedule function (line 158-163):
// BEFORE:
thresholds: SECONDARY_THRESHOLDS.to_vec(),
rewards: PRIMARY_PER_THRESHOLD.to_vec(),
// AFTER:
thresholds: get_thresholds(),
rewards: get_rewards(),
```

#### DYN-006: Replaced Hardcoded Array Access in Update (HIGH RISK)
- **File**: src/update.rs
- **Change**: Replaced all hardcoded threshold and reward array accesses with dynamic getters
- **Timestamp**: 2025-01-01
- **Security Impact**: Critical path - affects minting calculations
- **Test Status**: Pending

**Major Code Changes:**
```rust
// 1. Max threshold check (line 51-54):
// BEFORE:
})? > SECONDARY_THRESHOLDS[SECONDARY_THRESHOLDS.len() - 1]
// AFTER:
})? > {
    let thresholds = get_thresholds();
    thresholds[thresholds.len() - 1]
}

// 2. Threshold comparison and processing (line 79-87):
// BEFORE:
if tentative_total > SECONDARY_THRESHOLDS[current_threshold_index as usize] {
    // ... multiple SECONDARY_THRESHOLDS accesses
// AFTER:
let thresholds = get_thresholds();
if tentative_total > thresholds[current_threshold_index as usize] {
    // ... all accesses use thresholds variable

// 3. Rewards calculation in multiple locations:
// BEFORE (line 105):
let mut slot_mint = PRIMARY_PER_THRESHOLD[current_threshold_index as usize].checked_mul(
// AFTER (line 105-106):
let rewards = get_rewards();
let mut slot_mint = rewards[current_threshold_index as usize].checked_mul(

// Similar changes at lines 205, 264-265
```

#### DYN-007: Updated Candid Interface (LOW RISK)
- **File**: tokenomics.did
- **Change**: Updated InitArgs type to include dynamic arrays
- **Timestamp**: 2025-01-01
- **Security Impact**: None - interface definition only
- **Test Status**: Pending

**Code Change:**
```candid
// BEFORE (line 25-28):
type InitArgs = record {
  secondary_token_ledger : principal;
  primary_token_ledger : principal;
};

// AFTER (line 25-30):
type InitArgs = record {
  secondary_token_ledger : principal;
  primary_token_ledger : principal;
  secondary_thresholds : vec nat64;
  primary_rewards : vec nat64;
};
```

### Summary of Dynamic Configuration Changes
- **Total Changes**: 7
- **Risk Distribution**:
  - LOW: 4 (storage, helpers, interface, queries)
  - MEDIUM: 2 (InitArgs, init function)
  - HIGH: 1 (update.rs minting logic)
- **Preserved Logic**: All core minting calculations remain unchanged
- **Fallback Mechanism**: Gracefully falls back to hardcoded values if arrays not provided
- **Array Format**: Maintains exact format as hardcoded arrays (natural units for thresholds, 4-decimal for rewards)

### Important Notes
1. The 3x multiplier in mint_primary is preserved (line 331-344 in update.rs)
2. The 10,000 decimal conversion is preserved throughout
3. All audited economic logic remains intact - only the source of threshold/reward values changed
4. The hardcoded arrays remain in storage.rs as fallback values

