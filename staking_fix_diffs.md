# Staking Fix - Diff Views for Options A and B

## Option A: Simple approach - Call both functions

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
-   let lp_portion = total_distribution - alex_portion; // Remainder for exact accounting
+   let staker_portion = total_distribution - alex_portion; // 99% for stakers

-   // Update uncollected fees
+   // Update ALEX fees only
    UNCOLLECTED_ALEX_FEES.with(|f| {
        let current = f.borrow().get(&()).unwrap_or(0);
        f.borrow_mut().insert((), current.saturating_add(alex_portion));
    });

-   UNCOLLECTED_LP_FEES.with(|f| {
-       let current = f.borrow().get(&()).unwrap_or(0);
-       f.borrow_mut().insert((), current.saturating_add(lp_portion));
+   // Add staker portion back to pool for distribute_reward_to_stakers
+   REWARD_POOL.with(|p| {
+       let current = p.borrow().get(&()).unwrap_or(0);
+       p.borrow_mut().insert((), current.saturating_add(staker_portion));
    });

+   // Distribute to stakers
+   let staker_result = distribute_reward_to_stakers().await?;
+
    register_info_log(
        caller(),
        "distribute_reward",
-       &format!("Distributed {} from pool of {}", total_distribution, reward_pool)
+       &format!("Distributed {} to ALEX, staker distribution: {}", alex_portion, staker_result)
    );

-   Ok(format!("Distributed {} from pool of {}", total_distribution, reward_pool))
+   Ok(format!("Distributed {} to ALEX, staker distribution: {}", alex_portion, staker_result))
}
```

### Option A Flow:
1. Takes 1% from reward pool (total_distribution)
2. Splits it: 1% to ALEX (0.01% of pool), 99% back to pool (0.99% of pool)
3. Calls distribute_reward_to_stakers() which will:
   - Take STAKING_REWARD_PERCENTAGE (9900/10000 = 99%) of the pool
   - Distribute it to stakers
4. Result: ALEX gets 0.01% of pool, stakers get ~0.98% of pool

**ISSUE WITH OPTION A**: The math is wrong! distribute_reward_to_stakers() will take 99% of the ENTIRE pool, not just the 0.99% we put back.

## Option B: Cleaner approach - Proper math

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

+   // Update reward pool (remove what we're distributing)
+   REWARD_POOL.with(|p| {
+       let new_pool = reward_pool.saturating_sub(total_distribution);
+       p.borrow_mut().insert((), new_pool);
+   });
+
    // Calculate exact distribution
    let alex_portion = total_distribution / 100;  // 1% of distribution
-   let lp_portion = total_distribution - alex_portion; // Remainder for exact accounting
+   let staker_portion = total_distribution - alex_portion; // 99% of distribution

-   // Update reward pool (remove what we're distributing)
-   REWARD_POOL.with(|p| {
-       let new_pool = reward_pool.saturating_sub(total_distribution);
-       p.borrow_mut().insert((), new_pool);
-   });
-
-   // Update uncollected fees
+   // Update ALEX fees
    UNCOLLECTED_ALEX_FEES.with(|f| {
        let current = f.borrow().get(&()).unwrap_or(0);
        f.borrow_mut().insert((), current.saturating_add(alex_portion));
    });

-   UNCOLLECTED_LP_FEES.with(|f| {
-       let current = f.borrow().get(&()).unwrap_or(0);
-       f.borrow_mut().insert((), current.saturating_add(lp_portion));
-   });
+   // Distribute staker_portion directly to stakers
+   let total_staked = get_total_staked_primary_tokens();
+   if total_staked > 0 {
+       STAKES.with(|s| {
+           for (principal, stake) in s.borrow().iter() {
+               let stake_ratio = stake.primary_token_amount as u128 * SCALING_FACTOR / total_staked as u128;
+               let icp_reward = (staker_portion as u128 * stake_ratio) / SCALING_FACTOR;
+
+               let mut updated_stake = stake.clone();
+               updated_stake.reward_icp = updated_stake.reward_icp.saturating_add(icp_reward);
+               s.borrow_mut().insert(principal, updated_stake);
+           }
+       });
+   }

    register_info_log(
        caller(),
        "distribute_reward",
-       &format!("Distributed {} from pool of {}", total_distribution, reward_pool)
+       &format!("Distributed {} to ALEX, {} to stakers", alex_portion, staker_portion)
    );

-   Ok(format!("Distributed {} from pool of {}", total_distribution, reward_pool))
+   Ok(format!("Distributed {} to ALEX, {} to stakers", alex_portion, staker_portion))
}
```

### Option B Flow:
1. Takes 1% from reward pool (total_distribution)
2. Splits it: 1% to ALEX (0.01% of pool), 99% to stakers (0.99% of pool)
3. Directly distributes the staker portion proportionally
4. Result: Exactly 0.01% to ALEX, 0.99% to stakers

## Option C: Simplest - Just fix the percentage and call existing function

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

    // Calculate exact distribution
    let alex_portion = total_distribution / 100;  // 1% of distribution
-   let lp_portion = total_distribution - alex_portion; // Remainder for exact accounting

    // Update reward pool (remove what we're distributing)
    REWARD_POOL.with(|p| {
-       let new_pool = reward_pool.saturating_sub(total_distribution);
+       let new_pool = reward_pool.saturating_sub(alex_portion); // Only remove ALEX portion
        p.borrow_mut().insert((), new_pool);
    });

-   // Update uncollected fees
+   // Update ALEX fees only
    UNCOLLECTED_ALEX_FEES.with(|f| {
        let current = f.borrow().get(&()).unwrap_or(0);
        f.borrow_mut().insert((), current.saturating_add(alex_portion));
    });

-   UNCOLLECTED_LP_FEES.with(|f| {
-       let current = f.borrow().get(&()).unwrap_or(0);
-       f.borrow_mut().insert((), current.saturating_add(lp_portion));
-   });
+   // Now call distribute_reward_to_stakers which will take 99% of remaining pool
+   let staker_result = distribute_reward_to_stakers().await?;

    register_info_log(
        caller(),
        "distribute_reward",
-       &format!("Distributed {} from pool of {}", total_distribution, reward_pool)
+       &format!("Distributed {} to ALEX, staker result: {}", alex_portion, staker_result)
    );

-   Ok(format!("Distributed {} from pool of {}", total_distribution, reward_pool))
+   Ok(format!("Distributed {} to ALEX, staker result: {}", alex_portion, staker_result))
}
```

### Option C Flow:
1. Takes only 0.01% from pool for ALEX fees
2. Calls distribute_reward_to_stakers() which takes 99% of remaining pool
3. Result: 0.01% to ALEX, ~0.99% to stakers (with proper STAKING_REWARD_PERCENTAGE = 9900)

## Recommendation
**Option C is the simplest and cleanest** because:
1. Minimal changes to existing code
2. Reuses the existing distribute_reward_to_stakers() logic
3. Clear separation of concerns
4. Math works out correctly with the fixed STAKING_REWARD_PERCENTAGE

The key insight is we need to:
1. Fix STAKING_REWARD_PERCENTAGE from 100 to 9900
2. Only deduct ALEX fees from the pool in distribute_reward()
3. Let distribute_reward_to_stakers() handle the staker distribution
