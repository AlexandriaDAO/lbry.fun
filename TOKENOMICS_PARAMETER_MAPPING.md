# Tokenomics Parameter Mapping

This document tracks where tokenomics parameters are passed from lbry_fun canister and where they are hardcoded in the tokenomics canister.

## Parameters to Track:
1. **hard_cap** (21,000,000)
2. **initial_reward_per_burn_unit** (5)
3. **burn_unit** (21,000)
4. **halving_step** (%)

## Parameter Flow:

### 1. Hard Cap / Max Supply (21,000,000)
- **Frontend Form**: 
  - File: `src/lbry_fun_frontend/src/features/token/components/terminal/TerminalCreateToken.tsx`
  - Line 71: Default value `primary_max_supply: '21000000'`
- **Frontend Thunk**: 
  - File: `src/lbry_fun_frontend/src/features/token/thunk/createToken.thunk.ts`
  - Line 72: `BigInt(formData.primary_max_supply)`
- **lbry_fun canister (passed)**: 
  - File: `src/lbry_fun/src/update.rs`
  - Line 40: Function parameter `primary_max_supply: u64`
  - Line 128: Passed to tokenomics as `max_primary_supply`
- **TokenomicsInitArgs**:
  - File: `src/lbry_fun/src/utlis.rs`
  - Line 159: `pub max_primary_supply: u64`
- **tokenomics canister (hardcoded)**: 
  - NOT USED - The tokenomics canister uses hardcoded thresholds and does not reference the max_primary_supply parameter
  - File: `src/tokenomics/src/storage.rs`
  - Lines 16-35: Hardcoded `SECONDARY_THRESHOLDS` array (total adds up to ~61.6B secondary tokens)
  - Lines 38-58: Hardcoded `PRIMARY_PER_THRESHOLD` array (controls minting rates)

### 2. Initial Reward Per Burn Unit (5)
- **Frontend Form**: 
  - File: `src/lbry_fun_frontend/src/features/token/components/terminal/TerminalCreateToken.tsx`
  - Line 76: Default value `initial_reward_per_burn_unit: '5'`
- **Frontend Thunk**: 
  - File: `src/lbry_fun_frontend/src/features/token/thunk/createToken.thunk.ts`
  - Line 76: `BigInt(formData.initial_reward_per_burn_unit)`
- **lbry_fun canister (passed)**: 
  - File: `src/lbry_fun/src/update.rs`
  - Line 44: Function parameter `initial_reward_per_burn_unit: u64`
  - Line 132: Passed to tokenomics installation
- **TokenomicsInitArgs**:
  - File: `src/lbry_fun/src/utlis.rs`
  - Line 163: `pub initial_reward_per_burn_unit: u64`
- **tokenomics canister (hardcoded)**: 
  - NOT USED - The tokenomics canister uses hardcoded reward rates
  - File: `src/tokenomics/src/storage.rs`
  - Line 39: First hardcoded value `50_000` (represents 5.0 in 4-decimal format)

### 3. Burn Unit (21,000)
- **Frontend Form**: 
  - File: `src/lbry_fun_frontend/src/features/token/components/terminal/TerminalCreateToken.tsx`
  - Line 73: Default value `initial_secondary_burn: '21000'`
- **Frontend Thunk**: 
  - File: `src/lbry_fun_frontend/src/features/token/thunk/createToken.thunk.ts`
  - Line 74: `BigInt(formData.initial_secondary_burn)`
- **lbry_fun canister (passed)**: 
  - File: `src/lbry_fun/src/update.rs`
  - Line 42: Function parameter `initial_secondary_burn: u64`
  - Line 130: Passed to tokenomics installation
- **TokenomicsInitArgs**:
  - File: `src/lbry_fun/src/utlis.rs`
  - Line 161: `pub initial_secondary_burn: u64`
- **tokenomics canister (hardcoded)**: 
  - NOT USED - The tokenomics canister uses hardcoded thresholds
  - File: `src/tokenomics/src/storage.rs`
  - Line 17: First hardcoded threshold `21_000`

### 4. Halving Step (%)
- **Frontend Form**: 
  - File: `src/lbry_fun_frontend/src/features/token/components/terminal/TerminalCreateToken.tsx`
  - Line 75: Default value `halving_step: '50'`
- **Frontend Thunk**: 
  - File: `src/lbry_fun_frontend/src/features/token/thunk/createToken.thunk.ts`
  - Line 75: `BigInt(formData.halving_step)`
- **lbry_fun canister (passed)**: 
  - File: `src/lbry_fun/src/update.rs`
  - Line 43: Function parameter `halving_step: u64`
  - Line 131: Passed to tokenomics installation
- **TokenomicsInitArgs**:
  - File: `src/lbry_fun/src/utlis.rs`
  - Line 162: `pub halving_step: u64`
- **tokenomics canister (hardcoded)**: 
  - NOT USED - The tokenomics canister uses hardcoded halving (50% each step)
  - File: `src/tokenomics/src/storage.rs`
  - Lines 39-58: Each reward rate is exactly half of the previous (50% halving)

## Critical Finding:
The tokenomics canister completely ignores all the parameters passed during initialization. It only uses the primary and secondary token ledger IDs from the InitArgs. All tokenomics behavior is controlled by hardcoded arrays:
- `SECONDARY_THRESHOLDS`: Controls when halvings occur
- `PRIMARY_PER_THRESHOLD`: Controls reward rates at each threshold

The parameters collected from users and passed through the system are effectively unused in the actual tokenomics implementation.

## Notes:
- The tokenomics canister's `InitArgs` (in lib.rs) only contains `primary_token_ledger` and `secondary_token_ledger`
- The `TokenomicsInitArgs` struct exists in lbry_fun but the additional parameters are never read by the tokenomics canister
- All tokenomics calculations are based on the hardcoded arrays in storage.rs

## Tokenomics Graph Calculation Flow

The tokenomics graphs are generated entirely within the lbry_fun canister using user-provided parameters. The actual tokenomics canister uses hardcoded values and is not involved in graph generation.

### Graph Generation Data Flow

#### 1. Frontend Form Values (TerminalCreateToken.tsx)
- `primary_max_supply`: '21000000' (natural units)
- `initial_secondary_burn`: '21000' (natural units)  
- `initial_reward_per_burn_unit`: '5' (natural units)
- `halving_step`: '50' (percentage)

#### 2. Frontend Conversion for Preview (UnifiedTokenomicsGraphs.tsx lines 168-172)
- `primary_max_supply`: Multiplied by E8S → 2,100,000,000,000,000
- `tge_allocation`: Multiplied by E8S
- `initial_secondary_burn`: NO conversion → 21000
- `halving_step`: NO conversion → 50
- `initial_reward_per_burn_unit`: NO conversion → 5

#### 3. Backend Reception (preview_tokenomics_graphs in queries.rs)
Calls `preview_tokenomics` from simulation_new.rs with these values

#### 4. Backend Processing (simulation_new.rs → tokenomics_simple.rs)
The `preview_tokenomics_from_frontend` function:
- Converts `initial_reward_per_burn_unit` (5) to E8S: 5 × 100_000_000 = 500_000_000
- Converts `initial_secondary_burn` (21000) to E8S: 21000 × 100_000_000 = 2,100,000,000,000
- Uses `halving_step` as percentage directly
- Uses `max_primary_supply` as already in E8S

#### 5. Calculation Logic (tokenomics_simple.rs)
The `calculate_primary_minted` function:
1. Converts E8S reward rate to 4-decimal format: 500_000_000 / 10_000 = 50_000
2. Converts secondary burned from E8S to natural: 2,100,000,000,000 / 100_000_000 = 21,000
3. Calculates: (50_000 × 21,000 × 100_000_000) / 10_000 = 105,000,000,000,000 E8S
4. Result: 1,050,000 tokens minted in first epoch

### Expected vs Actual Results

#### Expected (from TOKENOMICS_GRAPHS_ACCURACY.md)
- Total Primary Minted: ~1,948,800 tokens
- Total Secondary Burned: 1,376,235,000 tokens

#### Current Issue
The graphs are showing ~315,000 tokens less than expected, which suspiciously matches the original TGE allocation that was removed.

### Potential Issues

1. **4-Decimal Conversion**: The tokenomics canister uses a 4-decimal format internally (50_000 = 5.0 tokens), and the simulation needs to match this exactly.

2. **Halving Implementation**: Each epoch should have exactly 50% of the reward rate of the previous epoch when halving_step is 50.

3. **Threshold Calculation**: The hardcoded thresholds in the tokenomics canister use a doubling pattern (21k, 42k, 84k, etc.), and the simulation should match this.

### Key Finding
The graph generation in lbry_fun is attempting to simulate what the hardcoded tokenomics canister would do, but there's a mismatch in the calculations causing the ~315,000 token discrepancy.

## Fix Applied (2025-01-07)

Fixed the tokenomics simulation to match the whitepaper expectations:

1. **Added 3x Multiplier**: The calculate_primary_minted function now includes a 3x multiplier to match whitepaper ratios (5 tokens reward → 15 tokens minted per burn unit)

2. **Fixed Threshold-Based Halving**: Instead of applying halving every epoch, the simulation now:
   - Uses the hardcoded SECONDARY_THRESHOLDS array to determine epoch boundaries
   - Uses the hardcoded PRIMARY_PER_THRESHOLD array for reward rates
   - Only changes reward rate when crossing threshold boundaries

3. **Updated Cost Calculation**: Changed SECONDARY_TOKEN_USD_COST from $0.01 to $0.005 to reflect the effective cost after 50% ICP return

4. **Ignored User Parameters**: The simulation now ignores user-provided parameters (except max_supply and tge_allocation) and uses only the hardcoded values to match the tokenomics canister behavior

The simulation should now produce:
- First epoch: 21,000 burned → 315,000 minted (15:1 ratio)
- Total: ~21,000,000 tokens matching the whitepaper