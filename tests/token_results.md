# Real Token Testing with Pocket-IC - Project Plan

## Executive Summary

This document serves as the project plan and implementation guide for testing the tokenomics system using pocket-ic. We'll use a mock ICP ledger to enable fast, deterministic testing of all token operations.

**Goal**: Create comprehensive tests that validate the entire token lifecycle from minting to distribution, ensuring mathematical correctness and edge case handling.

**Approach**: Incremental testing - one function at a time, building confidence with each step.

---

## Phase 1: Foundation (Days 1-2)

### Checkpoint 1.1: Mock ICP Ledger Implementation ✅
**Goal**: Create a minimal mock ICP ledger that supports our testing needs

#### Tasks:
- [ ] Create `mock_icp_ledger.rs` with basic structure
- [ ] Implement state storage (balances and approvals HashMaps)
- [ ] Implement `icrc1_balance_of` query method
- [ ] Implement `icrc2_approve` update method
- [ ] Implement `icrc2_transfer_from` update method
- [ ] Add helper method to set initial balances
- [ ] Write unit test to verify mock ledger works in isolation
- [ ] Package as deployable WASM

#### Success Criteria:
- Can deploy mock ledger to pocket-ic
- Can query balance and get correct result
- Can approve and transfer tokens

### Checkpoint 1.2: Fix Environment Setup ✅
**Goal**: Get TokenTestEnvironment fully operational with mock ICP ledger

#### Tasks:
- [ ] Replace ICP ledger deployment with mock ledger
- [ ] Verify all 5 canisters deploy successfully
- [ ] Run basic connectivity test (call each canister)
- [ ] Implement `get_icp_balance` helper using mock ledger
- [ ] Test that initial balances are set correctly
- [ ] Document any gotchas or special setup needed

#### Success Criteria:
- `test_environment_setup` passes without errors
- Can query balance for alice, bob, charlie
- All canisters respond to basic queries

---

## Phase 2: Core Token Operations (Days 3-5)

### Checkpoint 2.1: Test `swap()` Function ✅
**Goal**: Validate ICP → Secondary token minting

#### Tasks:
- [ ] Create test `test_swap_basic`
  - [ ] Alice starts with 1000 ICP
  - [ ] Alice approves 10 ICP to icp_swap
  - [ ] Alice calls swap(10 ICP)
  - [ ] Verify Alice receives correct secondary tokens
  - [ ] Verify Alice's ICP balance decreased by 10 + fee
- [ ] Create test `test_swap_insufficient_balance`
  - [ ] User with 5 ICP tries to swap 10 ICP
  - [ ] Verify proper error returned
- [ ] Create test `test_swap_no_approval`
  - [ ] User tries to swap without approval
  - [ ] Verify proper error returned
- [ ] Create test `test_swap_different_icp_prices`
  - [ ] Mock different ICP prices ($50, $100, $25)
  - [ ] Verify secondary token amounts scale correctly
  - [ ] Formula: secondary_tokens = (icp_amount * icp_price) / 0.01

#### Success Criteria:
- All swap tests pass
- Secondary token amounts match expected calculations
- Error cases handled gracefully

### Checkpoint 2.2: Test `burn_secondary()` Function ✅
**Goal**: Validate Secondary → Primary conversion with ICP return

#### Tasks:
- [ ] Create test `test_burn_basic`
  - [ ] Setup: User has 1000 secondary tokens
  - [ ] Burn 100 secondary tokens
  - [ ] Verify primary tokens minted (at initial rate)
  - [ ] Verify 50% ICP value returned
- [ ] Create test `test_burn_insufficient_balance`
  - [ ] User with 50 tokens tries to burn 100
  - [ ] Verify proper error
- [ ] Create test `test_burn_at_halving_boundary`
  - [ ] Setup: Set total burned to 4999 tokens
  - [ ] Burn 2 tokens (crosses 5000 threshold)
  - [ ] Verify first token at old rate, second at new rate
- [ ] Create test `test_burn_rate_calculation`
  - [ ] Test burns at different total_burned amounts
  - [ ] Verify rates match tokenomics schedule

#### Success Criteria:
- Burn amounts match tokenomics calculations
- ICP returns are exactly 50% of value
- Halving boundaries work correctly

### Checkpoint 2.3: Test `stake()` Function ✅
**Goal**: Validate primary token staking

#### Tasks:
- [ ] Create test `test_stake_basic`
  - [ ] User has 1000 primary tokens
  - [ ] Approve and stake 500 tokens
  - [ ] Verify staked balance updated
  - [ ] Verify tokens transferred to icp_swap
- [ ] Create test `test_stake_multiple_users`
  - [ ] Alice stakes 1000, Bob stakes 2000
  - [ ] Verify individual stake amounts
  - [ ] Verify total staked = 3000
- [ ] Create test `test_stake_insufficient_balance`
  - [ ] User with 100 tokens tries to stake 200
  - [ ] Verify proper error

#### Success Criteria:
- Staking updates user records correctly
- Total staked amount is accurate
- Can query individual stake amounts

---

## Phase 3: Distribution System (Days 6-7)

### Checkpoint 3.1: Test Distribution Mechanics ✅
**Goal**: Validate hourly distribution calculations

#### Tasks:
- [ ] Create test `test_distribution_basic`
  - [ ] Setup: 300 ICP in distribution pool
  - [ ] Alice staked 1000, Bob staked 2000 (1:2 ratio)
  - [ ] Advance time 1 hour
  - [ ] Trigger distribution
  - [ ] Verify 3 ICP distributed (1% of 300)
  - [ ] Verify Alice gets 1 ICP, Bob gets 2 ICP rewards
- [ ] Create test `test_distribution_no_stakers`
  - [ ] 100 ICP in pool, no stakers
  - [ ] Trigger distribution
  - [ ] Verify no errors, ICP stays in pool
- [ ] Create test `test_distribution_timing`
  - [ ] Trigger distribution
  - [ ] Advance 30 minutes
  - [ ] Try to trigger again
  - [ ] Verify rejection (too soon)
  - [ ] Advance another 31 minutes
  - [ ] Verify distribution allowed

#### Success Criteria:
- Distributions happen exactly once per hour
- Reward splits match stake ratios
- Edge cases handled gracefully

### Checkpoint 3.2: Test Reward Claims ✅
**Goal**: Validate reward claiming and unstaking

#### Tasks:
- [ ] Create test `test_claim_rewards`
  - [ ] Setup: User has 10 ICP unclaimed rewards
  - [ ] Call claim_rewards()
  - [ ] Verify ICP transferred to user
  - [ ] Verify unclaimed balance reset to 0
- [ ] Create test `test_unstake_basic`
  - [ ] User has 1000 staked tokens
  - [ ] Unstake 500
  - [ ] Verify tokens returned
  - [ ] Verify stake record updated
- [ ] Create test `test_unstake_with_pending_rewards`
  - [ ] User has staked tokens + unclaimed rewards
  - [ ] Unstake all
  - [ ] Verify both tokens and rewards handled

#### Success Criteria:
- Claims transfer correct ICP amounts
- Unstaking returns exact token amounts
- Combined operations work correctly

---

## Phase 4: Tokenomics Validation (Days 8-9)

### Checkpoint 4.1: Validate Halving Schedule ✅
**Goal**: Ensure tokenomics matches specification exactly

#### Tasks:
- [ ] Create test `test_all_halving_thresholds`
  - [ ] Test each threshold in schedule
  - [ ] Verify rates match expected values
  - [ ] Verify no off-by-one errors
- [ ] Create test `test_total_supply_limits`
  - [ ] Burn tokens up to max supply
  - [ ] Verify minting stops at limit
  - [ ] Verify burns still return ICP
- [ ] Create data collection test
  - [ ] Run through entire token lifecycle
  - [ ] Collect data points at each threshold
  - [ ] Generate CSV for analysis

#### Success Criteria:
- All thresholds match specification
- Total minted never exceeds max supply
- Rate changes happen at exact boundaries

### Checkpoint 4.2: Frontend Prediction Comparison ✅
**Goal**: Ensure backend matches frontend calculations

#### Tasks:
- [ ] Port frontend calculation logic to Rust
- [ ] Create test `test_frontend_backend_parity`
  - [ ] For each threshold, compare:
    - Primary tokens minted
    - Burn rates
    - Total supply projections
- [ ] Create visualization test
  - [ ] Generate same data as frontend graphs
  - [ ] Output for manual comparison
- [ ] Document any discrepancies found

#### Success Criteria:
- Backend and frontend calculations match within 0.01%
- No systematic bias in calculations
- Edge cases handled identically

---

## Phase 5: Stress Testing (Day 10)

### Checkpoint 5.1: Load and Edge Case Testing ✅
**Goal**: Ensure system handles extreme scenarios

#### Tasks:
- [ ] Create test `test_many_stakers`
  - [ ] Add 1000 stakers with random amounts
  - [ ] Run distribution
  - [ ] Verify all get correct rewards
- [ ] Create test `test_rapid_operations`
  - [ ] Perform 100 swaps/burns/stakes rapidly
  - [ ] Verify state consistency
- [ ] Create test `test_numerical_limits`
  - [ ] Test with maximum u64 values
  - [ ] Test with 1 wei amounts
  - [ ] Verify no overflows/underflows

#### Success Criteria:
- System handles 1000+ simultaneous stakers
- Rapid operations don't break state
- Math is safe at all scales

---

## Implementation Guidelines

### For Each Test:
1. **Start Simple**: Test happy path first
2. **Add Complexity**: Then test edge cases
3. **Verify Math**: Always check calculations manually
4. **Document**: Add comments explaining expected behavior
5. **Assert Precisely**: Use exact values, not ranges

### Code Organization:
```rust
// Each checkpoint gets its own test module
mod test_swap {
    use super::*;
    
    #[test]
    fn test_swap_basic() { ... }
    
    #[test] 
    fn test_swap_insufficient_balance() { ... }
}
```

### Helper Functions to Build:
- `setup_user_with_icp(user: &str, amount: u64)`
- `setup_user_with_secondary(user: &str, amount: u64)`
- `setup_user_with_primary(user: &str, amount: u64)`
- `assert_balance_equals(user: &str, token: Principal, expected: u64)`
- `advance_and_distribute(env: &mut TestEnv, hours: u64)`

---

## Risk Mitigation

### Potential Blockers:
1. **ICP Ledger Mock Complexity**: Keep it minimal, only what we need
2. **Timing Issues**: Use deterministic time advancement
3. **Calculation Precision**: Use integer math, avoid floating point
4. **State Management**: Reset state between tests

### Fallback Plans:
- If mock ledger too complex → Use even simpler version
- If timing unpredictable → Mock time-based functions
- If math doesn't match → Add detailed logging to trace calculations

---

## Success Metrics

### Test Coverage Goals:
- ✅ 100% of public functions tested
- ✅ All error conditions have test cases  
- ✅ All tokenomics thresholds validated
- ✅ Edge cases documented and tested

### Performance Goals:
- Full test suite runs in < 30 seconds
- Individual tests complete in < 1 second
- No test requires > 100MB memory

### Quality Goals:
- Zero flaky tests
- All tests deterministic
- Clear assertion messages
- Comprehensive documentation

---

## Next Steps

1. **Review this plan** with the team
2. **Prioritize checkpoints** based on risk
3. **Assign complexity estimates** to each task
4. **Begin with Checkpoint 1.1** - Mock ICP Ledger

Each checkpoint is designed to be completed independently and provides immediate value. The plan progresses from basic functionality to complex scenarios, building confidence at each step.