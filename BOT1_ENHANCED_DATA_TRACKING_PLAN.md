# Bot1 Enhanced Data Tracking Plan

## Executive Summary

This plan addresses confusion that arose when testing the tokenomics halving mechanism. While the halving is working correctly at 80%, large burns that cross multiple epoch thresholds display an "effective rate" that is a weighted average across all epochs traversed. This caused initial concern that the halving wasn't working properly when seeing rates like 2.586 instead of the expected 3.702.

## Background: What Actually Happened

### Test Results That Caused Confusion
When burning 100M tokens in one transaction:
- Expected: Next epoch rate of 3.702 (80% of 4.628)
- Actual: Effective rate of 2.586
- User thought: Halving might be broken (55.9% instead of 80%)
- Reality: The burn crossed epochs 0-4, receiving portions at rates 4.628, 3.702, 2.962, 2.370, and 1.896

### The Investigation Revealed
1. The halving IS working correctly at 80%
2. The tokenomics schedule shows proper rates: 46,280 → 37,024 → 29,619 (each is 80% of previous)
3. Large burns naturally cross multiple epochs and get a weighted average rate
4. The confusion arose from not understanding that the displayed rate was an average

## Current System Architecture

### Tokenomics System
- Uses threshold-based epochs (11.6M → 23.2M → 46.4M → 92.8M etc., doubling each time)
- Each epoch has a different reward rate (80% of the previous epoch)
- The `tokenomics` canister handles the actual minting calculations
- When a burn crosses thresholds, it's split and each portion gets its epoch's rate

### Bot1 Current Implementation
Located in: `src/icp_swap/src/bot1.rs`

Bot1 currently shows:
- `actual_mint_rate`: The effective (weighted average) rate for the transaction
- `epochs_reached`: Count of epochs touched
- `halving_occurred`: Boolean flag

Bot1 has access to:
- The tokenomics schedule via `get_tokenomics_schedule()` query
- Burn amounts and mint results from each transaction
- Cumulative burn totals before and after each transaction

## The Solution: Separation of Data and Analysis

### Core Principle
- **get_table()** - Shows pure, actual transaction results (what really happened)
- **get_summary()** - Adds theoretical analysis and verification (what should have happened)

This separation ensures users see both the real data and understand why multi-epoch burns have different rates.

## Pool 2 Verification Results (2025-07-08)

### Critical Bug Fixed
Found and fixed a critical bug in `preview_canister.rs` line 88 that was causing frontend projections to be incorrect by a factor of 100,000,000.

**The Bug:**
```rust
// INCORRECT - Extra E8S division
let reward_4decimal = ((rate_e8s * 10_000) / E8S as u128) as u64;

// CORRECT - No E8S division needed  
let reward_4decimal = (rate_e8s * 10_000) as u64;
```

**Why This Happened:**
- `rate_e8s` is calculated as `primary_minted_e8s / secondary_burned_e8s`
- Both values are in E8S format, so the E8S units cancel out in the division
- The extra `/E8S` division made rewards 100M times smaller than they should be

**Impact:**
- Frontend showed pool 2 would need 137.6 billion secondary tokens to reach 100% supply
- Actually only needs 49.2 billion secondary tokens  
- Pool 2 correctly hit its max supply cap at 70.93% after burning 90 billion secondary tokens

**Verification:**
- Pool 2 tokenomics are working correctly on backend
- Frontend projections now match backend calculations after fix
- No issues with halving mechanics - they trigger at the correct thresholds

## Implementation Plan (Bot1-Only Changes)

### 1. Add Analysis Functions to bot1.rs

```rust
// Calculate theoretical epoch breakdown for any burn
fn calculate_theoretical_breakdown(
    start_burned: u64,        // Cumulative before this burn
    burn_amount: u64,         // Amount being burned
    schedule: &TokenomicsSchedule,
) -> Vec<TheoreticalEpochContribution> {
    let mut contributions = Vec::new();
    let mut remaining_burn = burn_amount;
    let mut current_position = start_burned;
    
    // Convert thresholds from strings to u64
    let thresholds: Vec<u64> = schedule.thresholds.values()
        .map(|t| t.parse().unwrap())
        .collect();
    let rewards: Vec<u64> = schedule.rewards.values()
        .map(|r| r.parse().unwrap())
        .collect();
    
    // Find starting epoch
    let mut epoch_idx = 0;
    for (i, &threshold) in thresholds.iter().enumerate() {
        if current_position < threshold {
            epoch_idx = i;
            break;
        }
    }
    
    // Process burn through epochs
    while remaining_burn > 0 && epoch_idx < thresholds.len() {
        let epoch_end = thresholds[epoch_idx];
        let burn_in_epoch = (epoch_end - current_position).min(remaining_burn);
        
        if burn_in_epoch > 0 {
            let rate_4decimal = rewards[epoch_idx];
            // Calculate minted: (burn * rate * 10_000) / E8S
            let minted = (burn_in_epoch as u128 * rate_4decimal as u128 * 10_000) / E8S as u128;
            
            contributions.push(TheoreticalEpochContribution {
                epoch_number: epoch_idx as u32,
                amount_burned: burn_in_epoch,
                rate_4decimal,
                rate_human: rate_4decimal as f64 / 10_000.0,
                amount_minted: minted as u64,
                percentage_of_burn: (burn_in_epoch as f64 / burn_amount as f64) * 100.0,
            });
        }
        
        current_position += burn_in_epoch;
        remaining_burn -= burn_in_epoch;
        epoch_idx += 1;
    }
    
    contributions
}

// Find which epoch a cumulative burn amount falls into
fn find_epoch(cumulative_burned: u64, thresholds: &[u64]) -> u32 {
    for (i, &threshold) in thresholds.iter().enumerate() {
        if cumulative_burned < threshold {
            return i as u32;
        }
    }
    thresholds.len() as u32 - 1
}

// Analyze all burns to categorize single vs multi-epoch
fn analyze_epoch_crossings(
    snapshots: &[BurnSnapshot], 
    schedule: &TokenomicsSchedule
) -> EpochCrossingAnalysis {
    let mut single_epoch_burns = Vec::new();
    let mut multi_epoch_burns = Vec::new();
    
    let thresholds: Vec<u64> = schedule.thresholds.values()
        .map(|t| t.parse().unwrap())
        .collect();
    let rewards: Vec<u64> = schedule.rewards.values()
        .map(|r| r.parse().unwrap())
        .collect();
    
    for snapshot in snapshots {
        let start_epoch = find_epoch(snapshot.cumulative_secondary_burned - snapshot.secondary_burned, &thresholds);
        let end_epoch = find_epoch(snapshot.cumulative_secondary_burned, &thresholds);
        
        if start_epoch == end_epoch {
            // Single epoch burn - perfect for rate verification
            let expected_rate = rewards[start_epoch as usize] as f64 / 10_000.0;
            let actual_rate = snapshot.primary_received as f64 / snapshot.secondary_burned as f64;
            
            single_epoch_burns.push(SingleEpochBurn {
                loop_number: snapshot.loop_number,
                epoch: start_epoch,
                actual_rate,
                expected_rate,
                deviation_percent: ((actual_rate - expected_rate) / expected_rate * 100.0).abs(),
            });
        } else {
            // Multi-epoch burn - calculate theoretical breakdown
            let cumulative_before = snapshot.cumulative_secondary_burned - snapshot.secondary_burned;
            let theoretical_breakdown = calculate_theoretical_breakdown(
                cumulative_before,
                snapshot.secondary_burned,
                &schedule
            );
            
            let theoretical_total: u64 = theoretical_breakdown.iter()
                .map(|e| e.amount_minted)
                .sum();
            
            multi_epoch_burns.push(MultiEpochBurn {
                loop_number: snapshot.loop_number,
                epochs_crossed: (start_epoch..=end_epoch).map(|e| e as u32).collect(),
                actual_total: snapshot.primary_received,
                theoretical_total,
                theoretical_breakdown,
                deviation_percent: ((theoretical_total as f64 - snapshot.primary_received as f64) / snapshot.primary_received as f64 * 100.0).abs(),
            });
        }
    }
    
    EpochCrossingAnalysis {
        single_epoch_burns,
        multi_epoch_burns,
    }
}
```

### 2. Add New Data Structures

```rust
#[derive(CandidType, Deserialize, Clone)]
pub struct TheoreticalEpochContribution {
    pub epoch_number: u32,
    pub amount_burned: u64,
    pub rate_4decimal: u64,      // 46280 = 4.628
    pub rate_human: f64,         // 4.628
    pub amount_minted: u64,
    pub percentage_of_burn: f64,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct SingleEpochBurn {
    pub loop_number: u64,
    pub epoch: u32,
    pub actual_rate: f64,
    pub expected_rate: f64,
    pub deviation_percent: f64,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct MultiEpochBurn {
    pub loop_number: u64,
    pub epochs_crossed: Vec<u32>,
    pub actual_total: u64,
    pub theoretical_total: u64,
    pub theoretical_breakdown: Vec<TheoreticalEpochContribution>,
    pub deviation_percent: f64,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct EpochCrossingAnalysis {
    pub single_epoch_burns: Vec<SingleEpochBurn>,
    pub multi_epoch_burns: Vec<MultiEpochBurn>,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct RateVerification {
    pub configured_halving: u32,
    pub observed_halvings: Vec<ObservedHalving>,
    pub status: VerificationStatus,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct ObservedHalving {
    pub from_epoch: u32,
    pub to_epoch: u32,
    pub observed_percentage: f64,
}

#[derive(CandidType, Deserialize, Clone)]
pub enum VerificationStatus {
    Verified,
    InsufficientData,
    Mismatch { expected: f64, observed: f64 },
}
```

### 3. Enhance get_summary() Only

Keep `get_table()` completely unchanged. Only modify `get_summary()` to add analysis:

```rust
#[query]
pub fn get_summary() -> Result<Bot1Summary, String> {
    // ... existing summary code ...
    
    // Add new analysis
    let schedule = get_tokenomics_schedule()
        .map_err(|e| format!("Failed to get tokenomics schedule: {}", e))?;
    
    let epoch_analysis = analyze_epoch_crossings(&bot1_data.snapshots, &schedule);
    
    // Add rate verification from single-epoch burns
    let rate_verification = verify_halving_rates(&epoch_analysis.single_epoch_burns, &schedule);
    
    // Add theoretical vs actual comparison for largest multi-epoch burn
    let largest_multi_epoch = epoch_analysis.multi_epoch_burns.iter()
        .max_by_key(|b| b.epochs_crossed.len());
    
    // Include analysis in summary
    let enhanced_summary = Bot1Summary {
        // ... all existing fields ...
        
        // NEW fields
        epoch_analysis: Some(epoch_analysis),
        rate_verification: Some(rate_verification),
        largest_multi_epoch_burn: largest_multi_epoch.cloned(),
        analysis_warnings: generate_warnings(&epoch_analysis),
    };
    
    Ok(enhanced_summary)
}

fn verify_halving_rates(
    single_epoch_burns: &[SingleEpochBurn], 
    schedule: &TokenomicsSchedule
) -> RateVerification {
    let mut observed_halvings = Vec::new();
    
    // Group burns by epoch
    let mut epochs_data: HashMap<u32, Vec<f64>> = HashMap::new();
    for burn in single_epoch_burns {
        epochs_data.entry(burn.epoch)
            .or_insert_with(Vec::new)
            .push(burn.actual_rate);
    }
    
    // Calculate average rate per epoch
    let mut epoch_rates: Vec<(u32, f64)> = epochs_data.into_iter()
        .map(|(epoch, rates)| {
            let avg_rate = rates.iter().sum::<f64>() / rates.len() as f64;
            (epoch, avg_rate)
        })
        .collect();
    epoch_rates.sort_by_key(|(epoch, _)| *epoch);
    
    // Check halving between consecutive epochs
    for i in 0..epoch_rates.len()-1 {
        let (epoch1, rate1) = epoch_rates[i];
        let (epoch2, rate2) = epoch_rates[i+1];
        
        let observed_percentage = (rate2 / rate1 * 100.0).round();
        observed_halvings.push(ObservedHalving {
            from_epoch: epoch1,
            to_epoch: epoch2,
            observed_percentage,
        });
    }
    
    // Determine status
    let configured_halving = 80; // Get from params
    let all_match = observed_halvings.iter()
        .all(|h| (h.observed_percentage - configured_halving as f64).abs() < 2.0);
    
    let status = if observed_halvings.is_empty() {
        VerificationStatus::InsufficientData
    } else if all_match {
        VerificationStatus::Verified
    } else {
        let avg_observed = observed_halvings.iter()
            .map(|h| h.observed_percentage)
            .sum::<f64>() / observed_halvings.len() as f64;
        VerificationStatus::Mismatch { 
            expected: configured_halving as f64, 
            observed: avg_observed 
        }
    };
    
    RateVerification {
        configured_halving,
        observed_halvings,
        status,
    }
}
```

### 4. Display Format Examples

**get_table()** output remains unchanged:
```
Loop 1: Burned 999 → Received 4,623 (Rate: 4.628)
Loop 2: Burned 10,000 → Received 46,280 (Rate: 4.628)
...
Loop 6: Burned 100,000,000 → Received 258,582,146 (Rate: 2.586)
```

**get_summary()** adds analysis section:
```
=== STANDARD SUMMARY ===
Total loops: 6
Average mint rate: 2.790
Total ICP spent: 111,110 ICP
...

=== EPOCH CROSSING ANALYSIS ===

Single-Epoch Burns (5 burns):
✓ Loop 1-5: All in Epoch 0, rates match expected 4.628

Multi-Epoch Burns (1 burn):
Loop 6: Crossed epochs 0→4
  Burned: 100M tokens
  Received: 258.58M tokens (actual)
  
  Theoretical Breakdown:
  ├─ Epoch 0: 0.49M burned @ 4.628 → 2.26M minted (0.5%)
  ├─ Epoch 1: 11.60M burned @ 3.702 → 42.95M minted (11.6%)
  ├─ Epoch 2: 23.20M burned @ 2.962 → 68.72M minted (23.2%)
  ├─ Epoch 3: 46.40M burned @ 2.370 → 109.94M minted (46.4%)
  └─ Epoch 4: 18.31M burned @ 1.896 → 34.71M minted (18.3%)
  
  Theoretical Total: 258.58M tokens
  ✓ MATCHES actual received (0.00% deviation)

=== HALVING VERIFICATION ===
Configured halving: 80%
Observed rates: Limited to epoch 0 only
Status: INSUFFICIENT DATA

⚠️ Recommendation: Perform burns that stay within single epochs to verify halving rates
```

## Key Benefits

1. **Data Integrity**: get_table() remains pure - shows only actual results
2. **Transparency**: get_summary() clearly labels theoretical calculations
3. **Error Detection**: Would catch if halving was actually 60% instead of 80%
4. **User Education**: Shows exactly why multi-epoch burns have lower effective rates
5. **No Canister Changes**: All logic stays in bot1, no modifications to audited code

## Testing the Implementation

To verify halving is working correctly:
1. Do small burns that stay in epoch 0
2. Do a burn that stays entirely in epoch 1 (burn ~5M when already at 15M total)
3. Compare the rates - should be 80% reduction
4. The analysis will automatically detect any deviation

## Success Criteria

1. Users understand why large burns show lower effective rates
2. Any halving configuration errors are detectable
3. Clear separation between actual data and theoretical analysis
4. No modifications to tokenomics or icp_swap canisters required