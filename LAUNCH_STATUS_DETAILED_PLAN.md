# Launch Status Display Fix - Detailed Implementation Plan

## Problem Summary
1. Main page shows tokens as `[LIVE]` while swap page correctly shows `[launch_pending]` with countdown
2. Countdown is hardcoded to 24 hours instead of using user's actual launch delay setting
3. Different parts of the UI calculate "is live" status differently

## Root Cause Analysis
After thorough investigation, the core issues are:
1. `launch_delay_seconds` field from backend is not included in frontend's `TokenRecordStringified` type
2. `getTokenPools.thunk.ts` uses hardcoded `LAUNCH_PERIOD_NANOS` constant instead of token-specific values
3. Multiple locations calculate status independently with different logic

## All Status Determination Locations

### Backend (Rust)
1. **src/lbry_fun/src/queries.rs**
   - Lines 22-40: `get_upcomming()` - filters non-live tokens
   - Lines 42-61: `get_live()` - filters live tokens
   - Lines 77-104: `get_token_status_by_swap_canister()` - returns status for swap canister
   - Lines 106-147: `get_token_status()` - main status logic
   - **Logic**: `is_live = !pool_creation_failed && pool_created_at > 0 && current_time >= created_time + launch_delay_seconds * 1_000_000_000`

2. **src/lbry_fun/src/constants.rs**
   - Line 3: `LAUNCH_PERIOD_NANOS = 1000` (testing value)
   - Line 4: Commented production value (24 hours)

3. **src/lbry_fun/src/storage.rs**
   - Line 44: `launch_delay_seconds: u64` in `TokenRecord` struct

4. **src/icp_swap/src/utils.rs**
   - Lines 587-622: `is_live()` function
   - Line 591: Hardcoded principal (separate issue)

### Frontend (TypeScript)
1. **src/lbry_fun_frontend/src/constants/launchPeriod.ts**
   - Line 5: `LAUNCH_PERIOD_NANOS = BigInt(1000)`

2. **src/lbry_fun_frontend/src/features/token/thunk/getTokenPools.thunk.ts**
   - Lines 22-24: **BUG** - calculates `isLive` using `LAUNCH_PERIOD_NANOS` instead of `launch_delay_seconds`
   - Lines 83-105: `TokenRecordStringified` type **MISSING** `launch_delay_seconds` field

3. **src/lbry_fun_frontend/src/features/swap/hooks/useAccessState.ts**
   - Lines 13-27: **CORRECT** - uses `launch_delay_seconds` from token record
   - Lines 29-50: Countdown calculation

4. **UI Components Displaying Status**
   - `src/lbry_fun_frontend/src/features/token/components/terminal/TerminalPoolCard.tsx` (Lines 187-189)
   - `src/lbry_fun_frontend/src/features/swap/components/AccessGuard.tsx` (Lines 84-111)
   - `src/lbry_fun_frontend/src/features/swap/components/ConsolidatedTerminal.tsx`
   - `src/lbry_fun_frontend/src/features/swap/components/SwapPageWrapper.tsx`
   - `src/lbry_fun_frontend/src/features/analytics/components/AnalyticsTerminal.tsx`

## Detailed Implementation Steps

### Phase 1: Fix Data Model (High Priority)
1. **File: src/lbry_fun_frontend/src/features/token/thunk/getTokenPools.thunk.ts**
   - Line 83-105: Add `launch_delay_seconds: string` to `TokenRecordStringified` interface
   - Line ~60: Add mapping for `launch_delay_seconds` in the response transformation

### Phase 2: Fix Status Calculation (High Priority)
2. **File: src/lbry_fun_frontend/src/features/token/thunk/getTokenPools.thunk.ts**
   - Lines 22-24: Replace `LAUNCH_PERIOD_NANOS` with `BigInt(record.launch_delay_seconds) * BigInt(1_000_000_000)`
   - This fixes the main page status display

3. **Create centralized utility: src/lbry_fun_frontend/src/utils/tokenStatus.ts** (NEW FILE)
   ```typescript
   export function calculateTokenStatus(
     createdAt: bigint,
     launchDelaySeconds: bigint,
     poolCreationFailed: boolean,
     currentTimeNanos?: bigint
   ): 'live' | 'pending' | 'failed'
   
   export function calculateCountdown(
     createdAt: bigint,
     launchDelaySeconds: bigint,
     currentTimeNanos?: bigint
   ): { seconds: number; isLive: boolean }
   ```

### Phase 3: Update Components (Medium Priority)
4. **File: src/lbry_fun_frontend/src/features/swap/hooks/useAccessState.ts**
   - Already correct, but should use new utility functions for consistency

5. **Update all status display components to use centralized logic:**
   - `TerminalPoolCard.tsx` - use pool.isLive (will be fixed by step 2)
   - `ConsolidatedTerminal.tsx` - update to use consistent status
   - `SwapPageWrapper.tsx` - ensure consistent status display
   - `AccessGuard.tsx` - already uses useAccessState (correct)
   - `AnalyticsTerminal.tsx` - update status display

### Phase 4: Cleanup (Low Priority)
6. **Deprecate LAUNCH_PERIOD_NANOS**
   - Update comment in `src/lbry_fun_frontend/src/constants/launchPeriod.ts` to indicate deprecated
   - Remove usage from `getTokenPools.thunk.ts` (done in step 2)
   - Backend can keep it for now as it's not used in critical paths

7. **Testing checklist:**
   - Create token with 1 hour delay → verify countdown shows ~1 hour
   - Create token with 6 hour delay → verify countdown shows ~6 hours  
   - Create token with 48 hour delay → verify countdown shows ~48 hours
   - Verify main page and swap page show same status
   - Test status transition from pending to live

## Expected Outcome
- All UI components will use the actual `launch_delay_seconds` set by user
- Main page and swap page will show identical status
- Countdown will accurately reflect remaining time
- Single source of truth for status calculations
- Cleaner, more maintainable code with no duplicate logic

## Code Consolidation Benefits
1. Remove duplicate `isLive` calculations
2. Centralize countdown logic
3. Ensure consistent status strings across UI
4. Make future changes easier by having single utility module
5. Reduce chance of bugs from inconsistent implementations