# Logs Canister Refactor Plan - Minimal Fix

## Problem Summary
The lbryfun logs canister fails because it uses the `?` operator for async calls to fetch data. When ANY of the 7 calls fails (common for newly launched tokens), the entire log entry is skipped. The core version works because those canisters have been running for a long time with complete data.

## Minimal Solution
Just two simple changes to make it work:

### 1. Make Data Fetching Resilient
**File:** `/home/theseus/alexandria/lbryfun/src/logs/src/update.rs`

**Current code (lines 12-43):**
```rust
#[update(guard = "is_canister")]
pub async fn register_log() -> Result<String, String> {
    let primary_token_supply = get_primary_token_supply().await?;
    let secondary_token_supply = get_secondary_token_supply().await?;
    let total_secondary_burned = get_total_secondary_burned().await?;
    let icp_in_lp_treasury = get_icp_in_lp_treasury().await?;
    let total_primary_staked = get_total_primary_staked().await?;
    let staker_count = get_stakers_count().await?;
    let apy = get_apy_value().await?;
    let time = ic_cdk::api::time();

    LOGS.with(|logs| -> Result<(), String> {
        let mut log_map = logs.borrow_mut();
        if log_map.contains_key(&time) {
            return Err("Log already exists for this timestamp".to_string());
        }
        let new_log = Log {
            time,
            primary_token_supply,
            secondary_token_supply,
            total_secondary_burned,
            icp_in_lp_treasury,
            total_primary_staked,
            staker_count,
            apy,
        };

        log_map.insert(time.clone(), new_log);
        Ok(())
    })?;
    Ok("Logged!".to_string())
}
```

**New code:**
```rust
use candid::Nat;  // Add this import

#[update(guard = "is_canister")]
pub async fn register_log() -> Result<String, String> {
    // Use unwrap_or with sensible defaults instead of ? operator
    let primary_token_supply = get_primary_token_supply().await.unwrap_or(Nat::from(0u128));
    let secondary_token_supply = get_secondary_token_supply().await.unwrap_or(Nat::from(0u128));
    let total_secondary_burned = get_total_secondary_burned().await.unwrap_or(0);
    let icp_in_lp_treasury = get_icp_in_lp_treasury().await.unwrap_or(0);
    let total_primary_staked = get_total_primary_staked().await.unwrap_or(Nat::from(0u128));
    let staker_count = get_stakers_count().await.unwrap_or(0);
    let apy = get_apy_value().await.unwrap_or(0);
    let time = ic_cdk::api::time();

    LOGS.with(|logs| -> Result<(), String> {
        let mut log_map = logs.borrow_mut();
        if log_map.contains_key(&time) {
            return Err("Log already exists for this timestamp".to_string());
        }
        let new_log = Log {
            time,
            primary_token_supply,
            secondary_token_supply,
            total_secondary_burned,
            icp_in_lp_treasury,
            total_primary_staked,
            staker_count,
            apy,
        };

        log_map.insert(time.clone(), new_log);
        Ok(())
    })?;
    Ok("Logged!".to_string())
}
```

### 2. Add Post-Upgrade Hook
**File:** `/home/theseus/alexandria/lbryfun/src/logs/src/script.rs`

**Current code (lines 17-54):**
```rust
#[init]
 fn init(args: InitArgs) {
    if args.primary_token_id == Principal::anonymous() {
        ic_cdk::trap("Initialization failed: 'primary_token_id' cannot be anonymous.");
    }
    if args.secondary_token_id == Principal::anonymous() {
        ic_cdk::trap("Initialization failed: 'secondary_token_id' cannot be anonymous.");
    }
    if args.icp_swap_id == Principal::anonymous() {
        ic_cdk::trap("Initialization failed: 'icp_swap_id' cannot be anonymous.");
    }
    if args.tokenomics_id == Principal::anonymous() {
        ic_cdk::trap("Initialization failed: 'tokenomics_id' cannot be anonymous.");
    }

    let config = Config {
        primary_token_id: args.primary_token_id,
        secondary_token_id: args.secondary_token_id,
        icp_swap_id: args.icp_swap_id,
        tokenomics_id: args.tokenomics_id,
    };

    CONFIGS.with(|c| {
        c.borrow_mut()
            .set(config)
            .expect("Failed to initialize config");
    });

    let _log_timer_id: ic_cdk_timers::TimerId = ic_cdk_timers::set_timer_interval(LOG_INTERVAL, || ic_cdk::spawn(register_log_wrapper()));
}

#[update(guard = "is_canister")]
async fn register_log_wrapper() {
    match register_log().await {
        Ok(_) => ic_cdk::println!("Logged wrapper"),
        Err(e) => ic_cdk::println!("Error registering log: {}", e),
    }
}
```

**New code (add after init function):**
```rust
use ic_cdk::{init, post_upgrade, update};  // Add post_upgrade to imports

#[init]
 fn init(args: InitArgs) {
    // ... existing init code unchanged ...
    
    let _log_timer_id: ic_cdk_timers::TimerId = ic_cdk_timers::set_timer_interval(LOG_INTERVAL, || ic_cdk::spawn(register_log_wrapper()));
}

#[post_upgrade]
fn post_upgrade() {
    // Simply restart the timer after upgrade
    let _log_timer_id: ic_cdk_timers::TimerId = ic_cdk_timers::set_timer_interval(LOG_INTERVAL, || ic_cdk::spawn(register_log_wrapper()));
}

#[update(guard = "is_canister")]
async fn register_log_wrapper() {
    match register_log().await {
        Ok(_) => ic_cdk::println!("Logged wrapper"),
        Err(e) => ic_cdk::println!("Error registering log: {}", e),
    }
}
```

## That's It!

No other changes needed. This minimal fix will:
- **Always create a log entry** (even if all data is zeros initially)
- **Continue working after upgrades** 
- **Gradually show real data** as the token matures and canisters become ready

## What We're NOT Adding:
- ❌ Data quality tracking
- ❌ Error arrays
- ❌ Pause/resume functionality
- ❌ Health endpoints
- ❌ Memory rotation (8760 logs is fine)
- ❌ Complex timer management
- ❌ New types or structs
- ❌ Wrapper function removal
- ❌ Guard changes

## Why This Works:
1. **Matches core canister behavior** - Simple and robust
2. **Handles new tokens gracefully** - Shows zeros instead of failing
3. **Progressive data population** - As token systems come online, data appears
4. **No breaking changes** - Just makes existing code more resilient

## Implementation Steps:
1. Update `update.rs` - Replace `?` with `.unwrap_or()` 
2. Update `script.rs` - Add `post_upgrade` function
3. Build and deploy
4. Test with a new token launch

## Expected Behavior:
- **Hour 1:** Might show all zeros if canisters aren't ready
- **Hour 2-5:** Some data starts appearing as systems initialize  
- **Hour 6+:** Full data collection as all systems are operational

This is exactly how the core logs canister works - simple, robust, and effective.