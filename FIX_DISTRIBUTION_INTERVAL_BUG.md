# Distribution Interval Bug - Fix Implementation Guide

## Quick Summary

**THE BUG IS CONFIRMED**: `DISTRIBUTION_INTERVALS` storage is being overwritten with the interval duration (3600) instead of starting at 0 as a counter.

## Proof Points

1. **Code Evidence** (src/icp_swap/src/script.rs):
   - Line 110: Stores counter value `args.distribution_intervals` → 0
   - Line 171: **OVERWRITES** with `args.distribution_interval_seconds` → 3600
   - Same storage location, second write wins!

2. **Mainnet Evidence**:
   - Your value: 5398
   - Breakdown: 3600 (bug) + 1798 (increments) = 5398 ✓
   - 1798 distributions over 74 days = ~24/day = hourly ✓

3. **Test Evidence**:
   - Created test file: `tests/simulation/distribution_interval_bug_test.rs`
   - Test will fail showing counter = 3600 instead of 0

## The Fix (Choose One)

### Option A: Minimal Fix (Quick & Safe)
```rust
// In src/icp_swap/src/script.rs line 170-172
// REMOVE the storage line - just validate the interval
if let Some(interval_seconds) = args.distribution_interval_seconds {
    if interval_seconds < 60 {
        panic!("Distribution interval cannot be less than 60 seconds");
    }
    // DELETE THIS LINE:
    // DISTRIBUTION_INTERVALS.with(|m| {
    //     m.borrow_mut().insert((), interval_seconds as u32);
    // });
}
```

### Option B: Proper Fix (Recommended)
1. Add new storage in `src/icp_swap/src/storage.rs`:
```rust
pub const DISTRIBUTION_INTERVAL_DURATION_MEM_ID: MemoryId = MemoryId::new(NEW_ID);
pub static DISTRIBUTION_INTERVAL_DURATION: RefCell<StableBTreeMap<(), u32, Memory>> = ...
```

2. Store duration separately in `src/icp_swap/src/script.rs`:
```rust
if let Some(interval_seconds) = args.distribution_interval_seconds {
    DISTRIBUTION_INTERVAL_DURATION.with(|m| {
        m.borrow_mut().insert((), interval_seconds as u32);
    });
}
```

3. Update `post_upgrade` to read from new storage

## How to Verify the Fix

### Before Fix (Current Behavior)
```bash
# Run the test - it will show the bug
cd tests && cargo test test_distribution_interval_initialization_bug

# Output: Counter = 3600 (BUG!)
```

### After Fix (Expected Behavior)
```bash
# After implementing fix, run test
cd tests && cargo test test_distribution_interval_fixed_behavior

# Output: Counter = 0 (CORRECT!)
```

### Live Testing
```bash
# Deploy test token with 1-hour interval
./scripts/deploy_test_token.sh --interval 3600

# Query immediately
dfx canister call icp_swap get_distribution_interval
# Should return: (0 : nat32)  ← CORRECT!
# Currently returns: (3600 : nat32)  ← BUG!
```

## Migration for Existing Tokens

For your mainnet token showing 5398:
```rust
// Calculate actual distribution count
let actual_count = 5398 - 3600;  // = 1798

// After fix, you could:
// 1. Leave as-is (harmless, just confusing)
// 2. Migrate via upgrade with corrected value
```

## Impact Assessment

✅ **What Works**:
- Distributions happen correctly (timer runs at right interval)
- APY tracking works (modulo doesn't care about offset)

❌ **What's Broken**:
- Display shows 5398 instead of distribution count
- Confuses developers/auditors

## Next Steps

1. Choose fix option (A or B)
2. Run test to confirm bug exists
3. Implement fix
4. Run test to confirm fix works
5. Update `ICP_SWAP_CHANGE_LOG.md` with fix details
6. Deploy to test environment
7. Verify with live queries