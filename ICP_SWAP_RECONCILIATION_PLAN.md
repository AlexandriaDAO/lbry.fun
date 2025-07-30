# ICP Swap Ledger Reconciliation Implementation Plan

## Executive Summary

This document outlines the implementation of a ledger reconciliation query function for the ICP Swap canister. This query will enable detection of discrepancies between actual ICP ledger balances and internal accounting state.

**IMPORTANT**: The ICP Swap canister has been audited. All changes must be minimal, non-invasive, and preserve existing functionality.

## Security Considerations

### Audit Impact Assessment
1. **No State Changes**: This implementation only adds a read-only query function
2. **No Update Function Modifications**: All existing logic remains untouched
3. **Uses Existing Infrastructure**: Leverages already-audited `fetch_canister_icp_balance()` function
4. **Integer-Only Arithmetic**: No floating-point operations that could introduce precision errors
5. **No New Attack Vectors**: Query functions cannot modify state or affect canister operations

### Risk Level: **LOW**
- Changes are additive only (new query function)
- No modifications to existing audited code paths
- Read-only operations with no side effects

## Implementation Details

### Step 1: Add Reconciliation Types
**File**: `src/icp_swap/src/lib.rs`
```rust
// Add to existing types section

// Threshold for acceptable discrepancy (1 transfer fee)
pub const ALLOWED_DISCREPANCY_E8S: u64 = 10_000;

#[derive(CandidType, Deserialize)]
pub struct ReconciliationStatus {
    // Core balance tracking
    pub icp_balance_actual: u64,
    pub icp_balance_expected: u64,
    pub discrepancy_e8s: i64,  // No floating-point percentages
    
    // Component breakdown
    pub reward_pool: u64,
    pub uncollected_alex_fees: u64,
    pub uncollected_lp_fees: u64,
    pub total_staked: u64,
    pub operational_balance: u64,
    
    // Audit metadata
    pub timestamp: u64,
    pub canister_id: Principal,
    pub requires_attention: bool,
    pub operational_balance_suspicious: bool,
}
```

### Step 2: Make Balance Query Function Public
**File**: `src/icp_swap/src/utils.rs` (line 279)
```rust
// Change from pub(crate) to pub
pub async fn fetch_canister_icp_balance() -> Result<u64, ExecutionError> {
    // Existing implementation unchanged
}
```

### Step 3: Add Reconciliation Query
**File**: `src/icp_swap/src/queries.rs`
```rust
use crate::{fetch_canister_icp_balance, ReconciliationStatus, ALLOWED_DISCREPANCY_E8S};
use crate::storage::{REWARD_POOL, UNCOLLECTED_ALEX_FEES, UNCOLLECTED_LP_FEES, STAKES};

#[query]
pub async fn get_reconciliation_status() -> ReconciliationStatus {
    // 1. Get actual ICP balance from ledger using existing utility
    let actual_balance = match fetch_canister_icp_balance().await {
        Ok(balance) => balance,
        Err(_) => return ReconciliationStatus {
            // Return error state with all zeros
            icp_balance_actual: 0,
            icp_balance_expected: 0,
            discrepancy_e8s: 0,
            reward_pool: 0,
            uncollected_alex_fees: 0,
            uncollected_lp_fees: 0,
            total_staked: 0,
            operational_balance: 0,
            timestamp: ic_cdk::api::time(),
            canister_id: ic_cdk::api::id(),
            requires_attention: true,
            operational_balance_suspicious: false,
        }
    };
    
    // 2. Gather all components of expected balance
    let reward_pool = REWARD_POOL.with(|p| p.borrow().get(&()).unwrap_or(0));
    let uncollected_alex = UNCOLLECTED_ALEX_FEES.with(|f| f.borrow().get(&()).unwrap_or(0));
    let uncollected_lp = UNCOLLECTED_LP_FEES.with(|f| f.borrow().get(&()).unwrap_or(0));
    
    // 3. Calculate total staked (sum of all user stakes)
    let total_staked = STAKES.with(|stakes| {
        stakes.borrow().iter()
            .map(|(_, stake)| stake.amount)
            .sum::<u64>()
    });
    
    // 4. Calculate operational balance (for transfers, fees, etc)
    // This is balance not accounted for in other categories
    let accounted_balance = reward_pool + uncollected_alex + uncollected_lp + total_staked;
    let operational_balance = if actual_balance > accounted_balance {
        actual_balance - accounted_balance
    } else {
        0
    };
    
    // 5. Expected balance includes all components
    let expected_balance = reward_pool + uncollected_alex + uncollected_lp + total_staked + operational_balance;
    
    // 6. Calculate discrepancy (integer arithmetic only)
    let discrepancy = (actual_balance as i64) - (expected_balance as i64);
    
    // 7. Validate operational balance isn't suspiciously high
    // If operational balance is more than 10% of total staked, flag it
    let operational_balance_suspicious = if total_staked > 0 {
        operational_balance > (total_staked / 10)
    } else {
        operational_balance > 100_000_000  // 1 ICP for empty pools
    };
    
    ReconciliationStatus {
        icp_balance_actual: actual_balance,
        icp_balance_expected: expected_balance,
        discrepancy_e8s: discrepancy,
        reward_pool,
        uncollected_alex_fees: uncollected_alex,
        uncollected_lp_fees: uncollected_lp,
        total_staked,
        operational_balance,
        timestamp: ic_cdk::api::time(),
        canister_id: ic_cdk::api::id(),
        requires_attention: discrepancy.abs() as u64 > ALLOWED_DISCREPANCY_E8S || operational_balance_suspicious,
        operational_balance_suspicious,
    }
}
```

### Step 4: Update Candid Interface
**File**: `src/icp_swap/icp_swap.did`
```candid
// Add to existing types
type ReconciliationStatus = record {
    icp_balance_actual: nat64;
    icp_balance_expected: nat64;
    discrepancy_e8s: int64;
    reward_pool: nat64;
    uncollected_alex_fees: nat64;
    uncollected_lp_fees: nat64;
    total_staked: nat64;
    operational_balance: nat64;
    timestamp: nat64;
    canister_id: principal;
    requires_attention: bool;
    operational_balance_suspicious: bool;
};

// Add to service interface
service : {
    // ... existing methods ...
    get_reconciliation_status: () -> (ReconciliationStatus) query;
}
```

## Testing Requirements

1. **Unit Tests**: Test reconciliation calculations with various balance scenarios
2. **Integration Tests**: Verify query works correctly with live state
3. **Edge Cases**: Test with zero balances, maximum values, and error conditions
4. **Upgrade Tests**: Ensure query works after canister upgrades

## Deployment Notes

1. This change requires a canister upgrade
2. No state migration needed (query-only addition)
3. Existing functionality remains unchanged
4. Can be deployed independently of LBRY Fun changes

## Future Enhancements

If the operational balance consistently shows suspicious values, we can implement explicit operational balance tracking in a future update. This would require more substantial changes and a new audit.