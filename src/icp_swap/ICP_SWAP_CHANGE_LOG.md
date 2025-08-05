# ICP Swap Change Log

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