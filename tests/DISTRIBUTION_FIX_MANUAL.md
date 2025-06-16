# LBRY_FUN Test Suite - Distribution Fix Manual

## Quick Status (As of June 2025)
- **Problem**: 14/64 tests failing due to hardcoded parent canister dependency
- **Solution Implemented**: Mock root icp_swap canister (Option A)
- **Remaining Issue**: WASM compilation cache preventing fixes from taking effect
- **Estimated Work**: 2-4 hours to resolve WASM issues and verify

## For The Next Developer

### 1. The Core Problem
The distribution system has a hardcoded dependency on canister ID `54fqz-5iaaa-aaaap-qkmqa-cai` (parent project's root icp_swap). During reward distribution, it tries to send 1% of fees to this canister, which doesn't exist in the isolated test environment (pocket-ic).

**Impact**: All distribution and staking reward tests fail with "CheckSequenceNotMatch" errors.

### 2. What's Been Done

✅ **Mock Implementation Created**
- File: `tests/tests/helpers/mock_root_icp_swap.rs`
- Deploys ICRC1 ledger at exact principal ID `54fqz-5iaaa-aaaap-qkmqa-cai`
- Accepts the 1% distribution fee transfers

✅ **Type System Fixed**
- File: `src/icp_swap/src/update.rs` (line 619)
- Changed from `Result<String, String>` to `Result<String, ExecutionError>`
- Matches what tokenomics canister actually returns

✅ **Token Configuration Corrected**
- File: `tests/tests/integration/integrated_token_tests.rs`
- Primary token minting account: `self.tokenomics` (not `self.icp_swap`)
- Max supply: 21M tokens (matches initial balance)

✅ **Test Helpers Updated**
- File: `tests/tests/helpers/shared_helpers.rs`
- Added ExecutionError enum definition
- Updated burn response decoding
- Fixed burn amounts (5000 natural units)

### 3. What You Need To Do

#### Step 1: Clear WASM Cache (CRITICAL!)
```bash
cd /home/theseus/alexandria/lbryfun
rm -rf target/
cargo clean
```

#### Step 2: Rebuild Everything
```bash
# Build all required canisters
cargo build --release --target wasm32-unknown-unknown --package icp_swap
cargo build --release --target wasm32-unknown-unknown --package tokenomics
cargo build --release --target wasm32-unknown-unknown --package logs
cargo build --release --target wasm32-unknown-unknown --package lbry_fun
```

#### Step 3: Verify Timestamps
```bash
# All WASM files should show current time
ls -la target/wasm32-unknown-unknown/release/*.wasm
```

#### Step 4: Run Test
```bash
cd tests
cargo test test_distribution_basic -- --nocapture
```

### 4. Troubleshooting Guide

**Issue**: "Failed to decode successful response: Fail to decode argument 0"
- **Cause**: Old WASM still being used
- **Fix**: Delete target/, rebuild, check timestamps

**Issue**: "Underflow error" in tokenomics
- **Cause**: max_primary_supply < initial balance
- **Fix**: Ensure both are 21_000_000 * E8S

**Issue**: "Not enough secondary tokens to burn"
- **Cause**: Insufficient ICP swapped
- **Fix**: Swap at least 100 ICP to get enough secondary tokens

**Issue**: No primary tokens minted after burn
- **Cause**: Burning less than initial_secondary_burn threshold
- **Fix**: Burn at least 5000 natural units

### 5. Success Criteria

When properly fixed, you should see:
- ✅ "Burn succeeded with message: [success message]"
- ✅ "Primary balance after burn: [non-zero value]"
- ✅ Distribution tests pass without "CheckSequenceNotMatch"
- ✅ All 14 failing tests now pass

### 6. Test Files to Verify

Run these tests to confirm the fix:
```bash
cargo test test_distribution_basic
cargo test test_distribution_no_stakers  
cargo test test_distribution_timing
cargo test test_claim_rewards
cargo test test_stake_basic
cargo test test_unstake_with_rewards
```

### 7. Key Files Reference

**Modified Source Files:**
- `src/icp_swap/src/update.rs` - Fixed ExecutionError decoding
- `tests/tests/helpers/shared_helpers.rs` - Added error types
- `tests/tests/integration/integrated_token_tests.rs` - Fixed token config

**Created Files:**
- `tests/tests/helpers/mock_root_icp_swap.rs` - Mock implementation
- `tests/deploy_parent_canisters.sh` - Alternative deployment script
- `tests/run_tests_with_parent.sh` - Test runner script

### 8. Understanding the Fix

The solution works by:
1. Creating a mock canister at the exact principal ID expected
2. This mock accepts ICP transfers (preventing the distribution failure)
3. Type fixes ensure proper communication between canisters
4. Token configuration ensures minting can actually occur

### 9. Alternative Approaches (If Needed)

**Option B**: Make the canister ID configurable
- Modify `IcpSwapInitArgs` to accept optional root_canister_id
- Allows tests to specify their own mock ID
- More flexible but requires production code changes

**Option C**: Deploy actual parent canisters
- Use `tests/deploy_parent_canisters.sh`
- Requires parent project at `../../core`
- Works for local dev but not in CI/CD

### 10. Contact & Resources

- **Original Analysis**: See `token_results.md` for deep dive
- **Parent Project**: Alexandria (LBRY token ecosystem)
- **Test Framework**: pocket-ic v9.0.2
- **Hardcoded ID**: `54fqz-5iaaa-aaaap-qkmqa-cai` in `src/icp_swap/src/constants.rs`

---

**Time Estimate**: 2-4 hours including rebuild time and test verification
**Difficulty**: Medium (mainly build system challenges)
**Prerequisites**: Understanding of IC canisters, Rust, and pocket-ic testing