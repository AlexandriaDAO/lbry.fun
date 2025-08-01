# Routing Architecture Refactoring Plan

## Current Problems (Complete Analysis)

1. **Multiple Persistent States Causing Snap-backs**:
   - `activeSwapPool` in Redux → causes snap-back on `/swap` page
   - `activeDeploymentId` in localStorage + Redux → causes modal to auto-open in create token form
   - `activeTokenView` in Redux → controls which view shows on home page
   - Various localStorage items (`tab`, etc.) → cause unexpected UI state restoration

2. **State Restoration on App Init**:
   - `AppInitializer` runs `initializeDeployments` which restores `activeDeploymentId` from localStorage
   - `TerminalCreateToken` has useEffect that opens modal if `activeDeploymentId` exists
   - No cleanup when navigating away from pages

3. **Multiple Sources of Truth**: 
   - URL parameters (`?id=`)
   - Redux state (`activeSwapPool`, `activeDeploymentId`, `activeTokenView`)
   - localStorage (`activeDeploymentId`, `tab`, deployment data)
   - Hook state (`poolInitState`)
   
4. **Overly Complex Hooks**: 
   - `usePoolInitializer` manages routing, data fetching, and state
   - Multiple useEffect hooks checking and syncing state

5. **Circular Dependencies**: Navigation triggers state changes which trigger navigation.

## Root Causes

- **Missing cleanup**: No cleanup when leaving swap page
- **Tight coupling**: Business logic mixed with routing logic
- **Unclear ownership**: Multiple components trying to control navigation

## Refactoring Plan

### Phase 1: Clean State Management (Minimal Changes)

1. **Add Route-Level Cleanup**
   - Clear `activeSwapPool` when navigating away from swap page
   - Use React Router's route lifecycle hooks

2. **Simplify usePoolInitializer**
   - Remove navigation logic from the hook
   - Make it purely responsible for data fetching based on URL
   - Let the component handle navigation decisions

### Phase 2: Architectural Improvements (Recommended)

1. **Single Source of Truth**
   - URL should be the only source of truth for which pool is active
   - Redux should derive its state from the URL, not vice versa

2. **Separate Concerns**
   - Create `usePoolData` hook for data fetching only
   - Create `usePoolNavigation` hook for navigation logic only
   - Keep them independent

3. **Clear Navigation Flow**
   ```
   User Action → Update URL → Fetch Data → Update Redux
   (Never: Redux State → Update URL)
   ```

### Implementation Steps

#### Step 1: Add Cleanup (Quick Fix)
```typescript
// In SwapPage component
useEffect(() => {
  return () => {
    // Clear active pool when leaving the page
    dispatch(setActiveSwapPool(null));
  };
}, [dispatch]);
```

#### Step 2: Refactor usePoolInitializer
```typescript
// Remove navigation logic, make it data-only
export const usePoolData = (poolId: string | null) => {
  // Only fetch and manage data
  // No navigation side effects
};
```

#### Step 3: Create Navigation Hook
```typescript
export const usePoolNavigation = () => {
  // Handle all navigation logic
  // Clear separation from data fetching
};
```

#### Step 4: Update SwapMainConsolidated
- Use URL as single source of truth
- Don't sync Redux to URL
- Handle missing pool ID at component level

### Benefits

1. **Predictable Navigation**: No unexpected redirects
2. **Cleaner Architecture**: Clear separation of concerns
3. **Easier Testing**: Each piece can be tested independently
4. **Better Performance**: Fewer unnecessary re-renders

### Migration Path

1. Start with Phase 1 (quick fixes) to solve immediate problem
2. Plan Phase 2 refactoring for next sprint
3. Test thoroughly at each step
4. Update documentation

## Alternative: Remove Redux Pool State Entirely

Consider removing `activeSwapPool` from Redux entirely and always derive it from:
- URL parameters for swap page
- Direct selection for other pages

This would eliminate the sync problem completely.

## Implemented Fixes (Phase 1)

### 1. SwapPage Cleanup (`/src/pages/swap/index.tsx`)
- Clears `activeSwapPool` from Redux on unmount
- Removes `tab` from localStorage

### 2. TokenPage Cleanup (`/src/pages/tokenPage.tsx`)
- Clears `activeDeploymentId` from Redux and localStorage on unmount
- Resets `activeTokenView` to default 'TokenPools'

### 3. Deployment State Management
- Removed automatic restoration of `activeDeploymentId` from `initializeDeployments`
- Modified `TerminalCreateToken` to only show modal when `activeDeploymentId` is explicitly set
- Updated `DeploymentsPage` to set `activeTokenView` when selecting a deployment

### 4. URL Management
- Simplified `usePoolInitializer` to only redirect when truly needed
- Removed aggressive URL syncing logic

### Results
- No more snap-back when navigating from swap page to home
- No more automatic modal opening on token creation page
- Cleaner state management with proper cleanup
- Predictable navigation behavior

### Remaining Work
Consider Phase 2 refactoring to completely eliminate state/URL sync issues by making URL the single source of truth.

## Additional Fixes - URL as Source of Truth

### localStorage Review Summary
Reviewed all localStorage usage and identified:
- `riskWarningLastShown` - UI preference, OK to persist
- `deployment_format_cleaned` - One-time migration flag, OK to persist
- `deployment_*` - Deployment data cache, OK to persist (has expiry)
- `activeDeploymentId` - REMOVED in favor of URL params
- `tab` - UI state, already cleaned on page unmount

### Deployment Navigation Fix
Changed navigation flow to use URL parameters:

1. **DeploymentsPage** (`/src/pages/DeploymentsPage.tsx`)
   - Changed from: `dispatch(setActiveDeploymentId())` + `navigate('/')`
   - Changed to: `navigate('/?deploymentId=${deploymentId}')`

2. **TokenPage** (`/src/pages/tokenPage.tsx`)
   - Added URL parameter reading with `useSearchParams`
   - Sets `activeDeploymentId` and view based on URL on mount
   - Page refresh now preserves deployment context

3. **Removed localStorage persistence**
   - No more `localStorage.setItem('activeDeploymentId')`
   - No more auto-restoration in `initializeDeployments`

### Benefits
- **Refresh-proof**: URL parameters survive page refresh
- **Bookmarkable**: Users can share deployment URLs
- **Cleaner**: No complex state/storage sync logic
- **Predictable**: URL is the single source of truth

This incrementally moves us toward the ideal architecture where URL drives state, not vice versa.