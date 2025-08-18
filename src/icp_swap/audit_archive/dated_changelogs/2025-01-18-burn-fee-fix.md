# ICP Swap Change Log - 2025-01-18

## Fixed ICP Transfer Fee Accounting in Burn Operations

### Changes Made:

1. **update.rs (burn_secondary function - lines 386-412)**:
   - Fixed reward pool accounting to include the ICP transfer fee (10,000 E8S)
   - When sending ICP refund to users, the total deducted from canister is amount + fee
   - Updated REWARD_POOL deduction to account for both the refund amount and transfer fee
   - Updated logging to show the total amount deducted including fee

### Problem Fixed:
- Each burn operation was creating a 0.0001 ICP (10,000 E8S) discrepancy in treasury accounting
- The reward pool was only being reduced by the refund amount, not the refund + transfer fee
- This caused cumulative discrepancies that increased by 0.0001 ICP per burn

### Root Cause:
- The `send_icp` function sends `amount` to the user but charges `amount + ICP_TRANSFER_FEE` from the canister
- The reward pool tracking was only deducting `amount`, not accounting for the fee
- This created a mismatch between actual ICP leaving the canister and the tracked amount

### Solution:
- Changed `REWARD_POOL` deduction from `amount_icp_e8s` to `amount_icp_e8s + ICP_TRANSFER_FEE`
- Added variable `total_deducted = amount_icp_e8s + ICP_TRANSFER_FEE` for clarity
- This ensures the reward pool tracking matches the actual ICP leaving the canister

### Impact:
- Treasury accounting now correctly tracks all ICP movements
- Eliminates the 0.0001 ICP discrepancy per burn operation
- Improves accuracy of reconciliation and treasury reporting
- No changes to user-facing behavior - users still receive the same refund amount

### Testing Recommendation:
- Perform multiple burn operations and verify treasury discrepancy remains at 0

## Push-Based Fee Distribution Implementation

### Changes Made:

1. **script.rs (lines 301-305, 336-358)**:
   - Added 24-hour timer for automatic fee pushing
   - Added `push_alex_fees_wrapper()` function that calls modified collection logic
   - Fixed line 351: Changed `register_error_log` to `register_info_log` (function doesn't exist)

2. **update.rs (lines 1773-1822)**:
   - Removed `CollectionResult` and `CollectionError` types
   - Modified `collect_alex_fees()` to `collect_alex_fees_internal()` (removed guard)
   - Set MIN_PUSH_AMOUNT to 0.1 ICP (10,000,000 E8S)
   - Removed unused `add_to_reward_pool()` function

3. **lbry_fun/collection.rs (complete rewrite)**:
   - Removed 600+ lines of complex collection orchestration code
   - Replaced with simple 213-line swap and burn module
   - Removed all state tracking except total burned amount

4. **lbry_fun/update.rs (lines 680-683, 698-702)**:
   - Updated init() and post_upgrade() to use init_swap_timer()
   - Removed calls to init_collection_timer() and init_reconciliation_timer()

### Impact:
- Platform fees automatically push every 24 hours when > 0.1 ICP
- UNCOLLECTED_ALEX_FEES empties to 0 when pushed, maintains perfect reconciliation
- Eliminates need for external collection orchestration
- Simple, predictable daily cycle
- ~480 line reduction in lbry_fun canister
- Zero inter-canister calls for fee collection
- Each burn should no longer add 0.0001 ICP to the discrepancy