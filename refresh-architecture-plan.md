# Global Refresh Context Architecture Plan

## Overview
Implement a centralized refresh system using React Context that provides intelligent data refresh capabilities across the entire application with minimal UI clutter and optimal UX.

## Architecture Design

### Core Components

#### 1. RefreshContext Provider (`/src/contexts/RefreshContext.tsx`) - **NEW FILE +110 lines**
```typescript
interface RefreshState {
  isRefreshing: boolean;
  lastRefreshTime: number | null;
  refreshingKeys: Set<string>;
}

interface RefreshContextValue {
  state: RefreshState;
  refresh: (keys?: RefreshKey[]) => Promise<void>;
  isRefreshing: (key?: RefreshKey) => boolean;
  lastRefreshTime: number | null;
}

type RefreshKey = 
  | 'icp-balance'
  | 'primary-balance' 
  | 'secondary-balance'
  | 'staking-info'
  | 'burn-details'
  | 'pool-metrics';
```

#### 2. useRefresh Hook (`/src/hooks/useRefresh.ts`) - **NEW FILE +45 lines**
```typescript
export const useRefresh = () => {
  const context = useContext(RefreshContext);
  // Returns refresh function and state
  // Handles component-level refresh subscriptions
};
```

#### 3. RefreshIndicator Component (`/src/components/RefreshIndicator.tsx`) - **NEW FILE +35 lines**
```typescript
// Global refresh indicator that shows in header
// Shows loading state, last refresh time
// Single refresh button with keyboard shortcut
```

### Files to Modify

#### 1. `/src/features/auth/components/TerminalAuthMenu.tsx` - **+15 lines, -5 lines**
```diff
+ import { useRefresh } from '@/hooks/useRefresh';

  const TerminalAuthMenu: React.FC = () => {
+   const { isRefreshing, refresh, lastRefreshTime } = useRefresh();
    const { balance } = useIcpBalance();

    return (
      <div className="flex items-center gap-4">
        <span className="terminal-status-live">[CONNECTED]</span>
-       <span className="terminal-primary">{balance || "0.00"} ICP</span>
+       <span className={`terminal-primary ${isRefreshing('icp-balance') ? 'opacity-50' : ''}`}>
+         {balance || "0.00"} ICP
+       </span>
+       <RefreshIndicator compact />
```

#### 2. `/src/features/swap/components/ConsolidatedTerminal.tsx` - **+10 lines, -15 lines**
```diff
- const handleRefresh = () => {
-   if (!isAuthenticated || !principal) return;
-   dispatch(getIcpBal(principal));
-   dispatch(getPrimaryBalance(principal));
-   dispatch(getSecondaryBalance(principal));
-   toast.info("[REFRESHING] BALANCE UPDATE IN PROGRESS")
- }

+ const { refresh, isRefreshing } = useRefresh();
+ 
+ const handleRefresh = () => {
+   refresh(['icp-balance', 'primary-balance', 'secondary-balance']);
+ }

  // Remove individual FontAwesome refresh icon
- <FontAwesomeIcon 
-   role="button" 
-   icon={faRotate} 
-   onClick={handleRefresh} 
-   className="text-pink-500 hover:text-pink-400 cursor-pointer text-xs hover:animate-spin"
- />
+ <span className={`text-xs ${isRefreshing() ? 'terminal-blink' : ''}`}>
+   {isRefreshing() ? '[UPDATING...]' : ''}
+ </span>
```

#### 3. `/src/features/swap/components/StakeContent.tsx` - **+8 lines, -2 lines**
```diff
+ import { useRefresh } from '@/hooks/useRefresh';

  const StakeContent = () => {
+   const { isRefreshing } = useRefresh();
    
    // In render, add loading indicators
-   <span className="terminal-value">{swap.totalStaked}</span>
+   <span className={`terminal-value ${isRefreshing('staking-info') ? 'opacity-50' : ''}`}>
+     {swap.totalStaked}
+   </span>
```

#### 4. `/src/features/swap/components/BurnContent.tsx` - **+12 lines, -3 lines**
```diff
+ import { useRefresh } from '@/hooks/useRefresh';

  const BurnContent = () => {
+   const { refresh, isRefreshing } = useRefresh();

+   // Add refresh for max burn allowed
+   useEffect(() => {
+     const interval = setInterval(() => {
+       refresh(['burn-details']);
+     }, 30000); // Auto-refresh every 30s
+     return () => clearInterval(interval);
+   }, [refresh]);

    // In the Burn Details section
    <div className="terminal-row">
      <span className="terminal-label">Max Burn Allowed:</span>
-     <span className="terminal-value">{maxBurnAllowed.toFixed(4)}</span>
+     <span className={`terminal-value ${isRefreshing('burn-details') ? 'opacity-50' : ''}`}>
+       {maxBurnAllowed.toFixed(4)}
+     </span>
```

#### 5. `/src/store/middleware/refreshMiddleware.ts` - **NEW FILE +65 lines**
```typescript
// Redux middleware that listens for successful operations
// Automatically triggers refresh for relevant data
export const refreshMiddleware: Middleware = (store) => (next) => (action) => {
  const result = next(action);
  
  // Auto-refresh after transactions
  if (action.type.endsWith('/fulfilled')) {
    if (action.type.includes('burn') || action.type.includes('mint')) {
      store.dispatch(refreshBalances());
    }
    if (action.type.includes('stake') || action.type.includes('unstake')) {
      store.dispatch(refreshStakingInfo());
    }
  }
  
  return result;
};
```

#### 6. `/src/store/index.ts` - **+2 lines**
```diff
+ import { refreshMiddleware } from './middleware/refreshMiddleware';

  export const store = configureStore({
    reducer: rootReducer,
-   middleware: (getDefaultMiddleware) => getDefaultMiddleware()
+   middleware: (getDefaultMiddleware) => 
+     getDefaultMiddleware().concat(refreshMiddleware)
  });
```

#### 7. `/src/App.tsx` - **+3 lines**
```diff
+ import { RefreshProvider } from '@/contexts/RefreshContext';

  return (
    <AuthProvider>
+     <RefreshProvider>
        <RouterProvider router={router} />
+     </RefreshProvider>
    </AuthProvider>
  );
```

#### 8. `/src/hooks/useIcpBalance.ts` - **+8 lines, -4 lines**
```diff
+ import { useRefresh } from './useRefresh';

  export const useIcpBalance = () => {
+   const { subscribeToRefresh } = useRefresh();
    
+   useEffect(() => {
+     return subscribeToRefresh('icp-balance', () => {
+       dispatch(getIcpBal(principal));
+     });
+   }, [principal]);
```

### Keyboard Shortcuts Implementation

#### 9. `/src/hooks/useKeyboardShortcuts.ts` - **NEW FILE +30 lines**
```typescript
export const useKeyboardShortcuts = () => {
  const { refresh } = useRefresh();
  
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        refresh(); // Refresh all visible data
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [refresh]);
};
```

### CSS Additions

#### 10. `/src/styles/terminal.css` - **+25 lines**
```css
.terminal-refresh-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.terminal-refresh-indicator:hover {
  background: rgba(255, 255, 255, 0.1);
}

.terminal-refresh-indicator.refreshing {
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.terminal-data-stale {
  opacity: 0.7;
  font-style: italic;
}
```

## Lines of Code Summary

### New Files (Total: +325 lines)
- `RefreshContext.tsx`: +110 lines
- `useRefresh.ts`: +45 lines
- `RefreshIndicator.tsx`: +35 lines
- `refreshMiddleware.ts`: +65 lines
- `useKeyboardShortcuts.ts`: +30 lines
- CSS additions: +25 lines
- Misc new components: +15 lines

### Modified Files (Total: +60 lines, -45 lines)
- `TerminalAuthMenu.tsx`: +15, -5
- `ConsolidatedTerminal.tsx`: +10, -15
- `StakeContent.tsx`: +8, -2
- `BurnContent.tsx`: +12, -3
- `refreshMiddleware.ts`: +65, -0
- `store/index.ts`: +2, -0
- `App.tsx`: +3, -0
- `useIcpBalance.ts`: +8, -4
- Other minor updates: +12, -16

### **Net Change: +340 lines**

## Benefits

1. **Single Source of Truth**: All refresh logic centralized
2. **Intelligent Refresh**: Only fetches what's needed
3. **Better UX**: 
   - One clean refresh indicator in header
   - Inline loading states (opacity changes)
   - Keyboard shortcut (Cmd+R)
   - Auto-refresh after transactions
4. **Performance**: 
   - Deduplicates API calls
   - Batches refresh requests
   - Implements stale-while-revalidate pattern
5. **Developer Experience**:
   - Simple API: `const { refresh, isRefreshing } = useRefresh()`
   - Automatic cleanup and subscription management
   - TypeScript support with RefreshKey enum

## Migration Strategy

1. **Phase 1**: Implement core RefreshContext and provider
2. **Phase 2**: Add middleware for auto-refresh after transactions
3. **Phase 3**: Update components to use new refresh system
4. **Phase 4**: Remove old refresh logic and buttons
5. **Phase 5**: Add keyboard shortcuts and polish

## Testing Considerations

- Test refresh deduplication
- Verify auto-refresh after transactions
- Ensure loading states display correctly
- Test keyboard shortcuts don't interfere with forms
- Verify stale data indicators work properly

## Alternative Considerations Rejected

- **Individual refresh buttons**: Too much UI clutter
- **React Query**: Too heavy for current needs
- **Polling only**: Wastes resources and API calls
- **WebSocket subscriptions**: Overkill for current architecture