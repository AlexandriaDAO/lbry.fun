# Platform Fee Economics Change Plan

## Current Situation Analysis

### Platform Fee Calculation Issue
The current implementation uses double integer division which causes precision loss:
```rust
// In src/icp_swap/src/update.rs (lines 898-901)
let total_distribution = reward_pool / 100;     // 1% of pool
let alex_portion = total_distribution / 100;    // 1% of distribution = 0.01% of pool
```

**Issue**: Due to integer division rounding down at each step, the actual platform fee is ~0.74% instead of the intended 1.00%.

**Example with 10,000 ICP pool**:
- Step 1: `10,000 / 100 = 100 ICP` (1% for distribution)
- Step 2: `100 / 100 = 1 ICP` (intended 1% of distribution = 1% platform fee)
- Actual result: Platform gets ~0.74 ICP, Stakers get ~99.26 ICP (of the 100 ICP distribution)

### Current Fee Distribution Flow
1. Each token's `icp_swap` canister accumulates platform fees in `UNCOLLECTED_ALEX_FEES`
2. Every 4 hours, fees are pushed to `lbry_fun` canister (oni4e-oyaaa-aaaap-qp2pq-cai)
3. `lbry_fun` uses these fees to buy and burn $LBRY tokens hourly

## Proposed Changes

### Option 1: Fix Precision + Implement 50/50 Split (Recommended)
**Pros**:
- Corrects the platform fee to true 1.00% (of the 1% distribution)
- Fair split between ALEX and $ZERO projects
- Clean, mathematically correct implementation

**Cons**:
- Slightly increases platform fee from current ~0.74% to 1.00%

### Option 2: Keep Current ~0.74% + Implement 50/50 Split
**Pros**:
- No change to current effective economics
- Simpler to explain to existing users (no fee increase)

**Cons**:
- Perpetuates the precision bug
- Less platform revenue for both projects

## Detailed Implementation Plan

### Step 1: Fix Platform Fee Precision (if Option 1 chosen)
**File**: `src/icp_swap/src/update.rs` (lines 898-908)

**Current Code**:
```rust
// Calculate 1% of pool for distribution
let total_distribution = reward_pool / 100;

// Calculate exact distribution
let alex_portion = total_distribution / 100;  // Bug: results in ~0.74% due to rounding
let lp_portion = total_distribution - alex_portion;
```

**New Code (Option 1 - Fix precision)**:
```rust
// Calculate 1% of pool for distribution
let total_distribution = reward_pool / 100;

// Calculate platform fee more precisely (1% of distribution)
let platform_fee = reward_pool / 10000;  // Direct calculation: 0.01 of pool
let alex_portion = platform_fee / 2;     // 50% to ALEX
let zero_portion = platform_fee - alex_portion;  // 50% to ZERO (using remainder for exact)
let lp_portion = total_distribution - platform_fee;  // Remainder to stakers
```

**New Code (Option 2 - Keep current economics)**:
```rust
// Calculate 1% of pool for distribution
let total_distribution = reward_pool / 100;

// Keep the double division (maintains ~0.74% effective rate)
let platform_fee = total_distribution / 100;
let alex_portion = platform_fee / 2;     // 50% to ALEX
let zero_portion = platform_fee - alex_portion;  // 50% to ZERO
let lp_portion = total_distribution - platform_fee;
```

### Step 2: Add Storage for ZERO Fees
**File**: `src/icp_swap/src/storage.rs`

Add new memory ID (around line 40):
```rust
pub const UNCOLLECTED_ZERO_FEES_MEM_ID: MemoryId = MemoryId::new(20);
```

Add storage (around line 112):
```rust
thread_local! {
    pub static UNCOLLECTED_ZERO_FEES: RefCell<StableBTreeMap<(), u64, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(UNCOLLECTED_ZERO_FEES_MEM_ID)))
    );
}
```

### Step 3: Update Distribution Logic
**File**: `src/icp_swap/src/update.rs` (modify distribute_reward function)

Update the fee accumulation:
```rust
// Update uncollected fees for ALEX stakers (50% of platform fee)
UNCOLLECTED_ALEX_FEES.with(|f| {
    let current = f.borrow().get(&()).unwrap_or(0);
    f.borrow_mut().insert((), current.saturating_add(alex_portion));
});

// Update uncollected fees for ZERO (50% of platform fee)
UNCOLLECTED_ZERO_FEES.with(|f| {
    let current = f.borrow().get(&()).unwrap_or(0);
    f.borrow_mut().insert((), current.saturating_add(zero_portion));
});
```

### Step 4: Update Transfer Destinations
**File**: `src/icp_swap/src/update.rs`

Change the `transfer_icp_to_lbry_fun` function (line 1810):
```rust
// Rename and update the function
async fn transfer_icp_to_alex_revshare(amount: u64) -> Result<BlockIndex, String> {
    // Change destination to ALEX revenue sharing canister
    let alex_revshare_id = Principal::from_text("e454q-riaaa-aaaap-qqcyq-cai")
        .map_err(|e| format!("Invalid ALEX revshare canister ID: {}", e))?;

    // Rest of the transfer logic remains the same...
    let transfer_args = TransferArg {
        from_subaccount: None,
        to: alex_revshare_id.into(),
        // ... rest unchanged
    };
    // ... continue with transfer
}
```

Add new function for ZERO transfers:
```rust
async fn transfer_icp_to_zero_swap(amount: u64) -> Result<BlockIndex, String> {
    let zero_swap_id = Principal::from_text("bsarm-wqaaa-aaaap-qqcea-cai")
        .map_err(|e| format!("Invalid ZERO swap canister ID: {}", e))?;

    let icp_ledger_id = CONFIGS.with(|configs| {
        configs.borrow()
            .get(&())
            .map(|c| c.icp_ledger_id)
            .unwrap_or(MAINNET_LEDGER_CANISTER_ID)
    });

    let transfer_args = TransferArg {
        from_subaccount: None,
        to: zero_swap_id.into(),
        fee: None,
        created_at_time: None,
        memo: None,
        amount: Nat::from(amount),
    };

    let (result,) = ic_cdk::call::<(TransferArg,), (Result<BlockIndex, TransferError>,)>(
        icp_ledger_id,
        "icrc1_transfer",
        (transfer_args,)
    ).await
    .map_err(|e| format!("Transfer call failed: {:?}", e))?;

    result.map_err(|e| format!("Transfer failed: {:?}", e))
}
```

### Step 5: Add Collection Function for ZERO
**File**: `src/icp_swap/src/update.rs`

Add collection function:
```rust
pub async fn collect_zero_fees_internal() -> Result<u64, String> {
    const MIN_PUSH_AMOUNT: u64 = 10_000_000; // 0.1 ICP threshold

    // Atomic check and extraction
    let fees = UNCOLLECTED_ZERO_FEES.with(|f| {
        let current = f.borrow().get(&()).unwrap_or(0);
        if current >= MIN_PUSH_AMOUNT {
            f.borrow_mut().insert((), 0);  // Clear it
            current
        } else {
            0
        }
    });

    if fees == 0 {
        return Ok(0);
    }

    // Transfer to ZERO's icp_swap
    match transfer_icp_to_zero_swap(fees).await {
        Ok(_) => Ok(fees),
        Err(e) => {
            // Rollback on failure
            UNCOLLECTED_ZERO_FEES.with(|f| {
                let current = f.borrow().get(&()).unwrap_or(0);
                f.borrow_mut().insert((), current + fees);
            });
            Err(e)
        }
    }
}
```

Update the existing `collect_alex_fees_internal` to use the new transfer function:
```rust
// In collect_alex_fees_internal, change:
// match transfer_icp_to_lbry_fun(fees).await {
// To:
match transfer_icp_to_alex_revshare(fees).await {
```

### Step 6: Add Timer for ZERO Fee Collection
**File**: `src/icp_swap/src/script.rs`

Add timer in `setup_timers` function (after line 338):
```rust
// Push ZERO fees to zero swap periodically
let _zero_push_timer_id: ic_cdk_timers::TimerId = ic_cdk_timers::set_timer_interval(
    ALEX_FEE_PUSH_INTERVAL,  // Same 4-hour interval
    || { ic_cdk::spawn(push_zero_fees_wrapper()) }
);
```

Add wrapper function (after push_alex_fees_wrapper):
```rust
async fn push_zero_fees_wrapper() {
    use crate::update::collect_zero_fees_internal;

    match collect_zero_fees_internal().await {
        Ok(amount) => {
            if amount > 0 {
                register_info_log(
                    Principal::anonymous(),
                    "push_zero_fees",
                    &format!("Successfully pushed {} ICP to ZERO swap canister", amount)
                );
            }
        }
        Err(e) => {
            register_info_log(
                Principal::anonymous(),
                "push_zero_fees",
                &format!("Failed to push ZERO fees: {}", e)
            );
        }
    }
}
```

### Step 7: Update lbry_fun Canister
**File**: `src/lbry_fun/src/collection.rs`

Since fees no longer come to lbry_fun, update or remove the swap logic:
```rust
// In init_swap_timer() - either remove the timer or make it a monitoring-only function
pub fn init_swap_timer() {
    // Timer removed - platform fees now go directly to ALEX and ZERO
    // Could keep for monitoring purposes only
}
```

### Step 8: Create Change Log Entry
**File**: `src/icp_swap/ICP_SWAP_CHANGE_LOG.md` (create if doesn't exist)

```markdown
# ICP Swap Change Log

## [Date] - Platform Fee Split Implementation

### Changed
- Modified platform fee distribution from 100% to lbry_fun to 50/50 split between ALEX and ZERO
- [Option 1] Fixed precision bug: platform fee now correctly 1.00% (was ~0.74% due to double division)
- [Option 2] Maintained current ~0.74% effective rate but split between two recipients

### Added
- UNCOLLECTED_ZERO_FEES storage for tracking ZERO's portion
- collect_zero_fees_internal() function for ZERO fee collection
- Timer for pushing ZERO fees every 4 hours
- transfer_icp_to_zero_swap() function for ZERO transfers

### Modified
- distribute_reward() now splits platform fees 50/50
- ALEX fees now go to revenue sharing canister (e454q-riaaa-aaaap-qqcyq-cai) instead of lbry_fun
- Added ZERO fee destination (bsarm-wqaaa-aaaap-qqcea-cai)

### Impact
- All tokens (existing and new) will use the new fee structure after upgrade
- Platform fees split equally between ALEX and ZERO projects
- lbry_fun canister no longer receives platform fees
```

## Testing Plan

1. **Unit Tests**:
   - Test precision fix gives exactly 1.00% platform fee (Option 1)
   - Test 50/50 split with various pool amounts
   - Test with odd amounts (ensures remainder handling works)
   - Test minimum threshold enforcement

2. **Integration Tests**:
   ```bash
   cd tests
   cargo test test_platform_fee_split
   ```

3. **Local Network Testing**:
   ```bash
   # Deploy with short intervals for testing
   ./scripts/build.sh

   # Create token with 5-minute distribution interval
   # Add ICP to reward pool
   # Monitor fee accumulation and transfers
   ```

## Risk Analysis & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Transfer failures | Fees stuck | Rollback mechanism in place, retry on next interval |
| User confusion about fee change | Reputation | Clear communication about bug fix |
| One recipient unavailable | Partial fee distribution | Independent transfer timers, each succeeds/fails separately |

## Implementation Checklist

- [ ] **Decision Required**: Fix precision (1.00%) or keep current (~0.74%)?
- [ ] Update distribute_reward calculation in icp_swap
- [ ] Add ZERO fee storage and accumulation
- [ ] Implement transfer functions for both recipients
- [ ] Add collection function for ZERO fees
- [ ] Setup timer for ZERO fee collection
- [ ] Update existing ALEX transfer destination
- [ ] Update/disable lbry_fun collection logic
- [ ] Write comprehensive tests
- [ ] Document in ICP_SWAP_CHANGE_LOG.md
- [ ] Test on local network
- [ ] Deploy to testnet (if available)
- [ ] Production deployment plan

## Questions for Final Confirmation

1. **Precision Fix Decision**: Should we fix the bug (1.00% platform fee) or maintain status quo (~0.74%)?

2. **$ZERO Behavior**: What should $ZERO's icp_swap do with received fees?
   - Option A: Add to its own reward pool (benefits $ZERO stakers)
   - Option B: Use for buy/burn of $ZERO tokens
   - Option C: Other mechanism?

3. **Rollout Strategy**:
   - Immediate: All tokens get update at once
   - Phased: New tokens only, migrate existing later
   - Optional: Make it configurable per token

## Next Steps

Once you confirm the approach (especially Option 1 vs Option 2), I can begin implementing the changes with the exact code modifications outlined above.