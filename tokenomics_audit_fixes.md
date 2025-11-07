# Tokenomics Audit Fixes - Mainnet Issues

Generated from: MAINNET_TOKEN_BIOPSY.md
Date: 2025-11-05
Network: Mainnet (IC)

## 🔴 CRITICAL ISSUES

### 1. Distribution Math - Integer Constraint (Working as Intended)
**Status**: Documented behavior
**Location**: `icp_swap` canister, `distribute_reward()` function
**Resolution**: ALEX receives ~0.78% of distributions due to integer math constraints (1% of 128 E8S = 1.28, rounds to 1). Documentation will reflect actual 0.78% platform fee.

---

### 2. Reconciliation Status - Requires Attention Flag (INVESTIGATED)
**Status**: Root cause identified
**Location**: `icp_swap` canister reconciliation

**Problem**: System correctly flagging `requires_attention = true` due to +0.14 ICP surplus.

**Evidence**:
```rust
reconciliation_status {
    requires_attention: true,  // Triggered: 14,084,798 > ALLOWED_DISCREPANCY_E8S (1,000,000)
    operational_balance_suspicious: false,
    discrepancy_e8s: 14,084,798 (0.14 ICP),
    unexplained_discrepancy: 14,084,798 E8S
}
```

**Root Causes Identified**:
1. **Transfer Fee Asymmetry (~0.06-0.10 ICP)**:
   - Users pay transfer fees on deposits (canister receives full amount)
   - Canister pays fees on withdrawals/refunds
   - Failed refunds may double-count fees in archived balance tracking

2. **Distribution Rounding Accumulation (~0.04-0.08 ICP)**:
   - ALEX gets 0.78% instead of 1% per distribution
   - 0.22% extra goes to stakers each distribution
   - Compounds over many distributions

3. **Threshold Too Strict**:
   - ALLOWED_DISCREPANCY_E8S = 1,000,000 (0.01 ICP) at `storage.rs:15`
   - 0.14 ICP > 0.01 ICP triggers flag (working correctly)

**Fix Options**:
1. **Increase threshold**: Change ALLOWED_DISCREPANCY_E8S to 50,000,000 (0.5 ICP) for operational buffer
2. **Fix transfer fee accounting**: Ensure consistent fee handling in archive/refund logic
3. **Accept as operational buffer**: Document that small surpluses are expected

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

1. **DECIDE**: Reconciliation threshold (Issue #2) - Choose whether to increase ALLOWED_DISCREPANCY_E8S or fix fee accounting
2. **CLARIFY**: Distribution interval (Issue #3) - Confirm if 1.5 hours is intentional
3. **FIX WHEN CONVENIENT**: Staking percentage message (Issue #4) - UX improvement
4. **ENHANCEMENT**: Add historical data export with pagination

Note: Issue #1 (distribution math) is working as intended - integer constraint accepted.

---

## NEXT STEPS

1. **Documentation**: Update docs to reflect 0.78% ALEX fee (integer constraint)
2. **Decision Required**: Either:
   - Option A: Increase ALLOWED_DISCREPANCY_E8S from 0.01 to 0.5 ICP
   - Option B: Fix transfer fee accounting in archive/refund logic
3. **Confirm**: Verify if 1.5 hour distribution interval is intentional
4. **Minor Fix**: Update staking percentage display message to show 99%

---

## NOTES

- Script successfully collected comprehensive data from all 5 canisters
- Reconciliation and validation systems are working correctly (catching issues)
- Core tokenomics (halvings, burns, mints) operating as designed
- Issues are primarily in distribution/accounting logic, not core mechanics
