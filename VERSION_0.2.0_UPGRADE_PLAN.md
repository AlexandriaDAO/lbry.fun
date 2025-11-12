# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/lbryfun" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/lbryfun-version-upgrade"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/lbryfun-version-upgrade`
2. **Implement feature** - Follow plan sections below
3. **Build locally** (verification only - NEVER DEPLOY TO MAINNET):
   ```bash
   ./scripts/build.sh
   ```
   **⚠️ PRODUCTION WARNING**: This is a live financial application. Never deploy to mainnet.
4. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "Upgrade to version 0.2.0 with backup controller support"
   git push -u origin feature/version-0.2.0-with-controller
   gh pr create --title "[Version] Upgrade to 0.2.0 with Backup Controller" --body "Implements VERSION_0.2.0_UPGRADE_PLAN.md"
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

**Branch:** `feature/version-0.2.0-with-controller`
**Worktree:** `/home/theseus/alexandria/lbryfun-version-upgrade`

---

# Implementation Plan: Version 0.2.0 Upgrade with Backup Controller

## Overview

This plan upgrades the lbryfun platform from version 0.1.0 to 0.2.0 and adds a backup controller to all spawned canisters for emergency access.

**Task Type:** NEW FEATURE (adding controller functionality) + version bump

## Current State

### Version 0.1.0 Usage

**Version Constant:**
- Location: `src/lbry_fun/src/constants.rs:2`
- Current value: `pub const CODEBASE_VERSION: &str = "0.1.0";`

**Version Storage:**
- Field: `codebase_version: String` in `TokenRecord` struct (`src/lbry_fun/src/storage.rs:61`)
- Set at: `src/lbry_fun/src/deployment_execution.rs:243`
- Usage: Tracks which version of code was used to deploy each token

**Package Versions (all at 0.1.0):**
- `src/lbry_fun/Cargo.toml:3`
- `src/tokenomics/Cargo.toml` (line 3)
- `src/icp_swap/Cargo.toml` (line 3)
- `src/logs/Cargo.toml` (line 3)
- `src/bot1/Cargo.toml` (line 3)
- `src/xrc/Cargo.toml` (line 3)

### Current Canister Creation (No Controller Set)

**Token Canisters (ICRC1):**
- Function: `create_icrc1_canister()` in `src/lbry_fun/src/update.rs:79-158`
- Line 89: `let create_args = CreateCanisterArgument { settings: None };`
- Issue: No explicit controller set, defaults to creating canister (lbry_fun) only

**Other Canisters:**
- Function: `create_a_canister()` in `src/lbry_fun/src/update.rs:160-168`
- Used for: tokenomics, icp_swap, logs canisters
- Called from: `src/lbry_fun/src/deployment_execution.rs:93-105`
- Issue: Same problem - no controller configuration

### Backup Controller Principal
```
yog5q-6fxnl-g4zd4-s2nuh-f7fkw-ijb4e-z7dmo-jrarx-uoe2x-wx5sh-dae
```

This emergency access controller will be added to all spawned canisters.

## File Tree Changes

### Modified Files (8 files)
```
src/lbry_fun/
├── src/
│   ├── constants.rs          [MODIFY] - Update CODEBASE_VERSION
│   ├── update.rs             [MODIFY] - Add controller to canister creation
│   └── deployment_execution.rs [MODIFY] - Uses updated functions
└── Cargo.toml                 [MODIFY] - Update package version

src/tokenomics/Cargo.toml      [MODIFY] - Update package version
src/icp_swap/Cargo.toml        [MODIFY] - Update package version
src/logs/Cargo.toml            [MODIFY] - Update package version
src/bot1/Cargo.toml            [MODIFY] - Update package version (consistency)
```

No new files created. This is a focused upgrade modifying existing infrastructure.

## Implementation

### 1. Update Version Constant

**File:** `src/lbry_fun/src/constants.rs`

```rust
// PSEUDOCODE
// Line 2: Update version constant
pub const CODEBASE_VERSION: &str = "0.2.0";

// Line 4-8: Keep existing constants unchanged
pub const LBRY_FUN_CANISTER_ID: &str = "oni4e-oyaaa-aaaap-qp2pq-cai";
pub const KONG_BACKEND_CANISTER_ID: &str = "2ipq2-uqaaa-aaaar-qailq-cai";
pub const ICP_LEDGER_CANISTER_ID: &str = "ryjl3-tyaaa-aaaaa-aaaba-cai";
pub const ALEX_REVSHARE_CANISTER_ID: &str = "e454q-riaaa-aaaap-qqcyq-cai";

// Add new constant for backup controller
pub const BACKUP_CONTROLLER: &str = "yog5q-6fxnl-g4zd4-s2nuh-f7fkw-ijb4e-z7dmo-jrarx-uoe2x-wx5sh-dae";
```

### 2. Add Controller to ICRC1 Token Creation

**File:** `src/lbry_fun/src/update.rs`

**Import additions (around line 3-7):**
```rust
// PSEUDOCODE
use ic_cdk::{
    api::management_canister::main::{
        canister_status, create_canister, install_code,
        CanisterInstallMode, CreateCanisterArgument,
        InstallCodeArgument, CanisterIdRecord,
        CanisterSettings,  // ADD THIS IMPORT
    },
    update,
};
```

**Import backup controller constant (around line 17-24):**
```rust
// PSEUDOCODE
use crate::{
    get_principal, get_self_icp_balance, AddPoolArgs, AddPoolReply, AddPoolResult, AddTokenArgs,
    AddTokenReply, AddTokenResponse, AddTokenResult, ApproveArgs, ApproveResult, ArchiveOptions,
    FeatureFlags, IcpSwapInitArgs, InitArgs, LedgerArg, LogsInitArgs, MetadataValue, TokenDetail,
    TokenInfo, TokenomicsCanisterInitArgs, TxId, CHAIN_ID, E8S, ICP_CANISTER_ID, ICP_TRANSFER_FEE,
    KONG_BACKEND_CANISTER, TOKENS,
    CreateTokenParams, initiate_token_deployment, execute_token_deployment,
    BACKUP_CONTROLLER,  // ADD THIS IMPORT
};
```

**Function: `create_icrc1_canister` (lines 79-158):**
```rust
// PSEUDOCODE
pub async fn create_icrc1_canister(
    token_symbol: String,
    token_name: String,
    token_description: String,
    minting_account_owner: Principal,
    archive_controller: Principal,
    intital_amount: u64,
    logo: String,
    cycles: u128,
) -> Result<String, String> {

    // Parse backup controller principal
    let backup_controller = Principal::from_text(BACKUP_CONTROLLER)
        .map_err(|e| format!("Failed to parse backup controller: {:?}", e))?;

    // Get self (lbry_fun canister) as primary controller
    let self_principal = ic_cdk::api::id();

    // Create canister with TWO controllers: self + backup
    let settings = Some(CanisterSettings {
        controllers: Some(vec![self_principal, backup_controller]),
        compute_allocation: None,
        memory_allocation: None,
        freezing_threshold: None,
        reserved_cycles_limit: None,
    });

    let create_args = CreateCanisterArgument { settings };

    let canister_id_record = create_canister(create_args, cycles)
        .await
        .map_err(|e| format!("Failed to create canister: {:?}", e))?;

    let canister_id = canister_id_record.0.canister_id;

    // Rest of function remains unchanged (WASM installation, init args, etc.)
    let wasm_bytes = include_bytes!("ic-icrc1-ledger.wasm");

    let minter_account = Account {
        owner: minting_account_owner,
        subaccount: None,
    };

    let canister_account = Account {
        owner: ic_cdk::api::id(),
        subaccount: None,
    };

    let init_args = InitArgs {
        // ... existing init args unchanged ...
    };

    let encoded_args = Encode!(&LedgerArg::Init(init_args))
        .map_err(|e| format!("Failed to encode init args: {:?}", e))?;

    let install_args = InstallCodeArgument {
        mode: CanisterInstallMode::Install,
        canister_id,
        wasm_module: wasm_bytes.to_vec(),
        arg: encoded_args,
    };

    install_code(install_args)
        .await
        .map_err(|e| format!("Failed to install ICRC-1 token: {:?}", e))?;

    Ok(canister_id.to_string())
}
```

### 3. Add Controller to Generic Canister Creation

**File:** `src/lbry_fun/src/update.rs`

**Function: `create_a_canister` (lines 160-168):**
```rust
// PSEUDOCODE
pub async fn create_a_canister(cycles: u128) -> Result<Principal, String> {

    // Parse backup controller principal
    let backup_controller = Principal::from_text(BACKUP_CONTROLLER)
        .map_err(|e| format!("Failed to parse backup controller: {:?}", e))?;

    // Get self (lbry_fun canister) as primary controller
    let self_principal = ic_cdk::api::id();

    // Create canister with TWO controllers: self + backup
    let settings = Some(CanisterSettings {
        controllers: Some(vec![self_principal, backup_controller]),
        compute_allocation: None,
        memory_allocation: None,
        freezing_threshold: None,
        reserved_cycles_limit: None,
    });

    let create_args = CreateCanisterArgument { settings };

    let canister_id_record = create_canister(create_args, cycles)
        .await
        .map_err(|e| format!("Failed to create canister: {:?}", e))?;

    let canister_id = canister_id_record.0.canister_id;
    Ok(canister_id)
}
```

### 4. Update Package Versions

**File:** `src/lbry_fun/Cargo.toml`
```toml
# PSEUDOCODE
[package]
name = "lbry_fun"
version = "0.2.0"  # UPDATE FROM 0.1.0
edition = "2021"

# ... rest unchanged ...
```

**File:** `src/tokenomics/Cargo.toml`
```toml
# PSEUDOCODE
[package]
name = "tokenomics"
version = "0.2.0"  # UPDATE FROM 0.1.0
edition = "2021"

# ... rest unchanged ...
```

**File:** `src/icp_swap/Cargo.toml`
```toml
# PSEUDOCODE
[package]
name = "icp_swap"
version = "0.2.0"  # UPDATE FROM 0.1.0
edition = "2021"

# ... rest unchanged ...
```

**File:** `src/logs/Cargo.toml`
```toml
# PSEUDOCODE
[package]
name = "logs"
version = "0.2.0"  # UPDATE FROM 0.1.0
edition = "2021"

# ... rest unchanged ...
```

**File:** `src/bot1/Cargo.toml`
```toml
# PSEUDOCODE
[package]
name = "bot1"
version = "0.2.0"  # UPDATE FROM 0.1.0
edition = "2021"

# ... rest unchanged ...
```

## Verification Points

### After Implementation

1. **Version constant updated:**
   ```bash
   grep "CODEBASE_VERSION" src/lbry_fun/src/constants.rs
   # Should show: pub const CODEBASE_VERSION: &str = "0.2.0";
   ```

2. **Backup controller constant added:**
   ```bash
   grep "BACKUP_CONTROLLER" src/lbry_fun/src/constants.rs
   # Should show the new constant
   ```

3. **Controller settings in canister creation:**
   ```bash
   grep -A5 "CanisterSettings" src/lbry_fun/src/update.rs
   # Should show controllers array with self + backup
   ```

4. **Package versions updated:**
   ```bash
   grep "^version" src/*/Cargo.toml
   # All should show version = "0.2.0"
   ```

## Testing

### Local Build Verification

```bash
# Build all canisters locally to verify compilation
./scripts/build.sh
```

**Expected Output:**
- All Rust canisters compile successfully
- No type errors related to CanisterSettings
- WASM files generated for all canisters

**⚠️ CRITICAL:** This is a production financial application. Do NOT deploy to mainnet. Only verify local compilation.

### Manual Verification (Optional - Local Only)

If testing locally with dfx:
1. Create test token
2. Check canister controllers:
   ```bash
   dfx canister info [canister-id]
   ```
3. Verify two controllers listed:
   - lbry_fun canister principal
   - yog5q-6fxnl-g4zd4-s2nuh-f7fkw-ijb4e-z7dmo-jrarx-uoe2x-wx5sh-dae

## Impact Analysis

### What Changes
- ✅ All new tokens will have backup controller
- ✅ Version tracked as 0.2.0 in TokenRecord
- ✅ Emergency access possible for stuck/broken tokens

### What Stays the Same
- ✅ Existing tokens (0.1.0) unchanged - no migration needed
- ✅ Token creation flow identical (transparent to users)
- ✅ No breaking changes to APIs or data structures
- ✅ Deployment process unchanged

### Backward Compatibility
- **Fully compatible:** Old tokens (0.1.0) continue working
- **Version tracking:** Frontend can display version per token
- **No migration required:** This is additive, not breaking

## Rollback Plan

If issues arise:
1. Revert constants.rs to version 0.1.0
2. Remove CanisterSettings from create functions
3. Revert Cargo.toml versions
4. Rebuild and redeploy

Simple rollback - just reverse the changes.

## Security Considerations

### Backup Controller Access

**What the backup controller CAN do:**
- Access stuck canisters in emergency
- Upgrade canisters if bugs found
- Stop/start canisters for maintenance

**What the backup controller SHOULD NOT do:**
- Interfere with normal operations
- Modify user funds without authorization
- Take control from primary controller

**Best Practice:**
- Keep backup controller keys in secure cold storage
- Only use for genuine emergencies
- Document all uses of backup controller
- Consider multi-sig for backup controller in future

### Pre-launch Security
Since the platform is still in audit phase (admin-only token creation), this is the PERFECT time to add backup controller before public launch.

## Future Enhancements (Not in This PR)

- Multi-sig backup controller (requires governance system)
- Controller rotation mechanism
- Emergency pause functionality
- Automated health monitoring with controller alerts

## Summary

This upgrade:
1. **Bumps version** from 0.1.0 to 0.2.0
2. **Adds backup controller** to all spawned canisters (5 per token)
3. **Maintains compatibility** with existing 0.1.0 tokens
4. **Enables emergency access** for critical situations
5. **No breaking changes** - purely additive feature

**Total Changes:** 8 file modifications, ~50 lines of code added
**Risk Level:** Low (additive feature, no breaking changes)
**Testing:** Local build verification only (no mainnet deployment)
