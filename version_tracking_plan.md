# Version Tracking Implementation Plan

## Overview
Add a codebase version number that gets stored with each token launch, allowing tracking of which version of the code each token was launched with.

## Implementation Steps

### 1. Add Version Constant to lbry_fun Canister

**File: `/src/lbry_fun/src/constants.rs`**

```diff
use candid::Principal;

+ // Codebase version - Update this when making changes to the codebase
+ pub const CODEBASE_VERSION: &str = "0.1.0";
+ 
// Admin principal
const ADMIN_PRINCIPAL_STR: &str = "56kka-oe6xl-acccy-6cc5r-odus2-insgr-kk5ch-3d5i5-rwoit-3juc3-jqe";
```

### 2. Add Version Field to TokenRecord Storage

**File: `/src/lbry_fun/src/storage.rs`**

```diff
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TokenRecord {
    pub id: u64,
    pub status: TokenStatus,
    // Core token info
    pub primary_token_id: Principal,
    pub primary_token_symbol: String,
    pub primary_token_max_supply: u64,
    pub secondary_token_id: Principal,
    pub secondary_token_name: String,
    pub secondary_token_symbol: String,
    // Canister references
    pub tokenomics_canister_id: Principal,
    pub icp_swap_canister_id: Principal,
    pub logs_canister_id: Principal,
    // Configuration
    pub initial_primary_mint: u64,
    pub initial_secondary_burn: u64,
    pub halving_step: u64,
    pub threshold_multiplier: f64,
    pub initial_reward_per_burn_unit: u64,
    pub distribution_interval_seconds: u64,
    pub launch_delay_seconds: u64,
    // Metadata
    pub caller: Principal,
    pub created_time: u64,
    pub launched_at: u64,
+   // Version tracking
+   pub codebase_version: String,
}
```

### 3. Update Token Creation to Store Version

**File: `/src/lbry_fun/src/deployment_execution.rs`**

Find the function that creates TokenRecord and add version:

```diff
// In the function that creates TokenRecord (likely in execute_deployment or similar)
let token_record = TokenRecord {
    id: token_id,
    status: TokenStatus::Upcoming,
    primary_token_id: primary_canister_id,
    primary_token_name: deployment.params.primary_token_name.clone(),
    primary_token_symbol: deployment.params.primary_token_symbol.clone(),
    primary_token_max_supply: deployment.params.primary_max_supply,
    secondary_token_id: secondary_canister_id,
    secondary_token_name: deployment.params.secondary_token_name.clone(),
    secondary_token_symbol: deployment.params.secondary_token_symbol.clone(),
    tokenomics_canister_id: tokenomics_canister_id,
    icp_swap_canister_id: icp_swap_canister_id,
    logs_canister_id: logs_canister_id,
    initial_primary_mint: deployment.params.initial_primary_mint,
    initial_secondary_burn: deployment.params.initial_secondary_burn,
    halving_step: deployment.params.halving_step,
    threshold_multiplier: deployment.params.threshold_multiplier,
    initial_reward_per_burn_unit: deployment.params.initial_reward_per_burn_unit,
    distribution_interval_seconds: deployment.params.distribution_interval_seconds,
    launch_delay_seconds: deployment.params.launch_delay_seconds,
    caller: deployment.user,
    created_time: ic_cdk::api::time(),
    launched_at: ic_cdk::api::time() + (deployment.params.launch_delay_seconds * 1_000_000_000),
+   codebase_version: CODEBASE_VERSION.to_string(),
};
```

### 4. Pass Version to Child Canisters (Optional but Recommended)

**Option A: Add to ICP_SWAP Init Args**

**File: `/src/lbry_fun/src/utlis.rs`** (where IcpSwapInitArgs is defined)

```diff
#[derive(CandidType)]
pub struct IcpSwapInitArgs {
    pub token_id: Option<u64>,
    pub primary_token_id: Option<Principal>,
    pub secondary_token_id: Option<Principal>,
    pub tokenomics_canister_id: Option<Principal>,
    pub icp_ledger_id: Option<Principal>,
    pub distribution_interval_seconds: u64,
    pub launch_time: Option<u64>,
+   pub parent_codebase_version: Option<String>,
}
```

**File: `/src/lbry_fun/src/update.rs`** (in install_icp_swap_wasm_on_existing_canister function)

```diff
pub async fn install_icp_swap_wasm_on_existing_canister(
    canister_id: Principal,
    primary_token_id: Option<Principal>,
    secondary_token_id: Option<Principal>,
    tokenomics_canister_id: Option<Principal>,
    distribution_interval_seconds: u64,
    launch_delay_seconds: u64,
    token_id: Option<u64>,
+   codebase_version: Option<String>,
) -> Result<(), String> {
    // Calculate launch_time from current time + delay
    let launch_time = if launch_delay_seconds > 0 {
        Some(ic_cdk::api::time() / 1_000_000_000 + launch_delay_seconds)
    } else {
        None
    };

    let args = IcpSwapInitArgs {
        token_id,
        primary_token_id,
        secondary_token_id,
        tokenomics_canister_id,
        icp_ledger_id: None,
        distribution_interval_seconds,
        launch_time,
+       parent_codebase_version: codebase_version,
    };
```

**File: `/src/lbry_fun/src/deployment_execution.rs`** (in execute_deployment_safe function)

```diff
    ic_cdk::println!("[DEPLOYMENT] Installing swap wasm...");
    install_icp_swap_wasm_on_existing_canister(
        swap_canister_id,
        Some(get_principal(&primary_token_id)),
        Some(get_principal(&secondary_token_id)),
        Some(tokenomics_canister_id),
        params.distribution_interval_seconds,
        params.launch_delay_seconds,
        Some(token_id),
+       Some(CODEBASE_VERSION.to_string()),
    )
    .await?;
```

**File: `/src/icp_swap/src/lib.rs`** (to store the version in icp_swap canister)

```diff
thread_local! {
    static CANISTER_DATA: RefCell<CanisterData> = RefCell::new(CanisterData::default());
+   static PARENT_CODEBASE_VERSION: RefCell<String> = RefCell::new(String::new());
}

#[init]
fn init(arg: Option<IcpSwapInitArgs>) {
    if let Some(args) = arg {
        // ... existing initialization code ...
+       if let Some(version) = args.parent_codebase_version {
+           PARENT_CODEBASE_VERSION.with(|v| *v.borrow_mut() = version);
+       }
    }
}
```

**Option B: Add to Tokenomics Init Args**

**File: `/src/lbry_fun/src/utlis.rs`** (where TokenomicsCanisterInitArgs is defined)

```diff
pub struct TokenomicsCanisterInitArgs {
    pub primary_token_ledger: Principal,
    pub secondary_token_ledger: Principal,
    pub icp_swap_canister_id: Principal,
    pub max_primary_supply: u64,
    pub secondary_thresholds: Vec<u64>,
    pub primary_rewards: Vec<u64>,
+   pub parent_codebase_version: Option<String>,
}
```

**File: `/src/lbry_fun/src/update.rs`** (in install_tokenomics_wasm_on_existing_canister function)

```diff
pub async fn install_tokenomics_wasm_on_existing_canister(
    canister_id: Principal,
    primary_token_id: Option<Principal>,
    secondary_token_id: Option<Principal>,
    _swap_canister_id: Option<Principal>,
    _max_primary_supply: u64,
    _initial_primary_mint: u64,
    _initial_secondary_burn: u64,
    _halving_step: u64,
    _initial_reward_per_burn_unit: u64,
    secondary_thresholds: Vec<u64>,
    primary_rewards: Vec<u64>,
+   codebase_version: Option<String>,
) -> Result<(), String> {
    // Create the init args for the tokenomics canister
    let init_args = TokenomicsCanisterInitArgs {
        primary_token_ledger: primary_token_id.ok_or("Primary token ID required")?,
        secondary_token_ledger: secondary_token_id.ok_or("Secondary token ID required")?,
        icp_swap_canister_id: _swap_canister_id.ok_or("ICP swap canister ID required")?,
        max_primary_supply: _max_primary_supply,
        secondary_thresholds,
        primary_rewards,
+       parent_codebase_version: codebase_version,
    };
```

**File: `/src/lbry_fun/src/deployment_execution.rs`** (in execute_deployment_safe function)

```diff
    install_tokenomics_wasm_on_existing_canister(
        tokenomics_canister_id,
        Some(get_principal(&primary_token_id)),
        Some(get_principal(&secondary_token_id)),
        Some(swap_canister_id),
        params.primary_max_supply.into(),
        params.initial_primary_mint,
        params.initial_secondary_burn,
        params.halving_step,
        params.initial_reward_per_burn_unit,
        secondary_thresholds.clone(),
        primary_rewards.clone(),
+       Some(CODEBASE_VERSION.to_string()),
    )
    .await?;
```

**File: `/src/tokenomics/src/lib.rs`** (to store the version in tokenomics canister)

```diff
thread_local! {
    static STORAGE: RefCell<Storage> = RefCell::new(Storage::default());
+   static PARENT_CODEBASE_VERSION: RefCell<String> = RefCell::new(String::new());
}

#[init]
fn init(args: TokenomicsCanisterInitArgs) {
    // ... existing initialization code ...
+   if let Some(version) = args.parent_codebase_version {
+       PARENT_CODEBASE_VERSION.with(|v| *v.borrow_mut() = version);
+   }
}
```

### 5. Update Frontend to Display Version

**File: `/src/lbry_fun_frontend/src/types/token.ts`**

```diff
export interface TokenRecord {
  id: bigint;
  status: TokenStatus;
  primary_token_id: Principal;
  primary_token_name: string;
  primary_token_symbol: string;
  primary_token_max_supply: bigint;
  secondary_token_id: Principal;
  secondary_token_name: string;
  secondary_token_symbol: string;
  tokenomics_canister_id: Principal;
  icp_swap_canister_id: Principal;
  logs_canister_id: Principal;
  initial_primary_mint: bigint;
  initial_secondary_burn: bigint;
  halving_step: bigint;
  threshold_multiplier: number;
  initial_reward_per_burn_unit: bigint;
  distribution_interval_seconds: bigint;
  launch_delay_seconds: bigint;
  caller: Principal;
  created_time: bigint;
  launched_at: bigint;
+ codebase_version: string;
}
```

**File: `/src/lbry_fun_frontend/src/features/token/components/TokenCard.tsx`** (or similar display component)

```diff
// In the component that displays token information
<div className="text-xs text-gray-500">
  Created: {formatDate(token.created_time)}
+ <span className="ml-2">v{token.codebase_version}</span>
</div>
```

## Testing Considerations

1. **Backward Compatibility**: Since this is not live, we don't need to worry about existing tokens
2. **Version Format**: Using semantic versioning (MAJOR.MINOR.PATCH)
3. **Update Process**: When updating code, developers should update `CODEBASE_VERSION` constant

## Benefits

1. **Debugging**: Know exactly which version of code a token was launched with
2. **Feature Tracking**: Can identify which tokens have access to which features
3. **Migration Planning**: If needed in future, can identify which tokens need updates
4. **Audit Trail**: Clear record of code evolution

## Alternative Approaches Considered

1. **Git Commit Hash**: More precise but less human-readable
2. **Timestamp-based**: Automatic but doesn't clearly indicate changes
3. **Feature Flags**: More complex, better for feature toggling

## Migration Notes

Since the project is not live:
- No need for backward compatibility
- Can add required fields directly
- No migration scripts needed

## Implementation Summary

### Minimal Implementation (Recommended)
Just store version in the main lbry_fun canister's TokenRecord:
1. Add `CODEBASE_VERSION` constant
2. Add `codebase_version` field to TokenRecord
3. Set version when creating token
4. Update frontend to display version

### Full Implementation (Optional)
Also pass version to child canisters:
1. All of the above
2. Update IcpSwapInitArgs and/or TokenomicsCanisterInitArgs
3. Pass version when installing child canisters
4. Store version in child canisters for debugging

## Compatibility Notes

### Backend Changes
- **TokenRecord struct**: Adding new field is safe since project is not live
- **No migration needed**: Can add field directly without backward compatibility concerns
- **Child canisters**: Optional fields (`Option<String>`) ensure compatibility

### Frontend Changes
- **TypeScript types**: Must be updated to match Candid interface
- **Display components**: Can show version in token cards/details

## Todo Checklist

- [ ] Add CODEBASE_VERSION constant to constants.rs
- [ ] Add codebase_version field to TokenRecord struct
- [ ] Update token creation logic to store version
- [ ] Update frontend types to include version
- [ ] Display version in UI (optional but recommended)
- [ ] Consider adding version to child canisters (optional)
- [ ] Test full token creation flow with version tracking

## Version Update Process

When making future code changes:
1. Update `CODEBASE_VERSION` in `/src/lbry_fun/src/constants.rs`
2. Follow semantic versioning:
   - PATCH (x.x.1): Bug fixes, minor changes
   - MINOR (x.1.x): New features, backward compatible
   - MAJOR (1.x.x): Breaking changes
3. All new tokens will automatically use the new version
4. Existing tokens retain their launch version for tracking