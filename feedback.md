# Frontend Transaction Handling Improvements Plan

## Overview
This plan addresses the issue where transaction buttons become re-clickable too quickly and users can accidentally execute the same operation multiple times. The root cause is that all operations share a single `swap.loading` state, causing conflicts when operations complete.

## Change 1: Add Operation-Specific Loading States

### Files to Modify:
1. **`src/lbry_fun_frontend/src/features/swap/store/swapTypes.ts`**
   - Add new fields to `SwapState` interface:
   ```typescript
   isSwapping: boolean;
   isBurning: boolean;
   isStaking: boolean;
   isTransferring: boolean;
   isRedeeming: boolean;
   ```

2. **`src/lbry_fun_frontend/src/features/swap/store/swapActions.ts`**
   - Add new action creators:
   ```typescript
   resetOperationStates: (state) => {
     state.isSwapping = false;
     state.isBurning = false;
     state.isStaking = false;
     state.isTransferring = false;
     state.isRedeeming = false;
   }
   ```

3. **`src/lbry_fun_frontend/src/features/swap/store/swapSlice.ts`**
   - Update initial state with new fields (all false)
   - Modify thunk handlers:
     - `swapSecondary`: Use `isSwapping` instead of `loading`
     - `burnSecondary`: Use `isBurning` instead of `loading`
     - `stakePrimary`: Use `isStaking` instead of `loading`
     - `transferSecondary`: Use `isTransferring` instead of `loading`
     - `redeemArchivedBalance`: Use `isRedeeming` instead of `loading`

4. **Update all component files to use specific loading states:**
   - `SwapContent.tsx`: Replace `swap.loading` with `swap.isSwapping`
   - `BurnContent.tsx`: Replace `swap.loading` with `swap.isBurning`
   - `StakeContent.tsx`: Replace `swap.loading` with `swap.isStaking`
   - `TransferContent.tsx`: Replace `swap.loading` with `swap.isTransferring`

### Pros:
- Each operation can run independently without UI conflicts
- Clear separation of concerns
- No more shared state conflicts

### Cons:
- More state to manage
- Need to update multiple files
- Slightly larger Redux state

---

## Change 2: Create a Shared Transaction Button Component

### Files to Create:
1. **`src/lbry_fun_frontend/src/features/swap/shared/TransactionButton.tsx`**
   ```typescript
   interface TransactionButtonProps {
     operation: 'swap' | 'burn' | 'stake' | 'transfer' | 'redeem';
     isLoading: boolean;
     disabled: boolean;
     onClick: () => void;
     children: React.ReactNode;
     loadingText?: string;
     className?: string;
   }
   ```

### Files to Modify:
1. **All transaction components** to use the new button:
   - `SwapContent.tsx`
   - `BurnContent.tsx`
   - `StakeContent.tsx`
   - `TransferContent.tsx`

### Features:
- Consistent loading animations
- Built-in debouncing (500ms)
- Operation-specific loading messages
- Terminal-style aesthetics maintained

### Pros:
- Consistent UX across all operations
- Single place to manage button behavior
- Easy to add new features (like progress indicators)

### Cons:
- Another component to maintain
- Migration effort for existing buttons

---

## Change 3: Enhanced Transaction Status Tracking

### Files to Create:
1. **`src/lbry_fun_frontend/src/features/swap/types/transactionTracking.ts`**
   ```typescript
   interface PendingTransaction {
     id: string;
     operation: TransactionOperation;
     timestamp: number;
     estimatedDuration: number;
     status: 'pending' | 'confirming' | 'completed' | 'failed';
   }
   ```

### Files to Modify:
1. **`src/lbry_fun_frontend/src/features/swap/store/swapTypes.ts`**
   - Add `pendingTransactions: Map<string, PendingTransaction>`

2. **`src/lbry_fun_frontend/src/features/swap/store/swapSlice.ts`**
   - Add transaction tracking in each thunk
   - Auto-cleanup after 60 seconds
   - Update transaction status on completion/failure

3. **`src/lbry_fun_frontend/src/features/swap/hooks/useTerminalNotification.ts`**
   - Enhance to show transaction IDs
   - Add persistent notifications option

### Pros:
- Users can track multiple concurrent transactions
- Better error recovery (know which transaction failed)
- Professional transaction management

### Cons:
- More complex state management
- Need cleanup logic to prevent memory leaks

---

## Change 4: Improve Visual Feedback

### Files to Modify:
1. **`src/lbry_fun_frontend/src/styles/terminal.css`**
   - Add new classes:
   ```css
   .terminal-button-processing {
     animation: terminal-pulse 1s infinite;
   }
   @keyframes terminal-pulse {
     0%, 100% { opacity: 1; }
     50% { opacity: 0.7; }
   }
   ```

2. **`src/lbry_fun_frontend/src/features/swap/components/TerminalNotification.tsx`**
   - Add progress indicator for loading state
   - Show estimated time remaining
   - Make notifications persistent for transactions

### Pros:
- Clear visual indication of processing
- Better user confidence
- Maintains terminal aesthetic

### Cons:
- More CSS to maintain
- Might be visually distracting

---

## Change 5: Add Debouncing to Transaction Buttons

### Files to Create:
1. **`src/lbry_fun_frontend/src/features/swap/hooks/useTransactionDebounce.ts`**
   - Custom hook to manage button debouncing
   - Store last click timestamp per operation
   - Minimum 500ms between clicks

### Files to Modify:
1. **All transaction button implementations**
   - Wrap onClick handlers with debounce logic
   - Show "cooling down" state if clicked too fast

### Pros:
- Prevents accidental double-clicks
- Simple to implement
- No backend changes needed

### Cons:
- Might feel unresponsive to fast users
- Need to tune debounce duration

---

## Change 6: Create Transaction Status Monitor (Optional)

### Files to Create:
1. **`src/lbry_fun_frontend/src/features/swap/components/TransactionMonitor.tsx`**
   - Small terminal widget showing active transactions
   - Shows queue of pending operations
   - Click to expand for details

### Files to Modify:
1. **`src/lbry_fun_frontend/src/features/swap/swapMainConsolidated.tsx`**
   - Add TransactionMonitor to layout
   - Position in corner or as collapsible panel

### Pros:
- Professional trading interface feel
- Users can monitor multiple operations
- Good for power users

### Cons:
- Adds UI complexity
- Might be overwhelming for casual users
- More screen real estate used

---

## Implementation Priority & Effort Estimate

1. **Operation-specific loading states** (High Priority, 2-3 hours)
   - Core fix for the main issue
   - Relatively straightforward implementation

2. **Transaction button component** (High Priority, 2-3 hours)
   - Improves consistency and prevents issues
   - Good ROI for effort

3. **Visual feedback improvements** (Medium Priority, 1-2 hours)
   - Quick wins for better UX
   - Mostly CSS work

4. **Debouncing** (Medium Priority, 1 hour)
   - Simple safety mechanism
   - Easy to implement

5. **Transaction tracking** (Low Priority, 3-4 hours)
   - Nice to have but not critical
   - More complex implementation

6. **Status monitor** (Low Priority, 3-4 hours)
   - Optional enhancement
   - Only if users request it

## Total Estimated Effort: 12-19 hours for full implementation

## Recommendation
Start with Changes 1 and 2 as they address the core issue. Changes 3-6 can be implemented incrementally based on user feedback and needs.