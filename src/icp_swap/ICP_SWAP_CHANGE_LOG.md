# ICP Swap Change Log

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