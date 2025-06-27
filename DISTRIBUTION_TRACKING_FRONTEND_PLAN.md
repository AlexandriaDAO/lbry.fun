# Distribution Tracking Frontend Integration Plan

## Implementation Review (Completed 2025-06-27)

### Completed Tasks
1. ✅ Added distribution type definitions (distributionTypes.ts)
2. ✅ Created distribution thunks (distributionThunks.ts) 
3. ✅ Updated Redux slice with distribution state
4. ✅ Created distribution utility functions (distributionUtils.ts)
5. ✅ Built DistributionTracker container component
6. ✅ Created DistributionOverview component
7. ✅ Built PoolAllocationChart component
8. ✅ Created DistributionEventTimeline component
9. ✅ Created DistributionEventCard component
10. ✅ Updated Insights component to include distribution tracker
11. ✅ Added distribution-specific terminal styles

### Implementation Summary
Successfully integrated the distribution tracking system into the Analytics & Insights tab. The implementation provides complete transparency into ICP reward distributions with:
- Real-time distribution status and countdown timer
- Visual pool allocation breakdown with progress bars
- Expandable event timeline showing distribution history
- Proper error handling and loading states
- Automatic data refresh every minute
- Terminal-styled UI consistent with the app design

### Key Files Created/Modified
- **Types**: `src/features/swap/types/distributionTypes.ts`
- **Thunks**: `src/features/swap/thunks/distributionThunks.ts`
- **Components**: `src/features/swap/components/distribution/` (4 components)
- **Utils**: `src/features/swap/utils/distributionUtils.ts`
- **Redux**: Updated `swapSlice.ts`, `swapTypes.ts`, and `swapActions.ts`
- **Styles**: Added distribution styles to `terminal.css`

The distribution tracking is now fully functional and ready for testing with real canister data.

# Distribution Tracking Frontend Integration Plan

## Executive Summary

This document outlines the implementation plan for integrating the new distribution tracking system into the "[3] ANALYTICS & INFO" tab of the LBRY Fun frontend. The integration will provide users with complete transparency into ICP reward distributions across Alexandria (1%), LP Treasury (49.5%), and Stakers (49.5%) pools.

## Current State Analysis

### Analytics Terminal Structure (`src/lbry_fun_frontend/src/features/swap/components/terminals/AnalyticsTerminal.tsx`)
- Three tabs: Insights, Tokenomics, Technical
- Insights tab shows historical data with 6 line charts
- Currently displays "ICP in LP Treasury" but no distribution breakdown
- Uses Redux thunks for data fetching

### Data Fetching Architecture
- Thunks in `src/features/swap/thunks/analyticsThunks.ts`
- Actor services for blockchain integration
- Logs canister provides historical data

### Styling System
- Cypherpunk terminal design with Tailwind CSS
- Custom terminal classes in `/src/styles/terminal.css`
- Consistent monospace font and black/white/green color scheme

## Proposed Solution

### 1. Add Distribution Section to Insights Tab

Create a new distribution tracking section in the Insights tab that displays:

1. **Distribution Overview Card** - Current cycle information
2. **Pool Allocation Pie Chart** - Visual breakdown of the 1%/49.5%/49.5% split
3. **Lifetime Totals Summary** - Cumulative distributions to each pool
4. **Recent Distribution Events** - Timeline of recent distributions
5. **LP Provision Status** - Real-time status of liquidity provisions

### 2. New Components to Create

**File**: `src/lbry_fun_frontend/src/features/swap/components/distribution/DistributionTracker.tsx`

```typescript
interface DistributionTrackerProps {
  icpSwapCanisterId: string;
}

// Main container component that orchestrates all distribution displays
const DistributionTracker: React.FC<DistributionTrackerProps> = ({ icpSwapCanisterId }) => {
  // Fetches and displays all distribution data
};
```

**File**: `src/lbry_fun_frontend/src/features/swap/components/distribution/DistributionOverview.tsx`

```typescript
// Displays current distribution cycle info and next distribution countdown
const DistributionOverview: React.FC<{ summary: DistributionSummary }> = ({ summary }) => {
  return (
    <div className="terminal-pure mb-6">
      <div className="terminal-header mb-2">
        <span className="terminal-prompt">&gt;</span> distribution_status
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="terminal-info">
          <span className="terminal-label">cycle:</span>
          <span className="terminal-value">#{summary.total_cycles}</span>
        </div>
        <div className="terminal-info">
          <span className="terminal-label">next_distribution:</span>
          <span className="terminal-accent">{formatCountdown()}</span>
        </div>
        {/* More stats */}
      </div>
    </div>
  );
};
```

**File**: `src/lbry_fun_frontend/src/features/swap/components/distribution/PoolAllocationChart.tsx`

```typescript
// Pie chart showing the 1%/49.5%/49.5% distribution
const PoolAllocationChart: React.FC<{ data: LifetimeDistributionTotals }> = ({ data }) => {
  // Uses Chart.js or similar library styled to match terminal aesthetic
};
```

**File**: `src/lbry_fun_frontend/src/features/swap/components/distribution/DistributionEventTimeline.tsx`

```typescript
// Shows recent distribution events with expandable details
const DistributionEventTimeline: React.FC<{ events: DistributionEvent[] }> = ({ events }) => {
  return (
    <div className="terminal-pure">
      <div className="terminal-header mb-2">
        <span className="terminal-prompt">&gt;</span> recent_distributions
      </div>
      {events.map(event => (
        <DistributionEventCard key={event.event_id} event={event} />
      ))}
    </div>
  );
};
```

**File**: `src/lbry_fun_frontend/src/features/swap/components/distribution/DistributionEventCard.tsx`

```typescript
const DistributionEventCard: React.FC<{ event: DistributionEvent }> = ({ event }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="terminal-info mb-2">
      <div className="terminal-row cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className="terminal-label">cycle_#{event.distribution_cycle}:</span>
        <span className="terminal-value">{formatTimestamp(event.timestamp)}</span>
        <span className="terminal-accent ml-2">{formatICP(event.total_available)}</span>
      </div>
      {expanded && (
        <div className="mt-2 ml-4">
          <DistributionBreakdown event={event} />
        </div>
      )}
    </div>
  );
};
```

### 3. Add Distribution Thunks

**File**: `src/lbry_fun_frontend/src/features/swap/thunks/distributionThunks.ts`

```typescript
import { createAsyncThunk } from "@reduxjs/toolkit";
import { getIcpSwapActor } from "@/features/auth/utils/authUtils";

// Fetch distribution summary
export const fetchDistributionSummary = createAsyncThunk(
  'swap/fetchDistributionSummary',
  async (icpSwapId: string, { rejectWithValue }) => {
    try {
      const actor = await getIcpSwapActor(icpSwapId);
      const summary = await actor.get_distribution_summary();
      return summary;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Fetch distribution events with pagination
export const fetchDistributionEvents = createAsyncThunk(
  'swap/fetchDistributionEvents',
  async ({ icpSwapId, fromId = 0, limit = 10 }: DistributionEventsParams, { rejectWithValue }) => {
    try {
      const actor = await getIcpSwapActor(icpSwapId);
      const events = await actor.get_distribution_events(BigInt(fromId), limit);
      return events;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Fetch latest distribution event
export const fetchLatestDistributionEvent = createAsyncThunk(
  'swap/fetchLatestDistributionEvent',
  async (icpSwapId: string, { rejectWithValue }) => {
    try {
      const actor = await getIcpSwapActor(icpSwapId);
      const event = await actor.get_latest_distribution_event();
      return event;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Export all thunks
export const distributionThunks = {
  fetchDistributionSummary,
  fetchDistributionEvents,
  fetchLatestDistributionEvent,
};
```

### 4. Update Redux Slice

**File**: `src/lbry_fun_frontend/src/features/swap/store/swapSlice.ts`

Add to state interface:
```typescript
interface SwapState {
  // ... existing state ...
  
  // Distribution tracking
  distributionSummary: DistributionSummary | null;
  distributionEvents: DistributionEvent[];
  latestDistributionEvent: DistributionEvent | null;
  distributionLoading: boolean;
  distributionError: string | null;
}
```

Add reducers for the new thunks:
```typescript
extraReducers: (builder) => {
  // ... existing reducers ...
  
  // Distribution Summary
  builder
    .addCase(fetchDistributionSummary.pending, (state) => {
      state.distributionLoading = true;
      state.distributionError = null;
    })
    .addCase(fetchDistributionSummary.fulfilled, (state, action) => {
      state.distributionSummary = action.payload;
      state.distributionLoading = false;
    })
    .addCase(fetchDistributionSummary.rejected, (state, action) => {
      state.distributionError = action.payload as string;
      state.distributionLoading = false;
    });
    
  // Similar patterns for other thunks
}
```

### 5. Add Type Definitions

**File**: `src/lbry_fun_frontend/src/features/swap/types/distributionTypes.ts`

```typescript
export interface DistributionAllocations {
  alexandria_allocated: bigint;
  lp_treasury_allocated: bigint;
  stakers_allocated: bigint;
}

export interface DistributionResults {
  alexandria_sent: bigint[] | null;
  lp_treasury_added: bigint;
  stakers_distributed: bigint[] | null;
  stakers_rollover: bigint;
  lp_provision_status: LpProvisionStatus;
  error_details: string[] | null;
}

export type LpProvisionStatus = 
  | { Pending: null }
  | { Success: { lp_tokens: bigint } }
  | { Failed: { reason: string } };

export interface DistributionEvent {
  event_id: bigint;
  timestamp: bigint;
  distribution_cycle: number;
  total_available: bigint;
  allocations: DistributionAllocations;
  results: DistributionResults;
}

export interface LifetimeDistributionTotals {
  total_distributed: bigint;
  alexandria_total: bigint;
  lp_treasury_total: bigint;
  stakers_total: bigint;
}

export interface DistributionSummary {
  total_cycles: number;
  total_alexandria_sent: bigint;
  total_lp_treasury_balance: bigint;
  total_stakers_distributed: bigint;
  current_lp_provision_queue: bigint;
  last_distribution: DistributionEvent | null;
  lifetime_totals: LifetimeDistributionTotals;
}
```

### 6. Update Insights Component

**File**: `src/lbry_fun_frontend/src/features/swap/components/Insights.tsx`

Add the distribution tracker after the existing charts:

```typescript
import { lazy, Suspense } from 'react';

// Lazy load the distribution tracker
const DistributionTracker = lazy(() => import('./distribution/DistributionTracker'));

const Insights: React.FC = () => {
  // ... existing code ...
  
  return (
    <div className="container mx-auto px-4 py-8">
      {/* ... existing summary and charts ... */}
      
      {/* Add Distribution Tracking Section */}
      {poolData?.[1]?.icp_swap_canister_id && (
        <Suspense fallback={<UnifiedSkeleton variant="card" rows={10} />}>
          <div className="mt-12">
            <div className="terminal-pure mb-6">
              <div className="terminal-header">
                <span className="terminal-prompt">&gt;&gt;</span> distribution_tracking
              </div>
              <div className="terminal-row">
                <span className="terminal-label">protocol:</span>
                <span className="terminal-accent">1%_alexandria | 49.5%_lp_treasury | 49.5%_stakers</span>
              </div>
            </div>
            <DistributionTracker icpSwapCanisterId={poolData[1].icp_swap_canister_id} />
          </div>
        </Suspense>
      )}
    </div>
  );
};
```

### 7. Add Utility Functions

**File**: `src/lbry_fun_frontend/src/features/swap/utils/distributionUtils.ts`

```typescript
import { TokenConversionService } from "@/utils/TokenConversionService";

export const formatDistributionAmount = (amount: bigint): string => {
  return TokenConversionService.displayE8sAsIcp(Number(amount));
};

export const calculatePercentage = (part: bigint, total: bigint): number => {
  if (total === 0n) return 0;
  return Number((part * 10000n) / total) / 100;
};

export const formatLpProvisionStatus = (status: LpProvisionStatus): {
  text: string;
  className: string;
} => {
  if ('Pending' in status) {
    return { text: 'PENDING', className: 'terminal-status-loading' };
  }
  if ('Success' in status) {
    return { text: 'SUCCESS', className: 'terminal-status-success' };
  }
  if ('Failed' in status) {
    return { text: 'FAILED', className: 'terminal-status-error' };
  }
  return { text: 'UNKNOWN', className: 'terminal-accent' };
};

export const getNextDistributionTime = (intervalSeconds: bigint): Date => {
  const now = Date.now();
  const intervalMs = Number(intervalSeconds) * 1000;
  const nextTime = Math.ceil(now / intervalMs) * intervalMs;
  return new Date(nextTime);
};
```

### 8. Add Custom Styling

**File**: `src/styles/terminal.css`

Add distribution-specific styles:

```css
/* Distribution tracking styles */
.terminal-distribution-card {
  @apply terminal-pure mb-4 hover:border-terminal-primary transition-colors;
}

.terminal-distribution-timeline {
  position: relative;
  padding-left: 2rem;
}

.terminal-distribution-timeline::before {
  content: '';
  position: absolute;
  left: 0.5rem;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--terminal-accent);
  opacity: 0.3;
}

.terminal-distribution-event {
  position: relative;
  @apply mb-4;
}

.terminal-distribution-event::before {
  content: '>';
  position: absolute;
  left: -1.5rem;
  @apply text-terminal-primary;
}

.terminal-pool-badge {
  @apply inline-block px-2 py-1 text-xs font-mono uppercase;
}

.terminal-pool-badge-alexandria {
  @apply bg-purple-900/30 text-purple-400 border border-purple-700;
}

.terminal-pool-badge-lp {
  @apply bg-blue-900/30 text-blue-400 border border-blue-700;
}

.terminal-pool-badge-stakers {
  @apply bg-green-900/30 text-green-400 border border-green-700;
}
```

## Implementation Steps

### Phase 1: Backend Integration (2 days)
1. Add type definitions for distribution data
2. Create distribution thunks with proper error handling
3. Update Redux slice with new state and reducers
4. Add utility functions for formatting and calculations

### Phase 2: Component Development (3 days)
1. Create DistributionTracker container component
2. Build DistributionOverview with cycle info
3. Implement PoolAllocationChart with terminal styling
4. Create DistributionEventTimeline with expandable cards
5. Add loading and error states

### Phase 3: Integration & Polish (2 days)
1. Integrate into Insights tab
2. Add real-time updates using periodic polling
3. Implement pagination for event history
4. Add tooltips and help text
5. Test with various pool states

### Phase 4: Performance Optimization (1 day)
1. Implement request deduplication for distribution queries
2. Add caching for distribution summary (5-minute TTL)
3. Lazy load chart library
4. Optimize re-renders with React.memo

## Visual Design

The distribution tracking will maintain the cypherpunk terminal aesthetic:

1. **ASCII Headers**: Distribution sections will have ASCII art dividers
2. **Monospace Typography**: All text uses the terminal font
3. **Color Coding**: 
   - Alexandria: Purple accents (#9333ea)
   - LP Treasury: Blue accents (#3b82f6)
   - Stakers: Green accents (#10b981)
4. **Animation**: Subtle flicker effects on updates
5. **Interactive Elements**: Expandable event cards with smooth transitions

## Testing Considerations

1. **Unit Tests**: Test utility functions and formatters
2. **Integration Tests**: Verify thunk behavior with mock actors
3. **E2E Tests**: Test full user flow from tab click to data display
4. **Edge Cases**:
   - No distributions yet
   - Failed LP provisions
   - Large distribution amounts
   - Network errors

## Migration Notes

- No breaking changes to existing functionality
- Distribution tracking is additive only
- Backward compatible with pools created before this feature
- Gracefully handles missing distribution data

## Future Enhancements

1. **Export Functionality**: Download distribution history as CSV
2. **Notifications**: Alert users when distributions occur
3. **Historical Analysis**: Trends and patterns over time
4. **Pool Comparison**: Compare distribution efficiency across pools

This implementation ensures complete transparency in the distribution system while maintaining the existing terminal aesthetic and performance standards of the LBRY Fun platform.