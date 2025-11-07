# Distribution Interval Bug - Proof and Fix

## The Bug (CONFIRMED)

### Location
`src/icp_swap/src/script.rs` lines 108-112 and 160-173

### What's Happening

The `DISTRIBUTION_INTERVALS` storage is being used for TWO different purposes, and the second one overwrites the first:

```rust
// FIRST USE (lines 108-112) - Stores the COUNT of distributions
if let Some(distribution_intervals) = args.distribution_intervals {
    DISTRIBUTION_INTERVALS.with(|m| {
        m.borrow_mut().insert((), distribution_intervals);  // e.g., 0 for new canister
    });
}

// SECOND USE (lines 170-172) - OVERWRITES with the DURATION
if let Some(interval_seconds) = args.distribution_interval_seconds {
    DISTRIBUTION_INTERVALS.with(|m| {
        m.borrow_mut().insert((), interval_seconds as u32);  // e.g., 3600 for 1 hour
    });
}
```

## Proof the Bug Exists

### Test 1: What Should Happen (Expected Behavior)
```rust
#[test]
fn test_distribution_counter_should_start_at_zero() {
    // Initialize with:
    // - distribution_intervals: Some(0) - start counter at 0
    // - distribution_interval_seconds: Some(3600) - 1 hour interval

    let init_args = InitArgs {
        distribution_intervals: Some(0),
        distribution_interval_seconds: Some(3600),
        ..Default::default()
    };

    // After initialization
    let counter = get_distribution_interval();
    assert_eq!(counter, 0, "Counter should start at 0");

    // After first distribution
    add_to_distribution_intervals(1);
    let counter = get_distribution_interval();
    assert_eq!(counter, 1, "Counter should be 1 after first distribution");
}
```

### Test 2: What Actually Happens (Bug Behavior)
```rust
#[test]
fn test_bug_counter_starts_at_interval_duration() {
    // Initialize with:
    // - distribution_intervals: Some(0) - ignored!
    // - distribution_interval_seconds: Some(3600) - overwrites the counter!

    let init_args = InitArgs {
        distribution_intervals: Some(0),
        distribution_interval_seconds: Some(3600),
        ..Default::default()
    };

    // After initialization (BUG!)
    let counter = get_distribution_interval();
    assert_eq!(counter, 3600, "BUG: Counter starts at 3600 instead of 0!");

    // After first distribution
    add_to_distribution_intervals(1);
    let counter = get_distribution_interval();
    assert_eq!(counter, 3601, "Counter increments from 3600 to 3601");
}
```

## Your Mainnet Token Proof

Your mainnet token shows `5398`:
- You selected 1 hour (3600 seconds)
- Counter started at 3600 (due to bug)
- After 1798 distributions: 3600 + 1798 = 5398 ✓
- 1798 distributions over ~74 days = ~24/day = hourly ✓

## The Fix

### Option 1: Quick Fix (Minimal Change)
```rust
// Change line 171 to NOT overwrite the counter
if let Some(interval_seconds) = args.distribution_interval_seconds {
    // DON'T store interval_seconds in DISTRIBUTION_INTERVALS
    // Just validate it but don't store it there
    if interval_seconds < 60 {
        panic!("Distribution interval cannot be less than 60 seconds");
    }
    // Remove the DISTRIBUTION_INTERVALS storage line!
}
```

### Option 2: Proper Fix (Recommended)
Create separate storage for the interval duration:

```rust
// In storage.rs - Add new storage
pub static DISTRIBUTION_INTERVAL_DURATION: RefCell<StableBTreeMap<(), u32, Memory>> = ...

// In script.rs - Store duration separately
if let Some(interval_seconds) = args.distribution_interval_seconds {
    DISTRIBUTION_INTERVAL_DURATION.with(|m| {
        m.borrow_mut().insert((), interval_seconds as u32);
    });
}

// In post_upgrade - Read from correct storage
let distribution_interval = DISTRIBUTION_INTERVAL_DURATION.with(|m| {
    m.borrow().get(&()).unwrap_or(3600) as u64
});
```

## How to Verify the Fix Works

### Before Fix Test
```bash
# Create test token with 1 hour interval
# Query immediately after creation
dfx canister call icp_swap get_distribution_interval
# Returns: 3600 (BUG!)
```

### After Fix Test
```bash
# Create test token with 1 hour interval
# Query immediately after creation
dfx canister call icp_swap get_distribution_interval
# Returns: 0 (CORRECT!)

# Run a distribution
# Query again
dfx canister call icp_swap get_distribution_interval
# Returns: 1 (CORRECT!)
```

## Impact Assessment

### What Still Works
- Distributions happen correctly (timer uses the right interval)
- APY tracking works (modulo operation doesn't care about starting point)
- All core functionality intact

### What's Confusing
- `get_distribution_interval()` returns wrong values
- Makes it look like interval is 5398 seconds instead of 3600
- Developers/auditors get confused

### Why It Hasn't Broken Everything
- The timer setup reads the value once at initialization (gets 3600)
- Timer runs correctly at 3600 second intervals
- Only the counter display is wrong

## Summary

**THE BUG IS REAL**: Line 171 overwrites the distribution counter with the interval duration, causing the counter to start at 3600 instead of 0.

**PROOF**: Your mainnet token shows 5398 = 3600 + 1798 distributions over 74 days.

**FIX**: Either remove line 171 or create separate storage for the interval duration.

**VERIFICATION**: After fix, new tokens will show counter starting at 0 and incrementing by 1 per distribution.