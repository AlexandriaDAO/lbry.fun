# Token Status and isLive Determination Flow

## Token Lifecycle

1. **Token Creation**
   ```
   created_time = current_time
   launched_at = created_time + (launch_delay_seconds * 1_000_000_000)
   status = Deploying
   ```

2. **After Deployment Completes**
   ```
   status = Live { pool_id: "..." }
   // But token is NOT actually live for trading yet!
   ```

3. **Token Becomes Tradeable**
   ```
   When: current_time >= launched_at
   ```

## Backend Logic (Correct)

### `get_live()` - Returns tokens that are ACTUALLY live
```rust
filters for: 
- status == Live AND 
- current_time >= launched_at
```

### `get_upcoming()` - Returns tokens that are pending launch
```rust
filters for:
- status == Live BUT
- current_time < launched_at
```

### `get_all_token_record()` - Returns ALL tokens
```rust
No filtering - returns everything
```

## Frontend Logic (After Fix)

### 1. `getTokenPools.thunk.ts` (FIXED)
Used by: Main token lists, general queries
```typescript
// Calculates isLive correctly:
const hasLiveStatus = 'Live' in record.status;
const isLive = hasLiveStatus && currentTimeNanos >= launchedAtNanos;
```

### 2. `getLiveTokens.thunk.ts` (Correct)
Used by: Live tokens page
```typescript
isLive: true // Correct because backend already filtered
```

### 3. `getUpcommingTokens.thunk.ts` (Correct)
Used by: Upcoming tokens page
```typescript
isLive: false // Correct because backend already filtered
```

## Common Confusion Points

1. **Status vs isLive**
   - `status: Live` means deployment is complete
   - `isLive: true` means token is tradeable (time condition met)

2. **A token can have:**
   - `status: Live` and `isLive: false` (deployment done, waiting for launch)
   - `status: Live` and `isLive: true` (fully launched and tradeable)
   - `status: Failed` and `isLive: false` (deployment failed)
   - `status: Deploying` and `isLive: false` (still deploying)

## Visual Timeline

```
Token Created          Deployment Done        Launch Time
    |                       |                     |
    v                       v                     v
[Deploying]  --------> [Live + Not Trading] --> [Live + Trading]
                       (status: Live)            (status: Live)
                       (isLive: false)           (isLive: true)
                                                 
    |<-- deployment -->|<-- launch_delay -->|
```

## Debugging Tips

To check if a token should be live:
1. Check `status` field - must have `Live` variant
2. Compare `Date.now() * 1000000` with `launched_at` (both in nanoseconds)
3. Token is tradeable when: current_time >= launched_at