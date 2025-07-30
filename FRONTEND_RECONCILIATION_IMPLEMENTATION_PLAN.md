# Frontend Treasury Implementation Plan

## Context

The LBRY Fun platform recently implemented backend capabilities to provide transparency into token treasuries and fee distribution. Users need visibility into:
- **Treasury Balances**: How much ICP is waiting to be distributed to stakers
- **Pending Rewards**: Unclaimed rewards that stakers can collect
- **Collection Health**: How efficiently fees are being collected and distributed
- **Token Health**: Which tokens are performing well vs having issues

This frontend implementation will display treasury and distribution data through a new "TREASURY" tab in the Analytics Terminal, giving users insight into the financial health of their tokens.

## Executive Summary

This document outlines the implementation plan for adding a Treasury display to the LBRY Fun frontend. The backend now provides comprehensive queries that track treasury balances, fee collection, and token health. The frontend needs a user-friendly display that shows users where their ICP is and when it will be distributed.

## Architecture Overview

### Integration Point
- Add a new "TREASURY" tab to the existing AnalyticsTerminal component
- This places the treasury data alongside existing analytics tabs (INSIGHTS, TOKENOMICS, TECHNICAL)
- No new pages or complex navigation required

### Data Sources
The treasury data comes from four query endpoints that provide financial transparency:

1. **LBRY Fun Canister** (main platform canister):
   - `get_system_reconciliation()` - Returns `SystemReconciliationSummary`:
     - `total_uncollected_alex` - Platform-wide pending ALEX fees
     - `total_uncollected_lp` - Platform-wide pending LP fees
     - `tokens_with_discrepancies` - List of tokens with balance issues
   
   - `get_collection_metrics()` - Returns `CollectionMetrics`:
     - `total_accumulated_icp` - Total ICP ever collected
     - `total_burned_lbry` - Total LBRY tokens burned
     - `collection_efficiency_basis_points` - How well collection is working
     - `last_successful_collection` - Timestamp of last collection
     - `failed_collections_24h` - Recent collection failures
   
   - `get_token_health_summary()` - Returns `TokenHealthSummary`:
     - `healthy_tokens` - Count of properly functioning tokens
     - `unhealthy_tokens` - Count of tokens with issues
     - `stagnant_tokens` - Tokens not collecting fees properly
   
   - `get_token_reconciliation(token_id: u64)` - Returns `Result<ReconciliationDetail, string>`:
     - Success case contains `ReconciliationStatus` with:
       - **User-Friendly Data**:
         - `reward_pool` - ICP waiting to be distributed to stakers
         - `total_staked` - ICP locked in staking positions
         - `uncollected_alex_fees + uncollected_lp_fees` - Pending collection
       - **Developer-Friendly Data**:
         - `icp_balance_actual` vs `icp_balance_expected` - Balance comparison
         - `discrepancy_e8s` - Exact difference (positive or negative)
         - `operational_balance` - ICP reserved for operations
         - `requires_attention` - Boolean flag for issues
         - `operational_balance_suspicious` - Flag for unusually high operational balance

**Important Notes**:
- All these queries are read-only and don't modify any state
- The types for these queries are already auto-generated in `/src/declarations/lbry_fun/lbry_fun.did.d.ts`
- The `getLbryFunActor()` function from `/src/features/auth/utils/authUtils.ts` is used to create the actor instance

## Implementation Details

### 1. Type Definitions
The TypeScript types are already auto-generated in `/src/declarations/` from the Candid files:

```typescript
// Key types from lbry_fun.did.d.ts
interface ReconciliationStatus {
  operational_balance_suspicious: boolean;
  canister_id: Principal;
  total_staked: bigint;
  uncollected_lp_fees: bigint;
  icp_balance_expected: bigint;
  discrepancy_e8s: bigint;
  icp_balance_actual: bigint;
  reward_pool: bigint;
  uncollected_alex_fees: bigint;
  timestamp: bigint;
  requires_attention: boolean;
  operational_balance: bigint;
}

interface SystemReconciliationSummary {
  tokens_with_discrepancies: Array<Principal>;
  total_uncollected_alex: bigint;
  total_expected_fees: bigint;
  timestamp: bigint;
  total_uncollected_lp: bigint;
}

interface CollectionMetrics {
  last_successful_collection: bigint;
  collection_efficiency_basis_points: number;
  failed_collections_24h: number;
  total_accumulated_icp: bigint;
  average_collection_interval: bigint;
  total_burned_lbry: bigint;
}

interface TokenHealthSummary {
  healthy_tokens: number;
  unhealthy_tokens: number;
  stagnant_tokens: Array<Principal>;
  tokens_with_failures: Array<TokenFailureInfo>;
}

interface ReconciliationDetail {
  token_id: Principal;
  icp_swap_canister: Principal;
  reconciliation: ReconciliationStatus;
}

// Result type for get_token_reconciliation
type Result_5 = { 'Ok': ReconciliationDetail } | { 'Err': string };
```

### 2. Create Formatting Utilities

**File**: `/src/utils/treasury.ts`

**Purpose**: Reusable formatting functions for treasury data

```typescript
export const formatE8sToICP = (e8s: bigint): string => {
  return (Number(e8s) / 1e8).toFixed(8);
};

export const formatDiscrepancy = (e8s: bigint): string => {
  const icp = Number(e8s) / 1e8;
  const prefix = e8s > 0n ? '+' : '';
  return `${prefix}${icp.toFixed(8)} ICP`;
};

export const formatBasisPoints = (bp: number): string => {
  return (bp / 10000).toFixed(2) + '%';
};

export const formatNanoTimestamp = (ns: bigint): string => {
  const date = new Date(Number(ns) / 1_000_000);
  return date.toLocaleString();
};

export const getHealthColor = (status: 'healthy' | 'warning' | 'error'): string => {
  const colors = {
    healthy: 'text-lime-400',
    warning: 'text-amber-400',
    error: 'text-red-400'
  };
  return colors[status];
};
```

### 3. New Component: TreasuryTab

**File**: `/src/features/swap/components/TreasuryTab.tsx`

**Purpose**: Display treasury balances and distribution data in a user-friendly format

**State Management**: Use local component state (not Redux) for read-only treasury data:
```typescript
interface TreasuryState {
  systemReconciliation: SystemReconciliationSummary | null;
  collectionMetrics: CollectionMetrics | null;
  tokenHealth: TokenHealthSummary | null;
  tokenReconciliation: ReconciliationDetail | null;
  isLoading: boolean;
  error: string | null;
  dataLoadStatus: {
    system: boolean;
    metrics: boolean;
    health: boolean;
    token: boolean;
  };
}
```

**Key Features**:
- Progressive loading - show data as it arrives
- Manual refresh button with 30-second cooldown
- Error boundary wrapper for crash prevention
- Dual-purpose display combining user-friendly and developer-friendly data
- Displays three main sections:
  1. **Token Treasury** (Priority 1) - Shows:
     - User-friendly: ICP awaiting distribution, reserved for stakers, pending collection
     - Developer-friendly: Expected vs actual balance discrepancies (shown when issues detected)
  2. **Distribution Metrics** (Priority 2) - Total ICP collected and burned LBRY
  3. **System Overview** (Priority 3) - Platform-wide health and fee collection status

**Data Sources from Backend**:
- `ReconciliationStatus` provides:
  - `reward_pool` → "Reward Pool (Awaiting Distribution)"
  - `total_staked` → "Reserved for Stakers"
  - `uncollected_alex_fees + uncollected_lp_fees` → "Pending Collection"
  - `icp_balance_actual` vs `icp_balance_expected` → Discrepancy alerts
  - `discrepancy_e8s` → Exact difference for developers
  - `operational_balance_suspicious` → Operational balance warnings
- `CollectionMetrics` provides distribution history and efficiency
- `TokenHealthSummary` provides system-wide health status

**Why This Dual Approach Works**:
- **For Regular Users**: Primary display shows treasury balances in clear terms
- **For Developers/Advanced Users**: Reconciliation details appear when issues are detected or can be toggled
- **Automatic Escalation**: Developer details only shown when `requires_attention` is true

**Data Display**:
- Format E8S values to human-readable ICP (divide by 1e8)
- Convert timestamps from nanoseconds to readable dates
- Show basis points as percentages (divide by 10000) - e.g., 5000 basis points = 50%
- Highlight values with terminal color scheme:
  - `text-lime-400`: Healthy/positive values (e.g., high efficiency)
  - `text-amber-400`: Warnings (e.g., pending collections)
  - `text-red-400`: Issues requiring attention
  - `text-gray-400`: Normal/neutral values

### 4. Update AnalyticsTerminal

**File**: `/src/features/swap/components/terminals/AnalyticsTerminal.tsx`

**Changes**:
1. Add 'treasury' to the AnalyticsView type union
2. Add TREASURY button to the tab navigation
3. Lazy load the TreasuryTab component
4. Add case in renderActiveView() switch statement

```typescript
// Add to imports
const TreasuryTab = lazy(() => import('../TreasuryTab'));

// Update type
type AnalyticsView = 'insights' | 'tokenomics' | 'technical' | 'treasury';

// Update navigation buttons array
['insights', 'tokenomics', 'technical', 'treasury']

// Add case to switch
case 'treasury':
  return (
    <Suspense fallback={<UnifiedSkeleton variant="card" rows={5} />}>
      <TreasuryTab />
    </Suspense>
  );
```

### 5. Data Fetching Logic

**Getting the Token ID**:
The token ID is available from the activeSwapPool state in Redux. The activeSwapPool is a tuple of `[bigint, TokenRecord]` where the first element is the token ID:
```typescript
// Get activeSwapPool from Redux using useAppSelector hook
const { activeSwapPool } = useAppSelector(state => state.swap);

// Safe extraction with optional chaining
const tokenId = activeSwapPool?.[0]; // This is the u64 token ID (bigint)

if (!activeSwapPool || !tokenId) {
  return (
    <div className="text-gray-400 text-center py-8">
      No active token pool selected
    </div>
  );
}
```

**Progressive Data Fetching**:
Fetch data in parallel and update UI as each piece arrives:
```typescript
useEffect(() => {
  const fetchData = async () => {
    if (!activeSwapPool) return;
    
    const tokenId = activeSwapPool[0];
    const actor = await getLbryFunActor();
    
    // Fetch system-wide data (don't wait for token-specific data)
    Promise.all([
      actor.get_system_reconciliation(),
      actor.get_collection_metrics(),
      actor.get_token_health_summary()
    ]).then(([systemRecon, metrics, health]) => {
      setSystemReconciliation(systemRecon);
      setCollectionMetrics(metrics);
      setTokenHealth(health);
      setDataLoadStatus(prev => ({ ...prev, system: true, metrics: true, health: true }));
    }).catch(err => {
      console.error('Failed to fetch system data:', err);
    });
    
    // Fetch token-specific data separately
    actor.get_token_reconciliation(tokenId)
      .then(result => {
        if ('Ok' in result) {
          setTokenReconciliation(result.Ok);
          setDataLoadStatus(prev => ({ ...prev, token: true }));
        } else {
          setError(`Token reconciliation error: ${result.Err}`);
        }
      })
      .catch(err => {
        console.error('Failed to fetch token data:', err);
        setError('Failed to fetch token reconciliation data');
      });
  };
  
  fetchData();
}, [activeSwapPool]);
```

**Refresh Logic**:
```typescript
const [lastRefresh, setLastRefresh] = useState(Date.now());
const canRefresh = Date.now() - lastRefresh > 30000; // 30 second cooldown

const handleRefresh = () => {
  if (canRefresh) {
    setIsLoading(true);
    setError(null);
    fetchData();
    setLastRefresh(Date.now());
  }
};
```

### 6. UI/UX Implementation Details

**Component Structure**:
```typescript
return (
  <div className="space-y-6">
    {/* Show data progressively as it loads */}
    
    {/* Token Treasury - Priority 1 */}
    {dataLoadStatus.token && tokenReconciliation && (
      <div className="terminal-section">
        <div className="terminal-header mb-3">
          <span className="terminal-prompt">&gt;&gt;</span> TOKEN TREASURY
        </div>
        <div className="space-y-2">
          {/* Key treasury information users care about */}
          <div className="terminal-row">
            <span className="terminal-label">Reward Pool (Awaiting Distribution):</span>
            <span className="terminal-value text-lime-400">
              {formatE8sToICP(tokenReconciliation.reconciliation.reward_pool)} ICP
            </span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">Reserved for Stakers:</span>
            <span className="terminal-value">
              {formatE8sToICP(tokenReconciliation.reconciliation.total_staked)} ICP
            </span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">Pending Collection:</span>
            <span className="terminal-value text-amber-400">
              {formatE8sToICP(tokenReconciliation.reconciliation.uncollected_alex_fees + 
                             tokenReconciliation.reconciliation.uncollected_lp_fees)} ICP
            </span>
          </div>
          {/* Show health indicator if there are issues */}
          {tokenReconciliation.reconciliation.requires_attention && (
            <div className="terminal-row">
              <span className="terminal-label">Status:</span>
              <span className="terminal-value text-red-400">⚠️ Attention Required</span>
            </div>
          )}
          
          {/* Developer-friendly reconciliation details (show on expand or if discrepancy exists) */}
          {(tokenReconciliation.reconciliation.requires_attention || showAdvanced) && (
            <>
              <div className="terminal-divider-single my-2" />
              <div className="text-xs space-y-1 text-gray-500">
                <div className="flex justify-between">
                  <span>Expected Balance:</span>
                  <span>{formatE8sToICP(tokenReconciliation.reconciliation.icp_balance_expected)} ICP</span>
                </div>
                <div className="flex justify-between">
                  <span>Actual Balance:</span>
                  <span>{formatE8sToICP(tokenReconciliation.reconciliation.icp_balance_actual)} ICP</span>
                </div>
                <div className="flex justify-between">
                  <span>Discrepancy:</span>
                  <span className={tokenReconciliation.reconciliation.requires_attention ? 'text-red-400' : 'text-gray-400'}>
                    {formatDiscrepancy(tokenReconciliation.reconciliation.discrepancy_e8s)}
                  </span>
                </div>
                {tokenReconciliation.reconciliation.operational_balance_suspicious && (
                  <div className="flex justify-between">
                    <span>Operational Balance:</span>
                    <span className="text-amber-400">
                      {formatE8sToICP(tokenReconciliation.reconciliation.operational_balance)} ICP (High)
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    )}
    
    {/* Distribution Metrics - Priority 2 */}
    {dataLoadStatus.metrics && collectionMetrics && (
      <div className="terminal-section">
        <div className="terminal-header mb-3">
          <span className="terminal-prompt">&gt;&gt;</span> DISTRIBUTION METRICS
        </div>
        <div className="space-y-2">
          <div className="terminal-row">
            <span className="terminal-label">Total ICP Distributed:</span>
            <span className="terminal-value">
              {formatE8sToICP(collectionMetrics.total_accumulated_icp)} ICP
            </span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">Total LBRY Burned:</span>
            <span className="terminal-value">
              {formatE8sToICP(collectionMetrics.total_burned_lbry)} LBRY
            </span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">Collection Efficiency:</span>
            <span className={`terminal-value ${
              collectionMetrics.collection_efficiency_basis_points > 9000 
                ? 'text-lime-400' 
                : 'text-amber-400'
            }`}>
              {formatBasisPoints(collectionMetrics.collection_efficiency_basis_points)}
            </span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">Next Distribution:</span>
            <span className="terminal-value">
              {/* Calculate time until next distribution based on interval */}
              In ~1 hour
            </span>
          </div>
        </div>
      </div>
    )}
    
    {/* System Overview - Priority 3 */}
    {dataLoadStatus.system && systemReconciliation && tokenHealth && (
      <div className="terminal-section">
        <div className="terminal-header mb-3">
          <span className="terminal-prompt">&gt;&gt;</span> SYSTEM OVERVIEW
        </div>
        <div className="space-y-2">
          <div className="terminal-row">
            <span className="terminal-label">Platform-wide Pending Fees:</span>
            <span className="terminal-value">
              {formatE8sToICP(systemReconciliation.total_uncollected_alex + 
                             systemReconciliation.total_uncollected_lp)} ICP
            </span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">Healthy Tokens:</span>
            <span className="terminal-value text-lime-400">
              {tokenHealth.healthy_tokens} / {tokenHealth.healthy_tokens + tokenHealth.unhealthy_tokens}
            </span>
          </div>
        </div>
      </div>
    )}
  </div>
);
```

**Styling Classes**:
- Container: `terminal-pure terminal-flicker p-4`
- Headers: `terminal-header terminal-boot`
- Dividers: `terminal-divider-single`
- Data rows: `flex justify-between items-center`
- Labels: `terminal-label`
- Values: `terminal-value` with color modifiers

**Loading States**:
```typescript
if (isLoading && Object.values(dataLoadStatus).every(v => !v)) {
  return (
    <div className="flex items-center justify-center h-64">
      <LoaderCircle className="animate-spin text-primary" size={48} />
    </div>
  );
}
```

**Error States**:
```typescript
if (error && !Object.values(dataLoadStatus).some(v => v)) {
  return (
    <div className="terminal-section">
      <div className="terminal-status text-red-400">[ERROR]</div>
      <p className="mt-2 text-gray-400">{error}</p>
      <button onClick={handleRefresh} className="mt-4 terminal-button">
        Retry
      </button>
    </div>
  );
}
```

### 7. Error Handling and Edge Cases

**Error Boundary**:
Wrap the TreasuryTab in an error boundary to prevent crashes:
```typescript
<ErrorBoundary fallback={<TerminalError message="Treasury data unavailable" />}>
  <TreasuryTab />
</ErrorBoundary>
```

**Edge Cases to Handle**:
1. Missing activeSwapPool - Show empty state
2. Query failures - Show partial data if some queries succeed
3. Network errors - Provide retry mechanism
4. Invalid data formats - Use defensive programming with optional chaining
5. BigInt conversion errors - Wrap in try-catch when converting to numbers

### 8. Data Flow

```
Component Mount
    ↓
Check activeSwapPool exists (show empty state if not)
    ↓
Extract token ID from activeSwapPool[0] with safe optional chaining
    ↓
Get LBRY Fun actor using getLbryFunActor() from authUtils
    ↓
Progressive parallel fetch:
├── System-wide queries (don't block UI):
│   ├── get_system_reconciliation()
│   ├── get_collection_metrics()
│   └── get_token_health_summary()
│
└── Token-specific query (separate promise):
    └── get_token_reconciliation(tokenId: u64)
        ↓
    Handle Result<ReconciliationDetail, string> type
    ↓
Update dataLoadStatus as each query completes
    ↓
Render sections progressively as data arrives
```

### 9. Performance Optimizations

- Use React.memo() on ReconciliationTab to prevent unnecessary re-renders
- Lazy load the component only when tab is selected
- Fetch all data in parallel using Promise.all()
- Cache actor instances to avoid recreation

## Implementation Steps

### Phase 1: Foundation
1. **Create formatting utilities** (`/src/utils/treasury.ts`)
   - Implement all formatting functions with proper TypeScript types
   - Export functions for reuse across components

### Phase 2: Component Development
2. **Build TreasuryTab component** (`/src/features/swap/components/TreasuryTab.tsx`)
   - Create component file with TypeScript interfaces
   - Implement local state management
   - Add data fetching logic with progressive loading
   - Implement all three user-focused sections:
     - Token Treasury (reward pool, staking reserves, pending fees)
     - Distribution Metrics (total distributed, efficiency, next distribution time)
     - System Overview (platform health summary)
   - Add refresh functionality with cooldown
   - Handle all edge cases and errors

3. **Style the component**
   - Apply terminal styling classes for consistency
   - Use color coding to highlight important information:
     - Green (`text-lime-400`) for positive/healthy values
     - Amber (`text-amber-400`) for pending/warning states
     - Red (`text-red-400`) for issues requiring attention
   - Ensure responsive layout
   - Add loading and error states

### Phase 3: Integration
4. **Update AnalyticsTerminal**
   - Add 'treasury' to AnalyticsView type
   - Import TreasuryTab with lazy loading
   - Add TREASURY button to navigation array
   - Update renderActiveView switch statement
   - Wrap in error boundary

## Future Enhancements

1. **Countdown Timer** - Live countdown to next distribution cycle
2. **Historical Charts** - Show treasury balance trends over time
3. **Export Functionality** - Download treasury reports as CSV/PDF
4. **Distribution Notifications** - Alert when new rewards are distributed
5. **Staking Calculator** - Estimate rewards based on stake amount

## Security Considerations

- All data is read-only from query methods
- No state modifications possible
- No sensitive financial data exposed
- Treasury data is public information on the blockchain

## Key Technical Details

1. **Token ID Type**: Use `u64` (bigint in TypeScript), not Principal
2. **Query Method**: Call `get_token_reconciliation(tokenId)` on LBRY Fun actor
3. **Result Handling**: Must handle Result<ReconciliationDetail, string> return type
4. **Basis Points**: Divide by 10,000 for percentage conversion
5. **Token ID Source**: Extract from `activeSwapPool[0]`
6. **ReconciliationDetail**: Wrapper type that contains the ReconciliationStatus

## Production Readiness Checklist

Before deployment, ensure:

- [ ] Component displays user-friendly labels (not technical jargon)
- [ ] Treasury values are clearly explained (what they mean for users)
- [ ] Loading states show for all async operations
- [ ] Error messages help users understand what went wrong
- [ ] BigInt to number conversions are wrapped in try-catch
- [ ] Progressive loading provides immediate value
- [ ] Refresh button has visual feedback
- [ ] Terminal styling matches existing components
- [ ] Mobile responsive design works properly
- [ ] Empty states guide users appropriately

## Conclusion

This implementation transforms technical reconciliation data into a user-friendly Treasury view that provides real value to token holders. By focusing on what users care about - how much ICP is available for distribution, when it will be distributed, and whether their token is healthy - we create a feature that enhances transparency and builds trust.

The Treasury tab answers key user questions:
- "How much ICP is waiting to be distributed to me?"
- "How much is reserved for stakers?"
- "Is fee collection working properly?"
- "When is the next distribution?"

By integrating seamlessly into the AnalyticsTerminal and using familiar terminal styling, the feature feels like a natural extension of the platform rather than a technical add-on.

## Implementation Review

### Changes Made

1. **Created Treasury Utilities** (`/src/lbry_fun_frontend/src/utils/treasury.ts`):
   - `formatE8sToICP`: Converts E8S bigints to human-readable ICP values
   - `formatDiscrepancy`: Formats balance differences with appropriate +/- signs
   - `formatBasisPoints`: Converts basis points to percentages
   - `formatNanoTimestamp`: Converts nanosecond timestamps to readable dates
   - `calculateTimeUntilNextDistribution`: Calculates time remaining until next distribution
   - `getHealthColor`: Returns appropriate terminal color classes for health states

2. **Built TreasuryTab Component** (`/src/lbry_fun_frontend/src/features/swap/components/TreasuryTab.tsx`):
   - Implements progressive loading to show data as it arrives
   - Fetches from 4 backend queries in parallel
   - Displays user-friendly treasury information first
   - Includes toggleable advanced reconciliation details
   - Handles all edge cases (no pool selected, loading states, errors)
   - Includes refresh functionality with 30-second cooldown
   - Uses terminal styling consistent with existing components

3. **Updated AnalyticsTerminal** (`/src/lbry_fun_frontend/src/features/swap/components/terminals/AnalyticsTerminal.tsx`):
   - Added 'treasury' to AnalyticsView type union
   - Imported TreasuryTab with lazy loading
   - Added TREASURY button to navigation tabs
   - Added treasury case to renderActiveView switch statement

### Technical Considerations

- All backend queries are already implemented and available
- Types are auto-generated from Candid files
- Component uses local state rather than Redux (read-only data)
- Progressive loading ensures good UX even with slow network
- Error boundaries prevent crashes from affecting other components
- Terminal styling classes are already available in the CSS

### Next Steps

The implementation is complete and ready for testing. To fully test the feature:

1. Start the local development environment
2. Create a token pool to have an activeSwapPool
3. Navigate to the Analytics Terminal
4. Click the TREASURY tab
5. Verify all data displays correctly
6. Test refresh functionality
7. Toggle advanced details to see reconciliation information