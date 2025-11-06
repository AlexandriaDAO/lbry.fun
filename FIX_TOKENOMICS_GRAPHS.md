# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/lbryfun" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/lbryfun-fix-tokenomics-graphs"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/lbryfun-fix-tokenomics-graphs`
2. **Implement feature** - Follow plan sections below
3. **Build locally** (verification only - NEVER DEPLOY TO MAINNET):
   ```bash
   ./scripts/build.sh
   ```
   **⚠️ PRODUCTION WARNING**: This is a live financial application. Never deploy to mainnet.
4. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "Fix: Correct parameter names in tokenomics graphs thunk call"
   git push -u origin feature/fix-tokenomics-graphs
   gh pr create --title "Fix: Tokenomics graphs parameter mismatch" --body "Implements FIX_TOKENOMICS_GRAPHS.md"
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

**Branch:** `feature/fix-tokenomics-graphs`
**Worktree:** `/home/theseus/alexandria/lbryfun-fix-tokenomics-graphs`

---

# Implementation Plan: Fix Tokenomics Graphs Parameter Mismatch

## Classification
**BUG FIX**: Restore broken functionality with minimal changes

## Root Cause Analysis

### Current State
The tokenomics tab in the analytics terminal throws an error:
```
TypeError: can't access property "get_tokenomics_graphs", a is undefined
```

**Location**: `src/lbry_fun_frontend/src/features/swap/components/TokenomicsTab.tsx:26`

### The Bug
Parameter name mismatch between component call and thunk signature:

**Component (TokenomicsTab.tsx:26)** sends:
```typescript
dispatch(getTokenomicsGraphs({
  actor: lbryFunActor,           // ❌ Wrong name
  tokenId: poolData[0].toString() // ❌ Wrong name
}))
```

**Thunk (getTokenomicsGraphs.thunk.ts:17-20)** expects:
```typescript
{
  poolId: string;              // ✅ Correct name
  lbryFunActor: ActorSubclass<_SERVICE>  // ✅ Correct name
}
```

**Why it fails**: When destructuring parameters, the thunk tries to access `lbryFunActor` but receives `actor`, leaving `lbryFunActor` as `undefined`. Then line 26 in the thunk tries to call `actor.get_tokenomics_graphs()` on undefined.

## Implementation

### File: `src/lbry_fun_frontend/src/features/swap/components/TokenomicsTab.tsx`

**MODIFY line 26** - Change parameter names to match thunk interface:

```typescript
// BEFORE (line 26)
dispatch(getTokenomicsGraphs({ actor: lbryFunActor, tokenId: poolData[0].toString() }))

// AFTER (line 26)
dispatch(getTokenomicsGraphs({ poolId: poolData[0].toString(), lbryFunActor }))
```

**That's it.** Single line fix, no other changes needed.

## Testing

### Local Build Verification
```bash
./scripts/build.sh
```
**CRITICAL**: This is a production app - only local builds, never deploy to mainnet.

### Manual Testing Steps
1. Start local development server: `npm start`
2. Navigate to any token's swap interface
3. Click on the "Analytics" tab
4. Click on the "Tokenomics" sub-tab
5. Verify graphs load without errors
6. Check browser console for the error message - should be gone

## Expected Outcome
- Tokenomics graphs display correctly in the analytics terminal
- No console errors when navigating to the tokenomics tab
- All four graphs render: Cumulative Supply, Minted Per Epoch, Cost to Mint, Cumulative USD Cost

## Impact
- **Scope**: Single line change
- **Risk**: Minimal - fixing parameter names to match TypeScript interface
- **User Impact**: Restores broken tokenomics visualization feature
