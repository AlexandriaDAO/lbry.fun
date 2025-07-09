# Forever-Locked LP Token System Design

## Overview

This document outlines the design for a forever-locked liquidity provision system that integrates with KongSwap. Users can lock liquidity permanently through a custodial canister that manages LP positions on their behalf, tracking ownership through internal "meta-LP" shares.

## Problem Statement

- KongSwap LP tokens are internal accounting entries, not transferable ICRC tokens
- Users can't lock LP tokens in external contracts
- Need a system that prevents gaming (lock → claim rewards → unlock)
- Must accurately track pool shares as liquidity and prices change

## Solution Architecture

### Core Concept

1. Users send tokens to the locking canister
2. Locking canister adds liquidity to Kong on behalf of all users
3. Canister receives LP tokens and holds them forever
4. Users receive proportional "meta-LP" shares representing their stake
5. Rewards distributed based on meta-LP share percentage

### Key Components

```
User → [Tokens] → Locking Canister → [Add Liquidity] → Kong Backend
                         ↓
                   [Meta-LP Shares]
                         ↓
                       User
```

## Technical Implementation

### 1. Kong Integration Details

#### Add Liquidity Function
```candid
type AddLiquidityArgs = record {
    token_0 : text;      // Token canister ID (e.g., "ryjl3-tyaaa-aaaaa-aaaba-cai")
    amount_0 : nat;      // Amount in smallest units (e.g., 100000000 for 1.0 with 8 decimals)
    tx_id_0 : opt TxId;  // Optional: block index from icrc1_transfer
    token_1 : text;      // Token canister ID
    amount_1 : nat;      // Amount in smallest units
    tx_id_1 : opt TxId;  // Optional: block index from icrc1_transfer
};

type AddLiquidityResult = variant { 
    Ok : AddLiquidityReply; 
    Err : text 
};
```

#### Query Functions
```candid
// Get expected amounts for balanced liquidity
add_liquidity_amounts : (text, nat, text) -> (AddLiquidityAmountsResult) query;

// Get user balances including LP positions
user_balances : (opt principal) -> (vec UserBalancesReply) query;

// Get total LP supply for a pool
get_total_supply : (nat32) -> (nat) query;
```

### 2. Token Amount Handling

#### Decimal Precision
- Most tokens: 8 decimals (1 token = 100,000,000 smallest units)
- Some tokens: 6 decimals (USDC, USDT)
- LP tokens: Always 8 decimals
- Internal calculations: Use BigInt to prevent precision loss

#### Example Conversions
```rust
// 1.5 tokens with 8 decimals
let amount: Nat = 150_000_000;

// 1000 USDC with 6 decimals  
let usdc_amount: Nat = 1_000_000_000;
```

### 3. Meta-LP Share Calculation

#### Initial Deposit (Empty Pool)
```rust
if meta_total_supply == 0 {
    user_meta_shares = lp_tokens_received;  // 1:1 ratio
}
```

#### Subsequent Deposits
```rust
user_meta_shares = (lp_tokens_received * meta_total_supply) / kong_lp_balance_before;
```

#### Share Value Calculation
```rust
user_pool_share = user_meta_shares / total_meta_shares;
user_token_0_amount = pool_reserve_0 * user_pool_share;
user_token_1_amount = pool_reserve_1 * user_pool_share;
```

### 4. Data Structures

```rust
// User's locked position
struct LockedPosition {
    user: Principal,
    pool_id: String,
    meta_shares: Nat,
    locked_at: u64,
    initial_token_0_amount: Nat,
    initial_token_1_amount: Nat,
}

// Pool state
struct PoolState {
    kong_pool_id: String,
    token_0: String,
    token_1: String,
    total_meta_supply: Nat,
    kong_lp_balance: Nat,
    last_update: u64,
}

// Storage
HashMap<(Principal, String), LockedPosition>  // User positions
HashMap<String, PoolState>                     // Pool states
```

### 5. Core Functions

#### Lock Liquidity
```rust
async fn lock_liquidity(
    token_0: String,
    amount_0: Nat,
    token_1: String,
    amount_1: Nat
) -> Result<LockReceipt, Error> {
    let caller = ic_cdk::caller();
    
    // 1. Transfer tokens from user
    let transfer_0 = icrc2_transfer_from(caller, token_0, amount_0).await?;
    let transfer_1 = icrc2_transfer_from(caller, token_1, amount_1).await?;
    
    // 2. Get current canister LP balance
    let balances_before = kong.user_balances(None).await?;
    let lp_before = get_lp_balance_for_pool(&balances_before, token_0, token_1);
    
    // 3. Add liquidity to Kong
    let add_result = kong.add_liquidity(AddLiquidityArgs {
        token_0: token_0.clone(),
        amount_0,
        tx_id_0: Some(TxId::BlockIndex(transfer_0)),
        token_1: token_1.clone(),
        amount_1,
        tx_id_1: Some(TxId::BlockIndex(transfer_1)),
    }).await?;
    
    // 4. Get new LP balance
    let balances_after = kong.user_balances(None).await?;
    let lp_after = get_lp_balance_for_pool(&balances_after, token_0, token_1);
    let lp_received = lp_after - lp_before;
    
    // 5. Calculate meta shares
    let pool_state = get_or_create_pool_state(token_0, token_1);
    let meta_shares = if pool_state.total_meta_supply == 0 {
        lp_received
    } else {
        (lp_received * pool_state.total_meta_supply) / pool_state.kong_lp_balance
    };
    
    // 6. Update state
    pool_state.total_meta_supply += meta_shares;
    pool_state.kong_lp_balance = lp_after;
    
    // 7. Store user position
    let position = LockedPosition {
        user: caller,
        pool_id: pool_state.kong_pool_id.clone(),
        meta_shares,
        locked_at: ic_cdk::time(),
        initial_token_0_amount: amount_0,
        initial_token_1_amount: amount_1,
    };
    
    POSITIONS.insert((caller, pool_state.kong_pool_id), position);
    
    Ok(LockReceipt {
        meta_shares,
        pool_share_percentage: (meta_shares * 100) / pool_state.total_meta_supply,
    })
}
```

#### Query User Position
```rust
fn get_user_position(user: Principal, pool_id: String) -> Result<PositionInfo, Error> {
    let position = POSITIONS.get(&(user, pool_id.clone()))
        .ok_or("No position found")?;
    
    let pool_state = POOL_STATES.get(&pool_id)
        .ok_or("Pool not found")?;
    
    // Get current pool reserves from Kong
    let kong_balances = kong.user_balances(None).await?;
    let pool_info = get_pool_info(&kong_balances, &pool_id)?;
    
    let share_percentage = (position.meta_shares * 10000) / pool_state.total_meta_supply;
    
    Ok(PositionInfo {
        meta_shares: position.meta_shares,
        share_percentage: share_percentage as f64 / 100.0,
        current_value: PositionValue {
            token_0_amount: (pool_info.amount_0 * position.meta_shares) / pool_state.total_meta_supply,
            token_1_amount: (pool_info.amount_1 * position.meta_shares) / pool_state.total_meta_supply,
            usd_value: (pool_info.usd_value * position.meta_shares) / pool_state.total_meta_supply,
        },
        locked_at: position.locked_at,
    })
}
```

#### Distribute Rewards
```rust
async fn distribute_rewards(reward_amount: Nat) -> Result<(), Error> {
    // Get all unique pools
    let pools = get_all_active_pools();
    
    for pool_id in pools {
        let pool_state = POOL_STATES.get(&pool_id).unwrap();
        let pool_reward = calculate_pool_allocation(reward_amount, &pool_id);
        
        // Distribute to all users in this pool
        for ((user, pid), position) in POSITIONS.iter() {
            if pid == pool_id {
                let user_reward = (pool_reward * position.meta_shares) / pool_state.total_meta_supply;
                credit_user_rewards(user, user_reward);
            }
        }
    }
    
    Ok(())
}
```

### 6. Security Considerations

1. **No Unlock Function**: Positions are permanently locked
2. **Slippage Protection**: Verify received LP tokens match expected amount
3. **Reentrancy Guards**: Use async locks for state modifications
4. **Input Validation**: Check minimum amounts, valid token addresses
5. **Access Control**: Admin functions for emergency pause/upgrade

### 7. Gas Optimization

1. **Batch Operations**: Process multiple locks in single transaction
2. **Lazy Updates**: Only query Kong when necessary
3. **Efficient Storage**: Use compact data structures
4. **Cache Pool Data**: Store frequently accessed data locally

## User Flow

### Locking Liquidity

1. User approves tokens to locking canister
2. User calls `lock_liquidity` with token amounts
3. Canister transfers tokens from user
4. Canister adds liquidity to Kong
5. Canister mints meta-LP shares to user
6. User receives confirmation with share details

### Viewing Position

1. User queries `get_user_position`
2. Canister calculates current value based on pool reserves
3. Returns position details including USD value

### Claiming Rewards

1. Admin distributes rewards periodically
2. Rewards allocated proportionally to meta-LP shares
3. Users claim accumulated rewards
4. No unlock option - liquidity locked forever

## Benefits

1. **True Locking**: No gaming possible - liquidity locked permanently
2. **Fair Distribution**: Proportional ownership maintained
3. **Automatic Rebalancing**: LP tokens handle price changes
4. **Fee Accumulation**: Trading fees increase position value
5. **Gas Efficient**: Batch operations reduce costs

## Limitations

1. **Permanent Lock**: Users cannot retrieve original tokens
2. **Trust Required**: Canister controls all liquidity
3. **Single Point of Failure**: Canister upgrade risks
4. **No Partial Withdrawals**: All or nothing commitment

## Future Enhancements

1. **Multi-Pool Support**: Lock liquidity across multiple pools
2. **Governance Rights**: Vote with locked liquidity
3. **Yield Strategies**: Compound trading fees
4. **Cross-Chain**: Support non-IC tokens via bridges