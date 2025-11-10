# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/lbryfun" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/lbryfun-launch-delay-hardcode"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/lbryfun-launch-delay-hardcode`
2. **Implement feature** - Follow plan sections below
3. **Build locally** (verification only - NEVER DEPLOY TO MAINNET):
   ```bash
   ./scripts/build.sh
   ```
   **⚠️ PRODUCTION WARNING**: This is a live financial application. Never deploy to mainnet.
4. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "Hardcode launch delay to 24 hours, remove user configuration"
   git push -u origin feature/launch-delay-hardcode
   gh pr create --title "Hardcode launch delay to 24 hours" --body "Implements HARDCODE_LAUNCH_DELAY.md"
   ```
5. **Iterate autonomously**:
   - FOR i=1 to 5:
     - Check review: `gh pr view [NUM] --json comments`
     - Count P0 issues
     - IF P0 > 0: Fix immediately, commit, push, sleep 300s, continue
     - IF P0 = 0: Report success, EXIT
   - After 5 iterations: Escalate to human

## CRITICAL RULES
- ❌ NO questions ("should I?", "want me to?", "is it done?")
- ❌ NO skipping PR creation - it's MANDATORY
- ❌ NO stopping after implementation - create PR immediately
- ✅ After sleep: IMMEDIATELY continue (no pause)
- ✅ ONLY stop at: approved, max iterations, or error

**Branch:** `feature/launch-delay-hardcode`
**Worktree:** `/home/theseus/alexandria/lbryfun-launch-delay-hardcode`

---

# Implementation Plan: Hardcode Launch Delay to 24 Hours

## Task Classification
**BUG FIX / SIMPLIFICATION**: Remove unnecessary configurability, enforce 24-hour minimum launch delay

## Current State

### Backend Files with launch_delay_seconds

1. **Type Definitions**:
   - `src/lbry_fun/src/deployment.rs:42` - `CreateTokenParams` struct field
   - `src/lbry_fun/lbry_fun.did:7` - Candid interface field
   - `src/lbry_fun/src/storage.rs:56` - `TokenRecord` struct field

2. **Validation**:
   - `src/lbry_fun/src/deployment_updates.rs:409-416` - MIN/MAX validation (currently 1 second to 30 days)

3. **Usage**:
   - `src/lbry_fun/src/update.rs:47,66` - Parameter in create_token function
   - `src/lbry_fun/src/update.rs:220,224-225` - Calculates launch_time from delay
   - `src/lbry_fun/src/deployment_execution.rs:175,240,243` - Used in deployment

4. **Tests**:
   - `tests/unit/test_deployment_validation.rs` - Validation tests for launch_delay

### Frontend Files with launch_delay_seconds

1. **Type Definitions**:
   - `src/lbry_fun_frontend/src/types/deployment.ts:20` - Interface field

2. **Form Component**:
   - `src/lbry_fun_frontend/src/features/token/components/terminal/TerminalCreateToken.tsx:44` - Form state field
   - `src/lbry_fun_frontend/src/features/token/components/terminal/TerminalCreateToken.tsx:94` - Default value '86400'
   - `src/lbry_fun_frontend/src/features/token/components/terminal/TerminalCreateToken.tsx:182-188` - Validation logic
   - `src/lbry_fun_frontend/src/features/token/components/terminal/TerminalCreateToken.tsx:343-360` - Options dropdown
   - `src/lbry_fun_frontend/src/features/token/components/terminal/TerminalCreateToken.tsx:694-705` - UI rendering

3. **Display Components**:
   - `src/lbry_fun_frontend/src/features/swap/components/TokenomicsTab.tsx:233-236` - Displays launch delay info

4. **Thunks** (Pass-through only, no changes needed):
   - `src/lbry_fun_frontend/src/features/token/thunk/deploymentThunks.ts`
   - `src/lbry_fun_frontend/src/features/token/thunk/createToken.thunk.ts`
   - `src/lbry_fun_frontend/src/features/token/thunk/getLiveTokens.thunk.ts`
   - `src/lbry_fun_frontend/src/features/token/thunk/getTokenPools.thunk.ts`
   - `src/lbry_fun_frontend/src/features/token/thunk/getUpcommingTokens.thunk.ts`

### Current Behavior
- User can select launch delay from 1 second to 30 days via dropdown
- Default is 24 hours (86400 seconds)
- Both frontend and backend validate the range

### Target Behavior
- Launch delay is ALWAYS 24 hours (86400 seconds)
- No user configuration possible
- Remove from UI form (no dropdown, no input)
- Backend hardcodes the value
- Still stored in TokenRecord for display purposes

---

## Implementation

### 1. Backend Changes

#### File: `src/lbry_fun/src/deployment.rs`

**MODIFY** CreateTokenParams struct:
```rust
// PSEUDOCODE
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct CreateTokenParams {
    pub primary_token_name: String,
    pub primary_token_symbol: String,
    pub primary_token_description: String,
    pub primary_logo: String,
    pub secondary_token_name: String,
    pub secondary_token_symbol: String,
    pub secondary_token_description: String,
    pub secondary_logo: String,
    pub primary_max_supply: u64,
    pub initial_primary_mint: u64,
    pub initial_secondary_burn: u64,
    pub halving_step: u64,
    pub threshold_multiplier: f64,
    pub initial_reward_per_burn_unit: u64,
    pub distribution_interval_seconds: u64,
    // REMOVE: pub launch_delay_seconds: u64,
}

// ADD CONSTANT at module level
pub const LAUNCH_DELAY_SECONDS: u64 = 86400; // 24 hours hardcoded
```

#### File: `src/lbry_fun/lbry_fun.did`

**MODIFY** CreateTokenParams type:
```candid
// PSEUDOCODE
type CreateTokenParams = record {
  secondary_token_symbol : text;
  primary_token_name : text;
  secondary_token_description : text;
  secondary_token_name : text;
  primary_token_symbol : text;
  // REMOVE: launch_delay_seconds : nat64;
  primary_logo : text;
  halving_step : nat64;
  primary_token_description : text;
  initial_reward_per_burn_unit : nat64;
  initial_primary_mint : nat64;
  threshold_multiplier : float64;
  secondary_logo : text;
  distribution_interval_seconds : nat64;
  primary_max_supply : nat64;
  initial_secondary_burn : nat64;
};

// NOTE: TokenRecord KEEPS launch_delay_seconds for display
// No changes needed to TokenRecord in .did file
```

**MODIFY** create_token function signature:
```candid
// PSEUDOCODE
service : () -> {
  create_token : (
      text,  // primary_token_name
      text,  // primary_token_symbol
      text,  // primary_token_description
      text,  // primary_logo
      text,  // secondary_token_name
      text,  // secondary_token_symbol
      text,  // secondary_token_description
      text,  // secondary_logo
      nat64, // primary_max_supply
      nat64, // initial_primary_mint
      nat64, // initial_secondary_burn
      nat64, // halving_step
      float64, // threshold_multiplier
      nat64, // initial_reward_per_burn_unit
      nat64, // distribution_interval_seconds
      // REMOVE: nat64 (launch_delay_seconds)
    ) -> (Result);

  // ... rest of service definition unchanged
}
```

#### File: `src/lbry_fun/src/update.rs`

**MODIFY** create_token function:
```rust
// PSEUDOCODE
#[ic_cdk::update]
async fn create_token(
    primary_token_name: String,
    primary_token_symbol: String,
    primary_token_description: String,
    primary_logo: String,
    secondary_token_name: String,
    secondary_token_symbol: String,
    secondary_token_description: String,
    secondary_logo: String,
    primary_max_supply: u64,
    initial_primary_mint: u64,
    initial_secondary_burn: u64,
    halving_step: u64,
    threshold_multiplier: f64,
    initial_reward_per_burn_unit: u64,
    distribution_interval_seconds: u64,
    // REMOVE: launch_delay_seconds: u64,
) -> Result<String, String> {
    // Use hardcoded constant instead
    let params = CreateTokenParams {
        primary_token_name,
        primary_token_symbol,
        primary_token_description,
        primary_logo,
        secondary_token_name,
        secondary_token_symbol,
        secondary_token_description,
        secondary_logo,
        primary_max_supply,
        initial_primary_mint,
        initial_secondary_burn,
        halving_step,
        threshold_multiplier,
        initial_reward_per_burn_unit,
        distribution_interval_seconds,
        // REMOVE: launch_delay_seconds,
    };

    // Phase 1: Initiate deployment
    let deployment_id = initiate_token_deployment(params).await?;

    // Phase 2: Execute deployment
    let result = execute_token_deployment(deployment_id).await?;

    Ok(format!("Token created successfully (ID: {})", result.token_id))
}
```

**MODIFY** install_icp_swap_wasm_on_existing_canister function:
```rust
// PSEUDOCODE
pub async fn install_icp_swap_wasm_on_existing_canister(
    canister_id: Principal,
    primary_token_id: Option<Principal>,
    secondary_token_id: Option<Principal>,
    tokenomics_canister_id: Option<Principal>,
    distribution_interval_seconds: u64,
    // REMOVE: launch_delay_seconds: u64,
    token_id: Option<u64>,
) -> Result<(), String> {
    // Use hardcoded constant
    use crate::deployment::LAUNCH_DELAY_SECONDS;

    let launch_time = if LAUNCH_DELAY_SECONDS > 0 {
        Some(ic_cdk::api::time() / 1_000_000_000 + LAUNCH_DELAY_SECONDS)
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
    };

    // ... rest of function unchanged
}
```

#### File: `src/lbry_fun/src/deployment_updates.rs`

**MODIFY** validate_deployment_params function:
```rust
// PSEUDOCODE
async fn validate_deployment_params(params: &CreateTokenParams) -> Result<(), String> {
    // ... existing validation ...

    // REMOVE: All launch_delay_seconds validation (lines 408-417)
    // const MIN_LAUNCH_DELAY: u64 = 1;
    // const MAX_LAUNCH_DELAY: u64 = 2_592_000;
    // if params.launch_delay_seconds < MIN_LAUNCH_DELAY { ... }
    // if params.launch_delay_seconds > MAX_LAUNCH_DELAY { ... }

    // No validation needed - it's hardcoded!

    // ... rest of validation unchanged ...
    Ok(())
}
```

#### File: `src/lbry_fun/src/deployment_execution.rs`

**MODIFY** execute_deployment_safe function:
```rust
// PSEUDOCODE
pub async fn execute_deployment_safe(deployment_id: u64) -> Result<u64, String> {
    use crate::deployment::LAUNCH_DELAY_SECONDS;

    // ... existing code ...

    ic_cdk::println!("[DEPLOYMENT] Installing swap wasm...");
    install_icp_swap_wasm_on_existing_canister(
        swap_canister_id,
        Some(get_principal(&primary_token_id)),
        Some(get_principal(&secondary_token_id)),
        Some(tokenomics_canister_id),
        params.distribution_interval_seconds,
        // REMOVE: params.launch_delay_seconds,
        Some(token_id),
    )
    .await?;

    // ... more code ...

    let mut token_record = TokenRecord {
        id: 0,
        status: crate::storage::TokenStatus::Deploying { progress: 80 },
        // ... other fields ...
        distribution_interval_seconds: params.distribution_interval_seconds,
        launch_delay_seconds: LAUNCH_DELAY_SECONDS, // Use constant
        caller,
        created_time: ic_cdk::api::time(),
        launched_at: ic_cdk::api::time() + LAUNCH_DELAY_SECONDS * 1_000_000_000, // Use constant
        codebase_version: crate::CODEBASE_VERSION.to_string(),
    };

    // ... rest of function unchanged ...
}
```

#### File: `tests/unit/test_deployment_validation.rs`

**MODIFY** test cases:
```rust
// PSEUDOCODE
#[test]
fn test_validate_launch_delay() {
    // REMOVE entire test function
    // Launch delay is now hardcoded, no validation needed
}

// UPDATE other test functions to remove launch_delay_seconds parameter
#[test]
fn test_valid_params() {
    let params = CreateTokenParams {
        // ... other fields ...
        distribution_interval_seconds: 3600,
        // REMOVE: launch_delay_seconds: 86400,
    };

    // ... rest of test unchanged ...
}

// Repeat for all test functions that construct CreateTokenParams
```

---

### 2. Frontend Changes

#### File: `src/lbry_fun_frontend/src/types/deployment.ts`

**MODIFY** CreateTokenParams interface:
```typescript
// PSEUDOCODE
export interface CreateTokenParams {
  primary_token_name: string;
  primary_token_symbol: string;
  primary_token_description: string;
  primary_logo: string;
  secondary_token_name: string;
  secondary_token_symbol: string;
  secondary_token_description: string;
  secondary_logo: string;
  primary_max_supply: bigint;
  initial_primary_mint: bigint;
  initial_secondary_burn: bigint;
  halving_step: bigint;
  threshold_multiplier: number;
  initial_reward_per_burn_unit: bigint;
  distribution_interval_seconds: bigint;
  // REMOVE: launch_delay_seconds: bigint;
}

// ADD CONSTANT at module level
export const LAUNCH_DELAY_SECONDS = 86400n; // 24 hours hardcoded
```

#### File: `src/lbry_fun_frontend/src/features/token/components/terminal/TerminalCreateToken.tsx`

**MODIFY** TokenFormValues interface:
```typescript
// PSEUDOCODE
interface TokenFormValues {
  primary_token_symbol: string;
  primary_token_name: string;
  primary_token_description: string;
  secondary_token_symbol: string;
  secondary_token_name: string;
  secondary_token_description: string;
  secondary_token_logo_base64: string;
  primary_max_supply: string;
  tge_allocation: string;
  initial_secondary_burn: string;
  primary_token_logo_base64: string;
  halving_step: string;
  threshold_multiplier: string;
  initial_reward_per_burn_unit: string;
  distribution_interval_seconds: string;
  // REMOVE: launch_delay_seconds: string;
}
```

**MODIFY** form state initialization:
```typescript
// PSEUDOCODE
const [form, setForm] = useState<TokenFormValues>({
  primary_token_symbol: '',
  primary_token_name: '',
  primary_token_description: '',
  secondary_token_symbol: '',
  secondary_token_name: '',
  secondary_token_description: '',
  secondary_token_logo_base64: '',
  primary_max_supply: '1000000000',
  tge_allocation: '0',
  initial_secondary_burn: '1000000',
  primary_token_logo_base64: '',
  halving_step: '90',
  threshold_multiplier: '1.5',
  initial_reward_per_burn_unit: '1',
  distribution_interval_seconds: '3600',
  // REMOVE: launch_delay_seconds: '86400',
});
```

**REMOVE** launchDelayOptions array:
```typescript
// PSEUDOCODE
// DELETE lines 343-360
// const launchDelayOptions = [ ... ];
```

**REMOVE** launch_delay validation:
```typescript
// PSEUDOCODE
// In useEffect validation, DELETE lines 181-189:
// // Validate launch delay
// const launchDelay = parseInt(form.launch_delay_seconds);
// if (!form.launch_delay_seconds || isNaN(launchDelay)) {
//   newErrors.launch_delay_seconds = 'Launch delay is required';
// } else if (launchDelay < 1) {
//   newErrors.launch_delay_seconds = 'Launch delay must be at least 1 second';
// } else if (launchDelay > 2592000) {
//   newErrors.launch_delay_seconds = 'Launch delay cannot exceed 30 days';
// }
```

**REMOVE** launch_delay UI section:
```typescript
// PSEUDOCODE
// In JSX advanced_settings section, DELETE lines 693-705:
// <div className="flex items-center mb-1 mt-4">
//   <span className="text-gray-400 text-xs">launch_delay</span>
//   <TooltipIcon text="..." />
// </div>
// <TerminalSelect
//   label=""
//   value={form.launch_delay_seconds}
//   onChange={(v) => updateForm('launch_delay_seconds', v)}
//   options={launchDelayOptions}
// />
// <div className="text-gray-600 text-xs mt-1 font-mono mt-1">...</div>
```

**ADD** informational text in advanced section:
```typescript
// PSEUDOCODE
// After distribution_interval section, ADD:
<div className="text-gray-400 text-xs mt-4 font-mono">
  <div className="flex items-center mb-1">
    <span>launch_delay</span>
    <TooltipIcon text="Time delay before trading opens after token creation. Fixed at 24 hours to prevent bot sniping." />
  </div>
  <div className="text-white">24_hours [fixed]</div>
  <div className="text-gray-600 text-xs mt-1">Trading will be enabled 24 hours after creation.</div>
</div>
```

**MODIFY** handleInitiateDeployment function:
```typescript
// PSEUDOCODE
const handleInitiateDeployment = async () => {
  // ... existing validation ...

  const params: CreateTokenParams = {
    primary_token_name: form.primary_token_name,
    primary_token_symbol: form.primary_token_symbol,
    primary_token_description: form.primary_token_description,
    primary_logo: form.primary_token_logo_base64,
    secondary_token_name: form.secondary_token_name,
    secondary_token_symbol: form.secondary_token_symbol,
    secondary_token_description: form.secondary_token_description,
    secondary_logo: form.secondary_token_logo_base64,
    primary_max_supply: BigInt(form.primary_max_supply),
    initial_primary_mint: BigInt(form.tge_allocation),
    initial_secondary_burn: BigInt(form.initial_secondary_burn),
    halving_step: BigInt(form.halving_step),
    threshold_multiplier: parseFloat(form.threshold_multiplier),
    initial_reward_per_burn_unit: TokenConversionService.naturalToE8s(form.initial_reward_per_burn_unit),
    distribution_interval_seconds: BigInt(form.distribution_interval_seconds),
    // REMOVE: launch_delay_seconds: BigInt(form.launch_delay_seconds)
  };

  // ... rest of function unchanged ...
};
```

#### File: `src/lbry_fun_frontend/src/features/token/thunk/createToken.thunk.ts`

**MODIFY** createToken thunk:
```typescript
// PSEUDOCODE
import { LAUNCH_DELAY_SECONDS } from '../../../types/deployment';

export const createToken = createAsyncThunk(
  'token/createToken',
  async (formData: any, { dispatch }) => {
    // ... existing code ...

    const result = await lbryFunActor.create_token(
      formData.primary_token_name,
      formData.primary_token_symbol,
      formData.primary_token_description,
      formData.primary_logo,
      formData.secondary_token_name,
      formData.secondary_token_symbol,
      formData.secondary_token_description,
      formData.secondary_logo,
      BigInt(formData.primary_max_supply),
      BigInt(formData.initial_primary_mint),
      BigInt(formData.initial_secondary_burn),
      BigInt(formData.halving_step),
      formData.threshold_multiplier,
      BigInt(formData.initial_reward_per_burn_unit),
      BigInt(formData.distribution_interval_seconds),
      // REMOVE: BigInt(formData.launch_delay_seconds)
    );

    // ... rest of thunk unchanged ...
  }
);
```

#### File: `src/lbry_fun_frontend/src/features/token/thunk/deploymentThunks.ts`

**MODIFY** initiateDeployment thunk:
```typescript
// PSEUDOCODE
import { LAUNCH_DELAY_SECONDS } from '../../../types/deployment';

export const initiateDeployment = createAsyncThunk(
  'deployment/initiate',
  async (params: CreateTokenParams, { rejectWithValue }) => {
    // ... existing code ...

    const candidParams = {
      primary_token_name: params.primary_token_name,
      // ... other fields ...
      distribution_interval_seconds: params.distribution_interval_seconds,
      // REMOVE: launch_delay_seconds: params.launch_delay_seconds
    };

    // ... rest of thunk unchanged ...
  }
);

// UPDATE executeDeployment if it reconstructs params
// Generally no changes needed as it just passes deployment_id
```

#### File: `src/lbry_fun_frontend/src/features/swap/components/TokenomicsTab.tsx`

**MODIFY** display to show hardcoded value with note:
```typescript
// PSEUDOCODE
// Around line 233-236, MODIFY:
<div className="flex justify-between items-center">
    <span className="text-gray-400 flex items-center gap-1">
        launch_delay:
        <TooltipIcon text="Time after creation before minting/burning becomes active. Fixed at 24 hours to prevent bot sniping." />
    </span>
    <span className="text-white">
        {formatTimeInterval(tokenConfig.launch_delay_seconds)} [fixed]
    </span>
</div>
```

---

## Testing Requirements

### Local Build Verification
```bash
cd /home/theseus/alexandria/lbryfun-launch-delay-hardcode
./scripts/build.sh
```

**Expected Results:**
- ✅ All canisters compile successfully
- ✅ Frontend builds without TypeScript errors
- ✅ No warnings about missing launch_delay_seconds parameters

### Manual Verification (Optional)
If testing locally:
1. Create a token through the UI
2. Verify form no longer shows launch_delay dropdown
3. Verify "24_hours [fixed]" is displayed in advanced section
4. Verify token is created with 24-hour launch delay
5. Verify TokenomicsTab displays launch delay correctly

**⚠️ CRITICAL**: Never deploy to mainnet - this is a production app with financial consequences.

---

## Files Modified Summary

### Backend (8 files)
1. ✏️ `src/lbry_fun/src/deployment.rs` - Remove field, add constant
2. ✏️ `src/lbry_fun/lbry_fun.did` - Update CreateTokenParams, create_token signature
3. ✏️ `src/lbry_fun/src/update.rs` - Remove parameter, use constant
4. ✏️ `src/lbry_fun/src/deployment_updates.rs` - Remove validation
5. ✏️ `src/lbry_fun/src/deployment_execution.rs` - Use constant instead of param
6. ✏️ `tests/unit/test_deployment_validation.rs` - Update tests

### Frontend (5 files)
1. ✏️ `src/lbry_fun_frontend/src/types/deployment.ts` - Remove field, add constant
2. ✏️ `src/lbry_fun_frontend/src/features/token/components/terminal/TerminalCreateToken.tsx` - Remove UI, validation, options
3. ✏️ `src/lbry_fun_frontend/src/features/token/thunk/createToken.thunk.ts` - Remove parameter
4. ✏️ `src/lbry_fun_frontend/src/features/token/thunk/deploymentThunks.ts` - Remove parameter
5. ✏️ `src/lbry_fun_frontend/src/features/swap/components/TokenomicsTab.tsx` - Update display

### No Changes Needed
- `src/lbry_fun/src/storage.rs` - TokenRecord keeps launch_delay_seconds for display
- Other thunk files - Only pass through data, no reconstruction needed

---

## Review Checklist

- [ ] Backend constant LAUNCH_DELAY_SECONDS = 86400 defined
- [ ] CreateTokenParams struct no longer has launch_delay_seconds field
- [ ] Candid interface updated (both type and function signature)
- [ ] create_token function signature updated (removed parameter)
- [ ] Validation code removed from deployment_updates.rs
- [ ] install_icp_swap_wasm_on_existing_canister uses constant
- [ ] execute_deployment_safe uses constant for TokenRecord
- [ ] Tests updated to remove launch_delay_seconds
- [ ] Frontend CreateTokenParams interface updated
- [ ] Form state no longer includes launch_delay_seconds
- [ ] launchDelayOptions array removed
- [ ] Validation logic for launch_delay removed
- [ ] UI dropdown section removed
- [ ] Informational text added showing "24_hours [fixed]"
- [ ] createToken thunk updated (parameter removed)
- [ ] initiateDeployment thunk updated (parameter removed)
- [ ] TokenomicsTab updated to show "[fixed]" label
- [ ] Build passes successfully
- [ ] No TypeScript errors
- [ ] PR created and pushed

---

## Success Criteria

✅ Launch delay is hardcoded to 24 hours throughout the system
✅ User cannot configure launch delay in UI
✅ UI clearly shows "24_hours [fixed]" in advanced section
✅ Backend enforces 24-hour delay without user input
✅ All existing tokens with different delays still display correctly
✅ Build completes successfully
✅ PR created automatically
