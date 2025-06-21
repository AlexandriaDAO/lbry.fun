# Tokenomics Real Simulation Master Plan

## Executive Summary

The current tokenomics preview system is fundamentally broken because it attempts to duplicate complex logic that already exists in the actual canisters. This creates:
- **Maintenance nightmare**: Two separate implementations that drift apart
- **Bugs**: The simulation doesn't match reality (as we've seen)
- **Wasted effort**: Constantly fixing simulation instead of improving actual logic

**Solution**: Use the actual canister logic to generate previews, just like running a test.

## Why This Approach is Superior

1. **Single Source of Truth**: The tokenomics canister's logic IS the preview
2. **100% Accuracy**: What you see is literally what you get
3. **No Duplicate Code**: One implementation to maintain
4. **Test-Like Approach**: Deploy temporary canisters, run them, get results
5. **Future-Proof**: Any changes to tokenomics automatically reflected in preview

## Current Files to Delete

### Core Simulation Files
```
src/lbry_fun/src/simulation.rs
src/lbry_fun/src/simulation_new.rs  
src/lbry_fun/src/tokenomics_simple.rs
```

### Test Files
```
tests/tests/unit/test_simulation_*.rs (all simulation tests)
tests/tests/unit/test_tokenomics_bug_*.rs
tests/tests/unit/test_fixed_simulation.rs
tests/tests/unit/test_tokenomics_schedule_generation.rs
tests/simulate_preset_graphs.rs
tests/simulate_graph_data.js
```

### Scripts and Utilities
```
test_tokenomics_fix.sh
analyze_tokenomics_output.js
analyze_clean_output.js
analyze_fix_results.js
verify_calculation.js
test_halving_math.js
test_schedule_generation.sh
test_schedule.rs
tests/extract_preset_data.js
```

### Documentation
```
tokenomics_bug_master_plan.md
tokenomics_clean_implementation_summary.md
tokenomics_clean_fix_plan.md
tokenomics_fix_summary.md
tokenomics_fix_verification.md
tokenomics_real_issue_analysis.md
TOKENOMICS_BUG_CONSOLIDATED_GUIDE.md
```

### Graph Validation Tests
```
tests/tests/unit/test_graph_data_interpretation.rs
tests/tests/unit/test_graph_vs_reality.rs
tests/operational_validation/graph_comparison_tests.rs
tests/prompts/graph_*.md
tests/graph_data_summary.md
```

## Files to Modify

### Backend
- `src/lbry_fun/src/lib.rs` - Remove simulation module imports
- `src/lbry_fun/src/queries.rs` - Remove preview_tokenomics_graphs function
- `src/lbry_fun/lbry_fun.did` - Remove preview methods from interface

### Frontend  
- `src/lbry_fun_frontend/src/features/token/components/createTokenForm.tsx` - Replace with new preview
- `src/lbry_fun_frontend/src/features/token/lbryFunSlice.ts` - Update state management
- `src/lbry_fun_frontend/src/features/token/thunk/previewTokenomics.thunk.ts` - New implementation

## New Architecture

### Option 1: Temporary Canister Approach (Recommended)
```
User Input → Deploy Temp Canisters → Run Real Logic → Get Results → Destroy Canisters
```

1. **Preview Request Handler** (in lbry_fun)
   ```rust
   async fn preview_tokenomics_real(params: PreviewParams) -> GraphData {
       // 1. Deploy temporary tokenomics canister
       let temp_tokenomics = deploy_temp_tokenomics(params).await?;
       
       // 2. Deploy temporary icp_swap canister
       let temp_swap = deploy_temp_swap(params).await?;
       
       // 3. Run actual mint/burn cycles
       let results = simulate_epochs(temp_tokenomics, temp_swap).await?;
       
       // 4. Clean up
       destroy_canister(temp_tokenomics).await?;
       destroy_canister(temp_swap).await?;
       
       // 5. Return formatted graph data
       format_results_to_graph(results)
   }
   ```

2. **Epoch Simulator**
   ```rust
   async fn simulate_epochs(tokenomics: Principal, swap: Principal) -> Vec<EpochResult> {
       let mut results = vec![];
       
       // Get the actual schedule from tokenomics canister
       let schedule = tokenomics.get_schedule().await?;
       
       // Run through each epoch
       for epoch in schedule.epochs {
           let burn_result = swap.simulate_burn(epoch.burn_amount).await?;
           let mint_result = tokenomics.simulate_mint(burn_result).await?;
           
           results.push(EpochResult {
               secondary_burned: burn_result.amount,
               primary_minted: mint_result.amount,
               cost_per_token: calculate_cost(burn_result, mint_result),
           });
       }
       
       results
   }
   ```

### Option 2: Stateless Preview Method
Add preview methods to actual canisters that don't require state:

1. **In tokenomics canister**:
   ```rust
   #[query]
   fn preview_schedule(params: TokenomicsParams) -> TokenomicsSchedule {
       // Use the EXACT same logic as init, but don't store
       generate_tokenomics_schedule(params)
   }
   ```

2. **In icp_swap canister**:
   ```rust
   #[query]
   fn preview_mint_calculation(burn_amount: u64, schedule: TokenomicsSchedule) -> MintResult {
       // Use the EXACT same logic as burn_secondary, but don't execute
       calculate_mint_amount(burn_amount, schedule)
   }
   ```

## Implementation Steps

### Phase 1: Setup (Day 1)
- [ ] Create new preview module in lbry_fun
- [ ] Set up temporary canister deployment functions
- [ ] Create cleanup utilities

### Phase 2: Core Implementation (Day 2-3)
- [ ] Implement preview_tokenomics_real function
- [ ] Create epoch simulation logic
- [ ] Add inter-canister communication for preview
- [ ] Format results to match current GraphData structure

### Phase 3: Frontend Integration (Day 4)
- [ ] Update thunk to call new preview endpoint
- [ ] Ensure GraphData format compatibility
- [ ] Update any frontend validation

### Phase 4: Cleanup (Day 5)
- [ ] Delete all simulation files listed above
- [ ] Remove unused imports and types
- [ ] Update tests to use new approach
- [ ] Clean up documentation

### Phase 5: Validation (Day 6)
- [ ] Test all presets (Quick Launch, Balanced, Extended)
- [ ] Verify graphs match expected values
- [ ] Ensure no performance regression
- [ ] Document new approach

## Success Criteria

1. **Accuracy**: Preview exactly matches what happens when token is created
2. **Performance**: Preview completes in < 5 seconds
3. **Maintainability**: Single implementation of tokenomics logic
4. **Reliability**: No more discrepancies between preview and reality

## Technical Considerations

### Temporary Canister Management
- Use minimal cycles for temp canisters
- Ensure cleanup even if preview fails
- Consider rate limiting to prevent abuse

### State Isolation
- Temp canisters should not affect production state
- Use different canister IDs to avoid conflicts
- Clean up all temporary data

### Error Handling
- Graceful fallback if canister deployment fails
- Clear error messages for users
- Logging for debugging

## Migration Checklist

- [ ] Implement new preview system
- [ ] Test with all presets
- [ ] Update frontend to use new endpoint
- [ ] Delete all simulation files
- [ ] Update documentation
- [ ] Remove old tests
- [ ] Deploy to production
- [ ] Monitor for issues

## Benefits After Migration

1. **No More Tokenomics Bugs**: Preview = Reality
2. **Easier Maintenance**: One codebase
3. **Better Testing**: Can test actual canister logic
4. **Future Features**: Easy to add new tokenomics features
5. **Confidence**: Users see exactly what they'll get

## Notes for Implementation

- Start with Option 2 (stateless preview) as it's simpler
- If that doesn't work, implement Option 1 (temp canisters)
- Keep GraphData format for backward compatibility
- Add comprehensive logging for debugging
- Consider caching results for common parameter sets

This approach treats the preview as what it really is: a test run of the actual system. No more guessing, no more simulation bugs, just reality.