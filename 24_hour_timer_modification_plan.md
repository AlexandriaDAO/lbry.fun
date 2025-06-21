# 24-Hour Timer Modification Plan

## Current Behavior
- Tokens show as "Upcoming" for 24 hours after creation
- After 24 hours, they become "Live" (if pool creation succeeded)
- This timer is hardcoded in the backend canister

## Todo List
- [x] Check how frontend queries and displays tokens
- [x] Regenerate candid declarations to match backend
- [x] Fix frontend to calculate is_live status locally
- [ ] Test the frontend to ensure tokens display correctly

## Implementation Plan
Per user feedback, we kept the backend 24-hour timer logic intact since it controls when minting functions become available. Instead, we fixed the frontend to:
1. Use `get_all_token_record()` which returns ALL tokens
2. Calculate `isLive` status locally based on the same logic as the backend
3. Display all tokens with their correct live/upcoming status

## Review
The issue was that the frontend was expecting `is_live` and `liquidity_provided_at` fields on `TokenRecord` that didn't exist in the backend. This was causing a mismatch between the generated TypeScript declarations and the actual candid interface.

### Changes Made:
1. Regenerated candid declarations with `dfx generate` to match the actual backend interface
2. Updated `getTokenPools.thunk.ts` to calculate `isLive` status locally using the same logic as the backend
3. Updated `getLiveTokens.thunk.ts` and `getUpcommingTokens.thunk.ts` to include the new fields
4. Updated the `TokenRecordStringified` type to include `pool_created_at` and `pool_creation_failed`

Tokens should now display immediately on the frontend dashboard with the correct "Live" or "Upcoming" status based on their creation time and pool status.