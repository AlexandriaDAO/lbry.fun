# Master Test Plan & Fix Checklist for LBRY Fun

## Current Status: 8 Tests Failing (Critical Issues Found)

This document serves as the master checklist for fixing all failing tests. Based on detailed investigation, we've identified 3 root causes that cascade to create 8 test failures.

## Root Cause Analysis

### 🔴 Issue #1: Swap Returns Zero (Blocks Everything)
**Location**: `src/icp_swap/src/update.rs` - swap function  
**Problem**: ICP → Secondary token swap returns 0 tokens  
**Impact**: Cannot obtain any tokens, platform completely unusable  
**Tests Blocked**: 7 out of 8 failing tests  
**Details**: See `test_investigation_token_deployment.md`

### 🔴 Issue #2: Distribution Math Error (100x Less Rewards)
**Location**: `src/icp_swap/src/update.rs` line 1110  
**Problem**: Divides by 10,000 instead of 100 (0.01% vs 1%)  
**Impact**: Users get 100x less rewards than advertised  
**Tests Failed**: `test_simple_distribution_no_stakers`, `test_distribution_after_timer`  
**Details**: See `test_investigation_distribution_no_stakers.md`

### 🔴 Issue #3: Distribution Timer Not Initialized
**Location**: `src/icp_swap/src/lifecycle.rs` - init function  
**Problem**: DISTRIBUTION_INTERVAL defaults to 0  
**Impact**: No automatic hourly distributions  
**Tests Failed**: `test_query_distribution_info`  
**Details**: See `test_investigation_query_distribution_info.md`

## Fix Order & Checklist

### Phase 1: Unblock Token Flow (Priority: CRITICAL)

#### Fix #1: Enable Token Swaps
- [ ] **Option A**: Fix XRC price integration
  ```rust
  // Ensure XRC canister returns valid ICP price
  // Check xrc::get_icp_price() implementation
  ```
- [ ] **Option B**: Add test mode with fixed price
  ```rust
  #[cfg(test)]
  pub fn set_test_icp_price(price: u64) {
      TEST_ICP_PRICE.with(|p| *p.borrow_mut() = price);
  }
  ```
- [ ] **Option C**: Mock swap for testing
  ```rust
  #[cfg(test)]
  pub async fn swap_test_mode(amount: u128) -> u128 {
      // Return fixed conversion rate for testing
      amount * 100 // 1 ICP = 100 secondary tokens
  }
  ```
- [ ] Verify swap returns non-zero tokens
- [ ] Run `test_token_deployment_flow` - should pass

### Phase 2: Fix Economic Math (Priority: CRITICAL)

#### Fix #2: Correct Distribution Percentage
- [ ] Locate `src/icp_swap/src/update.rs` line 1110
- [ ] Change distribution calculation:
  ```rust
  // BEFORE (WRONG):
  let distribution_amount = pool_balance
      .saturating_mul(STAKING_REWARD_PERCENTAGE as u64)
      .saturating_div(10_000);  // ❌ Results in 0.01%
  
  // AFTER (CORRECT):
  let distribution_amount = pool_balance
      .saturating_mul(STAKING_REWARD_PERCENTAGE as u64)
      .saturating_div(100);  // ✅ Results in 1%
  ```
- [ ] Add constant for clarity:
  ```rust
  const PERCENTAGE_DIVISOR: u64 = 100;  // 100% = 100
  ```
- [ ] Run `test_simple_distribution_no_stakers` - should pass
- [ ] Run `test_distribution_after_timer` - should improve

### Phase 3: Initialize Timer (Priority: HIGH)

#### Fix #3: Set Distribution Interval
- [ ] Locate init function in `src/icp_swap/src/lifecycle.rs`
- [ ] Add initialization:
  ```rust
  pub fn init(init_args: InitArgs) {
      // Initialize distribution interval
      DISTRIBUTION_INTERVAL.with(|i| *i.borrow_mut() = 3600); // 1 hour
      
      // Set initial distribution time
      LAST_DISTRIBUTION_TIME.with(|t| *t.borrow_mut() = ic_cdk::api::time());
      
      // Start distribution timer
      start_distribution_timer();
  }
  ```
- [ ] Verify timer starts in logs
- [ ] Run `test_query_distribution_info` - should pass
- [ ] Run `test_distribution_after_timer` - should fully pass

### Phase 4: Verify Dependent Tests (Priority: HIGH)

Once Phase 1-3 complete, these should start working:

#### Staking Tests
- [ ] Run `test_stake_basic` - should pass (can now get tokens)
- [ ] Run `test_claim_rewards` - should pass (can now stake)
- [ ] Run `test_unstake_with_rewards` - should pass (full flow works)

#### Edge Case Tests
- [ ] Run `test_distribution_edge_cases` - should pass (can create scenarios)

## Test Status Tracking

| Test Name | Status | Root Cause | Fixed By |
|-----------|--------|------------|----------|
| `test_token_deployment_flow` | ❌ | Swap returns 0 | Fix #1 |
| `test_simple_distribution_no_stakers` | ❌ | Math error | Fix #2 |
| `test_distribution_after_timer` | ❌ | Math + timer | Fix #2 + #3 |
| `test_query_distribution_info` | ❌ | Timer not init | Fix #3 |
| `test_stake_basic` | ❌ | No tokens | Fix #1 |
| `test_claim_rewards` | ❌ | Can't stake | Fix #1 |
| `test_unstake_with_rewards` | ❌ | Can't stake | Fix #1 |
| `test_distribution_edge_cases` | ❌ | No tokens | Fix #1 |

## Verification Steps

### After Each Fix
1. Run specific test that validates the fix
2. Check for regressions in other tests
3. Verify no new errors introduced

### After All Fixes
```bash
# Run all tests
cd tests && cargo test

# Expected: All 8 tests passing
# Time estimate: < 5 minutes per test
```

## Additional Improvements (After Core Fixes)

### Code Quality
- [ ] Add unit tests for percentage calculations
- [ ] Add integration test for full user journey
- [ ] Add invariant checks (distribution > 0 for non-zero pool)

### Monitoring
- [ ] Log all distribution attempts
- [ ] Track actual vs expected distribution percentages
- [ ] Alert on any swap returning 0

### Documentation
- [ ] Document the 1% distribution clearly
- [ ] Explain tokenomics in user terms
- [ ] Add troubleshooting guide

## Success Criteria

### Immediate (This Sprint)
- ✅ All 8 failing tests pass
- ✅ Users can swap ICP for tokens
- ✅ Exactly 1% distributed hourly
- ✅ Staking and rewards work end-to-end

### Before Launch
- ✅ 100% test coverage on critical paths
- ✅ Security audit passed
- ✅ Load testing completed
- ✅ Monitoring in place

## Risk Mitigation

| Risk | Mitigation | Owner |
|------|------------|-------|
| XRC fails in production | Fallback price oracle | Backend |
| Distribution calculations wrong | Extensive test coverage | QA |
| Timer stops working | Manual distribution backup | DevOps |
| Integer overflow | Use checked math everywhere | Security |

## References

Detailed investigation for each test failure:
- `test_investigation_token_deployment.md` - Swap issue analysis
- `test_investigation_distribution_no_stakers.md` - Math error details
- `test_investigation_distribution_timer.md` - Timer and math issues
- `test_investigation_stake_basic.md` - Staking flow analysis
- `test_investigation_claim_rewards.md` - Reward claiming logic
- `test_investigation_unstake_with_rewards.md` - Unstaking design issues
- `test_investigation_distribution_edge_cases.md` - Edge case considerations
- `test_investigation_query_distribution_info.md` - Query and init issues

## Next Steps

1. **Today**: Fix Issues #1-3 (enables basic functionality)
2. **Tomorrow**: Verify all dependent tests pass
3. **This Week**: Add missing test coverage
4. **Next Week**: Security review of fixes

---

Remember: Every failing test represents a broken promise to users. Fix with urgency but also precision.