# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/lbryfun" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/lbryfun-distribution-test"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/lbryfun-distribution-test`
2. **Implement test** - Follow plan sections below
3. **Build locally** (verification only - NEVER DEPLOY TO MAINNET):
   ```bash
   cd tests && cargo test test_distribution_math_reproduction
   ```
   **⚠️ PRODUCTION WARNING**: This is a live financial application. Never deploy to mainnet.
4. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "Add test to reproduce distribution math error

This test reproduces issue #1 from tokenomics_audit_fixes.md:
- Platform fee (ALEX) receiving ~0.78% instead of 1% of distributions
- Integer division causing ALEX to get less than expected
- Test demonstrates exact numbers from mainnet audit"
   git push -u origin feature/distribution-math-test
   gh pr create --title "Test: Reproduce distribution math error from audit" --body "Implements DISTRIBUTION_MATH_TEST_PLAN.md

## Purpose
Reproduces the distribution math error found in mainnet audit where ALEX fees are calculated incorrectly due to integer division.

## Test Details
- Creates scenario with 12,805 E8S pool (matching mainnet evidence)
- Demonstrates ALEX receiving 1 E8S (0.78%) instead of expected 1.28 E8S (1%)
- Stakers receiving 127 E8S (99.22%) instead of expected 126.72 E8S (99%)

## Issue Reference
See tokenomics_audit_fixes.md - Issue #1: Distribution Math Error"
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

**Branch:** `feature/distribution-math-test`
**Worktree:** `/home/theseus/alexandria/lbryfun-distribution-test`

---

# Implementation Plan: Distribution Math Error Test

## Problem Statement

From mainnet audit (tokenomics_audit_fixes.md), the `distribute_reward()` function in `icp_swap` canister has an integer division error causing ALEX fees to be calculated incorrectly:

**Current behavior:**
```
Pool: 12,805 E8S → Distributed 128 E8S (1%)
- ALEX: 1 E8S (0.78% of 128)
- Stakers: 127 E8S (99.22% of 128)
```

**Expected behavior:**
```
Pool: 12,805 E8S → Distribute 128 E8S (1%)
- ALEX: 1.28 E8S (1% of 128)
- Stakers: 126.72 E8S (99% of 128)
```

## Root Cause Analysis

### Current Code (src/icp_swap/src/update.rs:887-1010)

```rust
pub async fn distribute_reward() -> Result<String, ExecutionError> {
    let reward_pool = REWARD_POOL.with(|p| {
        p.borrow().get(&()).unwrap_or(0)
    });

    // Calculate 1% of pool for distribution
    let total_distribution = reward_pool / 100;  // Line 898

    // Calculate exact distribution
    let alex_portion = total_distribution / 100;  // Line 901 - BUG HERE
    let lp_portion = total_distribution - alex_portion; // Line 902

    // Update uncollected fees for ALEX stakers (1% of distribution)
    UNCOLLECTED_ALEX_FEES.with(|f| {
        let current = f.borrow().get(&()).unwrap_or(0);
        f.borrow_mut().insert((), current.saturating_add(alex_portion));
    });

    // ... distribute lp_portion to stakers ...
}
```

### The Bug

Line 901: `alex_portion = total_distribution / 100`

When `total_distribution = 128 E8S`:
- Integer division: `128 / 100 = 1` (not 1.28)
- Remainder of 0.28 E8S is lost due to integer truncation
- This 0.28 E8S goes to stakers instead of ALEX

### Expected Fix (for reference, not implemented in this PR)

Should calculate ALEX first with proper precision:
```rust
// Option 1: Calculate ALEX as 1% using multiplication first
let alex_portion = total_distribution / 100;  // Current (wrong)
// Should be:
let alex_portion = (total_distribution * 1) / 100;  // Still has precision loss

// Option 2: Use scaling factor for precision
let alex_portion = (total_distribution as u128 * ALEX_FEE_PERCENTAGE as u128) / 10000;

// Option 3: Calculate stakers first, give remainder to ALEX
let staker_portion = (total_distribution * 99) / 100;
let alex_portion = total_distribution - staker_portion;
```

## Test Implementation

### File: `tests/tests/unit/test_distribution_math_reproduction.rs` (NEW)

```rust
// PSEUDOCODE - Implementing agent writes actual code

#[cfg(test)]
mod distribution_math_tests {

    #[test]
    fn test_reproduce_distribution_math_error() {
        // This test demonstrates the exact scenario from mainnet audit

        // Setup: Create pool with 12,805 E8S (matching audit evidence)
        let reward_pool = 12_805u64;

        // Current implementation logic
        let total_distribution = reward_pool / 100;  // 128 E8S (1% of pool)

        // BUG: Integer division loses precision
        let alex_portion_actual = total_distribution / 100;  // 1 E8S (wrong)
        let lp_portion_actual = total_distribution - alex_portion_actual;  // 127 E8S

        // Expected behavior with proper calculation
        // We expect ALEX to get 1% of distribution = 1.28 E8S
        // But since we use integers, we need to calculate it properly

        // Calculate percentages of the distribution amount (128 E8S)
        let alex_percentage_of_distribution = (alex_portion_actual as f64 / total_distribution as f64) * 100.0;
        let lp_percentage_of_distribution = (lp_portion_actual as f64 / total_distribution as f64) * 100.0;

        // Print the reproduction
        println!("=== Distribution Math Error Reproduction ===");
        println!("Pool: {} E8S", reward_pool);
        println!("Total distribution (1% of pool): {} E8S", total_distribution);
        println!("");
        println!("ACTUAL (current code):");
        println!("  ALEX: {} E8S ({:.2}% of distribution)", alex_portion_actual, alex_percentage_of_distribution);
        println!("  Stakers: {} E8S ({:.2}% of distribution)", lp_portion_actual, lp_percentage_of_distribution);
        println!("");
        println!("EXPECTED:");
        println!("  ALEX: 1.28 E8S (1.00% of distribution)");
        println!("  Stakers: 126.72 E8S (99.00% of distribution)");
        println!("");
        println!("DISCREPANCY:");
        println!("  ALEX short by: 0.28 E8S");
        println!("  Stakers over by: 0.28 E8S");

        // Assert the bug exists
        assert_eq!(alex_portion_actual, 1, "ALEX portion should be 1 E8S (demonstrating the bug)");
        assert_eq!(lp_portion_actual, 127, "LP portion should be 127 E8S (demonstrating the bug)");

        // Document what it SHOULD be
        // ALEX should get 1% of 128 = 1.28, but we can only use integers
        // so we need a better calculation method
        assert!(alex_percentage_of_distribution < 1.0, "ALEX is receiving less than 1% due to integer division");
        assert!(lp_percentage_of_distribution > 99.0, "Stakers are receiving more than 99% due to the bug");
    }

    #[test]
    fn test_demonstrate_cumulative_impact() {
        // Show how this compounds over multiple distributions

        println!("=== Cumulative Impact Analysis ===");

        let distributions = vec![12_805, 12_934, 13_064, 13_195, 13_327]; // From audit
        let mut total_alex_actual = 0u64;
        let mut total_alex_expected_f64 = 0.0f64;

        for pool in distributions {
            let total_distribution = pool / 100;
            let alex_actual = total_distribution / 100;
            let alex_expected = total_distribution as f64 * 0.01; // 1% as decimal

            total_alex_actual += alex_actual;
            total_alex_expected_f64 += alex_expected;

            println!("Pool: {} E8S → Dist: {} E8S → ALEX: {} E8S (expected: {:.2} E8S, loss: {:.2})",
                     pool, total_distribution, alex_actual, alex_expected, alex_expected - alex_actual as f64);
        }

        println!("");
        println!("Over {} distributions:", distributions.len());
        println!("  ALEX received: {} E8S", total_alex_actual);
        println!("  ALEX expected: {:.2} E8S", total_alex_expected_f64);
        println!("  Cumulative loss: {:.2} E8S", total_alex_expected_f64 - total_alex_actual as f64);

        // Assert cumulative loss exists
        assert!(total_alex_expected_f64 > total_alex_actual as f64,
                "Cumulative loss should exist over multiple distributions");
    }

    #[test]
    fn test_show_correct_calculation_approach() {
        // Demonstrate what the fix should look like

        let reward_pool = 12_805u64;
        let total_distribution = reward_pool / 100;  // 128 E8S

        // WRONG (current):
        let alex_wrong = total_distribution / 100;  // 1 E8S

        // RIGHT (option 1): Calculate stakers first, give remainder to ALEX
        let staker_right = (total_distribution * 99) / 100;  // 126 E8S (99% with rounding down)
        let alex_right = total_distribution - staker_right;   // 2 E8S (gets the remainder)

        println!("=== Correct Calculation Approach ===");
        println!("Total distribution: {} E8S", total_distribution);
        println!("");
        println!("Current (wrong):");
        println!("  ALEX: {} E8S (explicit 1% with rounding loss)", alex_wrong);
        println!("  Stakers: {} E8S (gets the remainder)", total_distribution - alex_wrong);
        println!("");
        println!("Fixed (give remainder to ALEX):");
        println!("  Stakers: {} E8S (explicit 99% with rounding down)", staker_right);
        println!("  ALEX: {} E8S (gets the remainder, closer to 1%)", alex_right);

        // This shows the fix: calculate the larger amount first, give remainder to smaller
        assert_eq!(alex_right + staker_right, total_distribution, "Should sum to total");
        assert!(alex_right > alex_wrong, "Fixed version should give more to ALEX");
    }
}
```

### File: `tests/main.rs` (MODIFY)

Add the new test module:

```rust
// PSEUDOCODE - Find the appropriate location in the unit tests section

#[path = "tests/unit/test_distribution_math_reproduction.rs"]
mod test_distribution_math_reproduction;
```

## Testing Requirements

### Local Build Verification Only
```bash
cd tests
cargo test test_distribution_math_reproduction -- --nocapture
```

Expected output should show:
- Test 1: Reproduces the exact bug with 12,805 E8S pool
- Test 2: Shows cumulative impact over multiple distributions
- Test 3: Demonstrates correct calculation approach

**CRITICAL**: No automated testing required in this plan. Focus on correct reproduction.

**NEVER deploy to mainnet** - this is a production app with financial consequences.

## Acceptance Criteria

1. ✅ Test reproduces exact numbers from audit (1 E8S to ALEX instead of 1.28)
2. ✅ Test shows cumulative impact over multiple distributions
3. ✅ Test demonstrates correct calculation approach for future fix
4. ✅ Test runs successfully with `cargo test`
5. ✅ Test output is clear and educational
6. ✅ PR created with proper description linking to audit document

## Notes

- This PR is **diagnostic only** - it reproduces the bug, does NOT fix it
- The fix will come in a separate PR after team review
- Test serves as regression test for future fix validation
- All calculations use integer math (no floating point in production code)
- Test uses f64 only for display/validation purposes

## Files Changed

1. `tests/tests/unit/test_distribution_math_reproduction.rs` - NEW file with 3 test cases
2. `tests/main.rs` - Add module declaration for new test file
