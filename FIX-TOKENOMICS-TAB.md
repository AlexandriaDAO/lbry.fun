# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/lbryfun" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/lbryfun-fix-tokenomics-tab"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/lbryfun-fix-tokenomics-tab`
2. **Implement feature** - Follow plan sections below
3. **Build locally** (verification only - NEVER DEPLOY TO MAINNET):
   ```bash
   ./scripts/build.sh
   ```
   **⚠️ PRODUCTION WARNING**: This is a live financial application. Never deploy to mainnet.
4. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "Fix: Tokenomics tab error with undefined actor in ANALYTICS_TERMINAL"
   git push -u origin feature/fix-tokenomics-tab
   gh pr create --title "Fix: Tokenomics tab error with undefined actor" --body "Implements FIX-TOKENOMICS-TAB.md"
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

**Branch:** `feature/fix-tokenomics-tab`
**Worktree:** `/home/theseus/alexandria/lbryfun-fix-tokenomics-tab`

---

# Implementation Plan

## Task Classification
**BUG FIX**: Fix Tokenomics tab error "can't access property 'get_tokenomics_graphs', a is undefined"

## Current State Analysis

### The Problem
When clicking on the Tokenomics tab in ANALYTICS_TERMINAL, the app throws:
```
error: can't access property "get_tokenomics_graphs", a is undefined
```

### Root Cause
The error occurs because:
1. The `ActorProvider` tries to create actors for `ICP_SWAP` and `TOKENOMICS` canisters using environment variables
2. These environment variables (`CANISTER_ID_ICP_SWAP` and `CANISTER_ID_TOKENOMICS`) don't exist in `.env`
3. These canisters are NOT standalone - they're spawned dynamically per token pool
4. The `ActorProvider` uses the `!` operator assuming these IDs exist, causing undefined actors

### Current Implementation Issues

**File:** `src/lbry_fun_frontend/src/providers/ActorProvider.tsx:95-116`
```typescript
// PROBLEM: These canister IDs don't exist as environment variables
<IcUseActorProvider
  canisterId={process.env.CANISTER_ID_ICP_SWAP!}  // undefined!
  context={IcpSwapContext}
  ...
>
  <IcUseActorProvider
    canisterId={process.env.CANISTER_ID_TOKENOMICS!}  // undefined!
    context={TokenomicsContext}
    ...
  >
```

**File:** `src/lbry_fun_frontend/src/features/swap/components/TokenomicsTab.tsx:26`
```typescript
// This calls get_tokenomics_graphs on lbryFunActor (correct)
dispatch(getTokenomicsGraphs({ poolId: poolData[0].toString(), lbryFunActor }))
```

## Implementation Steps

### Step 1: Remove Static IcpSwap and Tokenomics Providers
**File:** `src/lbry_fun_frontend/src/providers/ActorProvider.tsx`

REMOVE the nested IcpSwapContext and TokenomicsContext providers (lines 95-119):
```typescript
// PSEUDOCODE - REMOVE THESE PROVIDERS
// Delete the IcpSwapContext.Provider wrapper
// Delete the TokenomicsContext.Provider wrapper
// Keep only LbryFunContext and IcpLedgerContext providers
```

The structure should become:
```typescript
// PSEUDOCODE
return (
  <IcUseActorProvider
    canisterId={process.env.CANISTER_ID_LBRY_FUN!}
    context={LbryFunContext}
    ...
  >
    <IcUseActorProvider
      canisterId={process.env.CANISTER_ID_ICP_LEDGER_CANISTER || "ryjl3-tyaaa-aaaaa-aaaba-cai"}
      context={IcpLedgerContext}
      ...
    >
      {children}
    </IcUseActorProvider>
  </IcUseActorProvider>
);
```

### Step 2: Create Dynamic Actor Factory for Pool-Specific Canisters
**File:** `src/lbry_fun_frontend/src/actors/poolActorFactory.ts` (NEW)

```typescript
// PSEUDOCODE
import { createActor } from './canisterActorFactory';

export function createIcpSwapActor(canisterId: string, options?: ActorOptions) {
  // Use the existing createActor function with ICP_SWAP IDL
  return createActor(canisterId, icpSwapIdlFactory, options);
}

export function createTokenomicsActor(canisterId: string, options?: ActorOptions) {
  // Use the existing createActor function with TOKENOMICS IDL
  return createActor(canisterId, tokenomicsIdlFactory, options);
}
```

### Step 3: Update Components Using IcpSwap and Tokenomics Hooks
Since we're removing the global providers, components that use `useIcpSwap()` and `useTokenomics()` need updating.

**Search and update all files using these hooks:**
```bash
# Find all files using these hooks
rg "useIcpSwap|useTokenomics" --files-with-matches
```

For each component that uses these hooks, replace with dynamic actor creation based on pool data.

Example pattern to follow:
```typescript
// PSEUDOCODE - Components should get canister IDs from pool data
// and create actors dynamically when needed
const poolData = useAppSelector(state => state.swap.activeSwapPool);
const icpSwapCanisterId = poolData?.[1]?.icp_swap_canister_id;

// Create actor only when canister ID is available
const icpSwapActor = useMemo(() => {
  if (!icpSwapCanisterId) return null;
  return createIcpSwapActor(icpSwapCanisterId, { /* options */ });
}, [icpSwapCanisterId]);
```

### Step 4: Verify TokenomicsTab Still Works
The `TokenomicsTab` component should continue working because it already:
1. Uses the `lbryFunActor` (which remains available)
2. Calls `get_tokenomics_graphs` on the lbry_fun canister (correct approach)
3. Doesn't directly use the tokenomics actor

No changes needed to `TokenomicsTab.tsx`.

### Step 5: Update Hook Exports
**File:** `src/lbry_fun_frontend/src/hooks/actors/index.tsx`

```typescript
// PSEUDOCODE
// Keep these exports
export { default as useLbryFun } from './useLbryFun';
export { default as useIcpLedger } from './useIcpLedger';
export { useActorErrorHandler } from './useActorErrorHandler';

// Remove or deprecate these (no longer global contexts)
// export { default as useIcpSwap } from './useIcpSwap';
// export { default as useTokenomics } from './useTokenomics';
```

### Step 6: Clean Up Unused Context Files
Remove context files that are no longer needed:
- `src/lbry_fun_frontend/src/contexts/actors/IcpSwapContext.tsx`
- `src/lbry_fun_frontend/src/contexts/actors/TokenomicsContext.tsx`
- `src/lbry_fun_frontend/src/hooks/actors/useIcpSwap.tsx`
- `src/lbry_fun_frontend/src/hooks/actors/useTokenomics.tsx`

Update `src/lbry_fun_frontend/src/contexts/actors/index.tsx` to remove exports.

## Testing Requirements

**Local Build Verification Only**:
```markdown
## Testing
- Build locally to verify compilation: ./scripts/build.sh
- **NEVER deploy to mainnet** - this is a production app with financial consequences
- Test manually in local environment:
  1. Launch a test token
  2. Click on ANALYTICS_TERMINAL
  3. Click on "TOKENOMICS" tab
  4. Verify no errors and graphs load correctly
```

## Expected Outcome
After this fix:
1. The Tokenomics tab will load without errors
2. The app will no longer try to create actors for non-existent canister IDs
3. Components needing pool-specific actors will create them dynamically
4. The architecture will correctly reflect that icp_swap and tokenomics are per-pool canisters

## Files to Modify
1. `src/lbry_fun_frontend/src/providers/ActorProvider.tsx` - Remove static providers
2. `src/lbry_fun_frontend/src/actors/poolActorFactory.ts` - NEW file for dynamic actors
3. Various components using `useIcpSwap()` or `useTokenomics()` - Update to dynamic actors
4. `src/lbry_fun_frontend/src/hooks/actors/index.tsx` - Remove deprecated exports
5. Remove unused context and hook files

## Risk Assessment
- **Low Risk**: Changes are localized to frontend actor management
- **No Backend Changes**: All canister code remains unchanged
- **Backward Compatible**: Existing functionality preserved, just reorganized