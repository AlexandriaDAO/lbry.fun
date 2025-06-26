# Canister Logs UI Implementation Plan

## Overview
This plan details how to extend the existing Analytics Terminal's Technical tab to add log viewing functionality for spawned canisters, particularly the `icp_swap` canister logs which contain critical liquidity provision debugging information.

## Problem Investigation Summary

### What Was Found:
1. **Liquidity provision occurs in `provide_liquidity_from_treasury()`** (src/icp_swap/src/update.rs:989-1125)
   - Called after each hourly distribution
   - Uses 2% of LP treasury (1% buyback, 1% liquidity)
   - Two paths: bootstrap empty pool vs add to existing pool

2. **Logs are captured but not visible**:
   - `register_info_log()` logs successful operations
   - `register_error_log()` logs failures
   - Stored in icp_swap canister's stable memory
   - Queryable via `get_logs(page, page_size)` method

3. **The core issue**: No way to access these logs from the UI to debug why liquidity isn't increasing

## Context
- **Problem**: Unable to see logs from spawned canisters (especially `icp_swap`) when debugging liquidity pool issues
- **Solution**: Add UI controls to query and display logs without modifying audited backend code
- **Location**: Extend the existing Technical tab at `/swap/analytics?id={poolId}`

## Current Architecture Understanding

### Key Components
1. **InfoCard.tsx** (`/src/lbry_fun_frontend/src/features/swap/components/InfoCard.tsx`): Main container showing canister information
2. **CanisterCycles.tsx**: Component that displays cycles for each canister
3. **activeSwapPool** Redux state: Contains all canister IDs via `TokenRecordStringified`

### Data Flow Pattern
```
Redux Store (activeSwapPool) 
  → Contains canister IDs
  → InfoCard reads these IDs
  → CanisterCycles fetches data for each ID
  → Display results
```

## Implementation Requirements

### 1. Create New Log Viewer Component

**File**: `/src/lbry_fun_frontend/src/features/swap/components/CanisterLogs.tsx`

```typescript
interface CanisterLogsProps {
  canisterId: string;
  canisterName: string;
  canisterType: 'icp_swap' | 'tokenomics';
}
```

This component should:
- Display a "View Logs" button next to each canister's cycles display
- Open a modal/expandable section showing paginated logs
- Support filtering by log type (Info/Error)
- Show timestamps in human-readable format

### 2. Add Actor Methods for Log Queries

**File**: `/src/lbry_fun_frontend/src/actors/icpSwapActor.ts` (new file)

Create actor instances for icp_swap and tokenomics canisters using their DIDs:
- Use `/src/icp_swap/icp_swap.did` interface
- Implement `get_logs(page?: bigint, page_size?: bigint)` method wrapper

### 3. Extend InfoCard Component

**File**: `/src/lbry_fun_frontend/src/features/swap/components/InfoCard.tsx`

Modify the technical view to include log viewing for relevant canisters:
- Add CanisterLogs component for `icp_swap` and `tokenomics` canisters only
- These are the only canisters with the `get_logs` interface

### 4. Log Display Features

The log viewer should display:
- **Log ID**: Sequential identifier
- **Timestamp**: Convert from nanoseconds to readable format (use existing date formatting utilities)
- **Function**: Which function generated the log
- **Type**: Info (green) or Error (red) with appropriate styling
- **Details**: The actual log message or error details
- **Caller**: Principal who triggered the action

### 5. Pagination Controls

Implement pagination since logs can be numerous:
- Default page size: 20 (configurable)
- Show total pages and current page
- Previous/Next buttons
- Jump to page input

## Specific Implementation Steps

### Step 1: Create the Actor Factory
```typescript
// /src/lbry_fun_frontend/src/actors/canisterActorFactory.ts
import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory as icpSwapIdl } from '../../../declarations/icp_swap';
import { idlFactory as tokenomicsIdl } from '../../../declarations/tokenomics';

export const createCanisterActor = (canisterId: string, canisterType: 'icp_swap' | 'tokenomics') => {
  const agent = new HttpAgent({ host: process.env.DFX_NETWORK === 'local' ? 'http://localhost:4943' : 'https://ic0.app' });
  
  const idlFactory = canisterType === 'icp_swap' ? icpSwapIdl : tokenomicsIdl;
  return Actor.createActor(idlFactory, {
    agent,
    canisterId,
  });
};
```

### Step 2: Create Log Types
```typescript
// /src/lbry_fun_frontend/src/types/logs.ts
export interface Log {
  log_id: bigint;
  timestamp: bigint;
  caller: string;
  function: string;
  log_type: LogType;
}

export type LogType = 
  | { Info: { detail: string } }
  | { Error: { error: ExecutionError } };

export interface PaginatedLogs {
  logs: Log[];
  current_page: bigint;
  total_pages: bigint;
  page_size: bigint;
}
```

### Step 3: Implement Log Fetching Hook
```typescript
// /src/lbry_fun_frontend/src/hooks/useCanisterLogs.ts
export const useCanisterLogs = (canisterId: string, canisterType: 'icp_swap' | 'tokenomics') => {
  // Implement React Query hook for fetching logs
  // Handle pagination state
  // Format timestamps using existing utilities
};
```

### Step 4: Style the Log Display
- Use existing Tailwind classes from the project
- Match the dark theme aesthetic
- Error logs should use `text-red-400` 
- Info logs should use `text-green-400`
- Maintain consistency with existing UI patterns

## Error Handling

1. **No Logs Available**: Show "No logs found" message
2. **Failed to Fetch**: Display error with retry button
3. **Invalid Canister**: Gracefully handle if canister doesn't support logs

## Testing Instructions

1. Launch a new token with 1-minute distribution intervals
2. Navigate to Analytics Terminal → Technical tab
3. Click "View Logs" for the icp_swap canister
4. Verify logs appear after distribution events
5. Test pagination with multiple pages of logs
6. Filter between Info and Error logs

## Key Points for Implementation

1. **No Backend Changes**: This implementation only adds frontend functionality
2. **Reuse Patterns**: Follow existing patterns from CanisterCycles component
3. **User Experience**: Make logs easily accessible for debugging
4. **Performance**: Use pagination to avoid loading too many logs at once
5. **Clarity**: Format logs in a developer-friendly way

## Expected Outcome

After implementation, users will be able to:
- View logs from any icp_swap or tokenomics canister directly from the UI
- Debug liquidity provision issues by seeing execution logs
- Identify errors in reward distribution or liquidity addition
- Monitor canister behavior without command-line tools

## Files to Modify/Create

1. **Create**:
   - `/src/lbry_fun_frontend/src/actors/canisterActorFactory.ts`
   - `/src/lbry_fun_frontend/src/features/swap/components/CanisterLogs.tsx`
   - `/src/lbry_fun_frontend/src/hooks/useCanisterLogs.ts`
   - `/src/lbry_fun_frontend/src/types/logs.ts`

2. **Modify**:
   - `/src/lbry_fun_frontend/src/features/swap/components/InfoCard.tsx`

## Additional Notes

- The `get_logs` query method is already exposed in the canister interfaces
- Logs are stored in a circular buffer of 100,000 entries
- Each log entry includes full error details which will help debug LP issues
- Focus on icp_swap logs first as they contain the liquidity provision logic

## Key Log Messages to Look For

When debugging liquidity pool issues, these are the specific log messages from `provide_liquidity_from_treasury()`:

### Success Messages:
- `"Successfully bootstrapped pool with {amount} e8s ICP. Added {lp_tokens} LP tokens."` - Initial pool creation
- `"Successfully deployed {amount} e8s ICP ({percent}% of treasury). Used {tokens} primary tokens (including {accumulated} accumulated), added {lp_amount} to LP."` - Normal LP addition

### Error Messages:
- `"Failed to get primary token symbol: {error}"` - Can't identify token
- `"Failed to get pool reserves: {error}"` - Can't query Kongswap pool
- `"Failed to mint tokens with ICP: {error}"` - Bootstrap minting failed
- `"Failed to add initial liquidity: {error}"` - Bootstrap LP failed
- `"Failed to execute swap on DEX: {error}"` - Buyback failed
- `"Failed to add liquidity: {error}. Saved {tokens} primary tokens for next attempt"` - LP addition failed but tokens saved

These messages will help identify exactly where the liquidity provision process is failing.

## Implementation Review (2025-06-26)

✅ **COMPLETED** - All tasks have been successfully implemented:

1. **Created canister actor factory** (`/src/lbry_fun_frontend/src/actors/canisterActorFactory.ts`)
   - Follows existing patterns from the project
   - Supports both `icp_swap` and `tokenomics` canister types
   - Handles local vs IC environment configuration

2. **Created log types definition** (`/src/lbry_fun_frontend/src/types/logs.ts`)
   - Comprehensive type definitions matching backend interfaces
   - Helper functions for log processing and formatting
   - Type guards for safe type checking

3. **Created useCanisterLogs hook** (`/src/lbry_fun_frontend/src/hooks/useCanisterLogs.ts`)
   - Pagination support with customizable page size
   - Auto-refresh capability (disabled by default)
   - Error handling and loading states
   - Helper hook for processing logs for display

4. **Created CanisterLogs component** (`/src/lbry_fun_frontend/src/features/swap/components/CanisterLogs.tsx`)
   - Terminal-style UI matching project aesthetics
   - Filter controls for Info/Error logs
   - Expandable log entries showing full details
   - Pagination controls with page navigation
   - Manual refresh button

5. **Modified InfoCard component** to include log viewing buttons
   - Added "View Logs" buttons for icp_swap and tokenomics canisters
   - Maintains consistent UI layout

### Key Features Implemented:
- 🔍 **Log Filtering**: Users can filter between All, Info, and Error logs
- 📄 **Pagination**: Navigate through large log sets efficiently
- 🔄 **Manual Refresh**: Update logs on demand
- 📊 **Expandable Details**: Click logs to see full information
- 🎨 **Terminal UI**: Consistent with the cypherpunk design system

### Usage:
1. Navigate to Analytics Terminal → Technical tab
2. Click "View Logs" next to icp_swap or tokenomics canisters
3. Use filters and pagination to find specific logs
4. Click on individual logs to expand and see full details

The implementation successfully enables debugging of liquidity provision issues without requiring backend changes.