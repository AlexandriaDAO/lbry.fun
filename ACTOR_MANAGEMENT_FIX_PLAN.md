# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/lbryfun" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/lbryfun-actor-management-fix"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/lbryfun-actor-management-fix`
2. **Implement feature** - Follow plan sections below
3. **Build locally** (verification only - NEVER DEPLOY TO MAINNET):
   ```bash
   npm run build
   ```
   **⚠️ PRODUCTION WARNING**: This is a live financial application. Never deploy to mainnet.
4. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "Fix actor management to match alex_frontend pattern"
   git push -u origin feature/fix-actor-management
   gh pr create --title "Fix: Proper actor management with delegation validation" --body "Implements ACTOR_MANAGEMENT_FIX_PLAN.md

## Problem
- Authentication going stale
- Frontend not recognizing logged-in users
- Actor calls failing with undefined errors
- Missing delegation validation

## Solution
- Migrate to alex_frontend actor pattern
- Use createActorHook for all actors
- Centralized interceptors with delegation validation
- Proper identity refresh on expiry"
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

**Branch:** `feature/fix-actor-management`
**Worktree:** `/home/theseus/alexandria/lbryfun-actor-management-fix`

---

# Implementation Plan: Fix Actor Management

## Problem Statement

The current lbryfun frontend has broken actor management:
1. **Authentication going stale** - No delegation validation
2. **Frontend doesn't recognize logged-in users** - Identity not properly propagated
3. **Actor calls failing** - `icrc1_balance_of` and other calls return undefined
4. **Token pools not loading** - Cascading failure from actor issues
5. **Improper implementation** - Attempted migration to alex_frontend pattern was incomplete

## Root Cause Analysis

### Current (Broken) Implementation
The lbryfun codebase uses:
- Individual `ActorProvider` components wrapping each other (nested providers)
- Each actor in its own React context
- Manual identity/agent management per actor
- No delegation validation
- No centralized interceptor management
- Identity changes don't properly re-authenticate actors

Files affected:
- `src/lbry_fun_frontend/src/actors/LbryFunActor.tsx`
- `src/lbry_fun_frontend/src/actors/IcpLedgerActor.tsx`
- `src/lbry_fun_frontend/src/actors/IcpSwapActor.tsx`
- `src/lbry_fun_frontend/src/actors/TokenomicsActor.tsx`
- `src/lbry_fun_frontend/src/actors/ICRCActor.tsx`
- `src/lbry_fun_frontend/src/providers/ActorProvider.tsx`

### Reference (Working) Implementation
The alex_frontend uses:
- `createActorHook()` for each actor (standalone hooks)
- Single `ActorProvider` component that sets interceptors
- Centralized delegation validation in `onRequest` interceptor
- `ensureAllInitialized()` and `authenticateAll()` for proper initialization
- Identity changes trigger re-authentication of all actors

Files to reference:
- `core/src/alex_frontend/src/providers/ActorProvider.tsx`
- `core/src/alex_frontend/src/hooks/actors/useIcpLedger.tsx`
- `core/src/alex_frontend/src/hooks/actors/useAlex.tsx`

## Current State Documentation

### File Structure (Before)
```
src/lbry_fun_frontend/src/
├── actors/
│   ├── LbryFunActor.tsx          (ActorProvider wrapper - DELETE)
│   ├── IcpLedgerActor.tsx        (ActorProvider wrapper - DELETE)
│   ├── IcpSwapActor.tsx          (ActorProvider wrapper - DELETE)
│   ├── TokenomicsActor.tsx       (ActorProvider wrapper - DELETE)
│   ├── ICRCActor.tsx             (Custom provider - DELETE)
│   ├── createLogsActor.ts        (Manual actor creation - KEEP)
│   ├── canisterActorFactory.ts   (Manual actor creation - KEEP)
│   └── index.tsx                 (Exports - MODIFY)
├── contexts/
│   └── actors/
│       ├── LbryFunContext.tsx    (DELETE)
│       ├── IcpLedgerContext.tsx  (DELETE)
│       ├── IcpSwapContext.tsx    (DELETE)
│       └── TokenomicsContext.tsx (DELETE)
├── hooks/
│   └── actors/
│       ├── useActorErrorHandler.tsx (KEEP - modify)
│       ├── useActors.tsx         (MODIFY - use createUseActorHook)
│       └── index.tsx             (MODIFY)
└── providers/
    └── ActorProvider.tsx         (REPLACE with alex_frontend pattern)
```

### File Structure (After)
```
src/lbry_fun_frontend/src/
├── actors/
│   ├── createLogsActor.ts        (Manual actor creation - unchanged)
│   ├── canisterActorFactory.ts   (Manual actor creation - unchanged)
│   └── index.tsx                 (Exports manual creators only)
├── contexts/                      (DELETE entire directory)
├── hooks/
│   └── actors/
│       ├── useLbryFun.tsx        (NEW - createActorHook)
│       ├── useIcpLedger.tsx      (NEW - createActorHook)
│       ├── useIcpSwap.tsx        (NEW - createActorHook)
│       ├── useTokenomics.tsx     (NEW - createActorHook)
│       └── index.tsx             (Export all actor hooks)
└── providers/
    └── ActorProvider.tsx         (REPLACE - centralized interceptors)
```

## Implementation Plan

### Step 1: Delete Old Actor Components and Contexts

Delete these files (nested provider pattern):
```bash
# Delete old ActorProvider wrappers
rm src/lbry_fun_frontend/src/actors/LbryFunActor.tsx
rm src/lbry_fun_frontend/src/actors/IcpLedgerActor.tsx
rm src/lbry_fun_frontend/src/actors/IcpSwapActor.tsx
rm src/lbry_fun_frontend/src/actors/TokenomicsActor.tsx
rm src/lbry_fun_frontend/src/actors/ICRCActor.tsx

# Delete context files (no longer needed)
rm -rf src/lbry_fun_frontend/src/contexts/actors/
```

### Step 2: Create Actor Hooks (alex_frontend Pattern)

Create `src/lbry_fun_frontend/src/hooks/actors/useLbryFun.tsx`:
```typescript
// PSEUDOCODE
import { createActorHook } from "ic-use-actor";
import { _SERVICE } from "../../../../declarations/lbry_fun/lbry_fun.did";
import { canisterId, idlFactory } from "../../../../declarations/lbry_fun";
import { getIcHost } from "@/utils/getIcHost";

const useLbryFun = createActorHook<_SERVICE>({
  canisterId: canisterId,
  idlFactory: idlFactory,
  httpAgentOptions: { host: getIcHost() },
});

export default useLbryFun;
```

Create `src/lbry_fun_frontend/src/hooks/actors/useIcpLedger.tsx`:
```typescript
// PSEUDOCODE
import { createActorHook } from "ic-use-actor";
import { _SERVICE } from "../../../../declarations/icp_ledger_canister/icp_ledger_canister.did";
import { canisterId, idlFactory } from "../../../../declarations/icp_ledger_canister";
import { getIcHost } from "@/utils/getIcHost";

const useIcpLedger = createActorHook<_SERVICE>({
  canisterId: canisterId || "ryjl3-tyaaa-aaaaa-aaaba-cai",
  idlFactory: idlFactory,
  httpAgentOptions: { host: getIcHost() },
});

export default useIcpLedger;
```

Create `src/lbry_fun_frontend/src/hooks/actors/useIcpSwap.tsx`:
```typescript
// PSEUDOCODE
import { createActorHook } from "ic-use-actor";
import { _SERVICE } from "../../../../declarations/icp_swap/icp_swap.did";
import { canisterId, idlFactory } from "../../../../declarations/icp_swap";
import { getIcHost } from "@/utils/getIcHost";

const useIcpSwap = createActorHook<_SERVICE>({
  canisterId: canisterId,
  idlFactory: idlFactory,
  httpAgentOptions: { host: getIcHost() },
});

export default useIcpSwap;
```

Create `src/lbry_fun_frontend/src/hooks/actors/useTokenomics.tsx`:
```typescript
// PSEUDOCODE
import { createActorHook } from "ic-use-actor";
import { _SERVICE } from "../../../../declarations/tokenomics/tokenomics.did";
import { canisterId, idlFactory } from "../../../../declarations/tokenomics";
import { getIcHost } from "@/utils/getIcHost";

const useTokenomics = createActorHook<_SERVICE>({
  canisterId: canisterId,
  idlFactory: idlFactory,
  httpAgentOptions: { host: getIcHost() },
});

export default useTokenomics;
```

### Step 3: Update Actor Hooks Index

Update `src/lbry_fun_frontend/src/hooks/actors/index.tsx`:
```typescript
// PSEUDOCODE
// Export new actor hooks
export { default as useLbryFun } from './useLbryFun';
export { default as useIcpLedger } from './useIcpLedger';
export { default as useIcpSwap } from './useIcpSwap';
export { default as useTokenomics } from './useTokenomics';

// Keep utility hooks
export { useActorErrorHandler } from './useActorErrorHandler';
```

### Step 4: Replace ActorProvider with Centralized Pattern

Replace `src/lbry_fun_frontend/src/providers/ActorProvider.tsx`:
```typescript
// PSEUDOCODE
import React, { useCallback, useEffect, useMemo } from "react";
import { type DelegationIdentity, isDelegationValid } from "@dfinity/identity";
import {
  authenticateAll,
  ensureAllInitialized,
  type InterceptorErrorData,
  type InterceptorRequestData,
  type InterceptorResponseData,
} from "ic-use-actor";

import { getIdentity, useIdentity } from "@/hooks/useIdentity";
import { toast } from "sonner";
import {
  useLbryFun,
  useIcpLedger,
  useIcpSwap,
  useTokenomics,
} from "@/hooks/actors";

export default function ActorProvider() {
  const { identity, clear } = useIdentity();

  // Initialize actor hooks
  const lbryFun = useLbryFun();
  const icpLedger = useIcpLedger();
  const icpSwap = useIcpSwap();
  const tokenomics = useTokenomics();

  // Delegation validation interceptor
  const onRequest = useCallback(
    (data: InterceptorRequestData) => {
      const id = getIdentity();
      console.log("[ActorProvider] onRequest", data.methodName, data.args);
      
      if (
        id &&
        !isDelegationValid(
          (id as DelegationIdentity).getDelegation()
        )
      ) {
        toast.error("Login expired. Please sign in again.", {
          id: "login-expired",
          position: "bottom-right",
        });
        setTimeout(() => {
          clear(); // Clear identity
          window.location.reload(); // Reset UI
        }, 1000);
      }
      return data.args;
    },
    [clear]
  );

  const onRequestError = useCallback((data: InterceptorErrorData) => {
    console.error("[ActorProvider] onRequestError", data.methodName, data.error);
    return data.error;
  }, []);

  const onResponse = useCallback((data: InterceptorResponseData) => {
    console.log("[ActorProvider] onResponse", data.methodName);
    return data.response;
  }, []);

  const onResponseError = useCallback((data: InterceptorErrorData) => {
    console.error("[ActorProvider] onResponseError", data.methodName, data.error);
    return data.error;
  }, []);

  const interceptors = useMemo(
    () => ({
      onRequest,
      onResponse,
      onRequestError,
      onResponseError,
    }),
    [onRequest, onResponse, onRequestError, onResponseError]
  );

  // Re-authenticate all actors when identity changes
  useEffect(() => {
    if (!identity) return;
    
    console.log("[ActorProvider] Identity changed, authenticating all actors");
    ensureAllInitialized().then(() => {
      authenticateAll(identity);
    });
  }, [identity]);

  // Set interceptors on all actors
  useEffect(() => {
    console.log("[ActorProvider] Setting interceptors on all actors");
    ensureAllInitialized().then(() => {
      lbryFun.setInterceptors(interceptors);
      icpLedger.setInterceptors(interceptors);
      icpSwap.setInterceptors(interceptors);
      tokenomics.setInterceptors(interceptors);
    });
  }, [interceptors]);

  return null; // No UI, just side effects
}
```

### Step 5: Update App.tsx to Remove Nested Providers

Update `src/lbry_fun_frontend/src/App.tsx`:
```typescript
// PSEUDOCODE
import React, { useEffect, useState } from "react";
import ReduxProvider from "./providers/ReduxProvider";
import InternetIdentityProvider from "./providers/AuthProvider/IIProvider";
import ActorProvider from "./providers/ActorProvider"; // Now just sets interceptors
import { AppRoutes } from "./routes";
import AppInitializer from "./components/AppInitializer";
import { IdentityBridge } from "./components/IdentityBridge";

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
      console.log("App is ready");
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <ReduxProvider>
      <InternetIdentityProvider>
        <ActorProvider /> {/* No longer wraps children */}
        <IdentityBridge />
        <AppInitializer />
        {isReady ? <AppRoutes /> : null}
      </InternetIdentityProvider>
    </ReduxProvider>
  );
}
```

### Step 6: Update useIdentity Hook to Export getIdentity

Ensure `src/lbry_fun_frontend/src/hooks/useIdentity.tsx` exports `getIdentity`:
```typescript
// PSEUDOCODE
import { useInternetIdentity } from "ic-use-internet-identity";

// Global getter for current identity
export const getIdentity = () => {
  // Return current identity from global state
  // This is used by interceptors
};

export const useIdentity = () => {
  const { identity, isInitializing, isLoggingIn, clear, login } = useInternetIdentity();
  
  return {
    identity,
    isInitializing,
    isLoggingIn,
    clear,
    login,
  };
};
```

### Step 7: Update All Components Using Old Actor Pattern

Find and replace:
- `useActor()` from contexts → Direct actor hooks (`useLbryFun()`, etc.)
- `actor.actor` → `actor` (no nested .actor property)
- Context imports → Hook imports

Example migration in thunks:
```typescript
// BEFORE
const actor = useContext(LbryFunContext);
const result = await actor.actor?.get_all_token_record();

// AFTER (in component)
const lbryFun = useLbryFun();

// (in thunk)
const result = await lbryFun.actor.get_all_token_record();
```

### Step 8: Remove Actor Exports from actors/index.tsx

Update `src/lbry_fun_frontend/src/actors/index.tsx`:
```typescript
// PSEUDOCODE
// Only export manual actor creators (for dynamic canisters)
export { createLogsActor } from './createLogsActor';
export { createCanisterActor } from './canisterActorFactory';
```

## Testing Strategy

### Build Verification
```bash
cd /home/theseus/alexandria/lbryfun-actor-management-fix
npm run build
```

### Local Testing (Manual)
1. Start local dfx replica
2. Deploy canisters locally
3. Start frontend dev server
4. Test:
   - Login with Internet Identity
   - Verify token pools load
   - Check ICP balance displays
   - Test swap/burn/stake functions
   - Wait 30 minutes, verify delegation doesn't expire (or force expiry)
   - Verify proper re-auth on expiry

### Key Behaviors to Verify
- ✅ Actors initialize on app load
- ✅ Identity changes trigger re-authentication
- ✅ Delegation validation prevents expired requests
- ✅ Proper error handling and logging
- ✅ No nested provider warnings
- ✅ Actor calls succeed with proper identity

## Migration Checklist

- [ ] Delete old ActorProvider components
- [ ] Delete context files
- [ ] Create useLbryFun hook
- [ ] Create useIcpLedger hook
- [ ] Create useIcpSwap hook
- [ ] Create useTokenomics hook
- [ ] Update hooks/actors/index.tsx
- [ ] Replace ActorProvider.tsx
- [ ] Update App.tsx
- [ ] Export getIdentity from useIdentity
- [ ] Find/replace actor usage in components
- [ ] Update actors/index.tsx exports
- [ ] Build successfully
- [ ] Test locally

## Files Changed Summary

**Deleted:**
- `src/lbry_fun_frontend/src/actors/LbryFunActor.tsx`
- `src/lbry_fun_frontend/src/actors/IcpLedgerActor.tsx`
- `src/lbry_fun_frontend/src/actors/IcpSwapActor.tsx`
- `src/lbry_fun_frontend/src/actors/TokenomicsActor.tsx`
- `src/lbry_fun_frontend/src/actors/ICRCActor.tsx`
- `src/lbry_fun_frontend/src/contexts/actors/` (entire directory)

**Created:**
- `src/lbry_fun_frontend/src/hooks/actors/useLbryFun.tsx`
- `src/lbry_fun_frontend/src/hooks/actors/useIcpLedger.tsx`
- `src/lbry_fun_frontend/src/hooks/actors/useIcpSwap.tsx`
- `src/lbry_fun_frontend/src/hooks/actors/useTokenomics.tsx`

**Modified:**
- `src/lbry_fun_frontend/src/providers/ActorProvider.tsx`
- `src/lbry_fun_frontend/src/hooks/actors/index.tsx`
- `src/lbry_fun_frontend/src/actors/index.tsx`
- `src/lbry_fun_frontend/src/App.tsx`
- `src/lbry_fun_frontend/src/hooks/useIdentity.tsx`
- All components/thunks using actors (find/replace)

## Expected Outcome

After implementation:
- ✅ Authentication persists properly with delegation validation
- ✅ Frontend recognizes logged-in users
- ✅ Actor calls succeed (icrc1_balance_of, get_all_token_record, etc.)
- ✅ Token pools load correctly
- ✅ Expired delegations trigger re-login
- ✅ Cleaner, simpler actor management pattern
- ✅ Matches proven alex_frontend implementation
