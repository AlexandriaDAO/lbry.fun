# ICP_SWAP Change Log Security Audit

## Overview
This audit reviews the changes made to the ICP_SWAP canister for security vulnerabilities and exploitable issues introduced by each modification.

## Audit Date: 2025-07-09

## Changes SWAP-001 to SWAP-010: Token Renaming (Interface and Storage)

### Summary
These changes rename token references from ALEX/LBRY to primary/secondary throughout the canister interface and storage layer.

### Security Assessment: LOW RISK (No exploitable vulnerabilities identified)

### Deep Security Analysis:

#### 1. Memory Layout Preservation
**Analysis**: SWAP-008 and SWAP-009 rename storage constants but must preserve the underlying `MemoryId` values. If these were accidentally changed, it could lead to:
- Reading wrong data from stable memory after upgrade
- Type confusion if different data structures share memory IDs
- Potential data corruption

**Verification**: The code shows `SECONDARY_RATIO_MEM_ID` preserves the same memory ID, preventing memory layout attacks.

#### 2. Static Storage Thread Safety
**Analysis**: SWAP-009 changes `pub static LBRY_RATIO: RefCell<StableBTreeMap<(), LbryRatio, Memory>>` to use `SecondaryRatio`. The `RefCell` pattern in IC is single-threaded but:
- Could theoretically have race conditions if timer callbacks overlap
- BTreeMap with unit key `()` means single global value - no key collision possible

**Conclusion**: No race condition vulnerability as IC runtime guarantees single-threaded execution within a canister.

#### 3. Fee Manipulation via Storage
**Analysis**: SWAP-010 renames `ALEX_FEE` to `PRIMARY_FEE`. This appears to store fee amounts:
- If this fee is user-controllable through any update function, renaming alone doesn't add vulnerabilities
- If fee calculation has integer overflow/underflow issues, the rename doesn't change that

**Risk**: None from renaming, but worth verifying fee update authorization logic.

#### 4. Type Structure Integrity
**Analysis**: SWAP-012 renames `LbryRatio` struct. The Storable implementation (SWAP-014) must maintain exact same serialization format:
- Any change in field order or types would corrupt existing data
- Borsh serialization is deterministic, so rename alone is safe

**Conclusion**: Safe as long as struct fields remain identical.

### Subtle Exploitation Vectors Considered:

1. **Partial State Corruption**: If upgrade process reads old type name from stable memory but writes new type name, could cause deserialization failures. However, Storable trait handles this correctly.

2. **Import Path Confusion**: SWAP-007 changes import paths. If old and new types coexist temporarily, wrong type could be used. Compilation prevents this.

3. **Default Value Changes**: SWAP-013 updates default initialization to use `DEFAULT_SECONDARY_RATIO`. If this constant's value differs from `DEFAULT_LBRY_RATIO`, behavior changes. Need to verify values match.

### Recommendations:
1. Verify `DEFAULT_SECONDARY_RATIO` === `DEFAULT_LBRY_RATIO` value
2. Ensure no timer-based operations can execute during upgrade that might see inconsistent state
3. Add assertions in post_upgrade to verify critical storage values maintained correctly

### Pattern Analysis: Intentional Design, Not a Bug

#### Memory Access Pattern via Getters
**Assessment**: CORRECT IMPLEMENTATION  
**Location**: Lines 84-88 in storage.rs  
**Description**: The `get_secondary_ratio_mem()` function creates a new `StableBTreeMap` accessor each time it's called. This is an intentional design pattern, not an inefficiency.

**Why This Pattern is Necessary**: 
- **Post-Upgrade Safety**: After canister upgrades, Rust static variables are reset. The getter ensures proper re-initialization to stable memory
- **Memory Manager Coordination**: Always consults the memory manager for current memory state
- **Mutation Support**: Allows code to get a "new" map and mutate it, which works because `StableBTreeMap::init` connects to existing stable storage
- **Initialization Guarantee**: Handles both existing data and new initialization cases safely

**Security Implications**: NONE
- The pattern actually prevents potential post-upgrade failures
- Ensures consistent access to stable memory
- No data loss or corruption possible

### Conclusion:
The first 10 changes (SWAP-001 to SWAP-010) contain no security vulnerabilities. The renaming is implemented correctly with proper memory layout preservation. The getter function pattern is an intentional safety mechanism that should be preserved.

## Changes SWAP-011 to SWAP-020: Continued Token Renaming

### Summary
These 10 changes continue the token renaming from ALEX/LBRY to primary/secondary, focusing on storage functions, utility functions, and constants.

### Security Assessment: NO VULNERABILITIES FOUND

### Analysis Results:

All changes in SWAP-011 to SWAP-020 are simple renaming operations that do not introduce any security vulnerabilities. The changes maintain:
- Same memory layouts (MemoryId values unchanged)
- Same data structures (SecondaryRatio has identical fields)
- Same function behaviors (only names changed)
- Same security properties as before

### Items Reviewed and Dismissed:

1. **Hardcoded Canister IDs**: Not a vulnerability. The deployment process correctly overrides these via CONFIGS.
2. **`.expect()` on Principal parsing**: Could cause panic but not exploitable for attacks. This is a code quality issue, not a security vulnerability.
3. **`update_current_secondary_ratio` access**: Only callable via timer using XRC oracle data. Not user-accessible.

### Conclusion:
SWAP-011 to SWAP-020 contain no security vulnerabilities or exploitable issues.

## Changes SWAP-021 to SWAP-030: Utility Function Renaming

### Summary
These 10 changes continue the systematic token renaming from ALEX/LBRY to primary/secondary, focusing on utility functions in src/utils.rs and src/queries.rs.

### Security Assessment: NO VULNERABILITIES FOUND

### Detailed Analysis:

#### Changes Reviewed:
- **SWAP-021**: Rename `tokenomics_burn_LBRY_stats()` → `tokenomics_burn_secondary_stats()` (function later removed in SWAP-115)
- **SWAP-022**: Rename `update_current_LBRY_ratio()` → `update_current_secondary_ratio()`
- **SWAP-023**: Update comment from "LBRY ratio" to "secondary ratio"
- **SWAP-024**: Rename variable `lbry_ratio` → `secondary_ratio`
- **SWAP-025**: Rename `update_ALEX_fee()` → `update_primary_fee()`
- **SWAP-026**: Update storage reference `ALEX_FEE.with()` → `PRIMARY_FEE.with()`
- **SWAP-027**: Rename `get_total_alex_staked()` → `get_total_primary_staked()`
- **SWAP-028**: Update variable `alex_canister_id` → `primary_canister_id`
- **SWAP-029**: Update error string from "ALEX" to "PRIMARY"
- **SWAP-030**: Rename `get_alex_fee()` → `get_primary_fee()`

### Security Considerations:

#### 1. ICP Upgrade Safety
The Internet Computer's upgrade model ensures these renames are safe:
- Upgrades are atomic (all-or-nothing)
- Canister is stopped during upgrade (no concurrent execution)
- Timers are cancelled and must be explicitly restarted
- No partial states or race conditions possible

#### 2. Storage Access Patterns
Functions like `update_current_secondary_ratio()` (SWAP-022) and `update_primary_fee()` (SWAP-025) maintain identical storage access patterns:
- Same underlying memory IDs
- Same data structures
- Same access methods through RefCell

#### 3. Cross-Canister Calls
Functions making cross-canister calls (SWAP-027, SWAP-030) are renamed but functionality unchanged:
- Still use the same canister IDs (hardcoded at this point, fixed later)
- Same call patterns and error handling
- No new failure modes introduced

#### 4. Compiler Enforcement
Rust's type system ensures all renamed functions are updated at all call sites, preventing any mismatch issues.

### Notable Observations:

1. **Dead Code**: SWAP-021 renames a function marked `//remove` that was later deleted in SWAP-115. No security impact.

2. **Timer-Called Functions**: While `update_current_secondary_ratio()` is called by timers, the ICP ensures timers don't execute during upgrades, eliminating any upgrade-related vulnerabilities.

3. **Error Messages**: String literals updated for consistency (SWAP-029), improving debugging without affecting security.

### Verification Performed:
- ✓ All function signatures remain identical (only names changed)
- ✓ Storage access patterns unchanged
- ✓ No new external dependencies introduced
- ✓ No logic modifications
- ✓ Type safety maintained by Rust compiler

### Conclusion:
SWAP-021 to SWAP-030 are purely cosmetic renaming changes that maintain identical functionality and security properties. The Internet Computer's robust upgrade model prevents any timing-related vulnerabilities. These changes improve code consistency without introducing any security risks.

## Changes SWAP-031 to SWAP-040: Query Functions and Initialization Renaming

### Summary
These 10 changes continue token renaming in query functions (src/queries.rs) and initialization code (src/script.rs), plus two minor bug fixes.

### Security Assessment: NO VULNERABILITIES FOUND

### Detailed Analysis:

#### Changes Reviewed:
- **SWAP-031**: Update import `DEFAULT_LBRY_RATIO` → `DEFAULT_SECONDARY_RATIO` in queries.rs
- **SWAP-032**: Add % symbol to staking percentage display (bug fix)
- **SWAP-033**: Rename `get_current_LBRY_ratio()` → `get_current_secondary_ratio()`
- **SWAP-034**: Update variable `lbry_ratio_map` → `secondary_ratio_map`
- **SWAP-035**: Update variable in pattern match `lbry_ratio` → `secondary_ratio`
- **SWAP-036**: Update default return value to use `DEFAULT_SECONDARY_RATIO`
- **SWAP-037**: Fix typo in comment: "defult" → "default"
- **SWAP-038**: Update import `LbryRatio` → `SecondaryRatio` in script.rs
- **SWAP-039**: Update import `LBRY_RATIO` → `SECONDARY_RATIO` in script.rs
- **SWAP-040**: Update InitArgs field `lbry_ratio` → `secondary_ratio`

### Security Analysis:

#### 1. Query Function Safety (SWAP-031 to SWAP-037)
All changes in queries.rs affect read-only query functions:
- Cannot modify canister state
- Cannot perform transfers or burns
- Safe default fallback behavior preserved
- No attack surface exposed

#### 2. Display String Fix (SWAP-032)
Adding % symbol to staking percentage display:
- Pure cosmetic change
- Improves user interface clarity
- No computation or logic affected

#### 3. Initialization Parameter Renaming (SWAP-038 to SWAP-040)
Changes to InitArgs struct in script.rs:
- Only affects fresh canister initialization (not upgrades)
- Field rename maintains same type and semantics
- No change to initialization logic
- Compiler ensures all references updated

#### 4. Default Value Behavior (SWAP-036)
The function returns `DEFAULT_SECONDARY_RATIO` when no value is found:
- This is a safety mechanism, not a vulnerability
- Ensures predictable behavior
- Same default value as before rename

### Key Observations:

1. **Read-Only Operations**: Most changes affect query functions which are inherently safe
2. **Type Safety**: Rust compiler ensures renamed types are used consistently
3. **No Logic Changes**: All changes are naming updates, no behavioral modifications
4. **Bug Fixes**: SWAP-032 and SWAP-037 fix minor display/documentation issues

### Verification Checklist:
- ✓ No state-modifying operations affected
- ✓ Query functions remain read-only
- ✓ InitArgs changes only affect new deployments
- ✓ Default values preserved
- ✓ No cross-canister calls modified

### Initial Assessment:
The renaming changes themselves (SWAP-031 to SWAP-040) do not introduce vulnerabilities. However, our analysis revealed a pre-existing critical vulnerability that becomes apparent when examining these changes.

### Critical Vulnerability Discovered: Default Rate Exploitation

#### Vulnerability Details:
**Severity**: HIGH  
**Location**: `get_current_secondary_ratio()` function (SWAP-033-036)  
**Root Cause**: Conflation of "price floor" with "no data fallback"

#### The Problem:
The system uses `DEFAULT_SECONDARY_RATIO = 400` ($4.00) for two distinct purposes:
1. As a minimum price floor when ICP trades below $4.00
2. As a fallback value when no exchange rate has been set

This creates a critical vulnerability window:
- New canisters start with no ratio stored
- Until XRC oracle provides the first rate (up to 24 hours)
- All swaps use the $4.00 fallback rate
- If ICP is actually worth $10+, users get tokens at 40% of intended price

#### Attack Scenario:
1. New token launches when ICP trades at $10
2. Attacker immediately calls swap before XRC update
3. Buys tokens at $4.00 rate instead of $10.00 rate
4. 60% discount exploitation window

#### Why Original Audit Missed This:
- Original Alexandria project was a single trusted deployment
- This fork is a launchpad where multiple tokens are launched
- The trust model changed but the initialization logic didn't adapt

### Conclusion:
While SWAP-031 to SWAP-040 are simple renames, they exposed a critical pre-existing vulnerability where new tokens can be purchased at incorrect rates before the XRC oracle initializes the exchange rate.