# ICP Swap Change Log

## 2025-01-18: Improved Error Messages for Max Supply Mint Failures

### Changes Made:

1. **update.rs (burn_secondary function)**:
   - Updated error handling when `mint_primary` fails after successful burn
   - Added detection for max supply errors in the error message
   - Clarified that users have already received their ICP refund when mint fails

### Problem Fixed:
- When burning secondary tokens after max primary supply is reached, the error message incorrectly mentioned "check the redeem process"
- This was confusing because the ICP refund had already been sent successfully and redeem was not needed

### Solution:
- Error messages now correctly state:
  - "Maximum primary supply reached. You received your ICP refund but no primary tokens were minted." (for max supply errors)
  - "Primary token minting failed. You already received your ICP refund." (for other mint failures)
- Users are clearly informed that they have their ICP and don't need to use the redeem function

### Impact:
- Clearer user experience when burning at or near max supply
- No confusion about whether users need to redeem their ICP
- Accurate error messages that reflect the actual state

## 2025-01-16: Reconciliation Fix - Claimed Rewards Tracking & Distribution Logic Fix

### Changes Made:

1. **storage.rs**:
   - Added `TOTAL_CLAIMED_REWARDS_MEM_ID` (MemoryId 16) to track ICP that left via claims
   - Added thread-local storage and helper functions for tracking claimed rewards
   - Updated `ReconciliationStatus` struct with claimed rewards and unexplained discrepancy fields

2. **update.rs**:
   - Fixed `distribute_reward()` to only remove ALEX portion when no stakers exist
   - Modified `claim_icp_reward()` to track successfully claimed amounts
   - Prevents phantom ICP from disappearing when no stakers exist

3. **queries.rs**:
   - Fixed `get_reconciliation_status()` to properly calculate unexplained discrepancies
   - Added `get_total_claimed_rewards()` query function
   - Updated `validate_accounting()` to include claimed rewards in validation

4. **check_balances.sh**:
   - Added display of total claimed rewards
   - Updated reconciliation to show explained vs unexplained discrepancies

### Problems Fixed:

1. **Untracked Claimed Rewards**: The ~990 ICP persistent discrepancy was from historical claimed rewards that weren't being tracked.

2. **Phantom ICP on No Stakers**: When `distribute_reward()` ran with no stakers, it removed the full 1% from the pool but the 99% LP portion had nowhere to go, creating ~4946 ICP discrepancies.

3. **Bug #9**: Fixed the circular logic in reconciliation that was hiding real issues.

### Solution:

1. **Claimed Rewards Tracking**: Now tracks all ICP that successfully leaves via reward claims
2. **Smart Distribution**: When no stakers exist, only the 1% ALEX portion is removed from the pool; the 99% LP portion stays for future distributions
3. **Proper Reconciliation**: Unexplained discrepancy = actual - expected + claimed_rewards

### Impact:
- Fresh deployments will show 0 unexplained discrepancy
- Existing deployments can now explain their historical discrepancies
- Prevents phantom ICP from disappearing when no stakers exist
- All ICP movements are properly tracked and accounted for

### Technical Details:
- Claimed rewards are tracked AFTER successful ICP transfer (not before)
- Distribution logic now handles the no-staker case correctly
- The reconciliation formula: `expected = reward_pool + uncollected_fees + unclaimed + archived`
- Unexplained discrepancy: `actual - expected + claimed_rewards`

## 2025-08-14: Bug #9 - Fixed Reconciliation Double-Counting Error

### Changes Made:
1. **queries.rs - get_reconciliation_status() function (lines 230-242)**:
   - Fixed circular logic bug where operational_balance was calculated as `actual - accounted` then added back to expected_balance
   - Now calculates expected_balance from internal accounting components only (without operational_balance)
   - operational_balance now correctly represents unexplained positive discrepancy

### Problem:
The reconciliation function had a critical logic error that made it useless:
- It calculated `operational_balance = actual - accounted`
- Then added it back: `expected = accounted + operational_balance`
- This guaranteed `expected = actual`, making `discrepancy` always 0
- The function could never detect accounting errors, defeating its purpose

### Solution:
- Expected balance now only includes known accounting components
- Discrepancy properly shows difference between actual ledger balance and internal accounting
- Operational balance represents unexplained funds (could be fees, rounding, or bugs)
- Reconciliation now actually detects accounting errors as intended

### Impact:
This fix enables proper detection of:
- Accounting errors and bugs
- Double-spending issues
- Lost or stuck funds
- Unexplained balance discrepancies

---

## 2025-08-12: Treasury Reconciliation Query Fix

### Changes Made:
1. **queries.rs - get_reconciliation_status() function**:
   - Changed from `#[query]` to `#[update]` annotation
   - Added `update` import to use statement
   
2. **icp_swap.did**:
   - Removed `query` designation from `get_reconciliation_status` method signature

### Purpose:
Fixed runtime error where `get_reconciliation_status` was marked as a query but was making inter-canister calls (via `fetch_canister_icp_balance()`). Query methods in ICP cannot make network calls or inter-canister calls. This was causing "ic0_call_new cannot be executed in replicated query mode" errors.

### Technical Details:
- Query methods are read-only and execute locally on a single replica
- Update methods can make inter-canister calls but require consensus
- The reconciliation status needs to fetch real-time balance from ICP ledger, requiring an inter-canister call

## 2025-08-12: Burn Refund Accounting Fix

### Changes Made:
1. **update.rs - burn_secondary() function**:
   - Added REWARD_POOL deduction when ICP is refunded to users during burn
   - After successful `send_icp`, now deducts `amount_icp_e8s` from REWARD_POOL
   - Added logging to track the deduction

### Purpose:
Fixed critical accounting bug where burn refunds were not being deducted from REWARD_POOL. When users swap ICP for secondary tokens, the full amount goes into REWARD_POOL. But when they burn secondary tokens and receive 50% ICP back, this wasn't being deducted, causing phantom ICP accumulation in the pool.

### Technical Details:
- Uses `saturating_sub` to safely deduct from REWARD_POOL
- Maintains consistency: money in (swap) increases pool, money out (burn) decreases pool
- Ensures REWARD_POOL tracks net ICP (deposits minus refunds)

## 2025-08-09: Restored APY Tracking in distribute_reward()

### Changes Made:
1. **update.rs - distribute_reward() function**:
   - Added APY value tracking that was missing after reward pool refactor
   - Now stores `icp_reward_per_primary` in the APY map for historical tracking
   - Increments distribution interval counter with `add_to_distribution_intervals(1)`
   - Handles both cases: when stakers exist (stores actual rate) and when no stakers (stores 0)
   - Uses rolling 30-day window (index = intervals % MAX_DAYS)

### Purpose:
The APY tracking was lost when the distribution system was refactored from ALEX-based to PRIMARY-based rewards with the new reward pool system. This caused `get_all_apy_values()` to return an empty array, breaking APY calculations in the frontend.

### Technical Details:
- Calculates `icp_reward_per_primary = (lp_portion * SCALING_FACTOR) / total_staked`
- Stores in APY map at index `intervals % 30` for rolling window
- Maintains compatibility with frontend APY calculation logic

## 2025-08-04: Fixed lbry_fun canister ID for token status checks

### Changes Made:
1. **utils.rs**:
   - Fixed bug where `config.icp_ledger_id` was incorrectly used to get lbry_fun canister ID
   - Now directly uses the correct hardcoded lbry_fun canister ID ("oni4e-oyaaa-aaaap-qp2pq-cai")
   - This fixes the error: "Canister ryjl3-tyaaa-aaaaa-aaaba-cai has no update method 'get_token_status'"

### Purpose:
The code was incorrectly trying to call `get_token_status` on the ICP ledger canister instead of the lbry_fun canister.

## 2025-07-31: Token Status Checking Implementation (Simplified)

### Changes Made:

1. **storage.rs**:
   - Added `TOKEN_ID_MEM_ID` (MemoryId 15)
   - Added `TOKEN_ID: RefCell<u64>` thread-local storage
   - Added `CACHED_STATUS: RefCell<Option<(TokenStatus, u64)>>` for caching
   - Added simplified `TokenStatus` enum with only: Deploying, Live, Failed

2. **script.rs**:
   - Added `token_id: Option<u64>` to `InitArgs` struct
   - Updated `Default` implementation for `InitArgs`
   - Added token ID storage in `init()` function
   - Added `TOKEN_ID` import

3. **utils.rs**:
   - Added imports for `TOKEN_ID`, `CACHED_STATUS`, `TokenStatus`, and `Principal`
   - Removed hardcoded LBRY_FUN_CANISTER_ID constant
   - Simplified `check_can_trade()` function:
     - No fallback logic - requires token_id
     - 60-second status caching
     - Inter-canister call to lbry_fun's `get_token_status`
     - Simple status validation for Live/Failed/Deploying states
     - Uses config or default for lbry_fun canister ID
   - Kept `is_token_live()` for launch time check only

4. **update.rs**:
   - Replaced `is_token_live()` check with `check_can_trade().await?` in `swap()`
   - Replaced `is_token_live()` check with `check_can_trade().await?` in `burn_secondary()`
   - Added `check_can_trade` import

### Purpose:
These changes implement a simplified token status checking system without backwards compatibility, making the code cleaner and easier to maintain.

### Security Considerations:
- Status is cached for 60 seconds to reduce inter-canister calls
- Token ID is required - no fallback behavior
- All status transitions are validated before allowing trades