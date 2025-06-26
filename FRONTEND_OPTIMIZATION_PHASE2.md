# Frontend Optimization Phase 2 - Remaining Tasks

## Completed Tasks ✅
Phase 2 has successfully completed:
1. **Modal Migration** - Unified 3 modal components into single Modal component with useModal hook (123 lines removed)
2. **SwapSlice Reduction** - Split 505-line file into modular structure:
   - `store/swapTypes.ts` (49 lines) - interfaces
   - `store/swapActions.ts` (102 lines) - actions & initial state
   - `store/swapSelectors.ts` (94 lines) - memoized selectors
   - `store/swapSlice.ts` (194 lines) - reducer logic
   - Main `swapSlice.ts` (4 lines) - re-exports
3. **Component Structure Flattening** - Moved 28 components from nested directories to top level
   - Removed 10 empty directories
   - Updated all import paths to use relative paths from components/
   - Only `terminals/` subdirectory remains (appropriately)

## Important Context
- **No global shared directory**: Components are organized by feature, not globally
- **Import patterns**: Uses @/ alias for absolute imports from src/
- **Component naming**: Already moved to PascalCase during flattening
- **Current structure**: All swap components now at `/features/swap/components/` except terminals

## Remaining Tasks

### 1. Consolidate Component Patterns (Priority: MEDIUM, Time: 1-2 hours)
**Current State**: Multiple similar component patterns within swap feature
**Action Required**:

Search for duplicate patterns in `/features/swap/components/`:
- Multiple skeleton loaders (SwapContentSkeleton, StakeContentSkeleton, balanceCardSkeleton)
- Transaction display components (TransactionItem, detailTransaction, transactionHistoryObj)
- Helper components (CopyHelper, copyHelper case sensitivity)
- Info/card patterns (InfoCard, CanisterCycles)

**Consolidation approach**:
1. Merge skeleton loaders into generic `<Skeleton type="swap|stake|balance" />`
2. Create single `<TransactionDisplay />` component with view modes
3. Ensure single CopyHelper with consistent casing
4. Review if InfoCard patterns can be generalized

**Expected reduction**: ~200-300 lines

### 2. Performance Optimizations (Priority: MEDIUM, Time: 2 hours)
**Current State**: No memoization or lazy loading implemented
**Action Required**:

**Add React.memo to stable components**:
```typescript
// Terminal components (already mostly stable)
export const TradingTerminal = React.memo(TradingTerminalComponent);
export const StakingTerminal = React.memo(StakingTerminalComponent);
export const AnalyticsTerminal = React.memo(AnalyticsTerminalComponent);

// Heavy render components
export default React.memo(TransactionHistory);
export default React.memo(LineChart);
export default React.memo(ConsolidatedTerminal);
```

**Implement lazy loading for terminals**:
```typescript
// In swapMainConsolidated.tsx
const TradingTerminal = lazy(() => import('./components/terminals/TradingTerminal'));
const StakingTerminal = lazy(() => import('./components/terminals/StakingTerminal'));
const AnalyticsTerminal = lazy(() => import('./components/terminals/AnalyticsTerminal'));

// Wrap with Suspense in render
<Suspense fallback={<TerminalSkeleton />}>
  <Component />
</Suspense>
```

**Optimize hooks**:
- Add useCallback to event handlers in forms (SwapContent, BurnContent, etc.)
- Use useMemo for expensive calculations (burn calculations, APY calculations)
- Review useEffect dependencies for unnecessary re-runs

### 3. Type Safety Improvements (Priority: LOW, Time: 1 hour)
**Current State**: Some loose typing remains
**Action Required**:

**Search and fix in `/features/swap/`**:
```bash
# Find all 'any' types
grep -r "any" --include="*.ts" --include="*.tsx"

# Find @ts-ignore comments
grep -r "@ts-ignore" --include="*.ts" --include="*.tsx"

# Find loose event handlers
grep -r "event: any" --include="*.tsx"
```

**Common fixes needed**:
- Event handlers: `(event: any)` → `(event: React.FormEvent<HTMLFormElement>)`
- Thunk payloads: `action.payload as string` → proper error types
- Modal props: Remove remaining `any` from setters
- Actor types: Import proper types from `.did` files

### 4. Final Cleanup Pass (Priority: LOW, Time: 30 minutes)
**Current State**: Some inconsistencies remain after refactoring
**Action Required**:

**Automated cleanup**:
```bash
# Remove unused imports
npx eslint --fix "src/features/swap/**/*.{ts,tsx}"

# Format all files
npx prettier --write "src/features/swap/**/*.{ts,tsx}"

# Find commented code
grep -r "^[[:space:]]*//.*" --include="*.tsx" | grep -v "eslint\|@ts-"
```

**Manual review**:
- [ ] Ensure consistent imports (prefer named exports for components)
- [ ] Remove debug console.logs
- [ ] Update stale comments from refactoring
- [ ] Verify all file names match their default export
- [ ] Check for duplicate CSS classes in terminal styles

## Final Metrics Target
- **File count**: Current ~50 → Target ~45 files (merge similar components)
- **Type coverage**: 100% (no `any` types)
- **Bundle size**: 10-15% reduction from lazy loading
- **Import depth**: Max 3 levels from feature root
- **Memoized components**: All heavy components wrapped

## Testing Checklist
After all optimizations:
- [ ] All terminal tabs load correctly with lazy loading
- [ ] Modal transitions work smoothly
- [ ] No TypeScript errors in build
- [ ] Transaction history pagination works
- [ ] Forms validate correctly with proper types
- [ ] Bundle analyzer shows size reduction
- [ ] No console errors or warnings

## Git Commit Strategy
```bash
git commit -m "feat: consolidate swap component patterns"
git commit -m "perf: add memoization and lazy loading to swap terminals"
git commit -m "fix: improve type safety in swap feature"
git commit -m "chore: final cleanup and formatting of swap feature"
```