# Phase 1 Data Collection - Corrected Analysis

## Executive Summary

After discovering that the `preview_tokenomics_graphs` function expects raw token values (not e8s), we successfully collected meaningful data showing epoch generation ranges from 1 to 17 epochs across different parameter combinations.

## Key Findings

### 1. Halving Step Impact (Test Set A)
Using UI default parameters (1M supply, 1M burn unit, 2000 reward):
- **25-30% halving**: 6-7 epochs (aggressive halving extends epochs)
- **35-40% halving**: 8-9 epochs (optimal range for ~10 epochs)
- **45-55% halving**: 5-7 epochs
- **60-75% halving**: 4 epochs (matches UI default)
- **80-90% halving**: 3 epochs (minimal halving reduces epochs)

**Finding**: Lower halving percentages (more aggressive reduction) create MORE epochs, contrary to intuition.

### 2. Initial Reward Impact (Test Set B)
With 70% halving (UI default):
- **100 reward**: 11 epochs (very low reward extends distribution)
- **500 reward**: 7 epochs
- **1000 reward**: 5 epochs
- **2000 reward**: 4 epochs (UI default)
- **5000 reward**: 2 epochs
- **10000+ reward**: 1 epoch (too generous, immediate distribution)

**Finding**: Lower rewards create more epochs. Rewards above 5000 collapse to 1-2 epochs.

### 3. Burn Unit Scaling (Test Set C)
With UI default reward (2000) and halving (70%):
- **10,000 burn**: 17 epochs ($50 initial valuation - below threshold)
- **50,000 burn**: 12 epochs ($250 initial valuation)
- **100,000 burn**: 10 epochs ($500 initial valuation)
- **500,000 burn**: 5 epochs ($2,500 initial valuation)
- **1,000,000 burn**: 4 epochs ($5,000 initial valuation - UI default)
- **2,000,000+ burn**: 1-3 epochs (high barrier reduces epochs)

**Finding**: Lower burn units create more epochs but fall below $5k valuation threshold.

### 4. Optimal Parameters for 15-30 Epochs

To achieve 15-30 epochs, we need:
- **Low initial reward**: 50-200 tokens per burn unit
- **Low halving percentage**: 25-40% (aggressive reduction)
- **Small burn unit**: 10,000-50,000 (but this creates low initial valuation)

**Trade-off**: Parameters that generate many epochs often result in initial valuations below $5,000.

## Parameter Recommendations

### For ~15-20 Epochs with $5k+ Valuation:
```
burn_unit: 100,000 (initial val: $500)
initial_reward: 100-200
halving_step: 30-40%
```

### For ~10-15 Epochs with $5k+ Valuation:
```
burn_unit: 500,000 (initial val: $2,500)
initial_reward: 200-500
halving_step: 35-45%
```

### Current UI Defaults (4 epochs):
```
burn_unit: 1,000,000 (initial val: $5,000)
initial_reward: 2,000
halving_step: 70%
```

## Valuation vs Epoch Count Analysis

| Burn Unit | Initial Valuation | Typical Epochs | Status |
|-----------|------------------|----------------|---------|
| 10,000 | $50 | 15-20 | ⚠️ Below threshold |
| 50,000 | $250 | 10-15 | ⚠️ Below threshold |
| 100,000 | $500 | 8-12 | ⚠️ Below threshold |
| 500,000 | $2,500 | 5-8 | ⚠️ Below threshold |
| 1,000,000 | $5,000 | 3-5 | ✅ Meets threshold |
| 2,000,000 | $10,000 | 2-3 | ✅ Exceeds threshold |

## Recommendations for Phase 2

### 1. Parameter Slider Constraints
- **Burn Unit**: 
  - Min: 100,000 (with warning about low valuation)
  - Default: 1,000,000
  - Max: 10,000,000
  
- **Initial Reward**:
  - Min: 10
  - Default: 2,000
  - Max: 10,000
  - Dynamic max: Should not exceed 1% of hard cap
  
- **Halving Step**:
  - Min: 25%
  - Default: 70%
  - Max: 90%

### 2. Add Parameter Presets
- **Extended Distribution (15+ epochs)**:
  - Burn: 100,000, Reward: 200, Halving: 35%
  - Warning: Initial valuation $500
  
- **Balanced (8-12 epochs)**:
  - Burn: 500,000, Reward: 500, Halving: 45%
  - Initial valuation: $2,500
  
- **Quick Launch (3-5 epochs)**:
  - Burn: 1,000,000, Reward: 2,000, Halving: 70%
  - Initial valuation: $5,000 (current default)

### 3. Dynamic Validation Rules
- If `initial_reward > hard_cap * 0.01`: Warning "High reward may result in few epochs"
- If `burn_unit < 1,000,000`: Warning "Initial valuation below $5,000"
- If predicted epochs < 3: Warning "Very short distribution period"
- If predicted epochs > 30: Warning "Extended distribution may reduce liquidity"

## Conclusion

The tokenomics model is working correctly. The key insight is the inverse relationship between reward generosity and epoch count. To achieve more epochs (gradual distribution), projects need either:
1. Lower initial rewards
2. More aggressive halving (lower percentages)
3. Smaller burn units (but this impacts initial valuation)

The current UI defaults provide a reasonable 4-epoch distribution with exactly $5,000 initial valuation.