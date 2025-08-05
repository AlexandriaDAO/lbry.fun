# Async State Management Analysis

## Problem Summary
Async action buttons (EXECUTE SWAP, EXECUTE BURN, STAKE, etc.) are re-enabling prematurely while operations are still processing, allowing users to trigger duplicate actions unintentionally.

## Current Architecture Issues

### 1. Single Global Loading State
**Problem**: All async operations share a single `swap.loading` state
- Location: `/src/features/swap/store/swapSlice.ts`
- Impact: When multiple async operations run, they overwrite each other's loading states
- Example: Lines 82-83, 101-102, 120-121 in swapSlice.ts all set the same `state.loading`

### 2. Lifecycle of Async Operations

#### Current Flow:
1. **Button Click** → Dispatch thunk
2. **Thunk Pending** → Sets `loading: true`
3. **Show Loading Notification** → Displays progress message
4. **Thunk Fulfilled/Rejected** → Sets `loading: false`
5. **Success Effect** → Calls `flagHandler()` to reset success flags
6. **Show Success/Error** → Updates notification

#### The Gap:
- Between step 3 and 4, the button re-enables because:
  - The loading notification is shown immediately after dispatch
  - The `loading` state is set to `false` as soon as the thunk completes
  - But the UI effects and data refetching continue afterward

### 3. Affected Components

| Component | File | Button | Issue |
|-----------|------|--------|-------|
| SwapContent | SwapContent.tsx:206-224 | EXECUTE SWAP | Re-enables after ~2 seconds |
| BurnContent | BurnContent.tsx:206-229 | EXECUTE BURN | Re-enables after ~2 seconds |
| StakeContent | StakeContent.tsx:190-202 | [STAKE] | Re-enables during processing |
| Unstake | Unstake.tsx:32-37 | [UNSTAKE] | No loading state check |
| ClaimReward | ClaimReward.tsx:31-36 | [CLAIM] | No loading state check |
| TransferContent | TransferContent.tsx | EXECUTE TRANSFER | Likely affected |

### 4. Root Causes

1. **No Operation-Specific Loading States**: All operations use `swap.loading`, causing conflicts
2. **Premature Loading Reset**: Loading is set to false when the async call completes, not when all side effects finish
3. **Missing Loading Checks**: Some buttons (Unstake, ClaimReward) don't check loading state at all
4. **Notification State Disconnect**: The notification system operates independently from Redux loading state

## Current State Management Patterns

### Success Flag Pattern
```typescript
// In thunk fulfilled:
state.swapSuccess = true;
state.loading = false;

// In component useEffect:
if (swap.swapSuccess === true) {
    dispatch(flagHandler()); // Resets all success flags
    // Additional operations...
}
```

### Problems with This Pattern:
1. Race conditions between multiple operations
2. No tracking of which specific operation is in progress
3. flagHandler() resets ALL success flags, not just the relevant one

## Data Dependencies
After async operations complete, these additional actions occur:
- Balance refreshes (getSecondaryBalance, getPrimaryBalance)
- Transaction history updates (fetchTransactionHistory)
- Canister balance updates (getCanisterBal)
- Archive balance checks (getArchivedBalance)

These secondary operations extend the actual operation time beyond the initial thunk completion.

## Next Steps
1. Design operation-specific loading states
2. Implement proper lifecycle tracking
3. Create a unified async operation manager
4. Ensure buttons remain disabled until ALL related operations complete

# Clean Async State Management Architecture

## Design Principles
1. **Operation Isolation**: Each operation has dedicated state tracking
2. **Complete Lifecycle Tracking**: Track from initiation through all side effects
3. **Type Safety**: Full TypeScript coverage
4. **Clean Implementation**: No legacy code or compatibility layers

## Proposed Solution

### 1. Operation State Types

```typescript
type OperationStatus = 'idle' | 'pending' | 'success' | 'error';

interface OperationStates {
  swap: OperationStatus;
  burn: OperationStatus;
  stake: OperationStatus;
  unstake: OperationStatus;
  claim: OperationStatus;
  transferPrimary: OperationStatus;
  transferSecondary: OperationStatus;
  redeem: OperationStatus;
}
```

### 2. Clean SwapState Structure

```typescript
interface SwapState {
  // Core data (keep existing)
  secondaryRatio: string | null;
  secondaryFee: string;
  secondaryBalance: string;
  // ... other existing data fields
  
  // Replace ALL loading/success flags with:
  operations: OperationStates;
  
  // Operation-specific errors
  operationErrors: Partial<Record<keyof OperationStates, ErrorMessage>>;
  
  // Remove these legacy fields:
  // loading: boolean; ❌
  // swapSuccess: boolean; ❌
  // burnSuccess: boolean; ❌
  // successStake: boolean; ❌
  // unstakeSuccess: boolean; ❌
  // successClaimReward: boolean; ❌
  // transferSuccess: boolean; ❌
  // redeeemSuccess: boolean; ❌
  // error: ErrorMessage | null; ❌
}
```

### 3. Implementation Strategy

#### Step 1: Update State Structure
- Remove all individual loading/success flags
- Add single `operations` object
- Initialize all operations as 'idle'

#### Step 2: Update Thunks Pattern
- Remove manual state updates within thunks
- Let Redux handle state transitions automatically
- Ensure side effects complete before returning

#### Step 3: Update Components
- Use operation status directly from state
- Remove all useEffect hooks that watch success flags
- Simplify button state logic

## Implementation Details

### New Slice Actions

```typescript
export const swapActions = {
  resetOperation: (state: SwapState, action: PayloadAction<keyof OperationStates>) => {
    state.operations[action.payload] = 'idle';
    state.operationErrors[action.payload] = undefined;
  },
  
  // Remove flagHandler - no longer needed
  setActiveSwapPool: (state, action) => {
    // existing logic...
    // Reset all operations when switching pools
    Object.keys(state.operations).forEach(key => {
      state.operations[key as keyof OperationStates] = 'idle';
    });
  }
};
```

### Clean Thunk Pattern

```typescript
export const swapSecondary = createAsyncThunk<
  void,  // No return value needed
  { amount: string; userPrincipal: string; canisterId: string },
  { rejectValue: ErrorMessage }
>(
  "swap/swapSecondary",
  async ({ amount, userPrincipal, canisterId }, { dispatch, rejectWithValue }) => {
    try {
      // Main operation
      const actorSwap = await getActorSwap(canisterId);
      const actorIcpLedger = await getIcpLedgerActor();
      
      // ... approval logic ...
      
      const result = await actorSwap.swap(amountFormat, []);
      if ("Err" in result) {
        throw new Error(getErrorMessage(result.Err));
      }
      
      // Side effects - these complete before the thunk resolves
      await dispatch(getSecondaryBalance(userPrincipal));
      await dispatch(fetchTransactionHistory({ userPrincipal, startIndex: 0 }));
      
    } catch (error) {
      return rejectWithValue(formatError(error));
    }
  }
);

// Clean extraReducers:
.addCase(swapSecondary.pending, (state) => {
  state.operations.swap = 'pending';
  state.operationErrors.swap = undefined;
})
.addCase(swapSecondary.fulfilled, (state) => {
  state.operations.swap = 'success';
  // Auto-reset to idle after 3 seconds
})
.addCase(swapSecondary.rejected, (state, action) => {
  state.operations.swap = 'error';
  state.operationErrors.swap = action.payload;
});
```

### Clean Component Pattern

```typescript
const SwapContent = () => {
  const dispatch = useAppDispatch();
  const swapStatus = useAppSelector(state => state.swap.operations.swap);
  const swapError = useAppSelector(state => state.swap.operationErrors.swap);
  const { showLoading, showSuccess, showError, hide } = useTerminalNotification();
  
  // Handle notifications based on status changes
  useEffect(() => {
    if (swapStatus === 'pending') {
      showLoading("SWAP IN PROGRESS", "Processing transaction...");
    } else if (swapStatus === 'success') {
      hide();
      showSuccess("SUCCESS", "Transaction completed");
      setAmount(""); // Reset form
      
      // Reset to idle after showing success
      setTimeout(() => {
        dispatch(resetOperation('swap'));
      }, 3000);
    } else if (swapStatus === 'error' && swapError) {
      hide();
      showError(swapError.title, swapError.message);
      dispatch(resetOperation('swap')); // Reset immediately on error
    }
  }, [swapStatus, swapError]);
  
  const handleSubmit = () => {
    if (!isTokenLive) {
      showError("TRADING LOCKED", "Token in launch period");
      return;
    }
    
    dispatch(swapSecondary({ amount, userPrincipal: principal, canisterId }));
  };
  
  const isButtonDisabled = 
    swapStatus === 'pending' || 
    !amount || 
    parseFloat(amount) < minimum_icp ||
    !isTokenLive;
  
  return (
    <button
      disabled={isButtonDisabled}
      onClick={handleSubmit}
      className={`w-full ${isButtonDisabled ? 'bg-gray-800 text-gray-400' : 'bg-lime-500 text-black'}`}
    >
      {swapStatus === 'pending' ? (
        <LoaderCircle className="animate-spin mx-auto" />
      ) : (
        "EXECUTE SWAP"
      )}
    </button>
  );
};
```

## Files to Update

### Phase 1: Core State Management
1. `/src/features/swap/store/swapTypes.ts` - Define new types
2. `/src/features/swap/store/swapActions.ts` - Update initial state, remove flagHandler
3. `/src/features/swap/store/swapSlice.ts` - Update reducers

### Phase 2: Thunks
1. `/src/features/swap/thunks/tradingThunks.ts` - swapSecondary, burnSecondary, transfers
2. `/src/features/swap/thunks/stakingThunks.ts` - stake, unstake, claim
3. `/src/features/swap/thunks/balanceThunks.ts` - redeem

### Phase 3: Components
1. `/src/features/swap/components/SwapContent.tsx`
2. `/src/features/swap/components/BurnContent.tsx`
3. `/src/features/swap/components/StakeContent.tsx`
4. `/src/features/swap/components/Unstake.tsx`
5. `/src/features/swap/components/ClaimReward.tsx`
6. `/src/features/swap/components/TransferContent.tsx`

## Benefits

1. **Prevents Duplicate Operations**: Operations stay in 'pending' until fully complete
2. **Cleaner Code**: No success flags, no flagHandler, fewer useEffects
3. **Better Error Isolation**: Each operation has its own error state
4. **Type Safety**: Single source of truth for operation states
5. **Simpler Mental Model**: Status flows in one direction: idle → pending → success/error → idle

## Testing Checklist

- [ ] Rapid clicking doesn't trigger multiple operations
- [ ] Operations complete fully before button re-enables
- [ ] Errors are properly isolated per operation
- [ ] Pool switching resets all operation states
- [ ] Notifications sync with operation states
- [ ] Form fields reset on success

# Enhanced Architecture (Incorporating Agent Feedback)

## Key Improvements from Agent Review

### 1. Centralized State Reset Logic (Agent 1's Suggestion)

Instead of setTimeout in components, use Redux middleware:

```typescript
// operationMiddleware.ts
const operationMiddleware: Middleware = store => next => action => {
  const result = next(action);
  
  // Auto-reset successful operations after delay
  if (action.type.endsWith('/fulfilled')) {
    const operationName = extractOperationName(action.type);
    setTimeout(() => {
      store.dispatch(resetOperation(operationName));
    }, 3000);
  }
  
  return result;
};
```

### 2. Enhanced Operation States (Agent 2's Suggestion)

Use discriminated unions for richer state information:

```typescript
type OperationState = 
  | { status: 'idle' }
  | { status: 'pending'; startedAt: number }
  | { status: 'approving'; amount: string }
  | { status: 'executing'; txId?: string }
  | { status: 'completing'; sideEffects: string[] }
  | { status: 'success'; completedAt: number; txId: string }
  | { status: 'error'; error: ErrorMessage; canRetry: boolean };

interface OperationStates {
  swap: OperationState;
  burn: OperationState;
  stake: OperationState;
  // ... etc
}
```

### 3. Operation Cancellation (Agent 1's Suggestion)

Add abort controller support:

```typescript
// In component
useEffect(() => {
  const abortController = new AbortController();
  
  return () => {
    abortController.abort();
    if (swapStatus.status === 'pending' || swapStatus.status === 'executing') {
      dispatch(cancelOperation('swap'));
    }
  };
}, []);

// In thunk
export const swapSecondary = createAsyncThunk(
  "swap/swapSecondary",
  async (params, { signal, rejectWithValue }) => {
    try {
      // Pass signal to async operations
      const result = await actorSwap.swap(amountFormat, [], { signal });
      // ...
    } catch (error) {
      if (signal.aborted) {
        return rejectWithValue({ title: "Operation cancelled", message: "" });
      }
      // ... handle other errors
    }
  }
);
```

### 4. Operation Queue (Agent 2's Suggestion - Simplified)

For sequential operations like approve-then-swap:

```typescript
// operationQueueSlice.ts
interface QueuedOperation {
  id: string;
  type: keyof OperationStates;
  params: any;
  status: 'queued' | 'processing' | 'completed' | 'failed';
}

interface OperationQueueState {
  queue: QueuedOperation[];
  processing: boolean;
}

// Usage in thunk
export const swapWithApproval = createAsyncThunk(
  "operations/swapWithApproval",
  async (params, { dispatch }) => {
    // Queue both operations
    await dispatch(queueOperation({ type: 'approve', params: approvalParams }));
    await dispatch(queueOperation({ type: 'swap', params: swapParams }));
    await dispatch(processQueue());
  }
);
```

## Revised Implementation Priority

### Phase 1: Core State Management (Week 1)
1. Implement enhanced OperationState types with discriminated unions
2. Add operation middleware for centralized state management
3. Update slice to use new state structure

### Phase 2: Cancellation Support (Week 2)
1. Add abort controller integration to thunks
2. Implement cleanup in components
3. Add cancelled state handling

### Phase 3: Operation Queue (Week 3)
1. Implement basic queue for dependent operations
2. Add retry logic for failed operations
3. Show queue status in UI

### Phase 4: Polish & Testing (Week 4)
1. Add telemetry for operation tracking
2. Implement optimistic updates where appropriate
3. Comprehensive testing

## Practical Considerations

While the agents' suggestions are architecturally sound, we should balance ideal architecture with practical implementation:

1. **Start Simple**: Implement basic operation states first, then enhance
2. **Incremental Enhancement**: Add queue and cancellation after core works
3. **Measure Impact**: Add telemetry to identify real bottlenecks before optimizing
4. **User-Focused**: Prioritize fixes that directly impact user experience

## Final Architecture Decision

For immediate implementation, focus on:
1. **Operation-specific states** (solves the core problem)
2. **Middleware for state management** (cleaner than component timeouts)
3. **Basic cancellation** (prevents state updates on unmounted components)

Defer for later:
1. Complex state machines (current states are sufficient)
2. Full queue management (most operations are independent)
3. Optimistic updates (blockchain operations can't be truly optimistic)

# Implementation Guide for Fresh Agent

## CRITICAL: Remove All Legacy Code

This is a complete refactor. **DO NOT** add new code alongside old code. **REMOVE AND REPLACE** all the following:

### Legacy Code to DELETE:

#### In `/src/features/swap/store/swapActions.ts`:
- DELETE the `flagHandler` action entirely
- DELETE these fields from initialState:
  ```typescript
  // DELETE ALL OF THESE:
  loading: false,
  swapSuccess: false,
  redeeemSuccess: false,
  successStake: false,
  burnSuccess: false,
  successClaimReward: false,
  unstakeSuccess: false,
  transferSuccess: false,
  error: null,
  ```

#### In `/src/features/swap/store/swapSlice.ts`:
- DELETE all `.addCase()` blocks that set `state.loading`
- DELETE all `.addCase()` blocks that set success flags
- DELETE the `flagHandler` export
- DELETE all success flag fulfilled cases like:
  ```typescript
  // DELETE blocks like these:
  .addCase(unstake.fulfilled, (state) => { state.unstakeSuccess = true; })
  .addCase(claimReward.fulfilled, (state) => { state.successClaimReward = true; })
  ```

#### In ALL component files:
- DELETE all `useEffect` blocks that watch success flags:
  ```typescript
  // DELETE blocks like these:
  useEffect(() => {
    if (swap.swapSuccess === true) {
      dispatch(flagHandler());
      // ...
    }
  }, [swap.swapSuccess])
  ```
- DELETE all references to `swap.loading`
- DELETE all calls to `flagHandler()`

## Step-by-Step Implementation

### Step 1: Create New Types
**File**: `/src/features/swap/store/swapTypes.ts`

ADD at the top of the file:
```typescript
// Operation status tracking
export type OperationStatus = 'idle' | 'pending' | 'success' | 'error';

export interface OperationStates {
  swap: OperationStatus;
  burn: OperationStatus;
  stake: OperationStatus;
  unstake: OperationStatus;
  claim: OperationStatus;
  transferPrimary: OperationStatus;
  transferSecondary: OperationStatus;
  redeem: OperationStatus;
}

export interface ErrorMessage {
  title: string;
  message: string;
}
```

MODIFY the SwapState interface:
```typescript
export interface SwapState {
  // ... keep all existing data fields ...
  
  // ADD these new fields:
  operations: OperationStates;
  operationErrors: Partial<Record<keyof OperationStates, ErrorMessage>>;
  
  // DELETE these old fields (they should NOT exist):
  // loading: boolean; ❌ DELETE
  // swapSuccess: boolean; ❌ DELETE
  // burnSuccess: boolean; ❌ DELETE
  // successStake: boolean; ❌ DELETE
  // unstakeSuccess: boolean; ❌ DELETE
  // successClaimReward: boolean; ❌ DELETE
  // transferSuccess: boolean; ❌ DELETE
  // redeeemSuccess: boolean; ❌ DELETE
  // error: ErrorMessage | null; ❌ DELETE
}
```

### Step 2: Update Initial State
**File**: `/src/features/swap/store/swapActions.ts`

```typescript
export const initialState: SwapState = {
  // ... keep all existing data fields ...
  
  // ADD new operation states:
  operations: {
    swap: 'idle',
    burn: 'idle',
    stake: 'idle',
    unstake: 'idle',
    claim: 'idle',
    transferPrimary: 'idle',
    transferSecondary: 'idle',
    redeem: 'idle',
  },
  operationErrors: {},
  
  // DELETE all old flags (ensure these don't exist)
};

export const swapActions = {
  // ADD new action:
  resetOperation: (state: SwapState, action: PayloadAction<keyof OperationStates>) => {
    state.operations[action.payload] = 'idle';
    state.operationErrors[action.payload] = undefined;
  },
  
  // DELETE flagHandler completely
  
  // MODIFY setActiveSwapPool:
  setActiveSwapPool: (state: SwapState, action: PayloadAction<[string, TokenRecordStringified] | null>) => {
    // ... existing logic ...
    
    // ADD: Reset all operations when switching pools
    if (newPoolId && currentPoolId && newPoolId !== currentPoolId) {
      Object.keys(state.operations).forEach(key => {
        state.operations[key as keyof OperationStates] = 'idle';
      });
      state.operationErrors = {};
    }
  }
};
```

### Step 3: Create Operation Middleware
**File**: `/src/features/swap/middleware/operationMiddleware.ts` (NEW FILE)

```typescript
import { Middleware } from '@reduxjs/toolkit';
import { resetOperation } from '../store/swapSlice';

const OPERATION_MAP: Record<string, keyof OperationStates> = {
  'swap/swapSecondary': 'swap',
  'swap/burnSecondary': 'burn',
  'swap/stakePrimary': 'stake',
  'swap/unstake': 'unstake',
  'swap/claimReward': 'claim',
  'swap/transferPrimary': 'transferPrimary',
  'swap/transferSecondary': 'transferSecondary',
  'swap/redeemArchivedBalance': 'redeem',
};

export const operationMiddleware: Middleware = store => next => action => {
  const result = next(action);
  
  // Auto-reset successful operations after 3 seconds
  if (action.type.endsWith('/fulfilled')) {
    const operationKey = Object.keys(OPERATION_MAP).find(key => 
      action.type.startsWith(key)
    );
    
    if (operationKey) {
      const operation = OPERATION_MAP[operationKey];
      setTimeout(() => {
        store.dispatch(resetOperation(operation));
      }, 3000);
    }
  }
  
  return result;
};
```

### Step 4: Update Store Configuration
**File**: `/src/store/index.ts`

```typescript
import { operationMiddleware } from '@/features/swap/middleware/operationMiddleware';

export const store = configureStore({
  reducer: {
    // ... existing reducers
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(operationMiddleware), // ADD this
});
```

### Step 5: Update Slice Extra Reducers
**File**: `/src/features/swap/store/swapSlice.ts`

REPLACE ALL existing extraReducers with this pattern:

```typescript
extraReducers: (builder) => {
  builder
    // Swap Secondary
    .addCase(swapSecondary.pending, (state) => {
      state.operations.swap = 'pending';
      state.operationErrors.swap = undefined;
    })
    .addCase(swapSecondary.fulfilled, (state) => {
      state.operations.swap = 'success';
    })
    .addCase(swapSecondary.rejected, (state, action) => {
      state.operations.swap = 'error';
      state.operationErrors.swap = action.payload;
    })
    
    // Burn Secondary
    .addCase(burnSecondary.pending, (state) => {
      state.operations.burn = 'pending';
      state.operationErrors.burn = undefined;
    })
    .addCase(burnSecondary.fulfilled, (state) => {
      state.operations.burn = 'success';
    })
    .addCase(burnSecondary.rejected, (state, action) => {
      state.operations.burn = 'error';
      state.operationErrors.burn = action.payload;
    })
    
    // Continue this pattern for ALL operations...
    // stake, unstake, claim, transfers, redeem
    
    // Keep non-operation cases as they are (balance fetches, etc)
}
```

### Step 6: Update Thunks
**File**: `/src/features/swap/thunks/tradingThunks.ts`

MODIFY each thunk to ensure side effects complete:

```typescript
export const swapSecondary = createAsyncThunk<
  void, // Change return type to void
  { amount: string; userPrincipal: string; canisterId: string },
  { rejectValue: ErrorMessage }
>(
  "swap/swapSecondary", // Update action type prefix
  async ({ amount, userPrincipal, canisterId }, { dispatch, rejectWithValue }) => {
    try {
      // ... existing swap logic ...
      
      // IMPORTANT: Await all side effects before returning
      await Promise.all([
        dispatch(getSecondaryBalance(userPrincipal)),
        dispatch(fetchTransactionHistory({ userPrincipal, startIndex: 0 }))
      ]);
      
      // No return value needed
    } catch (error) {
      return rejectWithValue(formatError(error));
    }
  }
);
```

### Step 7: Update Components
**File**: `/src/features/swap/components/SwapContent.tsx`

COMPLETE REPLACEMENT of state management:

```typescript
const SwapContent = () => {
  const dispatch = useAppDispatch();
  const swapStatus = useAppSelector(state => state.swap.operations.swap);
  const swapError = useAppSelector(state => state.swap.operationErrors.swap);
  const { showLoading, showSuccess, showError, hide } = useTerminalNotification();
  
  // DELETE all old useEffects watching success flags
  
  // ADD single new useEffect for notifications:
  useEffect(() => {
    if (swapStatus === 'pending') {
      showLoading("SWAP IN PROGRESS", `Processing ICP → ${swap.activeSwapPool?.[1].secondary_token_symbol}`);
    } else if (swapStatus === 'success') {
      hide();
      showSuccess("SUCCESS", "Transaction submitted");
      setAmount("");
      setTentativeSecondary(0);
    } else if (swapStatus === 'error' && swapError) {
      hide();
      showError(swapError.title, swapError.message);
    }
  }, [swapStatus, swapError]);
  
  const handleSubmit = useCallback(() => {
    // ... validation logic ...
    dispatch(swapSecondary({ amount, userPrincipal: principal, canisterId }));
  }, [amount, principal, canisterId]);
  
  // REPLACE button disabled logic:
  const isButtonDisabled = 
    swapStatus === 'pending' || // Simple check
    !amount || 
    parseFloat(amount) < minimum_icp ||
    !isTokenLive;
  
  return (
    <button
      disabled={isButtonDisabled}
      onClick={handleSubmit}
      className={`w-full ${isButtonDisabled ? 'bg-gray-800 text-gray-400' : 'bg-lime-500 text-black'}`}
    >
      {swapStatus === 'pending' ? (
        <LoaderCircle className="animate-spin mx-auto" />
      ) : (
        "EXECUTE SWAP"
      )}
    </button>
  );
};
```

### Files to Update (in order):

1. **Core State** (Phase 1)
   - `/src/features/swap/store/swapTypes.ts` - Add new types
   - `/src/features/swap/store/swapActions.ts` - Update initial state, remove flagHandler
   - `/src/features/swap/middleware/operationMiddleware.ts` - Create new file
   - `/src/store/index.ts` - Add middleware
   - `/src/features/swap/store/swapSlice.ts` - Update all reducers

2. **Thunks** (Phase 2)
   - `/src/features/swap/thunks/tradingThunks.ts` - Update all trading thunks
   - `/src/features/swap/thunks/stakingThunks.ts` - Update all staking thunks
   - `/src/features/swap/thunks/balanceThunks.ts` - Update redeem thunk

3. **Components** (Phase 3)
   - `/src/features/swap/components/SwapContent.tsx`
   - `/src/features/swap/components/BurnContent.tsx`
   - `/src/features/swap/components/StakeContent.tsx`
   - `/src/features/swap/components/Unstake.tsx`
   - `/src/features/swap/components/ClaimReward.tsx`
   - `/src/features/swap/components/TransferContent.tsx`

## Verification Checklist

After implementation, verify:
- [ ] NO references to `flagHandler` exist anywhere
- [ ] NO `swap.loading` references remain
- [ ] NO success flag fields in state
- [ ] NO useEffects watching success flags
- [ ] ALL buttons use `operations.{operation} === 'pending'` for disabled state
- [ ] Middleware auto-resets operations after 3 seconds
- [ ] Rapid clicking doesn't trigger duplicate operations