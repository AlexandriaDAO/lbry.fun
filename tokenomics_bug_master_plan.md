# Tokenomics Bug Master Plan

## Executive Summary

The tokenomics system has a critical bug in the reward calculation formula that causes massive overminting. All three presets (Extended Distribution, Balanced, Quick Launch) mint 142-176% of the maximum supply, breaking the fundamental token economics.

## The Core Bug

### Root Cause
The formula in `simulation.rs` line 181:
```rust
reward_e8s = primary_per_threshold * in_slot_burn * 10000;
```

This multiplies by 10,000 when it should likely divide, causing rewards to be 100x larger than intended.

### Impact
- **Quick Launch**: First epoch mints 200,000 tokens (20% of 1M supply)
- **Balanced**: First epoch mints 25,000 tokens (2.5% of supply)
- **Extended Distribution**: Mints 1.49M tokens total (149% of max supply)

## Current State

### Backend Issues
1. **Overminting**: All presets exceed max supply by 42-76%
2. **Wrong epoch counts**: Extended Distribution gives 10-11 epochs, not 15+
3. **No halving in practice**: Actual tokenomics gives constant rewards, not decreasing

### Frontend Status
✅ **Correctly displays** the problematic backend values
✅ **My fixes added**:
- Supply cap warnings when exceeded
- Actual vs advertised epoch counts
- Overflow detection for extreme parameters
- E8S conversion verification (working correctly)
- Unit labels on graphs

## Fix Options

### Option 1: Fix the Backend Calculation (Recommended)
Fix the formula to produce reasonable token amounts:

```rust
// Current (broken)
reward_e8s = primary_per_threshold * in_slot_burn * 10000;

// Option A: Divide by 10000 (treats reward as basis points)
reward_e8s = (primary_per_threshold * in_slot_burn * E8S) / 10000;

// Option B: Direct interpretation (reward = tokens per burn)
reward_e8s = primary_per_threshold * E8S;

// Option C: Scale by burn unit ratio
reward_e8s = (primary_per_threshold * actual_burn * E8S) / initial_burn_unit;
```

### Option 2: Redefine Parameters
Keep the formula but change parameter meanings:
- Reduce all reward rates by 100x
- Update presets to use smaller values
- Add clear documentation about units

### Option 3: Frontend Workarounds (Not Recommended)
- Artificially cap displayed values at max supply
- Add heavy warnings about the issue
- Prevent token creation with problematic parameters

## Implementation Plan

### Phase 1: Backend Fix (Priority 1)
1. **Fix the formula** in `lbry_fun/src/simulation.rs`
2. **Add supply cap logic** to prevent any epoch from exceeding max supply
3. **Implement actual halving** in tokenomics canister (currently gives constant rewards)
4. **Update tests** to verify correct behavior

### Phase 2: Frontend Updates (Priority 2)
1. **Remove overminting warnings** once backend is fixed
2. **Update preset descriptions** to match actual behavior
3. **Add simulation preview** before token creation
4. **Improve parameter validation** with realistic bounds

### Phase 3: Testing & Validation (Priority 3)
1. **Unit tests** for all calculation paths
2. **Integration tests** with actual token burns
3. **Graph validation** comparing displayed vs actual values
4. **Preset verification** for all three options

## Test-Driven Development Approach

### Existing Tests That Catch The Bug
```rust
// ✅ test_demonstrate_overminting_bug
// Shows 1.42M tokens minted for 1M supply

// ✅ test_extended_distribution_epoch_count  
// Shows only 10 epochs instead of 15+

// ✅ test_supply_overflow_detection
// Panics when cumulative exceeds max supply
```

### New Tests Needed
1. **Halving verification**: Ensure rewards actually decrease
2. **Partial epoch test**: Verify last epoch caps at max supply
3. **E8S boundary test**: Check edge cases in conversion
4. **Parameter validation**: Test extreme values

## Migration Strategy

### For Existing Tokens
- Current tokens are already affected by overminting
- Consider grandfathering them or offering migration
- Document the issue transparently

### For New Tokens
- Deploy fix before any new tokens are created
- Add pre-creation simulation to show exact outcomes
- Require explicit acknowledgment of tokenomics

## Success Criteria

1. **No overminting**: Total minted ≤ max supply for all parameter combinations
2. **Accurate epochs**: Extended Distribution delivers 15+ epochs as promised
3. **Working halving**: Each epoch mints less than the previous (for halving < 100%)
4. **Clear documentation**: Users understand exactly what parameters mean
5. **Matching graphs**: Frontend graphs match actual minting behavior

## Timeline Estimate

- **Week 1**: Backend formula fix and testing
- **Week 2**: Frontend updates and integration
- **Week 3**: Full system testing and documentation
- **Week 4**: Deployment and migration planning

## Risk Assessment

### High Risk
- Breaking existing tokens if formula changes
- User confusion about parameter meanings
- Liquidity issues if minting is too restricted

### Mitigation
- Comprehensive testing before deployment
- Clear communication about changes
- Gradual rollout with monitoring

## Appendix: Current vs Fixed Behavior

### Quick Launch Preset
| Metric | Current (Broken) | Fixed |
|--------|-----------------|--------|
| First Epoch | 200,000 tokens (20%) | 2,000 tokens (0.2%) |
| Total Epochs | 4 | 5-7 |
| Total Minted | 1,420,801 (142%) | 1,000,000 (100%) |

### Extended Distribution  
| Metric | Current (Broken) | Fixed |
|--------|-----------------|--------|
| First Epoch | 2,000 tokens (0.2%) | 20 tokens (0.002%) |
| Total Epochs | 10-11 | 15-20 |
| Total Minted | 1,489,841 (149%) | 1,000,000 (100%) |

## Next Steps

1. **Review this plan** with the team
2. **Decide on formula fix** approach
3. **Create feature branch** for implementation
4. **Begin test-driven development**
5. **Deploy to testnet** for validation

---

*This master plan consolidates findings from:*
- `tokenomics_bug_investigation_results.md`
- `tokenomics_test_driven_frontend_fixes.md`
- `graph_reality_validation_tests.md`
- `tokenomics_validation_plan.md`
- Test results and simulations

## Related Tokenomics Bug Documentation Files

- ./tests/graph_data_summary.md
- ./tests/prompts/graph_reality_validation_tests.md
- ./tests/prompts/tokenomics_bug_investigation_results.md
- ./tests/prompts/tokenomics_frontend_fix_plan.md
- ./tests/prompts/tokenomics_tdd_validation_plan.md
- ./tests/prompts/tokenomics_test_driven_frontend_fixes.md
- ./tests/prompts/tokenomics_validation_plan.md
