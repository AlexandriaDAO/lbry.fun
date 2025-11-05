# Tokenomics Audit Fixes - Mainnet Issues

Generated from: MAINNET_TOKEN_BIOPSY.md
Date: 2025-11-05
Network: Mainnet (IC)

## 🔴 CRITICAL ISSUES

### 1. Distribution Math Error - ALEX Fee Calculation
**Status**: Needs immediate investigation
**Location**: `icp_swap` canister, `distribute_reward()` function

**Problem**: Platform fee (ALEX) is receiving less than 1% of distributions due to integer rounding.

**Evidence from logs**:
```
Pool: 12,805 E8S → Distributed 128 E8S (1%)
- ALEX: 1 E8S (0.78% of 128)
- Stakers: 127 E8S (99.22% of 128)

Pool: 12,934 E8S → Distributed 129 E8S (1%)
- ALEX: 1 E8S (0.775% of 129)
- Stakers: 128 E8S (99.225% of 129)

Pool: 13,064 E8S → Distributed 130 E8S (1%)
- ALEX: 1 E8S (0.77% of 130)
- Stakers: 129 E8S (99.23% of 130)
```

**Expected Behavior**:
```
Pool: 12,805 E8S → Distribute 128 E8S (1%)
- ALEX: 1.28 E8S (1% of 128)
- Stakers: 126.72 E8S (99% of 128)
```

**Root Cause**: Likely doing integer division and giving remainder to stakers instead of properly calculating percentages with the ALEX fee first.

**Impact**:
- ALEX is receiving ~0.75-0.8% instead of 1% of distributions
- Stakers receiving slightly more than intended (99.2% instead of 99%)
- Over time, this compounds to significant underpayment to platform

**Fix Required**:
- Calculate ALEX amount first: `alex_amount = total_to_distribute * ALEX_FEE_PERCENTAGE / 100`
- Then stakers get remainder: `staker_amount = total_to_distribute - alex_amount`
- OR use proper fractional math with scaling factor

---

### 2. Reconciliation Status - Requires Attention Flag
**Status**: Active warning
**Location**: `icp_swap` canister reconciliation

**Problem**: System is flagging `requires_attention = true` in reconciliation status.

**Evidence**:
```rust
reconciliation_status {
    requires_attention: true,
    operational_balance_suspicious: false,
    discrepancy_e8s: 14,084,798 (0.14 ICP),
    unexplained_discrepancy: 14,084,798 E8S
}
```

**Details**:
- Actual balance: 75.68 ICP
- Expected balance: 75.54 ICP
- Discrepancy: +0.14 ICP (surplus)
- All validation checks pass ✓

**Analysis**:
- Small positive discrepancy (<0.5 ICP) may be acceptable operational buffer
- However, system is correctly flagging it for review
- Need to trace where this 0.14 ICP came from

**Fix Required**:
1. Investigate source of +0.14 ICP surplus
2. If legitimate operational buffer, adjust `requires_attention` threshold
3. If accounting error, fix the source and reconcile

---

## ⚠️ CONFIGURATION ISSUES

### 3. Distribution Interval Mismatch
**Status**: Needs clarification
**Location**: `icp_swap` canister initialization

**Problem**: Distribution interval is 1.5 hours instead of expected 1 hour.

**Evidence**:
- Expected: 3,600 seconds (1 hour)
- Actual: 5,398 seconds (~1.5 hours)

**Questions**:
1. Is this intentional for mainnet?
2. Was this changed after deployment?
3. Should documentation be updated to reflect 1.5 hour intervals?

**Impact**:
- Rewards distributed less frequently than documented
- APY calculations may be based on wrong interval
- User expectations may not match reality

**Fix Required**:
- If intentional: Update documentation
- If error: Deploy fixed canister with 3,600 second interval

---

### 4. Staking Percentage Display Message
**Status**: Cosmetic/UX issue
**Location**: `icp_swap::get_current_staking_reward_percentage()`

**Problem**: Function returns "Staking percentage 1%" when it should indicate 99%.

**Evidence**:
```
get_current_staking_reward_percentage() → "Staking percentage 1%"
```

**Expected**:
```
"Staking percentage 99%"
OR
"Stakers receive 99% of the 1% pool distribution"
```

**Impact**:
- Confusing for users reading this value
- May mislead developers/auditors
- Frontend may display incorrect information

**Fix Required**:
- Update return message to show 99% (staker portion)
- OR clarify message: "Platform fee: 1%, Stakers: 99%"

---

## ✅ WORKING CORRECTLY

### Halving Mechanics ✓
- Currently at threshold index: 5/24
- Total burned: 5,663,571 secondary tokens
- Next threshold: 7,593,750 (74.6% progress)
- Current reward rate: 0.5904 primary per burn
- Reward decrease: 10% per halving (10000 → 9000 → 8100 → 7290 → 6561 → 5904) ✓

### Token Economics ✓
- Primary supply: 433.97M tokens distributed
- Secondary supply: 2.93M tokens minted (5.66M burned net)
- Deflationary pressure working as designed ✓

### System Health ✓
- Total stakers: 49 participants
- Unclaimed rewards: 75.47 ICP
- Total distributed: 5,346.99 ICP (left system successfully)
- Failed transactions: 0 ✓
- All validation checks passed ✓

---

## 📊 MISSING/TRUNCATED DATA

### Historical Performance Data
**Status**: Data collected but display truncated

**Issue**: The following data exists in the biopsy but was truncated due to size:
1. Hourly snapshots from logs canister (showing "[Omitted long context line]")
2. Historical APY values (showing "[Omitted long context line]")
3. Complete staking data (all 49 stakers)

**Impact**: Cannot analyze:
- Supply growth trends over time
- APY performance and volatility
- Staking concentration/distribution
- Timeline of halving events

**Solution Needed**:
- Extract logs canister data separately
- Parse and visualize in dedicated analytics tool
- Consider adding data export endpoints with pagination

---

## PRIORITY ORDER

1. **FIX IMMEDIATELY**: Distribution math error (Issue #1) - Platform is losing fees
2. **INVESTIGATE**: +0.14 ICP discrepancy (Issue #2) - Understand source
3. **CLARIFY**: Distribution interval (Issue #3) - Intentional or bug?
4. **FIX WHEN CONVENIENT**: Staking percentage message (Issue #4) - UX improvement
5. **ENHANCEMENT**: Add historical data export with pagination

---

## NEXT STEPS

1. Review distribute_reward() function in icp_swap.rs for fee calculation logic
2. Trace the +0.14 ICP discrepancy through transaction history
3. Confirm intended distribution interval with team
4. Create fix branch and test changes on local deployment
5. Plan mainnet upgrade strategy for fixes

---

## NOTES

- Script successfully collected comprehensive data from all 5 canisters
- Reconciliation and validation systems are working correctly (catching issues)
- Core tokenomics (halvings, burns, mints) operating as designed
- Issues are primarily in distribution/accounting logic, not core mechanics
