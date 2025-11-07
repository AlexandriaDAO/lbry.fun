# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/lbryfun" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/lbryfun-fix-actor-timing"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/lbryfun-fix-actor-timing`
2. **Implement feature** - Follow plan sections below
3. **Build locally** (verification only - NEVER DEPLOY TO MAINNET):
   ```bash
   ./scripts/build.sh
   ```
   **⚠️ PRODUCTION WARNING**: This is a live financial application. Never deploy to mainnet.
4. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "Fix: Add actor initialization checks to prevent undefined errors"
   git push -u origin feature/fix-actor-initialization-timing
   gh pr create --title "Fix: Actor initialization timing issues after PR 10" --body "Implements FIX-ACTOR-TIMING.md"
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

**Branch:** `feature/fix-actor-initialization-timing`
**Worktree:** `/home/theseus/alexandria/lbryfun-fix-actor-timing`

---

# Implementation Plan

## Task Classification
**BUG FIX**: Restore functionality broken after PR 10 removed static actor providers

## Current State Analysis

### The Problem
After PR 10 (architecturally correct removal of static IcpSwap/Tokenomics providers), two critical errors emerged:

1. **Tokenomics tab**: "Loading chunk 197 failed" (misleading - actually undefined actor)
2. **Create token page**: "Failed to initialize Lbry Fun actor" error

### Root Cause
The `ic-use-actor` library creates actors asynchronously:
```typescript
// From node_modules/ic-use-actor/src/ActorProvider.tsx:190-247
useEffect(() => {
  const initializeActor = async () => {
    // ... async actor creation
    setActor(createdActor); // This happens AFTER components try to use it!
  };
  initializeActor();
}, []);
```

Components are trying to use actors immediately without checking readiness.

### Affected Files (Research Complete)

**File 1:** `src/lbry_fun_frontend/src/features/swap/components/TokenomicsTab.tsx:21-38`
```typescript
// CURRENT STATE (BROKEN)
useEffect(() => {
    if (poolData && poolData[0] && lbryFunActor) { // lbryFunActor might be undefined!
        setLoading(true);
        setError(null);

        dispatch(getTokenomicsGraphs({ poolId: poolData[0].toString(), lbryFunActor }))
            .unwrap()
            .then(data => {
                setGraphData(data);
                setLoading(false);
            })
            .catch(error => {
                console.error("Failed to fetch tokenomics graphs:", error);
                setError(error.message || "Failed to fetch tokenomics data");
                setLoading(false);
            });
    }
}, [poolData, dispatch, lbryFunActor]);
```

**File 2:** `src/lbry_fun_frontend/src/features/token/components/UnifiedTokenomicsGraphsV2.tsx:89-146`
```typescript
// CURRENT STATE (BROKEN)
useEffect(() => {
    // useEffect runs immediately, actor might be undefined
    if (variant === 'token' && poolId && lbryFunActor) {
        setLoading(true);
        // ... dispatch with potentially undefined actor
    }
}, [variant, poolId, dispatch, lbryFunActor]);
```

**File 3:** `src/lbry_fun_frontend/src/features/token/hooks/useTokenomicsData.ts:32-90`
```typescript
// CURRENT STATE (BROKEN)
useEffect(() => {
    const fetchTokenomicsData = async () => {
        if (variant === 'preview' && previewData) {
            // ... preview logic
        } else if (variant === 'token' && poolId && lbryFunActor) {
            // Actor might be undefined here!
            setLoading(true);
            try {
                const result = await dispatch(getTokenomicsGraphs({
                    poolId: poolId.toString(),
                    lbryFunActor
                })).unwrap();
                // ...
            }
        }
    };
    fetchTokenomicsData();
}, [variant, previewData, poolId, lbryFunActor, dispatch]);
```

**File 4:** `src/lbry_fun_frontend/src/features/swap/components/terminals/TerminalCreateToken.tsx:307`
```typescript
// CURRENT STATE (BROKEN - condition doesn't prevent dispatch)
{!lbryFunActor ? (
    <ErrorMessage
        title="Preview Error"
        message="Failed to initialize Lbry Fun actor"
    />
) : (
    <UnifiedTokenomicsGraphsV2
        variant="preview"
        previewData={formToPreviewData(form)}
    />
)}
```

**File 5:** `src/lbry_fun_frontend/src/components/AppInitializer.tsx:18-23`
```typescript
// CURRENT STATE (BROKEN)
useEffect(() => {
    const fetchIcpPrice = async () => {
        if (lbryFunActor) { // Actor might be undefined!
            await dispatch(fetchIcpPriceThunk({ lbryFunActor }));
        }
    };
    fetchIcpPrice();
}, [dispatch, lbryFunActor]);
```

## Implementation Steps (PSEUDOCODE)

### Fix 1: TokenomicsTab.tsx
```typescript
// PSEUDOCODE
useEffect(() => {
    // ADD THIS CHECK AT THE BEGINNING
    if (!lbryFunActor) return; // Early return if actor not ready

    if (poolData && poolData[0]) {
        setLoading(true);
        setError(null);

        dispatch(getTokenomicsGraphs({ poolId: poolData[0].toString(), lbryFunActor }))
            .unwrap()
            .then(data => {
                setGraphData(data);
                setLoading(false);
            })
            .catch(error => {
                console.error("Failed to fetch tokenomics graphs:", error);
                setError(error.message || "Failed to fetch tokenomics data");
                setLoading(false);
            });
    }
}, [poolData, dispatch, lbryFunActor]);
```

### Fix 2: UnifiedTokenomicsGraphsV2.tsx
```typescript
// PSEUDOCODE - Line 91
useEffect(() => {
    // ADD THIS CHECK AT THE BEGINNING
    if (!lbryFunActor) return; // Early return if actor not ready

    if (variant === 'token' && poolId) {
        setLoading(true);
        // ... rest of logic
    }
}, [variant, poolId, dispatch, lbryFunActor]);
```

### Fix 3: useTokenomicsData.ts
```typescript
// PSEUDOCODE - Line 56
useEffect(() => {
    const fetchTokenomicsData = async () => {
        if (variant === 'preview' && previewData) {
            // ... preview logic (no change needed)
        } else if (variant === 'token' && poolId && lbryFunActor) {
            // ADD THIS CHECK
            if (!lbryFunActor) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const result = await dispatch(getTokenomicsGraphs({
                    poolId: poolId.toString(),
                    lbryFunActor
                })).unwrap();
                // ... rest of logic
            }
        }
    };

    fetchTokenomicsData();
}, [variant, previewData, poolId, lbryFunActor, dispatch]);
```

### Fix 4: TerminalCreateToken.tsx
```typescript
// PSEUDOCODE - Line 307
// Change conditional rendering to show loading state
{!lbryFunActor ? (
    <div className="text-gray-400 text-sm p-4">
        Loading actor initialization...
    </div>
) : (
    <UnifiedTokenomicsGraphsV2
        variant="preview"
        previewData={formToPreviewData(form)}
    />
)}
```

### Fix 5: AppInitializer.tsx
```typescript
// PSEUDOCODE - Line 19
useEffect(() => {
    const fetchIcpPrice = async () => {
        // ADD THIS CHECK AT THE BEGINNING
        if (!lbryFunActor) return; // Early return if actor not ready

        await dispatch(fetchIcpPriceThunk({ lbryFunActor }));
    };

    fetchIcpPrice();
}, [dispatch, lbryFunActor]);
```

## Testing Requirements

**Local Build Verification Only**:
```markdown
## Testing
- Build locally to verify compilation: ./scripts/build.sh
- **NEVER deploy to mainnet** - this is a production app with financial consequences
- Test manually in local environment:
  1. Navigate to home page (create token)
     - Verify no "Failed to initialize Lbry Fun actor" error
     - Verify tokenomics preview graphs load
  2. Create a test token
  3. Navigate to swap page
  4. Click ANALYTICS_TERMINAL
  5. Click "TOKENOMICS" tab
     - Verify no "Loading chunk 197 failed" error
     - Verify graphs load correctly
  6. Check browser console for any remaining errors
```

## Expected Outcome
1. ✅ No more misleading "Loading chunk 197 failed" errors
2. ✅ No more "Failed to initialize Lbry Fun actor" errors
3. ✅ Components gracefully wait for actor initialization
4. ✅ All functionality works once actors are ready
5. ✅ Clean browser console with no actor-related errors

## Risk Assessment
- **Minimal Risk**: Only adding null checks, no logic changes
- **No Backend Changes**: Frontend-only fixes
- **Surgical Changes**: ~5 lines added total across 5 files
- **Backward Compatible**: All existing functionality preserved

## Files Summary
| File | Line | Change |
|------|------|--------|
| TokenomicsTab.tsx | 22 | Add `if (!lbryFunActor) return;` |
| UnifiedTokenomicsGraphsV2.tsx | 91 | Add `if (!lbryFunActor) return;` |
| useTokenomicsData.ts | 56 | Add actor null check in fetch |
| TerminalCreateToken.tsx | 307 | Change error to loading message |
| AppInitializer.tsx | 19 | Add `if (!lbryFunActor) return;` |

Total changes: 5 files, ~10 lines of defensive checks