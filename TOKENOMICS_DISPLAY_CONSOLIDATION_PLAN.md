# Tokenomics Display Consolidation Plan V2

## Context and Background

### What We Just Did
1. Added `initial_reward_per_burn_unit` field to `TokenRecord` struct in the backend
2. Made it a required `u64` field (not optional)
3. Updated all frontend thunks to read this field
4. The system is ready for a fresh rebuild (no backward compatibility needed)

### Current Problem
After deploying a token with default parameters, the tokenomics graphs show completely different results:

**Token Creation Preview** (correct):
```json
{
  "parameters": {
    "initialRewardPerBurnUnit": "5"  // Natural units as entered by user
  },
  // Shows 18 epochs, gradual distribution
}
```

**Analytics Tab** (incorrect):
```json
{
  "parameters": {
    "initialRewardPerBurnUnit": "500000000"  // Same token shows 5 * 10^8
  },
  // Shows only 1 epoch, instant distribution
}
```

### Root Cause
The value "5" entered by the user is being stored as "5" but displayed as "500000000" (5 * E8S).

## Technical Details

### Current Data Flow

1. **Frontend Form Input**:
   - User enters: `5`
   - Frontend sends to backend: `5` (natural units)

2. **Backend Storage** (`create_token` in `update.rs`):
   ```rust
   initial_reward_per_burn_unit: initial_reward_per_burn_unit,  // Stores 5 as-is
   ```

3. **Backend Calculation** (`preview_tokenomics_from_frontend`):
   - Expects natural units (5)
   - Works correctly for preview

4. **Frontend Display** (Analytics Tab):
   - Reads from storage: `5`
   - Displays as: `"500000000"`
   - This breaks the tokenomics calculation

### File Locations

**Backend Files**:
- `/src/lbry_fun/src/storage.rs` - TokenRecord struct definition
- `/src/lbry_fun/src/update.rs` - create_token function
- `/src/lbry_fun/src/tokenomics_simple.rs` - preview_tokenomics_from_frontend

**Frontend Files**:
- `/src/lbry_fun_frontend/src/features/token/thunk/getTokenPools.thunk.ts`
- `/src/lbry_fun_frontend/src/features/token/components/UnifiedTokenomicsGraphsV2.tsx`
- `/src/lbry_fun_frontend/src/features/swap/components/TokenomicsTab.tsx`

## Solution: Standardize on E8S Storage

### Why This Solution?
1. **Consistency**: All other token amounts (max_supply, initial_mint, etc.) are stored as E8S
2. **ICP Standard**: E8S (10^8) is the standard unit for ICP tokens
3. **Precision**: Avoids floating-point issues

### Implementation Steps

#### Step 1: Update Backend to Store E8S
```rust
// In /src/lbry_fun/src/update.rs, around line 275
// Change from:
initial_reward_per_burn_unit,
// To:
initial_reward_per_burn_unit: initial_reward_per_burn_unit * E8S,
```

#### Step 2: Update Frontend to Convert E8S → Natural
```typescript
// In /src/lbry_fun_frontend/src/features/token/thunk/getTokenPools.thunk.ts
// Change from:
initial_reward_per_burn_unit: record.initial_reward_per_burn_unit.toString(),
// To:
initial_reward_per_burn_unit: (BigInt(record.initial_reward_per_burn_unit) / BigInt(100_000_000)).toString(),
```

Apply the same change to:
- `getLiveTokens.thunk.ts`
- `getUpcommingTokens.thunk.ts`

#### Step 3: Verify Preview Still Works
The `preview_tokenomics_from_frontend` function expects natural units, which is what the frontend will send, so no changes needed there.

#### Step 4: Verify UnifiedTokenomicsGraphsV2
The component expects natural units for `initialRewardPerBurnUnit`, which the thunks will now provide after conversion.

## Alternative Investigation

If you prefer to keep natural unit storage:
1. Find where the value is being multiplied by E8S
2. Check if it's happening in the tokenomics canister
3. The symptom (exactly 10^8 multiplication) suggests an E8S conversion somewhere

## Testing Plan

After implementation:
1. Create a new token with `initialRewardPerBurnUnit = 5`
2. Check the preview graphs
3. Deploy the token
4. Check the analytics tab graphs
5. Both should show identical results

## Key Constants
- `E8S = 100_000_000` (10^8)
- This is defined in the backend as `pub const E8S: u64 = 100_000_000;`

## Success Criteria
- Token creation preview and analytics tab show identical graphs
- No unit conversion errors
- The value flow is clear: UI (natural) → Backend (E8S) → Storage (E8S) → UI (natural)