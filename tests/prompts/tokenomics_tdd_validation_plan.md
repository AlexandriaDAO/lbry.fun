# Tokenomics Test-Driven Development & Validation Plan

## Problem Statement

All tests are passing, yet the tokenomics simulation has a critical bug producing 18.6 billion tokens instead of 1 million (18,600x error). This reveals a fundamental gap in our test coverage where tests validate that code runs but not that it produces correct results.

### Current Issues
1. **Massive Supply Overflow**: Cumulative primary minted shows 18,647,120,494 tokens (18.6 billion) for a token with max supply of 1 million
2. **No Halving/Multiple Epochs**: Both "Standard" and "Extended" distribution show only 1 epoch when Extended should have 15+ epochs
3. **Wrong Burn Amounts**: Cumulative secondary burned values are way off from expected epoch sizes
4. **Mathematical Error**: The formula `reward_e8s = primary_per_threshold * in_slot_burn * 10000` produces values 18,600x too large

## Core Testing Philosophy

### 1. Business Logic Validation Tests
- Test WHAT the code should do, not just that it runs
- Validate mathematical correctness of tokenomics calculations
- Ensure economic invariants are maintained
- Compare simulation predictions with actual canister behavior

### 2. Property-Based Testing
Essential invariants that must always hold:
- Total minted must NEVER exceed max_supply
- Each epoch's minted amount must be positive and reasonable
- Halving must actually reduce rewards (or increase based on halving_step)
- Secondary burn thresholds must increase monotonically
- Cumulative supply must be monotonically increasing
- USD cost calculations must be realistic

### 3. Known-Value Tests
Create test cases with hand-calculated expected outputs:
- Default preset: 1M max supply should have ~3-7 epochs, not 1
- Extended distribution: Should have 15+ epochs as advertised
- Specific test: initial_reward=100, burn=5000, max=21M → calculate exact expected values
- Validate against real-world expectations (e.g., $1000 initial valuation)

### 4. Integration with Operational Validation

Leverage the existing operational validation framework from `tests/operational_validation/`:
- **TokenTestEnvironment**: Already deploys all 6 canisters
- **LargeScaleValidationEnv**: Enhanced environment with validation tracking
- **Real Operations**: Execute actual swap/burn operations and track state
- **Validation Checkpoints**: Compare predictions vs actual at multiple points

## Implementation Plan

### Phase 1: Create Failing Tests (Red)

#### 1. Unit Tests for simulation.rs
```rust
#[test]
fn test_default_preset_calculations() {
    let args = PreviewArgs {
        primary_max_supply: 1_000_000,
        tge_allocation: 1,
        initial_secondary_burn: 1_000_000,
        halving_step: 70,
        initial_reward_per_burn_unit: 2000,
    };
    
    let result = preview_tokenomics(args);
    
    // Should NOT produce 18 billion tokens!
    let total_minted = result.cumulative_supply_data_y.last().unwrap();
    assert!(total_minted <= 1_000_000 * E8S, 
        "Total minted {} exceeds max supply {}", total_minted, 1_000_000 * E8S);
    
    // Should have reasonable number of epochs (3-7 for quick launch)
    assert!(result.minted_per_epoch_data_y.len() >= 3, 
        "Too few epochs: {}", result.minted_per_epoch_data_y.len());
    assert!(result.minted_per_epoch_data_y.len() <= 7, 
        "Too many epochs: {}", result.minted_per_epoch_data_y.len());
}

#[test]
fn test_extended_distribution_preset() {
    let args = PreviewArgs {
        primary_max_supply: 1_000_000,
        tge_allocation: 1,
        initial_secondary_burn: 200_000,
        halving_step: 90,
        initial_reward_per_burn_unit: 100,
    };
    
    let result = preview_tokenomics(args);
    
    // Should have 15+ epochs as advertised
    assert!(result.minted_per_epoch_data_y.len() >= 15,
        "Extended distribution should have 15+ epochs, got {}", 
        result.minted_per_epoch_data_y.len());
}
```

#### 2. Mathematical Correctness Tests
```rust
#[test]
fn test_mathematical_correctness() {
    // Hand-calculate expected values
    let args = PreviewArgs {
        primary_max_supply: 21_000_000,
        tge_allocation: 0,
        initial_secondary_burn: 5_000,
        halving_step: 50,
        initial_reward_per_burn_unit: 100,
    };
    
    let result = preview_tokenomics(args);
    
    // First epoch calculation:
    // reward_e8s = 100 * 5000 * 10000 = 5,000,000,000
    // reward_tokens = 5,000,000,000 / 100,000,000 = 50 tokens
    let first_epoch_minted = result.minted_per_epoch_data_y[0];
    assert_eq!(first_epoch_minted, 50 * E8S,
        "First epoch should mint 50 tokens, got {}", first_epoch_minted / E8S);
    
    // Second epoch (with 50% halving):
    // burn requirement doubles: 10,000
    // reward halves: 50
    // tokens = 50 * 10,000 * 10,000 / E8S = 50 tokens
    if result.minted_per_epoch_data_y.len() > 1 {
        let second_epoch_minted = result.minted_per_epoch_data_y[1];
        assert_eq!(second_epoch_minted, 50 * E8S,
            "Second epoch should mint 50 tokens, got {}", second_epoch_minted / E8S);
    }
}
```

#### 3. Supply Invariant Tests
```rust
#[test]
fn test_supply_invariants() {
    let test_cases = vec![
        // (max_supply, initial_burn, reward, halving_step)
        (1_000_000, 1_000_000, 2000, 70), // Default
        (1_000_000, 200_000, 100, 90),    // Extended
        (10_000_000, 500_000, 500, 45),   // Balanced
    ];
    
    for (max_supply, initial_burn, reward, halving) in test_cases {
        let args = PreviewArgs {
            primary_max_supply: max_supply,
            tge_allocation: 1,
            initial_secondary_burn,
            halving_step: halving,
            initial_reward_per_burn_unit: reward,
        };
        
        let result = preview_tokenomics(args);
        
        // Property 1: Cumulative supply is monotonically increasing
        for i in 1..result.cumulative_supply_data_y.len() {
            assert!(result.cumulative_supply_data_y[i] >= result.cumulative_supply_data_y[i-1],
                "Supply decreased at index {}", i);
        }
        
        // Property 2: Never exceed max supply
        for (i, &supply) in result.cumulative_supply_data_y.iter().enumerate() {
            assert!(supply <= max_supply * E8S,
                "Supply {} at index {} exceeds max {}", supply, i, max_supply * E8S);
        }
        
        // Property 3: Each epoch mints positive amount
        for (i, &minted) in result.minted_per_epoch_data_y.iter().enumerate() {
            assert!(minted > 0, "Epoch {} minted 0 tokens", i);
        }
    }
}
```

#### 4. USD Cost Validation Tests
```rust
#[test]
fn test_usd_cost_calculations() {
    let args = PreviewArgs {
        primary_max_supply: 1_000_000,
        tge_allocation: 1,
        initial_secondary_burn: 200_000, // $1000 initial valuation
        halving_step: 90,
        initial_reward_per_burn_unit: 100,
    };
    
    let result = preview_tokenomics(args);
    
    // Initial valuation should be ~$1000 (200,000 * $0.005)
    let first_cost = result.cumulative_usd_cost_data_y[1]; // After first epoch
    assert!((first_cost - 1000.0).abs() < 10.0,
        "First epoch cost should be ~$1000, got ${}", first_cost);
    
    // Costs should increase over time
    for i in 1..result.cumulative_usd_cost_data_y.len() {
        assert!(result.cumulative_usd_cost_data_y[i] >= result.cumulative_usd_cost_data_y[i-1],
            "USD cost decreased at index {}", i);
    }
    
    // Final cost should be reasonable (not in millions for 1M token supply)
    let final_cost = result.cumulative_usd_cost_data_y.last().unwrap();
    assert!(final_cost < &100_000.0,
        "Final cost ${} seems unreasonably high for 1M token supply", final_cost);
}
```

### Phase 2: Fix Implementation (Green)

The bug is in `simulation.rs` line 181:
```rust
let reward_e8s = primary_per_threshold * in_slot_burn * 10000;
```

This multiplies by 10,000 when it should properly handle the conversion. The fix needs to:
1. Correct the mathematical formula
2. Ensure proper E8S conversions
3. Validate against expected behavior

### Phase 3: Integration with Operational Validation

Extend the existing `tests/operational_validation/` framework:

```rust
// In graph_comparison_tests.rs
#[test]
fn test_simulation_matches_actual_canister() {
    let mut env = LargeScaleValidationEnv::new();
    
    // Get simulation predictions
    let args = PreviewArgs {
        primary_max_supply: 21_000_000,
        tge_allocation: 0,
        initial_secondary_burn: 5_000,
        halving_step: 50,
        initial_reward_per_burn_unit: 100,
    };
    let predictions = preview_tokenomics(args);
    
    // Execute real operations
    env.execute_swap(1000 * E8S).expect("Failed to swap");
    
    // Burn through first epoch
    for _ in 0..50 {
        env.execute_burn(100).expect("Failed to burn");
    }
    
    let state = env.capture_current_state();
    
    // Compare with predictions
    let predicted_supply = predictions.cumulative_supply_data_y
        .iter()
        .find(|&&x| x >= 5000)
        .unwrap_or(&0);
    
    assert_eq!(state.primary_supply, *predicted_supply,
        "Actual supply {} doesn't match prediction {}", 
        state.primary_supply, predicted_supply);
}
```

### Phase 4: Continuous Validation

1. **Add to CI/CD Pipeline**
   - Run all tokenomics tests on every commit
   - Fail builds if invariants are violated
   - Track performance metrics

2. **Test Data Generators**
   ```rust
   #[test]
   fn test_random_parameters() {
       use rand::Rng;
       let mut rng = rand::thread_rng();
       
       for _ in 0..100 {
           let args = PreviewArgs {
               primary_max_supply: rng.gen_range(100_000..100_000_000),
               tge_allocation: rng.gen_range(0..10_000),
               initial_secondary_burn: rng.gen_range(1_000..10_000_000),
               halving_step: rng.gen_range(25..99),
               initial_reward_per_burn_unit: rng.gen_range(1..10_000),
           };
           
           let result = preview_tokenomics(args);
           
           // Validate invariants hold for random inputs
           validate_tokenomics_invariants(&args, &result);
       }
   }
   ```

3. **Performance Benchmarks**
   ```rust
   #[bench]
   fn bench_preview_tokenomics(b: &mut Bencher) {
       let args = PreviewArgs { /* ... */ };
       b.iter(|| preview_tokenomics(args.clone()));
   }
   ```

## Success Criteria

1. **All New Tests Must Fail Initially**
   - Confirms we're testing the actual bug
   - Validates our understanding of the problem

2. **After Fix, All Tests Pass**
   - Bug is resolved
   - No regression in functionality

3. **Integration Tests Confirm Consistency**
   - Simulation matches actual canister behavior
   - Frontend displays match backend calculations

4. **Performance Maintained**
   - Calculations complete in < 100ms
   - Memory usage reasonable

## Benefits of This Approach

1. **Immediate Bug Detection**: Would have caught the 18.6B token bug
2. **Clear Specification**: Tests document expected behavior
3. **Regression Prevention**: Bug won't reappear
4. **Confidence in Changes**: Can refactor safely
5. **Living Documentation**: Tests show how system should work

## Implementation Timeline

- **Day 1**: Write all failing tests, confirm they catch the bug
- **Day 2**: Fix the calculation bug, make tests pass
- **Day 3**: Integration with operational validation framework
- **Day 4**: Add to CI/CD, documentation, and cleanup

## Key Takeaways

The operational validation framework already built provides excellent infrastructure for testing real behavior. What was missing was:
1. Tests that validate business logic correctness
2. Known-value tests with hand-calculated expectations
3. Property-based invariant testing
4. Integration between simulation and actual behavior

By adding these test types, we transform our test suite from "does it run?" to "does it work correctly?"