# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/lbryfun" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/lbryfun-fix-tokenomics-preview"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/lbryfun-fix-tokenomics-preview`
2. **Implement feature** - Follow plan sections below
3. **Build locally** (verification only - NEVER DEPLOY TO MAINNET):
   ```bash
   ./scripts/build.sh
   ```
   **⚠️ PRODUCTION WARNING**: This is a live financial application. Never deploy to mainnet.
4. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "Fix tokenomics preview actor initialization error"
   git push -u origin feature/fix-tokenomics-preview
   gh pr create --title "Fix: Tokenomics preview actor initialization error" --body "Fixes parameter mismatch in previewTokenomicsSchedule thunk calls that was causing 'Failed to initialize Lbry Fun actor' error. Implements PLAN_FIX_TOKENOMICS_PREVIEW.md"
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

**Branch:** `feature/fix-tokenomics-preview`
**Worktree:** `/home/theseus/alexandria/lbryfun-fix-tokenomics-preview`

---

# Implementation Plan

## Task Classification
**BUG FIX**: Restore broken tokenomics preview functionality → minimal changes

## Current State Documentation

### Error Flow
1. User enters token creation parameters
2. Graphs attempt to preview tokenomics schedule
3. `useTokenomicsData` hook dispatches `previewTokenomicsSchedule` thunk
4. Thunk receives incorrectly structured parameters
5. `lbryFunActor` is undefined (expects `lbryFunActor` property but receives `actor`)
6. Error thrown: "Failed to initialize Lbry Fun actor"

### Affected Files
- `src/lbry_fun_frontend/src/features/token/hooks/useTokenomicsData.ts:63-70` - Incorrect dispatch call
- `src/lbry_fun_frontend/src/features/token/components/UnifiedTokenomicsGraphsV2.tsx:126-133` - Incorrect dispatch call
- `src/lbry_fun_frontend/src/features/token/thunk/previewTokenomicsSchedule.thunk.ts:27-29` - Expects specific parameter structure

### Parameter Mismatch Details

**Thunk expects:**
```typescript
{
  args: PreviewScheduleArgs;  // Contains all the tokenomics parameters
  lbryFunActor: ActorSubclass<_SERVICE>;  // The actor instance
}
```

**Current calls provide:**
```typescript
{
  actor: lbryFunActor,  // Wrong property name
  primary_per_threshold,  // Should be in args
  max_primary_supply,  // Should be in args
  initial_secondary_burn,  // Should be in args
  halving_step,  // Should be in args
  tge_allocation,  // Should be in args
  threshold_multiplier  // Missing, should be in args
}
```

## Implementation (PSEUDOCODE)

### Fix 1: `src/lbry_fun_frontend/src/features/token/hooks/useTokenomicsData.ts`

```typescript
// PSEUDOCODE - Lines 63-70
// CURRENT (BROKEN):
const result = await dispatch(previewTokenomicsSchedule({
  actor: lbryFunActor,
  primary_per_threshold,
  max_primary_supply,
  initial_secondary_burn,
  halving_step,
  tge_allocation,
})).unwrap();

// FIXED:
const result = await dispatch(previewTokenomicsSchedule({
  args: {
    primary_per_threshold,
    max_primary_supply,
    initial_secondary_burn,
    halving_step,
    tge_allocation,
    threshold_multiplier: 2.0,  // Default value for burn threshold progression
  },
  lbryFunActor: lbryFunActor,
})).unwrap();
```

### Fix 2: `src/lbry_fun_frontend/src/features/token/components/UnifiedTokenomicsGraphsV2.tsx`

```typescript
// PSEUDOCODE - Lines 126-133
// Find the dispatch call and fix the same parameter structure issue
// CURRENT (BROKEN):
dispatch(previewTokenomicsSchedule({
  actor: lbryFunActor,
  primary_per_threshold,
  max_primary_supply,
  initial_secondary_burn,
  halving_step,
  tge_allocation,
}))

// FIXED:
dispatch(previewTokenomicsSchedule({
  args: {
    primary_per_threshold,
    max_primary_supply,
    initial_secondary_burn,
    halving_step,
    tge_allocation,
    threshold_multiplier: 2.0,
  },
  lbryFunActor: lbryFunActor,
}))
```

## Testing Requirements

**Local Build Verification Only**:
```markdown
## Testing
- Build locally to verify compilation: ./scripts/build.sh
- **NEVER deploy to mainnet** - this is a production app with financial consequences
- Verify graphs render correctly when creating a token
- Ensure no "Failed to initialize Lbry Fun actor" errors appear
```

## Expected Outcome
- Tokenomics preview graphs will render correctly
- No actor initialization errors
- Users can see the token distribution schedule visualization

## Risk Assessment
- **Low risk**: Simple parameter restructuring
- **No backend changes**: Frontend-only fix
- **No data migration**: Just fixes function call signature