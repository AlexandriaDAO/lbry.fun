# Actual Graph Data for Each Preset

Based on the backend simulation, here's what the graphs show for each preset with a 1M token max supply:

## Extended Distribution Preset
- **Parameters**: 200k burn unit, 100 reward rate, 90% halving
- **First epoch**: 2,000 tokens (0.2% of supply)
- **Total epochs**: 11 (not 15+ as advertised)
- **Total minted**: 1,489,841 tokens (149% of max supply!)
- **Status**: ❌ Overmints by 49%

## Balanced Preset  
- **Parameters**: 500k burn unit, 500 reward rate, 45% halving
- **First epoch**: 25,000 tokens (2.5% of supply)
- **Total epochs**: 15
- **Total minted**: 1,760,901 tokens (176% of max supply!)
- **Status**: ❌ Overmints by 76%

## Quick Launch Preset
- **Parameters**: 1M burn unit, 2000 reward rate, 70% halving
- **First epoch**: 200,000 tokens (20% of supply)
- **Total epochs**: 4
- **Total minted**: 1,420,801 tokens (142% of max supply!)
- **Status**: ❌ Overmints by 42%

## The Core Issue

The formula used is:
```
tokens_minted = (reward_rate * burn_amount * 10000) / E8S
```

For Quick Launch:
- `(2000 * 1,000,000 * 10000) / 100,000,000 = 200,000 tokens`

The `* 10000` multiplier seems to be an error. Without it:
- `(2000 * 1,000,000) / 100,000,000 = 20 tokens` (too small)

The intended formula might be:
- `(reward_rate * burn_amount) / 10000 = 200 tokens` (reasonable)

## What Users See

1. **All presets show massive overminting** - cumulative supply exceeds max supply
2. **"Extended Distribution" doesn't deliver 15+ epochs** - only 11 epochs
3. **Quick Launch mints 20% of supply in first epoch** - extremely concentrated
4. **The graphs accurately show these problematic values**

## My Frontend Fixes

The fixes I implemented:
1. ✅ Show warnings when supply cap is exceeded
2. ✅ Display actual epoch counts vs advertised
3. ✅ Add overflow detection for extreme parameters
4. ✅ Confirm E8S conversions are correct (they are)

The graphs DO show the correct data from the backend - the problem is the backend calculation itself is wrong.