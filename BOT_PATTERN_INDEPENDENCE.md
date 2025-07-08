# Bot Pattern Independence Issue

## The Problem
The documentation suggests that different burn patterns produce different results, but this is WRONG. The tokenomics system is designed to be pattern-independent.

## How It Should Work

The tokenomics canister uses cumulative thresholds. For example:
- Threshold 1: 30.1M tokens cumulative → Rate 0.5
- Threshold 2: 60.2M tokens cumulative → Rate 0.425 (85% of previous)
- Threshold 3: 120.4M tokens cumulative → Rate 0.361 (85% of previous)

**Key Point**: It doesn't matter HOW you reach these thresholds:
- Burn 30.1M at once → Get rate 0.5 for all 30.1M
- Burn 1M thirty times → Get rate 0.5 for all 30.1M
- Burn in any pattern → Same cumulative result

## Why The Documentation Is Misleading

The statement:
```
Loop 6: 100,000,000 tokens → Rate 1.22 (threshold crossed!)
```

This implies the rate changed DURING loop 6, but that's not how the system works. The rate applies to the ENTIRE burn amount based on which thresholds are crossed.

## The Real Calculation

When you burn tokens, the system:
1. Checks current cumulative burned
2. Determines which thresholds will be crossed
3. Applies appropriate rate to each portion

Example: If cumulative is at 50M and you burn 100M:
- First 10.2M (to reach 60.2M threshold) → Rate 0.5
- Next 60.2M (to reach 120.4M threshold) → Rate 0.425
- Last 29.6M (beyond 120.4M) → Rate 0.361

## Corrected Understanding

The bot results showing different rates per loop are either:
1. **Incorrect documentation** - The rates shown are average rates, not the actual rates applied
2. **A bug in rate calculation** - The system is incorrectly applying rates based on individual burn amounts rather than cumulative thresholds

## Required Fix

The tokenomics canister MUST ensure pattern independence:
```rust
// Pseudo-code for correct implementation
fn calculate_mint(burn_amount: u64) -> u64 {
    let start_cumulative = get_total_burned();
    let end_cumulative = start_cumulative + burn_amount;
    
    let mut total_minted = 0;
    let mut current_burned = start_cumulative;
    
    // Process each threshold crossed
    for (threshold, rate) in get_thresholds_and_rates() {
        if current_burned >= threshold {
            continue; // Already past this threshold
        }
        
        let burn_in_this_tier = min(threshold - current_burned, 
                                    end_cumulative - current_burned);
        total_minted += burn_in_this_tier * rate;
        current_burned += burn_in_this_tier;
        
        if current_burned >= end_cumulative {
            break;
        }
    }
    
    return total_minted;
}
```

This ensures that burning 1M tokens 100 times produces the exact same result as burning 100M tokens once.