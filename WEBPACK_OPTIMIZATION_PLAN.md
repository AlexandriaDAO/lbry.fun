# Webpack Optimization Plan

## Problems Identified

### 1. Over-Aggressive Code Splitting
**Current Config:**
```javascript
maxSize: 244000,       // 244KB - TOO SMALL for HTTP/2
maxAsyncRequests: 30,  // TOO MANY async chunks
```

**Impact:** 60+ vendor bundle files, slow initial load

**Recommended Fix:**
```javascript
maxSize: 512000,       // 512KB - Better for HTTP/2
maxAsyncRequests: 15,  // Reduce async chunks
minSize: 30000,        // 30KB minimum
```

### 2. Actor Re-initialization
**Current Code (ActorProvider.tsx:72):**
```javascript
const httpAgentOptions = { host: getIcHost() };
```

**Impact:** New object every render → all actors re-initialize

**Fix:**
```javascript
const httpAgentOptions = useMemo(() => ({ host: getIcHost() }), []);
```

## Expected Improvements

**Bundle Loading:**
- From: 60+ requests
- To: ~15-20 requests
- Initial load: ~30-40% faster

**Actor Performance:**
- From: Re-initialize on every render
- To: Initialize once
- Runtime: More stable, fewer connection resets

## Implementation Priority

1. **HIGH**: Fix httpAgentOptions memoization (quick win, immediate impact)
2. **MEDIUM**: Optimize webpack splitting (requires testing, bigger impact)
