# Tokenomics Clean Fix Plan

## Current Problems

1. **TGE Allocation**: Shows 100M tokens (99.80%) instead of 100 tokens (0.01%)
2. **Epoch 2**: Burns 800 quadrillion secondary tokens (completely wrong)
3. **USD Costs**: Shows $500 trillion (nonsensical)
4. **Unit Confusion**: Mixing E8S, natural units, and percentages throughout

## Root Cause

The fundamental issue is **unit inconsistency** and **unclear data flow**. The system is trying to handle:
- E8S units (10^8)
- Natural units (1)
- Percentages (0-100)
- USD values ($0.01 per secondary token)

All at once, without clear boundaries.

## Proposed Clean Architecture

### 1. Core Principles (Simple & Clear)

```
1. Secondary tokens cost $0.01 to mint (fixed)
2. Primary tokens are minted by burning secondary at a rate
3. Burn doubles each epoch: 1M → 2M → 4M → 8M...
4. Reward rate reduces by halving %: 2000 → 1400 → 980...
5. Stop when max supply is reached
```

### 2. Unit Convention

**Backend Internal**: Everything in E8S
**Frontend Display**: Everything in natural units
**Conversion**: Only at API boundaries

### 3. Data Flow

```
Frontend Input (E8S strings) 
    ↓
Backend Calculation (E8S integers)
    ↓
Schedule Generation (E8S)
    ↓
Graph Generation (E8S with proper formatting)
    ↓
Frontend Display (Natural units)
```

## Implementation Plan

### Phase 1: Understand Current Behavior
1. Trace exact values through the system
2. Identify where unit conversions go wrong
3. Document expected vs actual for each preset

### Phase 2: Clean Implementation
1. **Single calculation function** that handles all tokenomics math
2. **Clear unit types**: Use typed wrappers (E8sAmount, NaturalAmount)
3. **Explicit conversions**: Only convert at boundaries
4. **No magic numbers**: All constants clearly defined

### Phase 3: Test-Driven Development
1. Write tests for expected output FIRST
2. Implement to pass tests
3. Add edge cases

### Phase 4: Frontend Integration
1. Ensure backend returns data in expected format
2. Frontend only handles display formatting
3. No calculations in frontend

## Specific Fixes Needed

### 1. TGE Allocation
```rust
// Current (WRONG): Treats TGE as 100M tokens
// Fixed: TGE should be small amount (100 tokens = 0.01% of 1M supply)
let tge_e8s = 100 * E8S; // NOT 100_000_000 * E8S
```

### 2. Burn Thresholds
```rust
// Current: Cumulative thresholds getting astronomical
// Fixed: Clear epoch-by-epoch burns
struct Epoch {
    secondary_to_burn: u128,  // This epoch's burn requirement
    primary_to_mint: u128,    // This epoch's mint amount
    cost_per_token: f64,      // USD cost
}
```

### 3. Graph Data Structure
```rust
struct TokenomicsData {
    epochs: Vec<Epoch>,
    total_supply: u128,
    
    // Methods to generate graph data
    fn cumulative_burned(&self) -> Vec<u128>
    fn cumulative_minted(&self) -> Vec<u128>
    fn cost_curve(&self) -> Vec<f64>
}
```

## Example Calculation (Quick Launch)

```
Parameters:
- Max Supply: 1M tokens
- Initial Burn: 1M secondary
- Initial Reward: 2000 primary per 10k secondary
- Halving: 70%
- TGE: 100 tokens (0.01%)

Expected Output:
Epoch    Burn This Epoch    Mint This Epoch    Total Minted    % of Supply
TGE      0                  100                100             0.01%
1        1M                 200,000            200,100         20.01%
2        2M                 280,000            480,100         48.01%
3        4M                 392,000            872,100         87.21%
4        ~1.4M              127,900            1,000,000       100.00%
```

## Next Steps

1. **Create simple test harness** with expected values
2. **Rewrite calculation logic** from scratch with clear units
3. **Verify each step** with logging and tests
4. **Only then integrate** with existing code

The key is to start simple, verify correctness, then add complexity.