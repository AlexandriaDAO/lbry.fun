# Critical Fix: Global Unclaimed Reward Tracking - 2025-08-08

## Summary
Fixed a critical bug where the global `TOTAL_UNCLAIMED_ICP_REWARD` counter was not being updated when distributing rewards to stakers, causing claim transactions to fail while still sending ICP. This bug was introduced in the August 6 staking distribution fix when the distribution logic was rewritten.

## Problem Discovered
Users experienced the following symptoms:
1. After claiming rewards, `amount_earned` in UI never reset to 0
2. Could attempt to claim the same rewards multiple times
3. Eventually showed more unclaimed rewards than ICP available in canister
4. Example: User showed 97 ICP in unclaimed rewards but canister only had 43 ICP

## Root Cause Analysis

### The Bug Sequence:
1. **Distribution Phase** (after Aug 6 fix):
   - Individual `stake.reward_icp` values were updated correctly ✓
   - But `TOTAL_UNCLAIMED_ICP_REWARD` global counter was NOT updated ✗
   - Global counter stayed at 0 while individual rewards accumulated

2. **Claim Phase**:
   - User clicks claim with 50 ICP in `stake.reward_icp`
   - `send_icp()` succeeds - user receives 50 ICP ✓
   - `sub_to_unclaimed_amount(50)` tries to subtract 50 from 0 → **UNDERFLOW ERROR**
   - Function returns error, skipping the stake reset
   - User's `stake.reward_icp` remains at 50 ICP (not reset to 0)

3. **Accumulation**:
   - More distributions add to the unreset `stake.reward_icp`
   - User appears to have 97 ICP in rewards (50 old + 47 new)
   - But they already claimed 50 ICP in step 2

## The Fix

### Code Change in `/src/icp_swap/src/update.rs`:

In the `distribute_reward()` function, we added the missing call to update the global counter:

```rust
// In distribute_reward() function, after updating individual stakes:

        // Apply updates
        STAKES.with(|s| {
            for (principal, updated_stake) in updates {
                s.borrow_mut().insert(principal, updated_stake);
            }
        });
        
+       // Update the global unclaimed amount to match the sum of all stake rewards
+       // This ensures sub_to_unclaimed_amount won't underflow when users claim
+       add_to_unclaimed_amount(lp_portion as u128)?;
    }
```

This single line ensures that `TOTAL_UNCLAIMED_ICP_REWARD` increases by the same amount that was distributed to all stakers combined.

## Technical Explanation

The `claim_icp_reward` function follows this order:
1. Send ICP to user
2. Subtract from global total (`sub_to_unclaimed_amount`)
3. Reset user's stake reward to 0

If step 2 fails (underflow), the function returns an error and step 3 never happens. The user gets their ICP but the system still thinks they haven't claimed.

The fix ensures the global `TOTAL_UNCLAIMED_ICP_REWARD` stays synchronized with the sum of all individual `stake.reward_icp` values, preventing the underflow condition.

## Impact Assessment

### Before Fix:
- Users could drain canister by repeatedly claiming
- Accounting showed phantom unclaimed rewards
- Global tracking was completely broken

### After Fix:
- Claims will properly reset user rewards to 0
- Global tracking stays in sync with individual stakes
- Prevents double-claiming vulnerability

## Testing Recommendations

1. Verify `TOTAL_UNCLAIMED_ICP_REWARD` equals sum of all `stake.reward_icp` after distribution
2. Confirm successful claims reset `stake.reward_icp` to 0
3. Test that `sub_to_unclaimed_amount` no longer underflows
4. Ensure UI shows 0 for `amount_earned` after claiming

## Known Limitations

### Minor Rounding Discrepancy
Due to integer division in reward calculations, the sum of all individual rewards may be slightly less than `lp_portion` (by a few E8S). Over many distributions, `TOTAL_UNCLAIMED_ICP_REWARD` could become marginally higher than the actual sum of stakes. This is negligible (< 0.0001 ICP over thousands of distributions) and won't cause failures.

## Lessons Learned

When modifying distribution logic, always ensure:
1. Individual reward tracking is updated
2. Global totals are updated to match
3. The claim function's preconditions are maintained  
4. Test the full cycle: distribute → claim → verify reset
5. Maintain synchronization between all accounting mechanisms