# Tokenomics Backend Consolidation Plan

## Problem Statement
- Tokenomics calculations are duplicated between frontend and backend
- Frontend has to guess parameters for deployed tokens
- Multiple sources of truth lead to inconsistencies
- Complex state management for what should be simple data fetching

## Goal
Make the backend the single source of truth for ALL tokenomics calculations

## Proposed Solution

### Architecture
1. **Backend generates everything**: The lbry_fun canister provides endpoints to generate tokenomics graphs
2. **Frontend just displays**: No calculations in frontend, only visualization
3. **Two endpoints**:
   - `preview_tokenomics_graphs` - For token creation (already exists!)
   - `get_tokenomics_graphs(pool_id)` - For deployed tokens (NEW)

### Implementation Plan

#### Phase 1: Add Backend Endpoint for Deployed Tokens
```rust
// In lbry_fun canister
#[query]
pub fn get_tokenomics_graphs(pool_id: u64) -> Result<GraphData, String> {
    // 1. Look up the token record by pool_id
    let record = get_token_record(pool_id)?;
    
    // 2. Extract the tokenomics parameters
    let args = PreviewArgs {
        primary_max_supply: record.primary_token_max_supply,
        tge_allocation: record.initial_primary_mint,
        initial_secondary_burn: record.initial_secondary_burn,
        halving_step: record.halving_step,
        initial_reward_per_burn_unit: record.initial_reward_per_burn_unit, // Need to add this field
    };
    
    // 3. Use the same logic as preview_tokenomics_graphs
    preview_tokenomics_graphs(args)
}
```

#### Phase 2: Update TokenRecord Structure
```rust
pub struct TokenRecord {
    // ... existing fields ...
    pub initial_reward_per_burn_unit: u64, // NEW: Store this when token is created
}
```

#### Phase 3: Simplify Frontend Completely
```typescript
// For token creation preview
const { data } = await actor.preview_tokenomics_graphs({
    primary_max_supply: BigInt(values.primaryMaxSupply) * E8S,
    // ... other params
});

// For deployed token analytics
const { data } = await actor.get_tokenomics_graphs(poolId);

// Both return the same GraphData structure
// Frontend just renders it - no calculations!
```

#### Phase 4: Remove All Frontend Calculation Code
- Delete `previewTokenomicsSchedule` thunk
- Delete `tokenomics_simple.rs` logic duplication in frontend
- Delete all the complex conversion logic
- Just fetch and display!

## Benefits

1. **True Single Source of Truth**: Backend owns all business logic
2. **Perfect Consistency**: Impossible for views to differ
3. **Simpler Frontend**: Just fetch and render
4. **Easier Testing**: Test calculations in one place (backend)
5. **Better Performance**: No duplicate calculations in browser
6. **Cleaner Architecture**: Clear separation of concerns

## Migration Steps

### Step 1: Quick Fix Current Error (5 mins)
Fix the undefined variable error so app works while we implement the real solution

### Step 2: Add Backend Field (Backend Deploy)
1. Add `initial_reward_per_burn_unit` to TokenRecord
2. Update create_token to store this value
3. Add `get_tokenomics_graphs` endpoint

### Step 3: Update Frontend (Frontend Deploy)
1. Update analytics tab to call `get_tokenomics_graphs`
2. Remove all calculation logic
3. Both views just fetch and render GraphData

### Step 4: Cleanup
1. Remove unused thunks
2. Remove unused state management
3. Remove complex data transformations

## API Design

### Existing Endpoint (keep as-is)
```candid
preview_tokenomics_graphs : (PreviewArgs) -> (GraphData) query;
```

### New Endpoint
```candid
get_tokenomics_graphs : (pool_id : nat64) -> (Result<GraphData, text>) query;
```

### GraphData Structure (unchanged)
```candid
type GraphData = record {
    cumulative_supply_data_x : vec nat64;
    cumulative_supply_data_y : vec nat64;
    minted_per_epoch_data_x : vec text;
    minted_per_epoch_data_y : vec nat64;
    cost_to_mint_data_x : vec nat64;
    cost_to_mint_data_y : vec float64;
    cumulative_usd_cost_data_x : vec nat64;
    cumulative_usd_cost_data_y : vec float64;
};
```

## Success Criteria
- [ ] Backend is the ONLY place that calculates tokenomics
- [ ] Frontend has zero calculation logic
- [ ] Both views show identical data (they call the same backend)
- [ ] Code is significantly simpler
- [ ] No state synchronization issues
- [ ] Works for all deployed tokens (once initial_reward_per_burn_unit is added)