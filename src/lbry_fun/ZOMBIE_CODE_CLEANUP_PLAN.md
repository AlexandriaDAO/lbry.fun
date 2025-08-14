# Zombie Code Cleanup Plan for lbry_fun Canister

## Overview
This document identifies potentially unused functions, types, and modules in the lbry_fun canister. Since the project is not launched yet and backwards compatibility is not a concern, we can remove all unused code.

## Categorization Levels
- **HIGH CONFIDENCE**: Definitely unused, safe to remove
- **MEDIUM CONFIDENCE**: Likely unused, should verify
- **LOW CONFIDENCE**: May be used indirectly, needs careful review

---

## HIGH CONFIDENCE - Definitely Unused

### 1. preview_canister.rs (Entire Module)
**What it does**: Creates temporary tokenomics canisters for preview/simulation
**Why unused**: 
- Only exported function `preview_tokenomics_with_real_canister` is never called
- Uses actual canister creation/deletion for previews (expensive and unnecessary)
- We have `tokenomics_simple.rs` that does simulation without canisters
**Files to remove**: `src/preview_canister.rs`

### 2. cleanup.rs Module (Not Found/Empty)
**What it does**: Module is declared in lib.rs but file doesn't exist
**Why unused**: File missing, module declaration orphaned
**Action**: Remove `mod cleanup;` from lib.rs:17

### 3. script.rs Module (Not Found)
**What it does**: Referenced in comments but file doesn't exist
**Why unused**: File missing, only mentioned in preview_canister.rs comment
**Action**: Remove any references

### 4. Migration Functions
**Functions**:
- `migrate_v9_deployments()` in deployment_cleanup.rs:282-304
**What it does**: Migrates old V9 deployment format to V10
**Why unused**: Project not launched, no old deployments exist
**Action**: Remove function

### 5. Admin Recovery Functions (Temporary Fixes)
**Functions**:
- `fix_stuck_token()` in update.rs:683-702
**What it does**: Quick fix to remove stuck tokens with failed pool creation
**Why unused**: Temporary admin function for development, not needed for production
**Action**: Remove function

### 6. Treasury Processing Functions
**Functions**:
- `_process_fee_treasury()` in update.rs:595-669
**What it does**: Swaps excess ICP for SECONDARY token and burns it
**Why unused**: 
- References non-existent SECONDARY_SWAP_CANISTER_ID
- Called in init/post_upgrade but appears to be old mechanism
- Collection mechanism in collection.rs handles fees differently
**Action**: Remove function and timer setup in init/post_upgrade

### 7. Unused Types in preview_canister.rs
**Types**:
- `TokenomicsSchedule` (duplicate definition, different from simulation_new.rs)
- `Configs`
**Why unused**: Only used in the unused preview_canister module
**Action**: Remove with module

### 8. Unused Imports
**Files with unused imports**:
- lib.rs: `cleanup` module
- lib.rs: `script` module reference
- Multiple files: `Deserialize` from serde (CandidType handles serialization)

---

## MEDIUM CONFIDENCE - Likely Unused

### 9. Old Token Creation Function
**Function**: `create_token()` in update.rs:31-78
**What it does**: Old single-phase token creation (wraps the new two-phase system)
**Why unused**: 
- New two-phase deployment system (initiate/execute) is the proper way
- This is a wrapper for backwards compatibility
**Action**: Consider removing if frontend uses two-phase directly

### 10. Reconciliation Types (Partial Usage)
**Types in collection.rs**:
- `ReconciliationStatus` (lines 89-103)
- `ReconciliationDetail` (lines 106-112)
- `AuditState` (lines 20-27)
- `AuditAlerts` (lines 122-129)
**What they do**: Complex reconciliation and audit tracking
**Why possibly unused**:
- `ReconciliationStatus` mirrors a type from icp_swap but no actual cross-canister calls use it
- Audit system seems partially implemented
**Action**: Verify if reconciliation is actually working

### 11. Token Registry in collection.rs
**Type**: `TOKEN_REGISTRY` thread_local (line 133)
**Related types**: `TokenCollectionInfo`
**What it does**: Tracks collection info per token
**Why possibly unused**: 
- Parallel system to TOKENS storage
- Not initialized anywhere (no tokens added to registry)
**Action**: Verify if actually populated and used

### 12. Swap and Burn Functions
**Functions**:
- `execute_swap_and_burn()` in collection.rs:401-407
**What it does**: Placeholder for swapping ICP to LBRY and burning
**Why unused**: Just returns "Swap and burn executed" - not implemented
**Action**: Remove or implement properly

### 13. Pool Creation Retry
**Function**: `retry_pool_creation()` in update.rs:385-467
**What it does**: Allows retrying failed pool creation
**Why possibly unused**: 
- New deployment system handles pool creation differently
- May not be needed with improved deployment flow
**Action**: Verify if still needed with new deployment system

---

## LOW CONFIDENCE - Needs Careful Review

### 14. Collection System Functions
**Functions in collection.rs**:
- Various query functions for reconciliation
- `get_problematic_tokens()`
- Individual token reconciliation queries
**What they do**: Monitor token health and collection status
**Why uncertain**: May be important for monitoring but seems incomplete
**Action**: Review if monitoring is required

### 15. Admin Functions in deployment_cleanup.rs
**Functions**:
- `get_stuck_deployments()` (163-185)
- `admin_force_cleanup()` (188-230)
- `admin_retry_failed_refunds()` (233-268)
**What they do**: Admin tools for handling failed deployments
**Why uncertain**: Might be useful during testing/launch
**Action**: Consider keeping for initial launch period

### 16. Unused Constants
**Constants**:
- `SECONDARY_SWAP_CANISTER_ID` in update.rs:29
- `MINIMUM_TREASURY_RESERVE` in update.rs:30
- Various timeout/threshold constants in collection.rs
**Why uncertain**: Related to unused functions but might be planned features
**Action**: Remove with associated functions

---

## Duplicate/Redundant Definitions

### 17. TokenomicsSchedule
**Locations**:
- simulation_new.rs:4-8
- preview_canister.rs:13-17
**Issue**: Two different definitions of the same type
**Action**: Remove preview_canister.rs version

### 18. Multiple E8S Constants
**Locations**:
- tokenomics_simple.rs:4
- update.rs (via utlis.rs import)
- preview_canister.rs:6
**Action**: Consolidate to single definition

---

## Recommended Cleanup Order

1. **Phase 1 - Safe Removals** (HIGH CONFIDENCE)
   - Remove preview_canister.rs entirely
   - Remove cleanup.rs module declaration
   - Remove migration functions
   - Remove fix_stuck_token
   - Remove _process_fee_treasury and its timer setup

2. **Phase 2 - System Simplification** (MEDIUM CONFIDENCE)
   - Evaluate and remove old create_token if not used
   - Remove incomplete reconciliation system if not needed
   - Clean up TOKEN_REGISTRY if unused
   - Remove placeholder swap_and_burn

3. **Phase 3 - Final Cleanup** (After Testing)
   - Remove unused admin functions if not needed
   - Consolidate duplicate type definitions
   - Remove all unused imports and constants

---

## Files to Review for Complete Removal

1. **preview_canister.rs** - Entire file can be removed
2. **deployment_cleanup/deployment_cleanup_plan_v10.md** - Old documentation
3. **GEMINI.md** - Appears to be for a different AI assistant

---

## Impact Analysis

Removing this code will:
- Reduce canister size significantly (important for IC)
- Improve code clarity and maintainability
- Remove confusion about which functions to use
- Eliminate potential bugs from unmaintained code paths

## Next Steps

1. Review this plan together
2. Confirm which systems are actually being used
3. Start with Phase 1 removals (safest)
4. Test after each phase
5. Document any functions we decide to keep