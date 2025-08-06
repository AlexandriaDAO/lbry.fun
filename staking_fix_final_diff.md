# Final Staking Fix - Diff View

## Changes to `/src/icp_swap/src/update.rs`

```diff
pub async fn distribute_reward() -> Result<String, ExecutionError> {
    // Get current reward pool balance
    let reward_pool = REWARD_POOL.with(|p| {
        p.borrow().get(&()).unwrap_or(0)
    });
    
    if reward_pool == 0 {
        return Err(ExecutionError::new("No rewards to distribute"));
    }
    
    // Calculate 1% of pool for distribution
    let total_distribution = reward_pool / 100;
    
    // Update reward pool (remove what we're distributing)
    REWARD_POOL.with(|p| {
        let new_pool = reward_pool.saturating_sub(total_distribution);
        p.borrow_mut().insert((), new_pool);
    });
    
    // Calculate exact distribution
    let alex_portion = total_distribution / 100;  // 1% of distribution
    let lp_portion = total_distribution - alex_portion; // Remainder for exact accounting
    
    // Update uncollected fees
    UNCOLLECTED_ALEX_FEES.with(|f| {
        let current = f.borrow().get(&()).unwrap_or(0);
        f.borrow_mut().insert((), current.saturating_add(alex_portion));
    });
    
-   UNCOLLECTED_LP_FEES.with(|f| {
-       let current = f.borrow().get(&()).unwrap_or(0);
-       f.borrow_mut().insert((), current.saturating_add(lp_portion));
-   });
+   // Distribute lp_portion directly to stakers
+   let total_staked = get_total_staked_primary_tokens();
+   if total_staked > 0 {
+       // Collect updates first to avoid borrow checker issues
+       let updates: Vec<(Principal, Stake)> = STAKES.with(|s| {
+           s.borrow()
+               .iter()
+               .map(|(principal, stake)| {
+                   let stake_ratio = (stake.amount as u128) * SCALING_FACTOR / (total_staked as u128);
+                   let icp_reward = ((lp_portion as u128) * stake_ratio) / SCALING_FACTOR;
+                   
+                   let mut updated_stake = stake.clone();
+                   updated_stake.reward_icp = updated_stake.reward_icp.saturating_add(icp_reward);
+                   (*principal, updated_stake)
+               })
+               .collect()
+       });
+       
+       // Apply updates
+       STAKES.with(|s| {
+           for (principal, updated_stake) in updates {
+               s.borrow_mut().insert(principal, updated_stake);
+           }
+       });
+   }
    
    register_info_log(
        caller(),
        "distribute_reward",
-       &format!("Distributed {} from pool of {}", total_distribution, reward_pool)
+       &format!("Distributed {} to ALEX, {} to stakers from pool of {}", alex_portion, lp_portion, reward_pool)
    );
    
-   Ok(format!("Distributed {} from pool of {}", total_distribution, reward_pool))
+   Ok(format!("Distributed {} to ALEX, {} to stakers", alex_portion, lp_portion))
}
```

## Required Imports

At the top of `/src/icp_swap/src/update.rs`, ensure these are imported:
```diff
use crate::{
    // ... existing imports ...
+   get_total_staked_primary_tokens,
+   storage::{STAKES, Stake},
+   utils::SCALING_FACTOR,
    // ... rest of imports ...
};
+use candid::Principal;
```

## What This Changes

### Before:
- 1% of pool taken for distribution (1 ICP from 100 ICP pool)
- Split: 0.01 ICP to ALEX fees, 0.99 ICP to LP fees
- Stakers get nothing (LP fees just accumulate)

### After:
- 1% of pool taken for distribution (1 ICP from 100 ICP pool)
- Split: 0.01 ICP to ALEX fees, 0.99 ICP distributed directly to stakers
- Each staker receives proportional share based on their stake

## Math Verification
With 100 ICP in pool:
- `total_distribution` = 100 / 100 = 1 ICP
- `alex_portion` = 1 / 100 = 0.01 ICP
- `lp_portion` = 1 - 0.01 = 0.99 ICP
- Stakers receive 0.99 ICP distributed proportionally ✅

## Changelog Entry

```markdown
## 2025-08-06: Fixed Staker Reward Distribution

### Changes Made:
1. **update.rs - distribute_reward()**:
   - Replaced UNCOLLECTED_LP_FEES accumulation with direct staker distribution
   - The 99% portion (of the 1% distribution) now goes directly to stakers proportionally
   - Platform fee (1% of 1%) continues to accumulate in UNCOLLECTED_ALEX_FEES

### Purpose:
Fixed staking rewards showing 0 ICP. The LP fee accumulation was preventing stakers from receiving their rewards.

### Impact:
- Stakers now receive 0.99% of the reward pool per distribution interval
- Platform receives 0.01% of the reward pool per distribution interval
- Total distribution remains 1% of pool per interval
- UNCOLLECTED_LP_FEES remains unchanged for potential future use
```