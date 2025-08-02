# APY Calculation Implementation Plan

## Overview
This document outlines how to implement real APY (Annual Percentage Yield) calculations for the staking system, replacing the current placeholder value of 125.50%.

## Current State
- **Location**: `StakingTerminal.tsx` line 21
- **Current Implementation**: Hardcoded return value `'125.50'`
- **Data Flow**: APY values are stored historically but not used for actual APY percentage calculation

## Available Data Sources

### 1. ICP Swap Canister
- **Function**: `get_all_apy_values()`
  - Returns: `Vec<(u32, u128)>` - Historical ICP rewards per primary token
  - Format: Day index → ICP reward per primary token (scaled by SCALING_FACTOR)
  - Usage: Average these values for reward rate calculation

- **Function**: `get_distribution_interval()`
  - Returns: `u32` - Number of completed distributions
  - Usage: Track distribution count

- **Function**: `get_scaling_factor()`
  - Returns: `u128` - Scaling factor (typically 10^8)
  - Usage: Convert scaled values to actual amounts

- **ICP Price**: Stored in canister state, updated every 24 hours from XRC

### 2. LBRY Fun Canister (TokenRecord)
- **Field**: `distribution_interval_seconds`
  - Type: `nat64`
  - Values: 60 (1 min) to 86400 (24 hours)
  - Usage: Calculate distributions per year

### 3. Kongswap Integration
- **Service**: `KongswapService.getAllPools()`
- **Data Available**:
  - `balance_0`: ICP balance in pool
  - `balance_1`: Primary token balance in pool
  - `tvl`: Total value locked
  - `price`: Token price
- **Usage**: Calculate primary token price from 50/50 pool ratio

## The APY Formula

### High-Level Formula
```
APY = (Annual_Reward_Value_USD / Total_Staked_Value_USD) × 100
```

### Detailed Calculation Steps

```typescript
// Step 1: Get average ICP reward per primary token per distribution
const apyValues = await actor.get_all_apy_values();
const scalingFactor = await actor.get_scaling_factor();
const avgRewardPerToken = average(apyValues.map(v => v[1])) / scalingFactor;

// Step 2: Calculate distributions per year
const secondsPerYear = 365 * 24 * 3600;
const distributionInterval = tokenRecord.distribution_interval_seconds;
const distributionsPerYear = secondsPerYear / distributionInterval;

// Step 3: Calculate annual ICP rewards per token
const annualIcpPerToken = avgRewardPerToken * distributionsPerYear;

// Step 4: Get ICP price in USD
const icpPriceUsd = state.icpLedger.icpPrice; // From Redux state

// Step 5: Calculate annual reward value in USD
const annualRewardValueUsd = annualIcpPerToken * icpPriceUsd;

// Step 6: Calculate primary token price
const poolData = tvlData[poolId]; // From Kongswap
const icpInPool = Number(poolData.balance_0) / E8S;
const primaryTokensInPool = Number(poolData.balance_1) / E8S;
const primaryTokenPriceUsd = (icpInPool * icpPriceUsd) / primaryTokensInPool;

// Step 7: Calculate APY percentage
const stakedValuePerTokenUsd = 1 * primaryTokenPriceUsd;
const apy = (annualRewardValueUsd / stakedValuePerTokenUsd) * 100;
```

## Implementation Details

### 1. Frontend Changes Required

#### Update `stakingThunks.ts` - `getAverageApy` function
```typescript
export const getAverageApy = createAsyncThunk(
  "swap/getAverageApy",
  async (_, { rejectWithValue, getState }) => {
    const state = getState();
    const activePool = state.swap.activeSwapPool;
    const tokenRecord = activePool[1];
    const tvlData = state.token.tvlData[activePool[0]];
    
    // Get distribution interval from TokenRecord
    const distributionIntervalSeconds = Number(tokenRecord.distribution_interval_seconds);
    
    // Fetch APY values and calculate average
    const actor = await getActorSwap(tokenRecord.icp_swap_canister_id);
    const apyValues = await actor.get_all_apy_values();
    const scalingFactor = await actor.get_scaling_factor();
    
    // Calculate APY using formula above
    // ... implementation
    
    return calculatedApy;
  }
);
```

#### Update `StakingTerminal.tsx`
```typescript
const calculateAPY = () => {
  const apy = useSelector(selectAverageAPY);
  
  if (!apy) return 'Calculating...';
  if (apy === 0) return '0.00';
  
  return apy.toFixed(2);
};
```

### 2. Data Flow

1. **Pool Selection** → Triggers data fetching
2. **Fetch TokenRecord** → Get distribution_interval_seconds
3. **Fetch APY History** → Get historical reward rates
4. **Fetch Pool Data** → Get token pricing from Kongswap
5. **Calculate APY** → Apply formula
6. **Display Result** → Update UI with real APY

### 3. Edge Cases to Handle

#### No Distribution History
- **Condition**: New pool with no completed distributions
- **Display**: "Pending first distribution"
- **Fallback**: Use initial_reward_per_burn_unit for estimation

#### Zero Staked Tokens
- **Condition**: Total staked = 0
- **Display**: "0% APY"
- **Note**: No rewards distributed when nothing staked

#### Missing Pool Data
- **Condition**: Kongswap pool not found or failed
- **Display**: "Pool data unavailable"
- **Fallback**: Show ICP rewards only (not USD APY)

#### Variable Distribution Intervals
- **Handling**: Always use actual distribution_interval_seconds
- **Display**: Show interval (e.g., "Rewards every 1 hour")

### 4. UI Enhancements

#### APY Display Format
```
Current APY: 125.50% ✓
              ↓
Real APY: 87.23% (Rewards every 1 hour)
```

#### Additional Metrics
- **Confidence Level**: Based on data freshness
- **Trend Indicator**: ↑ ↓ → based on recent changes
- **Time Ranges**: 24h, 7d, 30d APY averages

### 5. Caching Strategy

- **Cache Duration**: 5 minutes
- **Cache Key**: `apy_${poolId}_${distributionInterval}`
- **Invalidation**: On new distribution or price update

## Testing Considerations

### Unit Tests
1. Test APY calculation with known values
2. Test edge cases (zero stakes, no history)
3. Test different distribution intervals

### Integration Tests
1. Verify data fetching from all sources
2. Test pool switching updates APY
3. Test cache invalidation

### Manual Testing
1. Compare calculated APY with actual rewards
2. Test with pools at different distribution intervals
3. Verify UI updates correctly

## Migration Path

1. **Phase 1**: Implement calculation logic
2. **Phase 2**: Add to UI alongside placeholder
3. **Phase 3**: Replace placeholder after validation
4. **Phase 4**: Add enhanced features (trends, ranges)

## Performance Considerations

- **Batch Requests**: Fetch all data in parallel
- **Memoization**: Cache intermediate calculations
- **Selective Updates**: Only recalculate on relevant changes

## Future Enhancements

1. **Historical APY Chart**: Show APY over time
2. **APY Projections**: Estimate future APY based on trends
3. **Comparative APY**: Compare across different pools
4. **APY Alerts**: Notify users of significant changes

## Summary

This implementation provides accurate, real-time APY calculations using:
- Actual reward distribution data
- Current market prices
- Pool-specific distribution intervals
- Live liquidity pool data

The calculation is transparent, verifiable, and updates automatically as market conditions change.