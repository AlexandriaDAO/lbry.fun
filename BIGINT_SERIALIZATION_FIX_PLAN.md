# BigInt Serialization Fix Plan

## Problem
Redux is throwing errors because it cannot serialize BigInt values that are being stored in the state. The specific errors occur with distribution-related data where the backend returns `u64` values that become `bigint` in JavaScript.

### Affected Data Structures
- `DistributionSummary`
- `DistributionEvent`
- `DistributionAllocations`
- `DistributionResults`
- `LifetimeDistributionTotals`

### Specific Fields with BigInt
- `stakers_rollover`
- `alexandria_total`
- `event_id`
- `timestamp`
- `total_available`
- All allocation amounts
- All result amounts
- All lifetime totals

## Solution Approach

### Option 1: Convert BigInt to String (Recommended)
Convert all BigInt values to strings before storing in Redux state. This is the simplest and most Redux-compatible approach.

### Option 2: Custom Serialization
Implement custom serialization/deserialization using JSON replacer/reviver functions.

## Implementation Plan

### 1. Create BigInt Serialization Utilities
- [ ] Create `src/lbry_fun_frontend/src/utils/bigintSerialization.ts`
- [ ] Implement conversion functions for distribution types
- [ ] Add type definitions for serialized versions

### 2. Update Distribution Thunks
- [ ] Modify `distributionThunks.ts` to convert BigInt values to strings
- [ ] Update return types to use serialized versions

### 3. Update Distribution Types
- [ ] Create serialized type definitions alongside existing types
- [ ] Update SwapState to use serialized types

### 4. Update Components
- [ ] Update components that use distribution data to handle string values
- [ ] Convert strings back to BigInt where needed for calculations

### 5. Testing
- [ ] Test all distribution-related functionality
- [ ] Verify Redux DevTools work properly
- [ ] Ensure no loss of precision in conversions

## Code Changes Preview

### bigintSerialization.ts
```typescript
// Convert distribution types with BigInt to serializable versions
export const serializeDistributionSummary = (summary: DistributionSummary): SerializedDistributionSummary => {
  return {
    ...summary,
    total_alexandria_sent: summary.total_alexandria_sent.toString(),
    total_lp_treasury_balance: summary.total_lp_treasury_balance.toString(),
    // ... convert all bigint fields
  };
};
```

### distributionThunks.ts update
```typescript
export const fetchDistributionSummary = createAsyncThunk(
  'swap/fetchDistributionSummary',
  async (icpSwapId: string, { rejectWithValue }) => {
    try {
      const actor = await getActorSwap(icpSwapId);
      const summary = await actor.get_distribution_summary();
      return serializeDistributionSummary(summary); // Convert before storing
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch distribution summary');
    }
  }
);
```

## Review
*To be completed after implementation*