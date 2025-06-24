# Tab Consolidation Performance Fix Plan

## Current Issues Summary

After consolidating from 8 tabs to 3 tabs, we've introduced several performance issues and architectural problems:

1. **Provider Recreation on Tab Switch**: The `UnifiedSwapDataProvider` is instantiated inside each tab component, causing all cached data to be lost when switching tabs.
2. **Components Bypassing Provider**: Several components (`Insights`, `TokenomicsTab`) are fetching data directly instead of using the unified provider.
3. **Certificate Errors**: "Invalid certificate: Signature verification failed" when fetching logs data.
4. **Slow Loading**: Tokenomics graphs take over 40 seconds to load (20s initial + 20s more).
5. **No Progressive Loading**: All data is fetched at once instead of prioritizing critical data.

## Architecture Overview

### Current Structure (Problematic)
```
SwapMainConsolidated.tsx
└── Tab Components (TradingTerminal, StakingTerminal, AnalyticsTerminal)
    └── UnifiedSwapDataProvider (recreated on each tab switch)
        └── Individual Components
```

### Proposed Structure
```
SwapMainConsolidated.tsx
└── UnifiedSwapDataProvider (persistent across tabs)
    └── Tab Components
        └── Individual Components (using provider data)
```

## Detailed Fix Plan

### 1. Move Provider to Higher Level

**File: `/src/lbry_fun_frontend/src/features/swap/swapMainConsolidated.tsx`**

Current (lines 118-128):
```tsx
{isPoolReady ? (
    <UnifiedSwapDataProvider>
        {(() => {
            const activeTabData = tabs.find(tab => tab.path === effectivePath);
            if (activeTabData && activeTabData.Component) {
                const Component = activeTabData.Component;
                return <Component />;
            }
            return null;
        })()}
    </UnifiedSwapDataProvider>
) : (
```

Should be:
```tsx
// Wrap the entire component content with the provider
return (
    <div className='tabs py-2 sm:py-3 md:py-4'>
        <div className='container px-2 sm:px-3 md:px-4'>
            {isPoolReady ? (
                <UnifiedSwapDataProvider>
                    <ConsolidatedTerminal />
                    <div className='tabs-content'>
                        {/* Tab navigation and content */}
                    </div>
                </UnifiedSwapDataProvider>
            ) : (
                // Loading state
            )}
        </div>
    </div>
);
```

### 2. Update Components to Use Provider

#### 2.1 Fix Insights Component

**File: `/src/lbry_fun_frontend/src/features/swap/components/insights/insights.tsx`**

Current problematic code (lines 26-30):
```tsx
useEffect(() => {
    if (logsCanisterId) {
        dispatch(getAllLogs(logsCanisterId));
    }
}, [dispatch, logsCanisterId]);
```

Replace with:
```tsx
const { insights, loadInsights, isLoading } = useUnifiedSwapData();

useEffect(() => {
    loadInsights(); // Use provider's method
}, [loadInsights]);
```

#### 2.2 Fix TokenomicsTab Component

**File: `/src/lbry_fun_frontend/src/features/swap/components/tokenomics/TokenomicsTab.tsx`**

Current problematic code (lines 20-50):
- Creates its own actor
- Fetches data independently

Replace with:
```tsx
const { tokenomics, loadTokenomics, isLoading } = useUnifiedSwapData();

useEffect(() => {
    loadTokenomics(); // Use provider's method
}, [loadTokenomics]);
```

### 3. Enhance UnifiedSwapDataProvider

**File: `/src/lbry_fun_frontend/src/features/swap/providers/UnifiedSwapDataProvider.tsx`**

#### 3.1 Add Loading Phases
```typescript
export enum LoadingPhase {
  IDLE = 'IDLE',
  LOADING_CRITICAL = 'LOADING_CRITICAL',  // Balances, pool data
  LOADING_SECONDARY = 'LOADING_SECONDARY', // Charts, logs, tokenomics
  READY = 'READY',
  ERROR = 'ERROR'
}
```

#### 3.2 Fix Agent Creation for Local Development
Add to all actor creation methods:
```typescript
const agent = new HttpAgent({
    host: process.env.DFX_NETWORK === "ic" ? "https://ic0.app" : "http://localhost:4943"
});

// Critical for local development
if (process.env.DFX_NETWORK !== "ic") {
    await agent.fetchRootKey().catch(err => {
        console.warn("Unable to fetch root key. This is expected in production.", err);
    });
}
```

#### 3.3 Implement Progressive Loading
```typescript
// Load critical data first
const loadCriticalData = useCallback(async () => {
    setLoadingPhase(LoadingPhase.LOADING_CRITICAL);
    
    // Load only essential data for immediate UI
    await Promise.all([
        loadBalances(),
        loadPoolData(),
        loadBasicRates()
    ]);
    
    setLoadingPhase(LoadingPhase.READY);
}, []);

// Load secondary data lazily
const loadSecondaryData = useCallback(async () => {
    setLoadingPhase(LoadingPhase.LOADING_SECONDARY);
    
    // Load heavy data only when needed
    if (shouldLoadLogs) {
        await loadLogsData();
    }
    if (shouldLoadTokenomics) {
        await loadTokenomicsData();
    }
}, [shouldLoadLogs, shouldLoadTokenomics]);
```

### 4. Fix Certificate Errors

**File: `/src/lbry_fun_frontend/src/features/swap/thunks/insights/getAllLogs.thunk.ts`**

Add proper error handling:
```typescript
try {
    const agent = new HttpAgent({
        host: process.env.DFX_NETWORK === "ic" ? "https://ic0.app" : "http://localhost:4943"
    });
    
    // Add retry logic
    let retries = 3;
    while (retries > 0) {
        try {
            if (process.env.DFX_NETWORK !== "ic") {
                await agent.fetchRootKey();
            }
            
            const actor = Actor.createActor(idlFactory, {
                agent,
                canisterId: Principal.fromText(logsCanisterId)
            });
            
            const logs = await actor.get_all_logs();
            return processLogs(logs);
        } catch (error) {
            if (error.message.includes("Invalid certificate") && retries > 1) {
                retries--;
                await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
                continue;
            }
            throw error;
        }
    }
} catch (error) {
    console.error("Failed to get logs:", error);
    throw error;
}
```

### 5. Optimize Caching Strategy

**File: `/src/lbry_fun_frontend/src/features/swap/providers/UnifiedSwapDataProvider.tsx`**

Update cache durations:
```typescript
const CACHE_DURATION = {
  POOL_DATA: 10 * 60 * 1000,     // 10 minutes (rarely changes)
  BALANCES: 30 * 1000,           // 30 seconds (user actions)
  RATES: 2 * 60 * 1000,          // 2 minutes (moderate frequency)
  TRANSACTIONS: 5 * 60 * 1000,   // 5 minutes
  INSIGHTS: 15 * 60 * 1000,      // 15 minutes (historical data)
  TOKENOMICS: 30 * 60 * 1000     // 30 minutes (static config)
};
```

Add stale-while-revalidate pattern:
```typescript
const getCachedOrFetch = async <T,>(
  key: string,
  fetcher: () => Promise<T>,
  duration: number
): Promise<T> => {
  const cached = cacheRef.current[key];
  
  // Return stale data immediately while fetching fresh
  if (cached && Date.now() - cached.timestamp < duration * 2) {
    if (Date.now() - cached.timestamp > duration) {
      // Fetch fresh data in background
      fetcher().then(data => {
        cacheRef.current[key] = { data, timestamp: Date.now() };
      });
    }
    return cached.data;
  }
  
  // No cache or too stale, fetch fresh
  const data = await fetcher();
  cacheRef.current[key] = { data, timestamp: Date.now() };
  return data;
};
```

### 6. Performance Optimizations

#### 6.1 Memoize Terminal Components

**Files:**
- `/src/lbry_fun_frontend/src/features/swap/components/terminals/TradingTerminal.tsx`
- `/src/lbry_fun_frontend/src/features/swap/components/terminals/StakingTerminal.tsx`
- `/src/lbry_fun_frontend/src/features/swap/components/terminals/AnalyticsTerminal.tsx`

Wrap exports with React.memo:
```tsx
export const TradingTerminal = React.memo(() => {
    // Component implementation
});

// Add display name for debugging
TradingTerminal.displayName = 'TradingTerminal';
```

#### 6.2 Add Loading Skeletons

Create reusable skeleton components for each data type to improve perceived performance.

## Migration Steps

1. **Backup Current State**: Create a git branch for the current implementation
2. **Move Provider**: Relocate UnifiedSwapDataProvider to wrap entire SwapMainConsolidated
3. **Update Components**: Modify Insights and TokenomicsTab to use provider
4. **Fix Actor Creation**: Add proper agent initialization with fetchRootKey
5. **Implement Progressive Loading**: Add loading phases to provider
6. **Test Each Tab**: Verify data persistence across tab switches
7. **Monitor Performance**: Use browser DevTools to verify reduced API calls

## Expected Results

1. **Tab Switching**: Instant with no data refetching
2. **Initial Load**: < 3 seconds for critical data
3. **Charts/Graphs**: Load progressively in background
4. **API Calls**: Reduced by 70-80% through proper caching
5. **Error Handling**: Graceful fallbacks for certificate errors

## Testing Checklist

- [ ] Tab switching maintains all loaded data
- [ ] No duplicate API calls when switching tabs
- [ ] Insights loads without certificate errors
- [ ] Tokenomics graphs load within 5 seconds
- [ ] Balances update properly on user actions
- [ ] Cache invalidation works correctly
- [ ] Local development works without certificate issues
- [ ] Production deployment maintains performance gains