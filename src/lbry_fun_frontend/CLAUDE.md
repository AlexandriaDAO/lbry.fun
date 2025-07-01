# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Recent Performance Optimizations

### Completed Optimizations (2025-06-17)
1. **Skeleton Loaders**: Added to Swap and Stake tabs for immediate UI rendering
2. **Request Deduplication**: Middleware prevents duplicate API calls  
3. **ICP Price Caching**: Fixed duplicate fetches (was 4+, now 1 with 5-min cache)
4. **Burn Calculation Fix**: Frontend now matches backend logic (no 50% reserve for burns)
5. **Performance Monitoring**: Added metrics tracking in development mode

### Key Architectural Improvements
- Progressive loading: UI shows immediately with skeleton loaders
- Request deduplication middleware in Redux store
- Performance monitoring utility for tracking data fetch times
- Fixed burn validation to match backend expectations

## Frontend Architecture

This is a React TypeScript frontend for a crypto token launchpad built on the Internet Computer blockchain. The application uses a feature-based architecture with Redux Toolkit for state management.

### Key Architecture Patterns

**Feature-Based Structure**: Code is organized by features (`/src/features/`) rather than by file type:
- `auth/` - Authentication and wallet connection
- `icp-ledger/` - ICP token operations 
- `swap/` - Main token trading interface with tabs for balance, swap, burn, stake, etc.
- `token/` - Token creation and pool management

**Actor Pattern for Blockchain Integration**: 
- Each canister type has its own Actor component in `/src/actors/`
- Context providers in `/src/contexts/actors/` manage actor instances
- Uses `ic-use-actor` library for Internet Computer integration
- Identity management through Internet Identity provider

**Redux Architecture**:
- Feature slices with async thunks for blockchain operations
- Separate thunks directory structure within each feature
- State management for UI, authentication, and blockchain data

**Component Organization**:
- Reusable UI components in `/src/lib/components/` (shadcn/ui based)
- Feature-specific components nested within feature directories
- Layout components in `/src/layouts/` for different page structures

### Key Integration Points

**Blockchain Actors**: Main canister actors are:
- `LbryFunActor` - Core platform functions
- `IcpSwapActor` - Token swapping operations  
- `TokenomicsActor` - Supply dynamics and mint rates

### Token Value Conversions

**Standard Pattern** (follows core repository):
- Convert to E8S in thunks: `BigInt(amount * 10**8)`
- Exception: `burn_secondary` - send natural units
- Tokenomics preview has mixed handling (see `UnifiedTokenomicsGraphs.tsx`)

**State Management Flow**:
1. Components dispatch thunks
2. Thunks call actor methods
3. Results update Redux state
4. Components re-render with new state

### Routing Structure

Uses React Router with nested routes:
- `/` - Token creation page
- `/swap/*` - Multi-tab swap interface (balance, swap, burn, stake, etc.)
- Authentication guard wraps all routes
- Lazy-loaded pages with suspense

### Development Notes

- Uses Tailwind CSS for styling
- Uses Shadcn components wherever possible
- Internet Identity for authentication
- FontAwesome icons
- Theme provider for dark/light mode
- Error boundaries for resilient UX
- Loading states managed through Redux and UI slice