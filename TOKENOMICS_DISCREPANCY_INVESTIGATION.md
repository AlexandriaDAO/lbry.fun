# Tokenomics Discrepancy Investigation Guide

## Problem Statement
The frontend tokenomics graphs show vastly different projections than actual on-chain behavior. Pools are reaching 70-80% of max supply with minimal ICP spent, when projections show it should take billions of dollars.

## Key Facts
1. **Secondary tokens mint at $0.01 per token** (fixed rate)
2. **ICP price is $10** (on local network)
3. **Expected**: 1 ICP ($10) should mint 1,000 secondary tokens
4. **Actual**: 1 ICP is minting 100 billion secondary tokens (100,000,000x more!)

## Concrete Examples

### Pool 2 (ASDF/FDSA)
- **Frontend projection**: Need 137.6 billion secondary tokens to reach 100% supply
- **Actual result**: Reached 70.93% with only 90 billion secondary burned
- **Cost discrepancy**: Frontend shows $688M needed, actual was $4.5M

### Pool 3 (asdf/FDA)
- **Frontend projection**: Need 1,242 billion secondary tokens to reach 100% supply
- **Actual result**: Reached 80.46% with only 77.7 billion secondary burned
- **Cost discrepancy**: Frontend shows $6.2B needed, actual was $50M

## What We've Already Fixed
1. Fixed E8S division bug in `preview_canister.rs` line 88
   - Was: `let reward_4decimal = ((rate_e8s * 10_000) / E8S as u128) as u64;`
   - Now: `let reward_4decimal = (rate_e8s * 10_000) as u64;`
   - This fixed the reward rate calculation but didn't solve the main issue

## Critical Questions to Answer

### 1. Secondary Token Minting Rate
**Question**: How many secondary tokens should 1 ICP mint?
- **Expected**: 1,000 tokens (if $10 ICP ÷ $0.01 per token)
- **Actual**: 100,000,000,000 tokens (based on bot1 observations)

**To investigate**:
```bash
# Check the swap function in icp_swap canister
dfx canister call [icp_swap_id] get_current_secondary_ratio
```

### 2. Unit Confusion
**Question**: Are we mixing up E8S and natural units somewhere?
- E8S = 10^8 (smallest unit)
- Natural = readable amount (1 token = 100,000,000 E8S)

**Key places to check**:
- `icp_swap/src/update.rs` - swap() function
- How `secondary_amount = amount_icp * icp_rate_in_cents` is calculated
- Whether the ratio is already accounting for E8S conversions

### 3. The Math Chain
Track the exact calculation from ICP to secondary to primary tokens:

```
ICP amount (E8S) → secondary_ratio → Secondary tokens (E8S) → burn → Primary tokens
```

**Need to verify**:
- What is `get_current_secondary_ratio()` actually returning?
- Is it a multiplier for E8S amounts or natural amounts?
- Are we double-converting somewhere?

## Investigation Steps

### Step 1: Understand Secondary Token Minting
```bash
# Get the ratio for a pool
dfx canister call [icp_swap_id] get_current_secondary_ratio

# Do a small test swap
dfx canister call [icp_swap_id] swap '(10000000, null)' # 0.1 ICP

# Check how many secondary tokens were minted
```

### Step 2: Trace Through Tokenomics
```bash
# Get the tokenomics schedule
dfx canister call [tokenomics_id] get_tokenomics_schedule

# Compare thresholds to actual burn amounts
```

### Step 3: Frontend vs Backend Comparison
Compare these three sources:
1. Frontend graph projections (the JSON data)
2. Backend preview_tokenomics_schedule output
3. Actual on-chain tokenomics schedule

## The Core Issue
The system appears to be minting 100 million times more secondary tokens per ICP than intended. This could be due to:

1. **Double E8S multiplication**: Secondary ratio might already include E8S conversion
2. **Wrong constant**: The $0.01 per token might not be implemented correctly
3. **Unit mismatch**: Somewhere in the chain, natural units are being treated as E8S

## Files to Examine
1. `/src/icp_swap/src/update.rs` - swap() function
2. `/src/icp_swap/src/queries.rs` - get_current_secondary_ratio()
3. `/src/lbry_fun/src/tokenomics_simple.rs` - SECONDARY_TOKEN_USD_COST
4. `/src/lbry_fun_frontend/src/features/token/components/UnifiedTokenomicsGraphsV2.tsx` - graph generation

## Expected Outcome
Once we understand the exact minting rate and fix any discrepancies, the frontend graphs should show realistic progressions where spending reasonable amounts of ICP produces expected results.