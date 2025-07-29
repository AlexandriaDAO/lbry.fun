# ALEX Rewards Implementation Change Log

## Overview
This document tracks all changes made to implement the ALEX staker rewards system as specified in ALEX_STAKER_REWARDS_PLAN.md.

## ICP Swap Canister Changes

### Storage (src/icp_swap/src/storage.rs)
- Added new memory IDs (12-14) for reward system storage
- Added `UNCOLLECTED_ALEX_FEES` stable storage for tracking uncollected fees for ALEX stakers
- Added `UNCOLLECTED_LP_FEES` stable storage for tracking uncollected fees for LP providers
- Added `REWARD_POOL` stable storage for segregated reward pool funds
- Added getter functions for all new storage structures

### Reward Distribution (src/icp_swap/src/update.rs)
- Replaced existing `distribute_reward` function with new implementation following the 1% of 1% model
- New `distribute_reward` function:
  - Calculates 1% of reward pool per interval
  - Splits distribution: 1% to ALEX stakers (via lbry_fun), 99% to LP providers
  - Updates uncollected fees atomically
  - Returns early if pool is empty or distribution amount too small
- Renamed original function to `distribute_reward_to_stakers` for legacy support

### Collection Endpoints (src/icp_swap/src/update.rs)
- Added `CollectionResult` and `CollectionError` types for collection responses
- Added `collect_alex_fees()` function:
  - Guard: `only_lbry_fun` - ensures only lbry_fun canister can collect
  - Implements CEI (Check-Effect-Interaction) pattern
  - Includes failure reversal to restore exact balance on transfer failure
  - Minimum collection amount: ICP_TRANSFER_FEE (10,000 E8S)
- Added `add_to_reward_pool()` function:
  - Guard: `only_lbry_fun` - ensures only lbry_fun canister can add funds
  - Allows adding funds to the segregated reward pool
- Added `transfer_icp_to_lbry_fun()` helper function for ICP transfers

### Query Functions (src/icp_swap/src/queries.rs)
- Added imports for new storage structures
- Added `get_uncollected_fees()` query - returns (alex_fees, lp_fees) tuple
- Added `get_reward_pool_status()` query - returns current reward pool balance

### Guards (src/icp_swap/src/guard.rs)
- Added `only_lbry_fun()` guard - restricts calls to lbry_fun canister

### Interface (src/icp_swap/icp_swap.did)
- Added `get_uncollected_fees : () -> (nat64, nat64) query`
- Added `get_reward_pool_status : () -> (nat64) query`
- Added `collect_alex_fees` with proper Result types
- Added `add_to_reward_pool : (nat64) -> (variant { Ok : nat64; Err : text })`

## LBRY Fun Canister Changes

### Collection Module (src/lbry_fun/src/collection.rs)
- Created new module for collection infrastructure
- Implements pull model where lbry_fun collects from all registered tokens
- Key features:
  - Automatic hourly collection via timer
  - State machine for operation tracking
  - Audit system with de-pegging detection
  - Stagnation alerts (24h without successful collection)
  - Auto-recovery from stuck states (10-minute timeout)
  - Problematic token tracking (consecutive failures)
- Query endpoints:
  - `get_audit_state()` - returns current audit information
  - `get_problematic_tokens()` - returns tokens with >3 consecutive failures
  - `get_collection_status()` - returns current state and accumulated amount
- Update endpoint:
  - `trigger_collection()` - manual collection trigger

### Integration (src/lbry_fun/src/lib.rs, src/lbry_fun/src/update.rs)
- Added collection module to exports
- Updated init function to initialize collection timer
- Collection runs every hour automatically

## Configuration Updates

The following values have been configured:

1. In `src/icp_swap/src/update.rs`:
   - Set lbry_fun canister ID to `"oni4e-oyaaa-aaaap-qp2pq-cai"`
   - Changed `add_to_reward_pool` guard from `is_admin` to `only_lbry_fun`
   - Fixed TODO comment on line 337 - now uses E8S constant for clarity

2. In `src/icp_swap/src/guard.rs`:
   - Set lbry_fun canister ID to `"oni4e-oyaaa-aaaap-qp2pq-cai"`
   - Removed `is_admin` guard function (all reward pool operations go through lbry_fun)

## Testing Requirements

The following tests should be implemented:

1. Unit tests for exact math verification (1% calculations)
2. Integration tests for end-to-end collection
3. Failure scenario tests (transfer failures, timeouts)
4. Audit accuracy tests
5. Scale tests with 1000+ tokens
6. Stress tests for concurrent operations

## Deployment Notes

1. The distribute_reward timer is already configured in script.rs
2. Collection timer initializes automatically on lbry_fun init
3. Reward pool must be funded via `add_to_reward_pool` before distributions begin
4. Monitor audit alerts for de-pegging and stagnation issues

## Security Considerations

1. All fee updates use atomic operations
2. Collection implements CEI pattern with failure reversal
3. Guards prevent unauthorized access to critical functions
4. Reward pool is segregated from operational funds
5. Auto-recovery prevents permanent stuck states

## Future Enhancements

1. Implement actual swap and burn logic in lbry_fun collection module
2. Add LP distribution mechanism (currently accumulates in UNCOLLECTED_LP_FEES)
3. Enhanced monitoring dashboard for audit states
4. Configurable thresholds for alerts