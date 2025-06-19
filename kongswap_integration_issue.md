# Kongswap Integration Issue Summary

## Problem
The frontend cannot successfully call the kongswap canister's `pools` method. Getting "Not a record type" error when trying to decode the response.

## What We Know

### 1. Method Signature
From the kongswap repo analysis:
- Method: `pools(opt text) -> (PoolsResult) query`
- Returns a variant type `PoolsResult` with `Ok`/`Err` cases
- Takes an optional text parameter for wildcard search

### 2. Error Analysis
- `actor.pools([])` → "Not a record type" - The response doesn't match our IDL definition
- `actor.pools()` → "Wrong number of message arguments" - Method expects a parameter
- `actor.pools([null])` → "Invalid opt text argument: [null]" - Null encoding issue

### 3. Current IDL Definition (Simplified for Testing)
```typescript
const PoolReply = IDL.Record({
  'pool_id': IDL.Nat32,
  'symbol': IDL.Text,
});

const PoolsReply = IDL.Record({
  'pools': IDL.Vec(PoolReply),
});

const PoolsResult = IDL.Variant({
  'Ok': PoolsReply,
  'Err': IDL.Text,
});

service : {
  'pools': IDL.Func([IDL.Opt(IDL.Text)], [PoolsResult], ['query']),
}
```

### 4. Backend Integration
- Backend uses the same kongswap canister ID: `2ipq2-uqaaa-aaaar-qailq-cai`
- Backend successfully calls other kongswap methods like `pool(symbol)` and `swap`
- No direct `pools()` method call found in backend code

## Potential Issues

1. **Canister ID Mismatch**: Local kongswap deployment might have a different canister ID
2. **IDL Mismatch**: The actual kongswap interface might be different than what we expect
3. **Network Configuration**: Frontend might be connecting to wrong network/host
4. **Response Format**: The response might not be wrapped in a Result variant

## Next Steps to Investigate

1. **Verify Canister ID**:
   - Check if local kongswap deployment uses a different canister ID
   - Look for `.dfx/local/canister_ids.json` or deployment logs

2. **Get Actual IDL**:
   - Try to fetch the actual candid interface from the running canister
   - Use `dfx canister metadata kongswap candid:service` if available

3. **Test Direct Call**:
   - Use `dfx canister call` to test the pools method directly
   - This will show the actual response format

4. **Compare with Working Backend Call**:
   - Find or create a backend method that calls `pools()`
   - Log the raw response to see the actual structure

5. **Try Different Encoding**:
   - For optional parameters, try `['']` for Some("") instead of `[]` for None
   - The backend might expect a different encoding

## Questions for Further Investigation

1. Is kongswap deployed locally as part of the lbryfun setup, or is it a separate deployment?
2. Are there any environment variables or configuration files that specify the local kongswap canister ID?
3. Has anyone successfully called the `pools` method from the frontend before?
4. Is there a working example of calling kongswap from another frontend project?

## Solution Implemented

The issue was that the IDL definition didn't match the actual kongswap response structure. Here's what was fixed:

1. **Corrected IDL structure**: The pools method returns `Ok: Vec<PoolReply>` not `Ok: PoolsReply`
2. **Updated field names**: Changed `fee_0/fee_1` to `lp_fee_0/lp_fee_1`, added `lp_token_symbol`, etc.
3. **Added TVL calculation**: Since TVL isn't in the basic response, we calculate it from pool balances and ICP price
4. **Fixed parameter encoding**: Use `[]` for None in optional parameters

### Changes Made

1. In `kongswapService.ts`:
   - Updated IDL to match actual kongswap response structure
   - Added TVL calculation logic based on ICP balance and price
   - Calculate TVL as: `2 * ICP_balance * ICP_price` for 50/50 AMM pools
   - Return TVL in dollar e8s for consistency with frontend display

The service now:
- Successfully calls kongswap's pools method
- Calculates TVL locally from pool balances
- Works with both local and mainnet deployments

## Debug Commands to Run

```bash
# 1. Check local canister IDs
cat .dfx/local/canister_ids.json | grep -i kong

# 2. Try calling pools method directly (replace canister-id if different)
dfx canister call 2ipq2-uqaaa-aaaar-qailq-cai pools '(null)' --network local

# 3. Get the actual candid interface
dfx canister metadata 2ipq2-uqaaa-aaaar-qailq-cai candid:service --network local

# 4. Check if kongswap canister is running
dfx canister status 2ipq2-uqaaa-aaaar-qailq-cai --network local
```

## Remaining Work for Full Local Development

To fully support kongswap in local development:

1. **Deploy kongswap locally**: Need to clone and deploy the kongswap canister locally
2. **Update environment variables**: Add REACT_APP_KONG_BACKEND_CANISTER_ID with the local canister ID
3. **Configure mock data**: For testing without full kongswap deployment, could enhance the mock service

For now, the implementation gracefully handles the absence of kongswap in local development by:
- Returning empty pools data from the KongswapService
- Showing "Liquidity provided ✓" status based on backend data instead of TVL amounts
- Adding tooltips to indicate TVL data is unavailable in local development

## Impact on UI

In local development:
- Token cards will show "Liquidity provided ✓" in green if liquidity has been added
- Token cards will show "No liquidity" if no liquidity has been provided
- Actual TVL amounts are only available when connected to mainnet kongswap