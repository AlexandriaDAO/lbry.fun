# Thunk Exploration Summary

## Overview
The frontend has thunks distributed across multiple features, primarily in `token` and `swap` features. There are 32 thunk files in total.

## Directory Structure

### Token Feature Thunks (`/features/token/thunk/`)
- `createToken.thunk.ts` - Creates new tokens
- `fetchTokenLogosForPoolThunk.ts` - Fetches token logos
- `getLiveTokens.thunk.ts` - Gets live tokens
- `getPoolsTvl.thunk.ts` - Gets TVL data for pools from Kongswap
- `getTokenPools.thunk.ts` - Gets all token pools
- `getUpcommingTokens.thunk.ts` - Gets upcoming tokens
- `previewTokenomics.thunk.ts` - Previews tokenomics graphs

### Swap Feature Thunks (`/features/swap/thunks/`)

#### Root Level
- `burnSecondary.ts` - Burns secondary tokens
- `claimReward.ts` - Claims staking rewards
- `fetchTransactionHistory.thunk.ts` - Fetches user transaction history
- `getAllStakesInfo.ts` - Gets all staking information
- `getArchivedBal.ts` - Gets archived balance
- `getAverageApy.ts` - Gets average APY
- `getCanisterArchivedBal.ts` - Gets canister archived balance
- `getSecondaryratio.ts` - Gets secondary token ratio
- `getStakedInfo.ts` - Gets staking info for user
- `getStakersCount.ts` - Gets count of stakers
- `redeemArchivedBalance.ts` - Redeems archived balance
- `stakePrimary.ts` - Stakes primary tokens
- `swapSecondary.ts` - Swaps secondary tokens
- `transferICPFromUserWallet.ts` - Transfers ICP from user wallet
- `unstake.ts` - Unstakes primary tokens

#### Insights Subdirectory
- `getAllLogs.thunk.ts` - Gets all logs from logs canister

#### Primary ICRC Subdirectory
- `getAccountPrimaryBalance.ts` - Gets primary token balance
- `getPrimaryFee.ts` - Gets primary token fee
- `getPrimaryPrice.ts` - Gets primary token price
- `transferPrimary.ts` - Transfers primary tokens

#### Secondary ICRC Subdirectory
- `getSecondaryBalance.ts` - Gets secondary token balance
- `getSecondaryFee.ts` - Gets secondary token fee
- `transferSecondary.ts` - Transfers secondary tokens

#### Tokenomics Subdirectory
- `getPrimaryMintRate.ts` - Gets primary minting rate
- `getTokenomicsInfo.ts` - Gets tokenomics information
- `getTotalPrimarySupply.ts` - Gets total primary supply

### ICP Ledger Thunks (`/features/icp-ledger/thunks/`)
- `getAccountId.ts` - Gets account ID
- `getCanisterBal.ts` - Gets canister balance
- `getIcpBal.ts` - Gets ICP balance
- `getIcpPrice.ts` - Gets ICP price
- `transferICP.ts` - Transfers ICP

## Common Patterns

### 1. Consistent Thunk Structure
All thunks use Redux Toolkit's `createAsyncThunk` with:
- First type parameter: Return type
- Second type parameter: Arguments
- Third type parameter: Config with `state` and/or `rejectValue`

### 2. Error Handling
- Most thunks use `rejectWithValue` with `ErrorMessage` type
- Common error structure: `{ title: string, message: string }`
- Centralized error handling in `/features/swap/utlis/erorrs.ts`

### 3. Common Dependencies

#### Actors (from `authUtils.ts`)
- `getLbryFunActor()` - Main launchpad actor
- `getIcpLedgerActor()` - ICP ledger actor
- `getICRCActor(canisterId)` - Generic ICRC token actor
- `getActorSwap(canisterId)` - ICP swap actor
- `getTokenomicsActor(canisterId)` - Tokenomics actor
- `createLogsActor(canisterId)` - Logs actor

#### Utilities
- `TokenConversionService` - Handles E8S conversions
- `Principal` from `@dfinity/principal` - Principal handling
- `KongswapService` - Interacts with Kongswap

### 4. Naming Conventions
- Most files use camelCase: `burnSecondary.ts`
- Some use `.thunk.ts` suffix: `fetchTransactionHistory.thunk.ts`
- Inconsistent naming pattern should be standardized

### 5. State Dependencies
Many thunks depend on Redux state:
- `state.swap.activeSwapPool` - Current active pool
- `state.swap.secondaryRatio` - Secondary token ratio
- `state.swap.secondaryFee` - Secondary token fee
- `state.icpLedger.icpPrice` - ICP price

### 6. Side Effects
Several thunks dispatch other thunks after completion:
- `burnSecondary` dispatches `getCanisterBal` and `getCanisterArchivedBal`
- `getTokenPools` dispatches `fetchTokenLogosForPool` for each pool
- `getLiveTokens` dispatches `fetchTokenLogosForPool` for each token

## Potential Issues

### 1. Circular Dependencies
No direct circular dependencies found, but complex interdependencies exist:
- Token thunks dispatch logo fetching
- Swap thunks dispatch balance updates
- Some thunks import types from other thunk files

### 2. Inconsistent File Organization
- Some thunks are in subdirectories, others at root level
- Naming convention varies (`.thunk.ts` vs `.ts`)
- Token thunks in `thunk/` directory (singular) vs swap thunks in `thunks/` (plural)

### 3. Type Duplication
- `TokenRecordStringified` type is defined in `getTokenPools.thunk.ts` but imported by others
- Some types could be centralized

### 4. Error Handling Inconsistency
- Some thunks have detailed error handling
- Others have generic "Unknown Error" fallbacks
- Certificate errors have retry logic only in `getAllLogs.thunk.ts`

## Consolidation Recommendations

1. **Standardize Directory Structure**
   - Move all thunks to consistent directories
   - Use consistent naming (all `.thunk.ts` or none)

2. **Centralize Common Types**
   - Create a `types/` directory for shared types
   - Move `TokenRecordStringified` and similar to central location

3. **Extract Common Patterns**
   - Create utility functions for actor initialization with error handling
   - Standardize error handling and retry logic
   - Create helper for dispatching follow-up thunks

4. **Group by Domain**
   - Consider grouping by business domain rather than technical structure
   - E.g., all staking-related thunks together, all token-info thunks together

5. **Improve Type Safety**
   - Use more specific types for canister IDs
   - Create branded types for E8S vs natural units
   - Add runtime validation for critical values