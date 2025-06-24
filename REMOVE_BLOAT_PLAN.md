# Remove Bloat Plan - Cypherpunk Swap Page

## Current Problems
1. UnifiedSwapDataProvider is fetching EVERYTHING on mount
2. Multiple actors being created simultaneously causing DOMException aborts
3. Complex caching logic for a simple terminal UI
4. Provider pattern overkill for basic swap functionality

## Solution: Strip It Down

### Phase 1: Remove the Provider Pattern
The UnifiedSwapDataProvider is causing more problems than it solves:
- Creating multiple actors in parallel
- Fetching data that tabs don't need
- Complex caching for data that rarely changes
- Causing the "text.includes is not a function" error (likely from undefined data)

### Phase 2: Direct Data Fetching
Each terminal should fetch ONLY what it needs, WHEN it needs it:
- TradingTerminal: Only balances when user is authenticated
- StakingTerminal: Only staking data when that tab is active
- AnalyticsTerminal: Only charts when that tab is active

### Phase 3: Remove Unused Code
- Remove the complex caching logic
- Remove the loading phases
- Remove the stale-while-revalidate pattern
- Remove unnecessary memoization

## Implementation Steps

1. **Remove UnifiedSwapDataProvider completely**
2. **Update SwapMainConsolidated to not use the provider**
3. **Update each terminal to fetch its own data directly**
4. **Remove all the optimization code we just added**

## Expected Result
- Faster initial load (no unnecessary data fetching)
- Simpler code (no provider complexity)
- No more DOMException errors
- Each tab loads only what it needs