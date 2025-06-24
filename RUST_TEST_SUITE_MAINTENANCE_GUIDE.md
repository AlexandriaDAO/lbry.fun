# Rust Test Suite Maintenance Guide

This comprehensive guide serves as a checklist for maintaining and troubleshooting the 67-test Rust test suite for the LBRY Fun token launchpad project.

## Quick Status Check

**Current Status**: ✅ All 67 tests compile successfully (fixed December 2024)
- **Compilation Errors**: 0/7 (all resolved)
- **Warnings**: 124 unused imports (low priority cleanup)
- **Critical Tests**: Backend validation, tokenomics calculations, security exploits

## Section 1: Common Compilation Error Patterns

### Pattern 1: PocketIC API Misuse (5 Fixed Errors)
**Symptoms**: E0308 type mismatch errors on `query_call` or `update_call`

**Root Cause**: PocketIC returns `Result<Vec<u8>, Error>` (raw bytes), not decoded types

**Wrong Pattern**:
```rust
let response: Result<GraphData, String> = env
    .pic
    .query_call(canister_id, Principal::anonymous(), "method_name", args)
```

**Correct Pattern**:
```rust
let response: Result<GraphData, String> = env
    .pic
    .update_call(  // or query_call
        canister_id,
        Principal::anonymous(),
        "method_name",
        args,
    )
    .map(|bytes| candid::decode_one(&bytes).unwrap())
    .map_err(|e| format!("Call failed: {:?}", e))
```

**Checklist**:
- [ ] Use `update_call` for `#[update]` functions, `query_call` for `#[query]`
- [ ] Always decode bytes with `candid::decode_one(&bytes)`
- [ ] Add proper error handling with `.map_err()`

### Pattern 2: Function Signature Drift (2 Fixed Errors)
**Symptoms**: E0061 wrong number of function arguments

**Root Cause**: Function signatures changed but tests weren't updated

**Example**: `create_token_with_config` expects 6 parameters, not 8:
```rust
// WRONG (8 parameters):
env.create_token_with_config("NAME", "SYM", 100, "url", 1M, 1M, 2000, 70)

// CORRECT (6 parameters):
env.create_token_with_config(
    "NAME",           // name
    "SYM",            // symbol
    100 * E8S,        // initial_secondary_burn (in e8s)
    1_000_000,        // initial_reward_per_burn_unit
    1_000_000 * E8S,  // max_primary_supply (in e8s)
    70,               // halving_step (percentage)
).unwrap()          // Handle Result type
```

**Checklist**:
- [ ] Check function signature in implementation file
- [ ] Remove extra parameters
- [ ] Add `.unwrap()` for Result returns
- [ ] Make `env` mutable if function requires it

## Section 2: API Endpoint Verification

### Critical API Endpoints
**File**: `/src/lbry_fun/lbry_fun.did`

**Preview Functions**:
- ✅ `preview_tokenomics_graphs: (PreviewArgs) -> (GraphData)` - UPDATE method
- ❌ `preview_tokenomics` - Does NOT exist (common test error)

**Tokenomics Functions**:
- ✅ `get_tokenomics_schedule: () -> (TokenomicsSchedule)` - QUERY method

**Checklist**:
- [ ] Use correct function name: `preview_tokenomics_graphs`
- [ ] Use `update_call` for preview functions (not query_call)
- [ ] Verify function exists in .did file before writing tests

## Section 3: Test Environment Setup

### TokenTestEnvironment Configuration
**Location**: `/tests/tests/integration/integrated_token_tests.rs`

**Two Environment Types**:

1. **Mock Environment** (for isolated testing):
   - Uses mock `lbry_fun` canister (ICRC1 ledger)
   - Good for: tokenomics calculations, burn mechanics
   - Limitation: No preview functions available

2. **Real Environment** (for full integration):
   ```rust
   // Deploy real lbry_fun.wasm
   let lbry_fun_wasm = include_bytes!("../../../target/wasm32-unknown-unknown/release/lbry_fun.wasm");
   pic.install_canister(canister_id, lbry_fun_wasm.to_vec(), arg, None);
   ```

**Checklist**:
- [ ] Use real environment for API endpoint testing
- [ ] Use mock environment for tokenomics validation
- [ ] Ensure WASM files exist in `/target/wasm32-unknown-unknown/release/`

## Section 4: Security Test Patterns

### Critical Vulnerability Tests
**Based on**: Burn unit exploit (fixed)

**Test Categories**:

1. **Parameter Validation Tests**:
   ```rust
   #[test]
   fn test_reject_unsafe_burn_unit() {
       let result = env.create_token_with_config(
           "Exploit", "HACK",
           1,              // burn_unit = 1 (SHOULD BE REJECTED)
           1_000_000, 21_000_000 * E8S, 50
       );
       assert!(result.is_err());
       assert!(result.unwrap_err().contains("must be at least"));
   }
   ```

2. **Economic Sanity Tests**:
   ```rust
   #[test] 
   fn test_minimum_token_cost() {
       // Ensure tokens cost at least $1 each initially
       // burn_unit determines cost: (burn_unit / E8S) * $0.005
   }
   ```

3. **Overflow Protection Tests**:
   ```rust
   #[test]
   fn test_reward_calculation_overflow() {
       // Test: primary_per_threshold * burn_amount * 10_000
       // Should use checked_mul to prevent overflow
   }
   ```

**Checklist**:
- [ ] Test parameter boundaries (minimum/maximum values)
- [ ] Validate economic constraints (minimum cost per token)
- [ ] Test overflow conditions in calculations
- [ ] Verify exploits are properly blocked

## Section 5: E8S Units and Conversions

### Critical Rule: E8S Multiplication
**When multiplying two E8S values, divide by E8S TWICE:**

```rust
// WRONG:
let result = value1_e8s * value2_e8s / E8S;

// CORRECT:
let result = (value1_e8s * value2_e8s) / E8S / E8S;
```

### Unit Conventions in Tests
- **Backend expects**: e8s values (multiply by 100_000_000)
- **Frontend sends**: natural values 
- **Exception**: `burn_secondary` expects natural units

**Checklist**:
- [ ] Use `* E8S` for token amounts in test setup
- [ ] Verify unit conversion in calculations
- [ ] Test both natural and e8s value boundaries

## Section 6: Test Execution Commands

### Running Specific Test Categories
```bash
# 1. Run all tests (check compilation)
cd tests && cargo test --no-run

# 2. Run security tests
cd tests && cargo test tokenomics_security --nocapture

# 3. Run backend validation tests
cd tests && cargo test backend_fix_validation --nocapture

# 4. Run specific test with output
cd tests && cargo test test_backend_fix_no_overminting -- --nocapture

# 5. Check for specific errors
cd tests && cargo test 2>&1 | grep -E "(E0061|E0308)"
```

### Build Requirements
```bash
# Ensure WASM files are built
cargo build --release --target wasm32-unknown-unknown --package lbry_fun
cargo build --release --target wasm32-unknown-unknown --package tokenomics
cargo build --release --target wasm32-unknown-unknown --package icp_swap
cargo build --release --target wasm32-unknown-unknown --package logs
```

## Section 7: Troubleshooting Checklist

### When Tests Won't Compile
- [ ] Check function signatures in implementation files
- [ ] Verify API endpoint names in .did files
- [ ] Ensure proper PocketIC response handling
- [ ] Check for missing struct definitions
- [ ] Verify import statements are correct

### When Tests Compile but Fail
- [ ] Check if WASM files are built and up-to-date
- [ ] Verify test uses correct environment (mock vs real)
- [ ] Check if API endpoints exist on the canister
- [ ] Validate test parameters are within safe bounds
- [ ] Ensure proper error handling for edge cases

### When Adding New Tests
- [ ] Follow existing test patterns
- [ ] Add security validation for new features
- [ ] Test both success and failure cases
- [ ] Include edge case testing
- [ ] Verify economic constraints are enforced

## Section 8: Critical Test Files Status

### Fixed Files (✅ Compiling):
- `test_backend_fix_validation.rs` - Backend validation after E8S bug fix
- `test_backend_table_data.rs` - Data formatting for UI display
- `test_actual_backend_response.rs` - API response validation
- `test_exact_backend_output.rs` - Mathematical accuracy validation

### Working Files (✅ No Issues):
- `integrated_token_tests.rs` - Main test environment
- Most unit test files in `/tests/unit/`

### Files Needing Cleanup (⚠️ Warnings Only):
- 124 unused import warnings across test suite
- Performance: Low priority, doesn't affect functionality

## Section 9: Emergency Procedures

### If All Tests Break After Code Changes
1. **Immediate Check**: Run `cargo test --no-run` to isolate compilation vs runtime issues
2. **API Changes**: Check if function signatures changed in `.did` files
3. **Revert Strategy**: Use git to identify what changed in core files
4. **Quick Fix**: Focus on compilation errors first, runtime issues second

### If Security Tests Fail
1. **STOP**: Do not deploy if security tests fail
2. **Investigate**: Check if vulnerability was reintroduced
3. **Validate**: Ensure parameter validation is working
4. **Audit**: Review all tokenomics calculations

## Section 10: Maintenance Schedule

### Weekly
- [ ] Run full test suite: `cd tests && cargo test`
- [ ] Check for new compilation warnings
- [ ] Verify security tests still pass

### Before Major Releases
- [ ] Run security test suite
- [ ] Update test cases for new features
- [ ] Validate all API endpoints in tests
- [ ] Check WASM files are current

### After Code Changes
- [ ] Run affected test categories
- [ ] Update test documentation if needed
- [ ] Add new tests for new functionality
- [ ] Verify no regressions in existing tests

---

## Quick Reference

**Total Tests**: 67 Rust test files
**Test Categories**: Unit (mathematical), Integration (full canister), Security (exploit prevention)
**Build Command**: `cargo build --release --target wasm32-unknown-unknown`
**Test Command**: `cd tests && cargo test`
**Critical Files**: `lbry_fun.wasm`, `tokenomics.wasm`, test environment setup

**Key Learning**: Test failures often reveal real issues in the codebase, not just test problems. Always investigate the root cause before changing tests to pass.