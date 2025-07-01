# Tokenomics Parameter Validation Plan

## Overview
This document analyzes the relationship between tokenomics input parameters and the hardcoded tokenomics values in the deployed canisters, with the goal of establishing acceptable parameter ranges.

## Hardcoded Tokenomics Reference
From `/src/tokenomics/src/storage.rs`:

### Secondary Burn Thresholds (Natural Units)
```
21,000
42,000
84,000
168,000
336,000
672,000
1,344,000
2,688,000
5,376,000
10,752,000
21,504,000
43,008,000
86,016,000
172,032,000
344,064,000
688,128,000
1,376,256,000
61,632,592,000
```

### Primary Rewards Per Threshold (4-decimal format)
```
50,000 (5.0000 tokens)
25,000 (2.5000 tokens)
12,500 (1.2500 tokens)
6,250 (0.6250 tokens)
3,125 (0.3125 tokens)
1,562 (0.1562 tokens)
781 (0.0781 tokens)
391 (0.0391 tokens)
195 (0.0195 tokens)
98 (0.0098 tokens)
49 (0.0049 tokens)
24 (0.0024 tokens)
12 (0.0012 tokens)
6 (0.0006 tokens)
3 (0.0003 tokens)
2 (0.0002 tokens)
1 (0.0001 tokens)
1 (0.0001 tokens)
```

## Pattern Analysis

### Secondary Burn Pattern
- Each threshold doubles from the previous one (2x multiplier)
- Starts at 21,000 and follows: threshold[n] = 21,000 × 2^n
- Exception: Last threshold (61,632,592,000) is ~44.8x the previous

### Primary Reward Pattern
- Each reward halves from the previous one (50% reduction)
- Starts at 5.0 tokens and follows: reward[n] = 5.0 × 0.5^n
- Minimum reward: 0.0001 tokens (last two epochs)

## Input Parameters to Match

To generate a tokenomics schedule that matches the hardcoded values:

### Required Parameters:
1. **initial_secondary_burn**: 21,000
2. **initial_reward_per_burn_unit**: 5
3. **halving_step**: 50 (50% reduction per epoch)
4. **secondary_doubling**: 2x per epoch (implicit in current algorithm)

### Calculated Values:
- Total epochs: 18
- Total secondary to burn: ~61.6 billion tokens
- Initial mint rate: 5:1 (5 primary per 1 secondary)
- Final mint rate: 0.0001:1

## Acceptable Parameter Ranges

### 1. Initial Secondary Burn
**Purpose**: Sets the starting threshold for the first epoch

**Recommended Range**: 10,000 - 100,000
- **Minimum**: 10,000 (ensures meaningful first epoch)
- **Maximum**: 100,000 (prevents too aggressive start)
- **Default**: 21,000 (matches hardcoded)

**Impact**:
- Lower values: More epochs, longer distribution
- Higher values: Fewer epochs, faster distribution

### 2. Initial Reward Per Burn Unit
**Purpose**: Sets how many primary tokens are minted per secondary burned

**Recommended Range**: 1 - 10
- **Minimum**: 1 (1:1 ratio minimum)
- **Maximum**: 10 (prevents excessive initial rewards)
- **Default**: 5 (matches hardcoded)

**Impact**:
- Lower values: More secondary needed for same primary
- Higher values: Less secondary needed, faster distribution

### 3. Halving Step
**Purpose**: Controls reward reduction rate between epochs

**Recommended Range**: 25% - 90%
- **Minimum**: 25% (aggressive halving)
- **Maximum**: 90% (gentle halving)
- **Default**: 50% (matches hardcoded)

**Impact**:
- Lower values: Steeper reward decline, more front-loaded
- Higher values: Gentler decline, more even distribution

### 4. Max Primary Supply
**Purpose**: Total primary tokens to be minted

**Recommended Range**: 1,000,000 - 1,000,000,000
- **Minimum**: 1,000,000 (1M tokens)
- **Maximum**: 1,000,000,000 (1B tokens)
- **Default**: 21,000,000 (21M tokens, Bitcoin-like)

**Impact**:
- Determines when minting stops
- Affects percentage calculations

### 5. TGE Allocation
**Purpose**: Initial token allocation at launch

**Recommended Range**: 0% - 30% of max supply
- **Minimum**: 0% (no pre-allocation)
- **Maximum**: 30% (reasonable initial liquidity)
- **Default**: 1.5% (315,000 of 21M)

**Impact**:
- Higher values reduce mintable supply
- Affects initial market dynamics

## Validation Formula

To check if parameters will generate a reasonable schedule:

```
epochs_estimate = log2(total_secondary_needed / initial_burn)
total_secondary_needed ≈ (max_supply - tge) / average_mint_rate

where average_mint_rate ≈ initial_reward * (1 - halving^epochs) / (1 - halving)
```

## Precision Matching

### Current Implementation vs Hardcoded:
1. **Secondary thresholds**: Should match exactly (natural units)
2. **Primary rewards**: Match to 4 decimal places
3. **Epoch count**: Within ±2 epochs acceptable
4. **Final totals**: Within 1% acceptable

### Key Constraints:
1. Secondary burn must double each epoch
2. Primary reward must reduce by halving_step each epoch
3. Must stop when max supply reached
4. No negative or zero burns allowed

## Testing Strategy

1. **Exact Match Test**: Use default parameters, verify exact match
2. **Range Tests**: Test min/max of each parameter
3. **Combination Tests**: Test parameter combinations
4. **Edge Cases**: Test boundary conditions

## Implementation Notes

- Frontend sends natural units for burns and rewards
- Backend converts to E8S for calculations
- Display always shows natural units
- Ensure consistent precision throughout pipeline