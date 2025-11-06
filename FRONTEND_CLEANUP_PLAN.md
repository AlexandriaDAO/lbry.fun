# Frontend Cleanup & Optimization Plan

## Problem Analysis

### 1. Chunk Load Error (427.d7bac18a51e68922c914.js)
- **Root Cause**: Chunk 427 contains the lazy-loaded TerminalCreateToken component
- **Issue**: Old chunk referenced in browser cache doesn't exist after rebuild
- **Impact**: Page fails to load when navigating to token creation

### 2. Excessive Logging
**IdentityBridge (3 logs per identity access):**
- Line 18: "[IdentityBridge] Registering identity getter" (once on mount)
- Line 21-22: "[IdentityBridge] Getter called, returning identity: ..." (EVERY call)
- Line 31-32: "[IdentityBridge] Identity changed: ..." (on every identity change)

**authUtils (2 logs per identity access):**
- Line 58: "[authUtils] Got identity with principal: ..." (EVERY call to getCurrentIdentity)
- Line 60: "[authUtils] No identity available" (when no identity)

**ActorProvider (2 logs per canister call):**
- Line 35: "[ActorProvider] onRequest" (EVERY canister call)
- Line 63: "[ActorProvider] onResponse" (EVERY canister call)

**Impact**: With 4 actor providers × dozens of calls = hundreds/thousands of logs per page load

### 3. Agent Time Sync Errors
- **Issue**: AgentReadStateError with "Expected to find result for path time"
- **Cause**: Multiple HttpAgent instances created without proper time sync
- **Location**: authUtils.ts creates new agents without coordinated sync

### 4. NS_BINDING_ABORTED
- **Cause**: Network requests cancelled during navigation/hot reload
- **Related**: No retry mechanism for transient network failures

### 5. No Chunk Load Error Handling
- **Missing**: No retry mechanism for failed chunk loads
- **Missing**: No user feedback for chunk load failures

---

## Refactoring Plan

### Phase 1: Remove Excessive Logging (Negative LOC)

**File: /home/theseus/alexandria/lbryfun/src/lbry_fun_frontend/src/components/IdentityBridge.tsx**
- [ ] Remove line 18: console.log('[IdentityBridge] Registering identity getter')
- [ ] Remove lines 21-22: console.log('[IdentityBridge] Getter called, returning identity: ...')
- [ ] Remove lines 31-32: console.log('[IdentityBridge] Identity changed: ...')
- **Lines removed**: 5

**File: /home/theseus/alexandria/lbryfun/src/lbry_fun_frontend/src/features/auth/utils/authUtils.ts**
- [ ] Remove line 53: console.warn('[authUtils] Identity getter not registered')
- [ ] Remove lines 58-60: All console.log in getCurrentIdentity
- [ ] Remove line 67: console.log('[authUtils] Clearing auth utilities...')
- **Lines removed**: 7

**File: /home/theseus/alexandria/lbryfun/src/lbry_fun_frontend/src/providers/ActorProvider.tsx**
- [ ] Remove line 35: console.log("[ActorProvider] onRequest", data.methodName)
- [ ] Remove line 63: console.log("[ActorProvider] onResponse", data.methodName)
- **Lines removed**: 2

**File: /home/theseus/alexandria/lbryfun/src/lbry_fun_frontend/src/hooks/actors/useActorErrorHandler.ts**
- [ ] Remove lines 13-14: console.debug('Actor request:', data.methodName)
- [ ] Remove lines 18-19: console.debug('Actor response:', data.methodName)
- **Lines removed**: 4

**File: /home/theseus/alexandria/lbryfun/src/lbry_fun_frontend/src/App.tsx**
- [ ] Remove line 28: console.log("App is ready")
- **Lines removed**: 1

**File: /home/theseus/alexandria/lbryfun/src/lbry_fun_frontend/src/index.tsx**
- [ ] Remove lines 62-64: console.log('Loading indicator removed') (keep condition, remove log)
- **Lines removed**: 1

**Total lines removed: 20**

### Phase 2: Add Chunk Load Error Handling (Minimal LOC)

**File: /home/theseus/alexandria/lbryfun/src/lbry_fun_frontend/src/routes/index.tsx**
- [ ] Add lazy load error boundary wrapper
- [ ] Add retry mechanism for chunk load failures
- [ ] Add user-friendly error message

**Implementation:**
```typescript
// Add retry utility for lazy loading
const lazyWithRetry = (componentImport: () => Promise<any>) => {
  return lazy(() => 
    componentImport().catch(error => {
      // Check if it's a chunk load error
      if (error.name === 'ChunkLoadError' || error.message?.includes('Loading chunk')) {
        // Retry once after clearing cache
        return new Promise((resolve) => {
          setTimeout(() => {
            window.location.reload();
          }, 100);
        });
      }
      throw error;
    })
  );
};

// Replace lazy() calls with lazyWithRetry()
const NotFoundPage = lazyWithRetry(() => import("@/pages/NotFoundPage"));
const TokenPage = lazyWithRetry(() => import("@/pages/tokenPage"));
const DeploymentsPage = lazyWithRetry(() => import("@/pages/MyDeploymentsPage"));
```
**Lines added**: ~15

### Phase 3: Optimize Agent Creation (Reduce Duplication)

**File: /home/theseus/alexandria/lbryfun/src/features/auth/utils/authUtils.ts**
- [ ] Create single shared agent factory function
- [ ] Remove duplicate agent creation in getActorSwap, getTokenomicsActor, getIcpLedgerActor, getICRCActor
- [ ] Add agent caching to prevent multiple instances
- [ ] Ensure proper fetchRootKey timing

**Implementation:**
```typescript
// Shared agent cache
let cachedAgent: HttpAgent | null = null;
let agentIdentity: Identity | undefined = undefined;

const createOrGetAgent = async (identity?: Identity): Promise<HttpAgent> => {
  // Return cached agent if identity matches
  if (cachedAgent && agentIdentity === identity) {
    return cachedAgent;
  }

  const agentOptions: any = {
    host: isLocalDevelopment ? `http://localhost:4943` : "https://ic0.app"
  };
  
  if (identity) {
    agentOptions.identity = identity;
  }
  
  const agent = await HttpAgent.create(agentOptions);
  
  if (isLocalDevelopment) {
    await agent.fetchRootKey().catch((err) => {
      console.warn("Unable to fetch root key. Check local replica.");
    });
  }
  
  cachedAgent = agent;
  agentIdentity = identity;
  return agent;
};

// Clear cache on logout
export const clearAuthCaches = () => {
  cachedAgent = null;
  agentIdentity = undefined;
};
```

**Refactor all getActor* functions to use createOrGetAgent:**
- getActorSwap
- getTokenomicsActor
- getIcpLedgerActor
- getICRCActor

**Lines removed**: ~80 (duplicate agent creation code)
**Lines added**: ~30 (shared function)
**Net**: -50 LOC

### Phase 4: Improve Error Handling

**File: /home/theseus/alexandria/lbryfun/src/lbry_fun_frontend/src/utils/networkRetry.ts**
- [ ] Add ChunkLoadError to retry conditions
- [ ] Add exponential backoff
- [ ] Add max retry attempts tracking

**Implementation:**
```typescript
export const callWithRetry = async <T>(
  apiCall: () => Promise<T>, 
  retries = 2,
  delay = 1000
): Promise<T> => {
  try {
    return await apiCall();
  } catch (error: any) {
    const isRetriable = 
      error.name === 'ChunkLoadError' ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('network') || 
      error.message?.includes('Failed to fetch') ||
      error.code === 'ERR_NETWORK';
    
    if (retries > 0 && isRetriable) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(apiCall, retries - 1, delay * 2);
    }
    throw error;
  }
};
```
**Lines modified**: 10

### Phase 5: Clean Up Console Output Strategy

**Create: /home/theseus/alexandria/lbryfun/src/lbry_fun_frontend/src/utils/logger.ts**
```typescript
// Simple logger that only logs in development
const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  debug: (...args: any[]) => {
    if (isDev) console.debug(...args);
  },
  info: (...args: any[]) => {
    if (isDev) console.info(...args);
  },
  warn: (...args: any[]) => {
    console.warn(...args); // Always show warnings
  },
  error: (...args: any[]) => {
    console.error(...args); // Always show errors
  }
};
```

**Replace critical logs only:**
- Keep error logs (console.error)
- Keep warning logs (console.warn) 
- Remove all debug/info logs (console.log)

**Lines added**: 15

### Phase 6: Fix Webpack Chunking Strategy

**File: /home/theseus/alexandria/lbryfun/webpack.config.js**
- [ ] Add cache busting for production builds
- [ ] Improve chunk naming for better debugging
- [ ] Add performance hints

**Modifications:**
```javascript
output: {
  filename: '[name].[contenthash].js',
  chunkFilename: '[name].[contenthash].js',
  path: path.join(__dirname, "dist", frontendDirectory),
  publicPath: '/',
  clean: true, // Clean dist folder before build
},
performance: {
  hints: isDevelopment ? false : 'warning',
  maxEntrypointSize: 512000,
  maxAssetSize: 512000,
},
```
**Lines modified**: 5

---

## Implementation Order

1. **Phase 1** (Logging Removal) - Immediate impact, zero risk
2. **Phase 2** (Chunk Error Handling) - Fixes main user-facing issue
3. **Phase 3** (Agent Optimization) - Fixes time sync errors
4. **Phase 4** (Network Retry) - Improves resilience
5. **Phase 5** (Logger Utility) - Future-proofs logging strategy
6. **Phase 6** (Webpack Config) - Long-term stability

---

## Success Metrics

### Before:
- Console logs: 500-1000+ per page load
- Chunk load errors: Frequent, no recovery
- Agent errors: Multiple time sync failures
- Network aborts: No handling

### After:
- Console logs: <10 per page load (errors/warnings only)
- Chunk load errors: Auto-retry with user feedback
- Agent errors: Eliminated via singleton pattern
- Network aborts: Graceful retry with backoff

---

## Risk Assessment

**Low Risk Changes:**
- Removing console.log statements (Phase 1)
- Adding chunk retry logic (Phase 2)
- Adding logger utility (Phase 5)

**Medium Risk Changes:**
- Agent caching refactor (Phase 3) - thorough testing needed
- Network retry improvements (Phase 4)

**Testing Strategy:**
- Test authentication flow thoroughly
- Test lazy-loaded routes
- Test network failure scenarios
- Test hot reload behavior

---

## Estimated Impact

**Lines of Code:**
- Removed: ~100
- Added: ~60
- **Net: -40 LOC** ✅

**Build Size:**
- Minimal impact (removed logs compress well)

**Performance:**
- Fewer agent instances = less memory
- Reduced console logging = better DevTools performance
- Better caching = faster subsequent loads

**Developer Experience:**
- Cleaner console output
- Better error messages
- Easier debugging

**User Experience:**
- Automatic recovery from chunk errors
- Faster page loads
- Fewer authentication errors
