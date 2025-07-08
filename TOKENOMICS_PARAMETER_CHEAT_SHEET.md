# Tokenomics Parameter Cheat Sheet

## Quick Reference: How Each Parameter Affects Your Token Launch

### 🎯 Primary Goal Settings

**Want more epochs?**
- ↑ Increase Hard Cap (primary_max_supply)
- ↓ Decrease Initial Reward Rate
- ↓ Decrease Halving Step (e.g., 30% instead of 50%)

**Want fewer epochs?**
- ↓ Decrease Hard Cap
- ↑ Increase Initial Reward Rate
- ↑ Increase Halving Step (e.g., 70% instead of 50%)

**Want a flatter curve (more stable rewards)?**
- ↓ Lower Halving Step (25-40%)
- ↓ Start with lower Initial Reward Rate
- The flatter the curve, the more predictable the mining

**Want a steeper curve (rapidly decreasing rewards)?**
- ↑ Higher Halving Step (60-90%)
- ↑ Start with higher Initial Reward Rate
- Creates FOMO but may concentrate supply early

---

## 📊 Parameter Deep Dive

### 1. **Hard Cap (primary_max_supply)**
**Range:** 1,000,000 - 10,000,000,000+ tokens

**Effects:**
- **More Supply → More Epochs**: Larger supplies take longer to distribute
- **Less Supply → Fewer Epochs**: Smaller supplies distribute quickly
- **Market Cap**: Directly affects potential valuation

**Examples:**
- 1M tokens: ~5-10 epochs (quick distribution)
- 21M tokens: ~15-25 epochs (Bitcoin-like)
- 1B tokens: ~30-50 epochs (extended distribution)
- 50B+ tokens: 100+ epochs (very long tail)

---

### 2. **Initial Reward Rate (initial_reward_per_burn_unit)**
**Range:** 0.01 - 20 tokens per burn
**Default:** 0.105 tokens

**Effects:**
- **Higher Rate → Faster Distribution**: More tokens minted early
- **Lower Rate → Slower Distribution**: More gradual release
- **First Epoch Impact**: Directly multiplies with Burn Unit

**Warning Zones:**
- **Too High (>10)**: First epoch may capture >30% of supply
- **Too Low (0.01)**: No halvings occur (flat distribution)

**Sweet Spots:**
- **0.05-0.5**: Conservative, gradual distribution
- **0.5-2.0**: Balanced approach
- **2.0-10.0**: Aggressive early distribution

---

### 3. **Burn Unit (initial_secondary_burn)**
**Range:** 1,000,000 - 100,000,000 secondary tokens
**Default:** 1,000,000 tokens ($5,000 at $0.005/token)

**Effects:**
- **Higher → Larger First Epoch**: More tokens minted initially
- **Lower → Smaller First Epoch**: More conservative start
- **Sets Initial Valuation**: Burn Unit × $0.005 = Starting liquidity

**Recommendations:**
- **Small Projects**: 1M-5M tokens ($5K-$25K)
- **Medium Projects**: 5M-20M tokens ($25K-$100K)
- **Large Projects**: 20M+ tokens ($100K+)

**Note:** Each epoch after the first requires 2x the previous burn amount!

---

### 4. **Halving Step (halving_step)**
**Range:** 25% - 99%
**Default:** 50%

**Effects on Curve Shape:**

**25-40% (Gentle Halving)**
- Very flat curve
- Rewards decrease slowly
- Many epochs with similar rewards
- Best for: Long-term, stable distribution

**45-55% (Balanced Halving)**
- Moderate curve
- Classic halving behavior
- Predictable decrease
- Best for: Most projects

**60-75% (Aggressive Halving)**
- Steep curve
- Rewards drop quickly
- Front-loaded distribution
- Best for: Creating early scarcity

**80-99% (Extreme Halving)**
- Very steep curve
- Massive early rewards
- Hits floor quickly (3-5 epochs)
- Best for: Maximum FOMO

---

## 🎮 Common Patterns & Recipes

### "The Bitcoin" (Steady & Predictable)
- Hard Cap: 21,000,000
- Initial Reward: 0.1-0.5
- Burn Unit: 2,000,000
- Halving: 50%
- Result: ~20 epochs, classic halving curve

### "The Quick Launch" (Fast Distribution)
- Hard Cap: 10,000,000
- Initial Reward: 2-5
- Burn Unit: 1,000,000
- Halving: 70%
- Result: ~10 epochs, front-loaded

### "The Marathon" (Extended Distribution)
- Hard Cap: 1,000,000,000
- Initial Reward: 0.05-0.1
- Burn Unit: 5,000,000
- Halving: 30%
- Result: 50+ epochs, very gradual

### "The Fair Launch" (Even Distribution)
- Hard Cap: 100,000,000
- Initial Reward: 0.01 (minimum)
- Burn Unit: 2,000,000
- Halving: Any (won't matter)
- Result: Flat rate of 0.01 forever

---

## ⚠️ Things to Avoid

1. **The Instant Dump**
   - Don't set Initial Reward so high that >50% mints in epoch 1
   - Calculator: (Initial Reward × Burn Unit) / Hard Cap < 0.3

2. **The Never-Ending Story**
   - With huge supplies (>10B) and low rewards, you might get 200+ epochs
   - Most won't be meaningful - consider smaller supply

3. **The Precision Trap**
   - Starting too close to 0.01 means no real halvings
   - Give yourself room to halve at least 3-5 times

4. **The Whale Feast**
   - Very low Burn Unit + Very high Initial Reward = Bots win
   - Keep initial valuation above $5,000

---

## 📈 Visual Guide

```
Halving Step Impact on Curve:

25% Halving:  ████████████████████████████████░░░░
50% Halving:  ████████████████░░░░░░░░░░░░░░░░░░░
75% Halving:  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░
90% Halving:  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

Initial Reward Impact:

Low (0.05):   ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁ (many small epochs)
Med (0.5):    ▃▃▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁ (balanced)
High (5.0):   █████▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁ (front-loaded)
```

---

## 🧮 Quick Math

**First Epoch Minted** = Initial Reward × Burn Unit × 3

**Epochs to Hit Floor** = Log(0.01/Initial Reward) / Log(Halving Step/100)

**Total Cost to Mine All** ≈ Hard Cap × Average Cost Per Token

**When Rewards Hit Minimum**:
- 50% halving from 0.1 → 3 epochs
- 70% halving from 0.1 → 5 epochs  
- 30% halving from 0.1 → 2 epochs

---

## 💡 Pro Tips

1. **Test in Preview First**: Always preview your tokenomics before creating
2. **Consider Your Audience**: Degens like steep curves, institutions prefer gradual
3. **Match Your Roadmap**: Align distribution timeline with development milestones
4. **Leave Room for Growth**: Don't mint everything in 5 epochs
5. **The 3x Multiplier**: Remember, actual minted = displayed × 3 internally

---

## 🎯 TL;DR - Just Tell Me What To Do

**For most projects**, start with:
- Hard Cap: 10M - 100M
- Initial Reward: 0.1 - 0.5
- Burn Unit: 1M - 5M  
- Halving: 50%

Then adjust based on what you see in the preview!