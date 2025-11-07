# ICP Swap Canister: 0.14 ICP Discrepancy Investigation Plan

## Executive Summary

This investigation plan outlines a systematic approach to identify the EXACT source of a +0.14 ICP surplus in the icp_swap canister that accumulates slowly over time during distributions.

**Status**: The reconciliation system correctly flags the discrepancy when it exceeds 0.01 ICP threshold. This is a POSITIVE surplus (more ICP than expected), suggesting ICP is entering the system through untracked means rather than leaking out.

**Key Insight**: A positive discrepancy suggests one of two scenarios:
1. ICP is being added to the canister but not tracked in accounting
2. ICP is being removed from internal accounting but not from the ledger

## Background Context

### What We Know

1. **Discrepancy Type**: +0.14 ICP surplus (actual balance > expected balance)
2. **Growth Pattern**: Accumulates slowly over time during distributions
3. **Recent Fixes**: Multiple reconciliation and distribution fixes were applied in 2025-08 (see RECONCILIATION_FIX_PLAN_V2.md)
4. **Detection**: The reconciliation system at lines 196-277 in queries.rs correctly identifies this

### Previous Fixes Applied

From RECONCILIATION_FIX_PLAN_V2.md:
- **2025-01-15**: Fixed distribute_reward() to prevent phantom ICP when no stakers
- **2025-08-06**: Fixed burn_secondary to deduct refunds from REWARD_POOL
- **2025-08-14**: Fixed CEI pattern in claim_icp_reward
- Added TOTAL_CLAIMED_REWARDS tracking

## Investigation Methodology

### Phase 1: ICP Flow Path Analysis

#### 1.1 Map ALL ICP Entry Points

**File**: `src/icp_swap/src/update.rs`

**Entry Points to Analyze**:

1. **swap() [Lines 121-226]**
   ```rust
   - Receives: amount_icp (E8S)
   - Adds to REWARD_POOL: amount_icp (Line 162)
   - Fee: ICP_TRANSFER_FEE deducted by ledger (10,000 E8S = 0.0001 ICP)
   
   TRACE:
   - User balance decreases by: amount_icp + ICP_TRANSFER_FEE
   - Canister receives: amount_icp (fee paid separately)
   - REWARD_POOL increases by: amount_icp
   
   POTENTIAL ISSUE:
   - If ledger balance increases by amount_icp + something, but we only track amount_icp in REWARD_POOL
   ```

2. **burn_secondary() [Lines 229-480]**
   ```rust
   - Burns secondary tokens
   - Refunds 50% ICP to user
   - Lines 390-413: Deducts (amount_icp_e8s + ICP_TRANSFER_FEE) from REWARD_POOL
   
   TRACE:
   - Canister balance decreases by: amount_icp_e8s + ICP_TRANSFER_FEE
   - REWARD_POOL decreases by: amount_icp_e8s + ICP_TRANSFER_FEE
   
   POTENTIAL ISSUE:
   - Are we correctly calculating the 50% ICP refund amount?
   - Line 262-283: Complex calculation with division by (icp_rate_in_cents * 2)
   - Could rounding here cause accumulation?
   ```

3. **transfer_icp_to_lbry_fun() [Lines 1810-1840]**
   ```rust
   - Sends UNCOLLECTED_ALEX_FEES to lbry_fun canister
   - Called by push_alex_fees_wrapper every 4 hours
   
   TRACE:
   - Canister balance decreases by: amount + ICP_TRANSFER_FEE
   - UNCOLLECTED_ALEX_FEES decreases by: amount
   
   POTENTIAL ISSUE:
   - Transfer fee handling on outbound transfers
   ```

#### 1.2 Map ALL ICP Exit Points

**File**: `src/icp_swap/src/update.rs`

**Exit Points to Analyze**:

1. **burn_secondary() refund [Line 378]**
   - Already analyzed above

2. **claim_icp_reward() [Lines 1252-1383]**
   ```rust
   - Sends staking rewards to users
   - Line 1297: amount_after_fee = reward_u64 - ICP_TRANSFER_FEE
   - Line 1327: send_icp()
   - Line 1308: sub_to_unclaimed_amount(stake.reward_icp)
   - Line 1320: stake.reward_icp = 0
   - Line 1356: add_to_total_claimed_rewards(amount_after_fee)
   
   TRACE:
   - Canister balance decreases by: amount_after_fee + ICP_TRANSFER_FEE = reward_u64
   - TOTAL_UNCLAIMED_ICP_REWARD decreases by: stake.reward_icp (u128)
   - TOTAL_CLAIMED_REWARDS increases by: amount_after_fee (u64)
   
   POTENTIAL ISSUE:
   - Type mismatch: stake.reward_icp is u128, amount_after_fee is u64
   - If stake.reward_icp > u64::MAX, conversion could fail
   - Line 1282: safe_reward_to_transfer_amount() converts u128 to u64
   ```

3. **redeem() [Lines 1511-1609]**
   ```rust
   - Refunds archived ICP from failed operations
   - Line 1554: sub_to_total_archived_balance(trx.icp)
   - Line 1571: send_icp()
   
   TRACE:
   - Canister balance decreases by: trx.icp + ICP_TRANSFER_FEE
   - TOTAL_ARCHIVED_BALANCE decreases by: trx.icp
   
   POTENTIAL ISSUE:
   - Are we tracking the transfer fee correctly?
   - The archived amount doesn't include the fee for the refund
   ```

#### 1.3 Analyze distribute_reward() [Lines 887-1010]

**Critical Section**: This runs on a timer and distributes 1% of the reward pool.

```rust
Line 889: reward_pool = REWARD_POOL.get()
Line 898: total_distribution = reward_pool / 100  // Integer division!
Line 901: alex_portion = total_distribution / 100  // Integer division!
Line 902: lp_portion = total_distribution - alex_portion  // Remainder

Line 905-908: UNCOLLECTED_ALEX_FEES += alex_portion
Line 911: total_staked = get_total_primary_staked()

If total_staked == 0:
  Line 915-917: REWARD_POOL -= alex_portion (LP stays in pool)
Else:
  Line 930-933: REWARD_POOL -= total_distribution (full amount removed)
```

**POTENTIAL ISSUES**:

1. **Integer Division Rounding**:
   ```
   Example: reward_pool = 999,999 E8S
   total_distribution = 999,999 / 100 = 9,999 E8S (0.99 E8S lost to rounding)
   
   Over many distributions, this rounding could accumulate in the pool
   ```

2. **Staker Reward Distribution** [Lines 940-966]:
   ```rust
   Line 952: stake_ratio = (stake.amount * SCALING_FACTOR) / total_staked
   Line 953: icp_reward = (lp_portion * stake_ratio) / SCALING_FACTOR
   
   Each calculation involves division - more rounding!
   ```

3. **Double Rounding**:
   - First rounding: total_distribution = reward_pool / 100
   - Second rounding: alex_portion = total_distribution / 100
   - Third rounding: per-staker calculations
   - Fourth rounding: total_distributed accumulation

4. **Sum vs Theoretical Mismatch**:
   ```rust
   Line 937: total_distributed = 0
   Lines 956: total_distributed += icp_reward  // Sum of actual distributions
   Line 970: add_to_unclaimed_amount(total_distributed)
   
   CRITICAL: We distribute based on lp_portion, but sum up what was ACTUALLY distributed
   If rounding causes sum(icp_reward) < lp_portion, the difference stays untracked!
   ```

### Phase 2: Rounding and Fee Accumulation Analysis

#### 2.1 Transfer Fee Accounting

**Every ICP transfer charges 10,000 E8S (0.0001 ICP)**

Check if transfer fees are properly accounted for in ALL operations:

1. **swap()**: User pays fee, but does canister account for this?
2. **burn_secondary()**: Line 390 subtracts `amount_icp_e8s + ICP_TRANSFER_FEE` from REWARD_POOL ✓
3. **claim_icp_reward()**: Tracks amount_after_fee, but what about the fee itself?
4. **redeem()**: Does not appear to track the fee for the refund transfer
5. **transfer_icp_to_lbry_fun()**: Fee handling?

**Hypothesis**: If transfer fees are paid FROM the canister balance but not always tracked in internal accounting, they could accumulate as surplus.

#### 2.2 E8S Rounding Accumulation

**Test Case to Create**:
```rust
// Simulate 1000 distributions with various pool sizes
let mut pool = 123_456_789_012; // ~1,234 ICP
let mut accumulated_dust = 0;

for _ in 0..1000 {
    let distribution = pool / 100;
    let alex = distribution / 100;
    let lp = distribution - alex;
    
    // Simulate per-staker rounding
    let staker1_share = (lp * 60) / 100; // 60% staker
    let staker2_share = (lp * 40) / 100; // 40% staker
    let actual_distributed = staker1_share + staker2_share;
    
    accumulated_dust += lp - actual_distributed;
    pool -= distribution;
}

// Does accumulated_dust ≈ 0.14 ICP (14,000,000 E8S)?
```

#### 2.3 u128 to u64 Conversion Issues

**File**: `src/icp_swap/src/update.rs`, Line 879-884

```rust
fn safe_reward_to_transfer_amount(reward: u128) -> Result<u64, ExecutionError> {
    reward.try_into()
        .map_err(|_| ExecutionError::ConversionError {
            details: format!("Reward amount {} exceeds maximum transferable amount", reward)
        })
}
```

**Potential Issue**: If stake.reward_icp is stored as u128 but capped at u64::MAX during conversion, could the difference accumulate?

### Phase 3: Historical Data Analysis

#### 3.1 Examine Logs Canister Data

**File**: `src/logs/src/*`

The logs canister may collect statistical snapshots. Examine:
1. Historical balance snapshots
2. Distribution events
3. Timing of discrepancy growth

#### 3.2 Create Forensic Test

**File**: `tests/tests/integration/icp_discrepancy_forensics.rs` (NEW)

```rust
#[test]
fn trace_icp_through_full_lifecycle() {
    let env = setup_test_environment();
    
    // Track EVERY E8S through the system
    let mut ledger_tracker = LedgerTracker::new();
    let mut internal_tracker = InternalAccountingTracker::new();
    
    // 1. Swap operations
    ledger_tracker.record_swap(user, amount);
    internal_tracker.record_swap(amount);
    assert_eq!(ledger_tracker.balance(), internal_tracker.expected_balance());
    
    // 2. Multiple distributions
    for _ in 0..100 {
        ledger_tracker.record_distribution();
        internal_tracker.record_distribution();
        
        let discrepancy = ledger_tracker.balance() - internal_tracker.expected_balance();
        println!("After distribution {}: discrepancy = {}", i, discrepancy);
    }
    
    // 3. Burns
    // 4. Claims
    // 5. Analyze where discrepancy appears
}
```

### Phase 4: Code Audit Checklist

#### 4.1 Critical Arithmetic Operations

Review EVERY instance of:
- `/ 100` (distribution percentages)
- `/ SCALING_FACTOR` (precision calculations)
- `saturating_add()` (could hide overflows)
- `saturating_sub()` (could hide underflows)
- Type conversions between u64 and u128

#### 4.2 State Update Patterns

For EVERY function that moves ICP:
```
[ ] Ledger balance change tracked?
[ ] Internal accounting updated?
[ ] Transfer fee accounted for?
[ ] Rounding documented?
[ ] Error cases reverse state correctly?
```

#### 4.3 Reconciliation Formula Verification

**File**: `src/icp_swap/src/queries.rs`, Lines 196-277

Current formula:
```rust
expected = reward_pool + uncollected_alex + total_staked + archived_balance
actual = ledger balance
discrepancy = actual - expected
unexplained = discrepancy + claimed_rewards
```

**Verify**:
- [ ] Does `total_staked` sum match TOTAL_UNCLAIMED_ICP_REWARD?
- [ ] Does `archived_balance` sum match ARCHIVED_TRANSACTION_LOG?
- [ ] Are there any other ICP holdings not in this formula?
- [ ] Primary token balance held in canister?
- [ ] Secondary token balance held in canister?

### Phase 5: Reproduction Strategy

#### 5.1 Minimal Reproduction Test

```bash
# Goal: Create exactly 0.14 ICP discrepancy in controlled environment

1. Fresh deployment (0 discrepancy)
2. Swap exactly X ICP to create pool
3. Trigger Y distributions
4. Measure discrepancy growth

# Binary search to find X and Y that produce ~0.14 ICP surplus
```

#### 5.2 Instrumented Test

Modify `distribute_reward()` temporarily to log:
```rust
register_info_log(
    Principal::anonymous(),
    "distribute_reward_debug",
    &format!(
        "pool_before: {}, distribution_calculated: {}, alex: {}, lp: {}, \
         actual_distributed: {}, pool_after: {}, dust: {}",
        reward_pool, total_distribution, alex_portion, lp_portion,
        total_distributed, new_pool, lp_portion - total_distributed
    )
);
```

### Phase 6: Data Sources for Investigation

#### 6.1 Production Data

If available:
1. Current reconciliation status
2. Number of distributions that have occurred
3. Number of stakers
4. Historical claim amounts

#### 6.2 Test Data Generation

Create controlled scenarios:
1. Many distributions, no stakers (tests alex_portion handling)
2. Many distributions, one staker (tests rounding with simple ratio)
3. Many distributions, many stakers (tests complex rounding accumulation)
4. Mixed operations (swap, burn, stake, claim, distribute)

## Hypothesis Ranking (Most to Least Likely)

### 1. Integer Division Rounding in distribute_reward() [HIGH]

**Evidence**:
- Multiple division operations per distribution
- Line 952-953: per-staker rounding
- Line 937-956: sum of actual vs theoretical distribution
- Grows slowly over time (matches description)

**Test**: Run 100+ distributions and track `lp_portion - total_distributed`

### 2. Transfer Fee Accounting Gaps [MEDIUM-HIGH]

**Evidence**:
- Transfer fees (0.0001 ICP each) could accumulate to 0.14 ICP over 1400 operations
- Some operations may not properly track the fee portion

**Test**: Audit every `send_icp()` call and verify fee accounting

### 3. Burn Refund Calculation Rounding [MEDIUM]

**Evidence**:
- Lines 262-283: Complex calculation with multiple divisions
- Burns happen frequently
- Each burn involves: amount_icp_e8s = (amount_secondary * 100_000_000) / (icp_rate_in_cents * 2)

**Test**: Verify refund amount matches what's added back to pool

### 4. Archive Balance Management [LOW-MEDIUM]

**Evidence**:
- ARCHIVED_TRANSACTION_LOG tracks failed operations
- Could be edge cases where archive isn't properly credited

**Test**: Check archived balance consistency

### 5. Claimed Rewards Tracking Lag [LOW]

**Evidence**:
- TOTAL_CLAIMED_REWARDS was recently added
- Type conversion from u128 to u64

**Test**: Verify sum of claims matches tracking

## Investigation Execution Steps

### Step 1: Quick Diagnostic (1 hour)

```bash
# Check current state
dfx canister call <icp_swap> get_reconciliation_status
dfx canister call <icp_swap> get_reward_pool_status
dfx canister call <icp_swap> get_distribution_interval

# Check if it's a rounding issue
# If 0.14 ICP = 14,000,000 E8S
# And distributions happen every hour
# 14,000,000 / number_of_distributions = E8S lost per distribution
```

### Step 2: Add Instrumentation (2 hours)

Add detailed logging to `distribute_reward()` to track:
- Calculated lp_portion
- Sum of actual distributions
- The difference (dust)

### Step 3: Create Reproduction Test (3 hours)

Build the forensic test described in Phase 3.2

### Step 4: Audit Transfer Fees (2 hours)

Check EVERY occurrence of `ICP_TRANSFER_FEE` and verify accounting

### Step 5: Deep Dive into Top Hypothesis (4 hours)

Based on Steps 1-4 results, focus investigation

## Success Criteria

1. [ ] Identified EXACT code location causing surplus
2. [ ] Reproduced 0.14 ICP discrepancy in test environment
3. [ ] Understood mathematical cause (rounding vs fee vs bug)
4. [ ] Documented fix without introducing new issues
5. [ ] Created regression test

## Tools and Utilities

### Code Search Commands

```bash
# Find all ICP movements
rg "REWARD_POOL" src/icp_swap/src/update.rs
rg "send_icp|transfer_icp" src/icp_swap/src/
rg "ICP_TRANSFER_FEE" src/icp_swap/src/

# Find all arithmetic that could round
rg "/ 100|/ SCALING_FACTOR" src/icp_swap/src/update.rs
rg "saturating_" src/icp_swap/src/update.rs
```

### Analysis Scripts

```bash
# Calculate expected dust from rounding
cat > analyze_rounding.py << 'PYTHON'
def simulate_distribution(pool_size, num_stakers, num_distributions):
    dust = 0
    for i in range(num_distributions):
        distribution = pool_size // 100
        alex = distribution // 100
        lp = distribution - alex
        
        # Simulate staker distribution
        distributed = 0
        for s in range(num_stakers):
            stake_reward = lp // num_stakers
            distributed += stake_reward
        
        dust += lp - distributed
        pool_size -= distribution
    
    return dust

# Test various scenarios
print("1000 distributions, 10 stakers:", simulate_distribution(500_000_000_000, 10, 1000))
PYTHON
```

## Red Flags to Watch For

1. **Saturating arithmetic hiding issues**: Check if any `saturating_add/sub` is silently capping
2. **Type conversion losses**: u128 → u64 conversions
3. **Fee paid twice**: Transfer fee deducted from balance AND internal accounting
4. **Rounding always in one direction**: If always rounds down, ICP could accumulate
5. **State updates in wrong order**: CEI pattern violations

## Next Steps After Investigation

Once the root cause is identified:

1. **Document findings** in a new file: `ICP_DISCREPANCY_ROOT_CAUSE.md`
2. **Create fix plan** similar to RECONCILIATION_FIX_PLAN_V2.md
3. **Write regression test** that fails before fix, passes after
4. **Update reconciliation** to account for the issue if it's expected behavior
5. **Record in changelog**: `src/icp_swap/ICP_SWAP_CHANGE_LOG.md`

## Questions to Answer

- [ ] What is the rate of accumulation? (0.14 ICP per how many distributions?)
- [ ] Does it happen with 0 stakers? With 1 staker? With many stakers?
- [ ] Does it happen without burn operations?
- [ ] Does it happen without claim operations?
- [ ] Is it exactly 0.14 ICP or approximately?
- [ ] Has it been growing linearly over time?

## References

- `src/icp_swap/RECONCILIATION_FIX_PLAN_V2.md` - Previous reconciliation fixes
- `src/icp_swap/ICP_SWAP_CHANGE_LOG.md` - History of all changes
- `src/icp_swap/audit_archive/dated_changelogs/2025-08-06-staking-distribution-fix.md` - Burn refund fix
- Lines 887-1010 in `src/icp_swap/src/update.rs` - distribute_reward() implementation
- Lines 196-277 in `src/icp_swap/src/queries.rs` - Reconciliation logic

---

**Investigation Owner**: [To be assigned]
**Created**: 2025-11-06
**Status**: Ready for execution
**Priority**: Medium (system is functioning, but needs explanation)
