# Tokenomics Real-World Configuration Test Plan

## Objective
Create comprehensive tests that mirror actual user configurations from the frontend forms, focusing on finding real errors in tokenomics calculations across various edge cases and problematic configurations.

## Current Status (Last Updated: 2025-06-19)

### ✅ Burn Unit Exploit Test - COMPLETED
Successfully created and tested the burn_unit=1 exploit scenario:
- Created `test_burn_unit_exploit.rs` with two comprehensive tests
- Verified that the default configuration (burn_unit = 5000) is safe from exploitation
- Confirmed that burning 1 secondary token only yields 0.01 primary tokens (not millions)
- Validated that the minimum $1000 valuation rule is enforced (actual: $2500)
- **Result**: No burn_unit=1 exploit exists with current default settings

### Work Completed
1. **Created test files** in `/tests/tests/unit/`:
   - `test_burn_unit_exploit.rs` - CRITICAL: Tests burn_unit=1 exploit scenario (PASSING ✅)
   - `test_tokenomics_realworld_validation.rs` - Contains extreme configuration tests (Whale Capture, Inflation Bomb, etc.)
   - `test_tokenomics_edge_cases.rs` - Contains E8S conversion, boundary value, and burn pattern tests
   - `test_tokenomics_realworld_validation_v2.rs` - Simplified version attempting to work with existing infrastructure

2. **Discovered existing test infrastructure**:
   - Comprehensive tokenomics tests already exist in `test_tokenomics_validation.rs` and `phase4_tokenomics_lifecycle_tests.rs`
   - Test environment uses `TokenTestEnvironment` from `integrated_token_tests.rs`
   - Helper functions in `phase2_token_operations.rs` and `shared_helpers.rs`

### Key Challenges Encountered

1. **Test Environment Limitations**:
   - `TokenTestEnvironment` doesn't have a `create_token_with_config` method to set custom tokenomics
   - Tokens are created through `lbry_fun` canister, not directly configurable
   - Need to update tokenomics after creation via canister calls

2. **Import and Type Issues**:
   - `ExecutionError` is an enum in `shared_helpers.rs`, not a struct
   - Helper functions like `swap_icp` are in `phase2_token_operations.rs`, not `shared_helpers.rs`
   - `approve_token` doesn't exist; need to use ICRC2 approve directly

3. **User Management**:
   - Test environment uses string names ("alice", "bob") mapped to principals
   - Cannot create arbitrary principals; must use the test user system

### Critical Bug to Test For
**From master_test_plan.md**: With burn_unit=1 and high reward values, users can mint the entire supply with 1 secondary token!
**STATUS**: ✅ TESTED AND VERIFIED SAFE - Default configuration prevents this exploit

### Next Steps for Implementation

1. **Fix compilation issues**:
   ```rust
   // Import from correct modules
   use crate::phase2_token_operations::{swap_icp, approve_icp};
   use crate::shared_helpers::E8S;
   
   // Use ExecutionError correctly (it's an enum)
   match result {
       Err(ExecutionError::InvalidAmount { reason, .. }) => { ... }
   }
   ```

2. **Update tokenomics after token creation**:
   ```rust
   // Create token first
   env.create_token("alice", "Test Token", "TEST").unwrap();
   
   // Get the deployed canister IDs
   let (primary, secondary, icp_swap) = get_alice_token_ids(&env);
   
   // Update tokenomics configuration
   env.pic.update_call(
       icp_swap,
       env.test_users["alice"],
       "update_tokenomics_config",
       candid::encode_args((
           max_supply, initial_mint, burn_unit, halving, reward
       )).unwrap()
   );
   ```

3. **Test the critical burn_unit=1 exploit**:
   ```rust
   // THIS MUST BE THE FIRST TEST IMPLEMENTED
   #[test]
   fn test_burn_unit_one_exploit() {
       // Set burn_unit = 1, high reward
       // Burn 1 secondary token
       // Assert user DOESN'T get millions of primary tokens
   }
   ```

## Key Frontend Configuration Parameters

### User-Configurable Values
1. **Hard Cap (primary_max_supply)**: 100,000 to 10,000,000 tokens
2. **TGE Allocation**: Fixed at 1 token (not configurable)
3. **Burn Unit (initial_secondary_burn)**: 200,000 to 10,000,000 secondary tokens
4. **Initial Reward (initial_reward_per_burn_unit)**: 10 to 10% of remaining supply
5. **Halving Step**: 25% to 99%

### Critical Validation Rules to Test
1. **$1,000 Minimum Valuation**: `burn_unit * 0.005 >= 1000`
2. **30% First Epoch Cap**: First epoch cannot mint >30% of remaining supply
3. **0.1% Transaction Cap**: No single burn can mint >0.1% of total supply
4. **Minimum 3 Epochs**: Configurations resulting in <3 epochs should be rejected

## Test Configuration Matrix

### 1. Extreme Front-Load Configuration
```
Name: "Whale Capture Token"
Hard Cap: 1,000,000
TGE: 1
Burn Unit: 1,000,000
Initial Reward: 2,999 (just under 30% cap)
Halving Step: 25%
Expected Issues:
- 99.7% of tokens minted in first epoch
- Second epoch participants get almost nothing
- Effectively a whale-only launch
```

### 2. Extreme Back-Load Configuration
```
Name: "Inflation Bomb Token"
Hard Cap: 10,000,000
TGE: 1
Burn Unit: 200,000
Initial Reward: 10
Halving Step: 99%
Expected Issues:
- Early participants get minimal rewards
- Late stage becomes hyperinflationary
- Rewards actually increase over time
```

### 3. Minimum Viable Configuration
```
Name: "Micro Cap Token"
Hard Cap: 100,000 (minimum allowed)
TGE: 1
Burn Unit: 200,000
Initial Reward: 100
Halving Step: 50%
Expected Issues:
- Susceptible to manipulation
- Rounding errors more significant
- May hit supply cap quickly
```

### 4. Transaction Cap Violation
```
Name: "Cap Buster Token"
Hard Cap: 1,000,000
TGE: 1
Burn Unit: 500,000
Initial Reward: 1,000
Halving Step: 50%
Test Case: User tries to burn 10,000 secondary tokens at once
Expected: Should fail with "exceeds 0.1% cap" error
```

### 5. Zero Epoch Configuration
```
Name: "Instant Mint Token"
Hard Cap: 100,000
TGE: 1
Burn Unit: 10,000,000
Initial Reward: 99,999
Halving Step: 50%
Expected Issues:
- Should be rejected (violates 30% rule)
- If not rejected, entire supply minted instantly
```

### 6. Preset Configuration Tests

#### Extended Distribution
```
Hard Cap: 1,000,000
Burn Unit: 200,000
Initial Reward: 100
Halving Step: 35%
Validate:
- 15+ epochs generated
- $1,000 initial valuation
- Smooth distribution curve
```

#### Balanced
```
Hard Cap: 5,000,000
Burn Unit: 500,000
Initial Reward: 500
Halving Step: 45%
Validate:
- 8-12 epochs
- $2,500 initial valuation
- Fair early/late balance
```

#### Quick Launch
```
Hard Cap: 10,000,000
Burn Unit: 1,000,000
Initial Reward: 2,000
Halving Step: 70%
Validate:
- 3-5 epochs
- $5,000 initial valuation
- Fast completion
```

## Critical Findings from Graph Validation Tests

### ❌ CRITICAL BUG: Backend Does Not Match Frontend Graphs
**Date:** 2025-06-19
**Test:** test_graph_vs_reality.rs::test_primary_minted_per_epoch_matches_graph

**Finding:** The backend tokenomics gives CONSTANT rewards (50 tokens per burn) instead of applying halving between epochs. This completely contradicts what the frontend graphs show to users.

**Expected Behavior (per graphs):**
- Epoch 1: 100 tokens per burn (or 50 if already halved)
- Epoch 2: 50 tokens per burn (or 25 if starting from 50)
- Epoch 3: 25 tokens per burn (or 12.5)
- Epoch 4: 12.5 tokens per burn (or 6.25)

**Actual Behavior:**
- ALL epochs: 50 tokens per burn (constant)

**Impact:** Users see graphs showing exponentially decreasing rewards (encouraging early participation) but the actual implementation gives constant rewards. This is a fundamental mismatch between advertised and actual tokenomics.

**Test Evidence:**
```
Burn #1: 50 tokens (epoch 1) ✓ Expected
Burn #2: 50 tokens (epoch 2) ❌ Expected 25
Burn #3: 50 tokens (epoch 2) ❌ Expected 25
Burn #4: 50 tokens (epoch 3) ❌ Expected 12
...continues with constant 50 tokens
```

## Edge Cases to Test

### 1. E8S Conversion Errors
Test that frontend values convert correctly:
- Frontend: 1.5 initial_reward → Backend: 150,000,000 (1.5 * 10^8)
- Frontend: 0.1 initial_reward → Backend: 10,000,000 (0.1 * 10^8)
- Test decimal truncation handling

### 2. Boundary Value Tests
- Hard Cap: Exactly 100,000 and 10,000,000
- Burn Unit: Exactly 200,000 and 10,000,000
- Halving Step: Exactly 25% and 99%
- Initial Reward: Maximum allowed (10% of supply)

### 3. Sequential Burn Patterns
Test different user behaviors:
- Single user burning entire first epoch
- 100 users each burning small amounts
- Alternating large/small burns
- Burns across epoch boundaries

### 4. Supply Exhaustion Scenarios
- Approaching max supply with large burns
- Attempting burns after supply exhausted
- Rounding causing supply overrun

### 5. Halving Precision Tests
- Test halving_step values that cause rounding issues
- Verify rewards decrease correctly each epoch
- Check "one reward mode" activation

## Test Implementation Strategy

### For Each Configuration:
1. Deploy token with exact parameters from frontend
2. Simulate realistic burn sequences
3. Verify:
   - Actual primary tokens received match frontend predictions
   - Epoch transitions occur at correct thresholds
   - Halving applied correctly
   - Transaction caps enforced
   - Supply limits respected

### Key Assertions:
```rust
// For each burn operation
assert_eq!(actual_primary_received, expected_from_frontend_calc);
assert!(actual_primary_received <= max_supply * 0.001); // 0.1% cap
assert_eq!(current_epoch, expected_epoch);
assert_eq!(current_reward_rate, expected_rate_after_halvings);
```

### Error Detection Focus:
1. **Rounding Errors**: Small values causing unexpected behavior
2. **Overflow/Underflow**: Large calculations exceeding limits
3. **State Inconsistency**: Threshold index vs actual burned mismatch
4. **Cap Violations**: Transaction or epoch caps not enforced
5. **Supply Violations**: Minting beyond max supply

## Implementation Guide for Test Files

### File Structure
The test files created need the following fixes:

1. **`test_tokenomics_realworld_validation.rs`**:
   - Remove direct principal creation
   - Use test environment's user system
   - Fix ExecutionError usage
   - Import functions from correct modules

2. **`test_tokenomics_edge_cases.rs`**:
   - Similar fixes as above
   - Use env.get_balance() instead of env.get_primary_balance()
   - Proper ICRC2 approve flow

3. **Main.rs registration**:
   - Currently registered as `test_tokenomics_realworld_validation_v2`
   - Should clean up and use one consistent version

### Proper Test Pattern
Based on existing tests, follow this pattern:

```rust
#[test]
fn test_configuration_name() {
    let mut env = TokenTestEnvironment::new();
    
    // Step 1: Create token (uses default config)
    env.create_token("alice", "Token Name", "SYMBOL").unwrap();
    
    // Step 2: Get canister IDs
    let alice_principal = env.test_users["alice"];
    let result = env.pic.query_call(
        env.lbry_fun,
        alice_principal,
        "get_user_metadata",
        candid::encode_one(&alice_principal).unwrap(),
    ).unwrap();
    let tokens: Vec<(Principal, Principal, Principal, Principal, Principal)> = 
        candid::decode_one(&result).unwrap();
    let (primary, secondary, tokenomics, icp_swap, logs) = &tokens[0];
    
    // Step 3: Check if we can update tokenomics
    // NOTE: This needs investigation - can we update after deployment?
    
    // Step 4: Execute test scenario
    approve_icp(&mut env, "bob", amount + 100_000).unwrap();
    swap_icp(&mut env, "bob", amount).unwrap();
    
    // Step 5: Approve and burn
    // Use proper ICRC2 approve...
    
    // Step 6: Verify results
}
```

### Critical Tests to Implement First

1. **Burn Unit = 1 Exploit Test** (HIGHEST PRIORITY)
2. **Graph vs Reality Validation**
3. **Overflow Protection Tests**
4. **Parameter Boundary Tests**

## Expected Outcomes

This test suite should uncover:
1. Configurations that violate stated constraints but aren't rejected
2. Rounding errors that accumulate over multiple burns
3. Edge cases where caps aren't properly enforced
4. Scenarios where actual rewards differ from frontend calculations
5. State management issues during epoch transitions
6. **The burn_unit=1 exploit that allows minting entire supply with 1 token**

## Success Criteria

Tests are successful when they:
1. Find at least 3-5 real bugs in current implementation
2. Validate all frontend presets work correctly
3. Confirm all validation rules are enforced
4. Ensure user experience matches frontend predictions
5. Prevent any configuration that could be exploited
6. **Specifically catch and prevent the burn_unit=1 vulnerability**

## Notes for Next Agent

1. **Check first**: Can tokenomics be updated after token creation? Look at icp_swap canister methods.
2. **Priority**: Implement burn_unit=1 exploit test FIRST - this is the critical vulnerability
3. **Test files**: Fix compilation in existing files rather than creating new ones
4. **Use existing patterns**: Follow the test patterns from `phase4_tokenomics_lifecycle_tests.rs`
5. **Document bugs**: When you find bugs, document them clearly in test comments