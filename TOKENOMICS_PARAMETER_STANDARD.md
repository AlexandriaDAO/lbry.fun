# Tokenomics Parameter Standard

## Problem
The tokenomics preview was showing incorrect values because of inconsistent parameter formats between frontend and backend.

## Solution
Established a clear standard: **Frontend always uses whole numbers, backend converts as needed**.

## Parameter Standards

### Frontend Input (User-Friendly Whole Numbers)
- `primary_max_supply`: "21000000" (21 million tokens)
- `tge_allocation`: "315000" (315,000 tokens)  
- `initial_secondary_burn`: "21000" (21,000 tokens)
- `initial_reward_per_burn_unit`: "5" (5 tokens per burn)
- `halving_step`: "50" (50%)

### Backend Expectations (What Tokenomics Canister Needs)
Based on the hardcoded values in `tokenomics/src/storage.rs`:
- Secondary burn thresholds: Natural units (21,000 = 21,000 tokens)
- Primary rewards: 4-decimal format (50,000 = 5.0 tokens)

### Conversion Flow

1. **Frontend** (`UnifiedTokenomicsGraphs.tsx`):
   ```typescript
   // Convert to E8S only where needed
   const primary_max_supply = BigInt(primaryMaxSupply) * E8S_MULTIPLIER;
   const tge_allocation = BigInt(tgeAllocation) * E8S_MULTIPLIER;
   // Keep as natural units
   const initial_secondary_burn = BigInt(initialSecondaryBurn);
   const initial_reward_per_burn_unit = BigInt(initialRewardPerBurnUnit);
   ```

2. **Backend** (`tokenomics_simple.rs`):
   ```rust
   // Convert natural units to E8S for internal calculations
   let initial_reward_rate_e8s = primary_per_threshold * E8S;
   let initial_burn_e8s = initial_secondary_burn * E8S;
   ```

## Why This Works
- Users think in whole tokens (intuitive)
- Frontend code is simple (no complex conversions)
- Backend handles the technical conversions
- Matches the deployed tokenomics canister's expectations

## Expected Behavior
With default values:
- Epoch 1: Burn 21,000 secondary → Mint 105,000 primary (21,000 × 5)
- Epoch 2: Burn 42,000 secondary → Mint 105,000 primary (with 50% halving)
- Continues with doubling burns and appropriate halving

## Date Fixed
2025-06-30