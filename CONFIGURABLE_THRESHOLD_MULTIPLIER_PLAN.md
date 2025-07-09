# Configurable Threshold Multiplier Implementation Plan

## Overview
This plan details how to implement configurable threshold multipliers in the lbryfun token launchpad system. Currently, the system uses a hardcoded 2x multiplier for burn threshold progression between epochs. This plan enables users to choose different multipliers (e.g., 1.25, 1.5, 3, 5) when creating tokens.

## Background Context

### Current System Behavior
- Each epoch requires 2x the secondary token burn of the previous epoch
- Example progression with 21,000 initial burn: 21,000 → 42,000 → 84,000 → 168,000...
- This 2x multiplier is hardcoded in `tokenomics_simple.rs`
- All tokens use the same progression pattern

### System Architecture
1. **Frontend** calls create_token with parameters
2. **lbry_fun canister** generates threshold arrays using the hardcoded 2x multiplier
3. **tokenomics canister** receives and stores these pre-calculated arrays
4. **icp_swap canister** handles minting/burning based on tokenomics queries
5. **Graphs** are generated from the stored arrays

## Critical Code Location
The 2x multiplier is hardcoded in exactly ONE place that affects the entire system:
- **File**: `src/lbry_fun/src/tokenomics_simple.rs`
- **Line**: 150
- **Code**: `current_threshold = current_threshold.saturating_mul(2);`

## Implementation Steps

### 1. Backend Core Changes

#### src/lbry_fun/src/tokenomics_simple.rs
```rust
// Add to TokenomicsParams struct (after line 16):
pub threshold_multiplier: f64,  // e.g., 2.0 for doubling, 1.5 for 50% increase

// Replace line 150:
// OLD: current_threshold = current_threshold.saturating_mul(2);
// NEW:
current_threshold = ((current_threshold as f64 * params.threshold_multiplier) as u128)
    .max(current_threshold + 1); // Ensure progression even with low multipliers

// Update preview_tokenomics_from_frontend function signature:
pub fn preview_tokenomics_from_frontend(
    primary_per_threshold: u64,
    max_primary_supply: u64,
    initial_secondary_burn: u64,
    halving_step: u64,
    tge_allocation: u64,
    threshold_multiplier: f64,  // NEW PARAMETER
) -> TokenomicsSchedule {
    let params = TokenomicsParams {
        // ... existing fields ...
        threshold_multiplier,  // Add this
    };
    // ... rest of function
}
```

#### src/lbry_fun/src/update.rs
```rust
// Update create_token function signature (line ~30):
async fn create_token(
    // ... existing parameters ...
    halving_step: u64,
    threshold_multiplier: f64,  // NEW PARAMETER (after halving_step)
    initial_reward_per_burn_unit: u64,
    // ... rest of parameters ...
) -> Result<String, String> {
    
    // Pass to preview function (line ~56):
    let schedule = preview_tokenomics_from_frontend(
        initial_reward_per_burn_unit,
        primary_max_supply,
        initial_secondary_burn,
        halving_step,
        initial_primary_mint,
        threshold_multiplier,  // NEW PARAMETER
    );
```

#### src/lbry_fun/src/queries.rs
```rust
// Update preview_tokenomics_schedule:
#[update]
async fn preview_tokenomics_schedule(
    primary_per_threshold: u64,
    max_primary_supply: u64,
    initial_secondary_burn: u64,
    halving_step: u64,
    tge_allocation: u64,
    threshold_multiplier: f64,  // NEW PARAMETER
) -> TokenomicsSchedule {
    preview_tokenomics_from_frontend(
        primary_per_threshold,
        max_primary_supply,
        initial_secondary_burn,
        halving_step,
        tge_allocation,
        threshold_multiplier,  // Pass it through
    )
}
```

#### src/lbry_fun/lbry_fun.did
```candid
// Update create_token signature:
create_token : (
    text, text, text, text, text, text, text, text,
    nat64, nat64, nat64, nat64, float64, nat64, nat64, nat64  // Added float64
) -> (Result);

// Update preview_tokenomics_schedule:
preview_tokenomics_schedule : (nat64, nat64, nat64, nat64, nat64, float64) -> (
    TokenomicsSchedule,
);
```

### 2. Preview Functionality Updates

#### src/lbry_fun/src/preview_canister.rs
```rust
// Add to PreviewArgs struct:
pub threshold_multiplier: f64,

// Update preview_tokenomics_graphs to pass multiplier through
```

### 3. Frontend Changes

#### src/lbry_fun_frontend/src/features/token/thunk/createToken.thunk.ts
```typescript
// Add to the actor.create_token call:
const result = await actor.create_token(
    // ... existing parameters ...
    BigInt(formData.halving_step),
    formData.threshold_multiplier,  // NEW - as number, not BigInt
    BigInt(formData.initial_reward_per_burn_unit),
    // ... rest of parameters ...
);
```

#### src/lbry_fun_frontend/src/features/token/thunk/previewTokenomicsSchedule.thunk.ts
```typescript
// Add to PreviewScheduleArgs interface:
export interface PreviewScheduleArgs {
    // ... existing fields ...
    threshold_multiplier: number;  // e.g., 2.0 for doubling
}

// Add to actor call:
const result = await actor.preview_tokenomics_schedule(
    primary_per_threshold_e8s,
    args.max_primary_supply,
    initial_secondary_burn_e8s,
    BigInt(args.halving_step),
    args.tge_allocation,
    args.threshold_multiplier  // NEW PARAMETER
);
```

#### Frontend Form Component
- Add input field for threshold multiplier
- Default value: 2.0
- Validation: minimum 1.1, maximum 10.0
- Tooltip: "Controls how much the burn requirement increases each epoch. 2.0 = double, 1.5 = 50% increase"

### 4. Test File Updates

Replace hardcoded `*= 2` with parameterized multiplier in:
- `tests/simulate_graph_data.js` (line with `currentBurnThreshold *= 2`)
- `tests/simulation/phase4_tokenomics_lifecycle_tests.rs`
- `tests/tests/unit/test_tokenomics_schedule_generation.rs` (2 occurrences)
- `tests/tests/unit/test_tokenomics_validation.rs`
- `tests/tests/unit/test_simulation_e8s_bug.rs` (2 occurrences)
- `tests/tests/unit/test_tokenomics_simple.rs`
- `tests/tests/unit/test_fixed_simulation.rs`
- `tests/tests/unit/test_final_verification.rs`
- `tests/tests/unit/test_verify_correct_fix.rs`
- `tests/tests/unit/test_backend_raw_data.rs`
- `tests/tests/unit/test_simple_fix_verification.rs`
- `tests/tests/unit/test_tokenomics_bug_simple_demo.rs` (2 occurrences)

Example change pattern:
```rust
// OLD:
burn_requirement *= 2;

// NEW:
burn_requirement = (burn_requirement as f64 * threshold_multiplier) as u64;
```

### 5. Validation Rules

Add in `tokenomics_simple.rs`:
```rust
// Validate multiplier range
if params.threshold_multiplier <= 1.0 {
    ic_cdk::trap("Threshold multiplier must be greater than 1.0");
}
if params.threshold_multiplier > 10.0 {
    ic_cdk::trap("Threshold multiplier cannot exceed 10.0");
}

// In the threshold calculation, ensure progression:
let new_threshold = ((current_threshold as f64 * params.threshold_multiplier) as u128)
    .max(current_threshold + 1);  // Never allow same or decreasing threshold
```

## Testing Strategy

1. **Backward Compatibility**: Test with 2.0 multiplier, verify identical behavior to current system
2. **Edge Cases**: Test multipliers 1.1, 1.25, 1.5, 3.0, 5.0, 10.0
3. **Graph Validation**: Ensure all graphs render correctly with different progressions
4. **Math Consistency**: Verify tokenomics calculations remain accurate
5. **Bot Integration**: Confirm bot1 canister handles non-2x progressions
6. **Overflow Protection**: Test with large multipliers near max values

## Important Notes

1. **No Changes Needed**:
   - Tokenomics canister (just stores the arrays)
   - ICP swap canister (doesn't use thresholds directly)
   - Bot1 canister (will work with any progression)

2. **Floating Point Considerations**:
   - Always round down when converting f64 to u128
   - Ensure monotonic increasing thresholds
   - Consider using fixed-point math for consistency

3. **Documentation Updates**:
   - Update all examples showing hardcoded arrays
   - Note that 21,000 → 42,000 → 84,000 is "with 2x multiplier"
   - Add examples with other multipliers

## Example Progressions

With initial burn of 21,000:
- **1.5x**: 21,000 → 31,500 → 47,250 → 70,875 → 106,312...
- **2.0x**: 21,000 → 42,000 → 84,000 → 168,000 → 336,000...
- **3.0x**: 21,000 → 63,000 → 189,000 → 567,000 → 1,701,000...
- **5.0x**: 21,000 → 105,000 → 525,000 → 2,625,000 → 13,125,000...

## Verification Checklist

- [ ] Backend compiles with new parameter
- [ ] Frontend form accepts and validates multiplier
- [ ] Preview graphs show correct progressions
- [ ] Token creation succeeds with custom multiplier
- [ ] Tokenomics canister receives correct arrays
- [ ] Minting/burning works as expected
- [ ] All tests pass with parameterized multipliers
- [ ] Bot1 handles custom progressions correctly