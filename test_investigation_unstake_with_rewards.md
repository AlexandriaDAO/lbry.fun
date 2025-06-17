# Test Investigation: test_unstake_with_rewards

## Test Status
**FAILING** - Blocked by inability to stake tokens

## Test Purpose
This test validates that users can unstake their tokens AND receive both their principal and accumulated rewards in a single operation.

## Failure Analysis

### Dependency Chain
Same as claim_rewards test - cannot reach unstaking because staking is blocked:
1. Need tokens ❌
2. Need to stake ❌  
3. Need to accumulate rewards ❌
4. Need to unstake ❌

## Unstake Implementation Analysis

### Core Function (src/icp_swap/src/update.rs)
```rust
pub async fn unstake(amount: Nat) -> Result<(), String> {
    let caller = ic_cdk::caller();
    
    // 1. Check user has enough staked
    let staked_amount = STAKERS.with(|stakers| {
        stakers.borrow()
            .get(&caller)
            .map(|s| s.amount)
            .unwrap_or(0)
    });
    
    if amount_to_u128(&amount)? > staked_amount {
        return Err("Insufficient staked amount".to_string());
    }
    
    // 2. Calculate and claim pending rewards first
    let rewards = claim_rewards().await.unwrap_or(0);
    
    // 3. Transfer tokens back to user
    let transfer_result = primary_token_transfer(
        caller,
        amount.clone()
    ).await?;
    
    // 4. Update staking records
    STAKING_POOL.with(|pool| {
        let mut pool = pool.borrow_mut();
        pool.total_staked = pool.total_staked.saturating_sub(amount_to_u128(&amount)?);
    });
    
    STAKERS.with(|stakers| {
        let mut stakers = stakers.borrow_mut();
        if let Some(staker) = stakers.get_mut(&caller) {
            staker.amount = staker.amount.saturating_sub(amount_to_u128(&amount)?);
            if staker.amount == 0 {
                stakers.remove(&caller);
            }
        }
    });
    
    Ok(())
}
```

## Critical Design Issues

### Issue 1: Atomicity Problem
The current implementation has a race condition:
1. Claims rewards (transfers ICP)
2. Then transfers tokens back
3. If step 2 fails, user loses rewards but keeps stake

### Issue 2: Partial Unstaking Complexity
- User might unstake 50% of tokens
- How are rewards calculated for remaining 50%?
- Need to track reward share accurately

### Issue 3: Emergency Unstaking
- What if reward pool is empty?
- Should user still get principal back?
- Current code might fail entirely

## Recommended Implementation Fix

### Option 1: True Atomic Operation
```rust
pub async fn unstake_with_rewards(amount: Nat) -> Result<UnstakeResult, String> {
    // Start atomic operation
    let operation_id = start_atomic_operation();
    
    try {
        // 1. Calculate everything first
        let rewards = calculate_pending_rewards(caller)?;
        let token_amount = amount_to_u128(&amount)?;
        
        // 2. Update state optimistically
        update_staking_state(caller, -token_amount);
        
        // 3. Execute transfers
        let token_transfer = transfer_tokens_to_user(amount).await?;
        let reward_transfer = transfer_rewards_to_user(rewards).await?;
        
        // 4. Commit operation
        commit_atomic_operation(operation_id);
        
        Ok(UnstakeResult {
            tokens_returned: token_amount,
            rewards_claimed: rewards,
        })
    } catch (e) {
        // Rollback all changes
        rollback_atomic_operation(operation_id);
        Err(e)
    }
}
```

### Option 2: Separate Operations (Current)
Keep claim_rewards and unstake separate but document clearly:
- Users should claim rewards first
- Then unstake tokens
- UI should handle this flow

## Test Scenarios When Working

### Scenario 1: Full Unstake
```rust
1. Stake 1000 tokens
2. Wait 5 hours
3. Unstake all 1000 tokens
4. Should receive:
   - 1000 tokens back
   - 5 hours worth of rewards
```

### Scenario 2: Partial Unstake
```rust
1. Stake 1000 tokens
2. Wait 3 hours
3. Unstake 400 tokens
4. Should receive:
   - 400 tokens back
   - 3 hours of rewards on 1000 tokens
5. Remaining stake: 600 tokens
```

## Priority
**HIGH** - Critical user flow

## Security Considerations
1. Reentrancy protection needed
2. Ensure state consistency
3. Handle transfer failures gracefully
4. Prevent double-claiming of rewards

## Impact Analysis
- **User Trust**: Failed unstaking = locked funds = platform death
- **Economic Security**: Must ensure no token/reward duplication
- **UX**: Should be simple one-click operation