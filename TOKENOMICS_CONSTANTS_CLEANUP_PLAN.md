# Tokenomics Constants Cleanup Plan

## Overview
The tokenomics canister contains several hardcoded constants that are now obsolete due to the implementation of dynamic configuration. This document provides a careful cleanup plan that respects the audited code while removing confusion and potential bugs.

## Current State

### Hardcoded Constants in `src/tokenomics/src/utils.rs`
```rust
pub const MAX_PRIMARY: u64 = 2100000000000000; // 21 million
```

### Hardcoded Arrays in `src/tokenomics/src/storage.rs`
```rust
pub const SECONDARY_THRESHOLDS: [u64; 18] = [...];  // Lines 16-35
pub const PRIMARY_PER_THRESHOLD: [u64; 18] = [...]; // Lines 38-57
```

## The Problem
1. **MAX_PRIMARY is still referenced** in `update.rs` as a fallback, but this creates confusion
2. **Hardcoded arrays are unused** - we now use dynamic arrays via `get_thresholds()` and `get_rewards()`
3. **Mixed patterns** - some code uses hardcoded values as fallbacks, creating inconsistency

## Cleanup Strategy

### Phase 1: Remove MAX_PRIMARY Constant (HIGH PRIORITY)
1. **Current usage**: Used as fallback in `update.rs` line 311:
   ```rust
   let max_primary_supply = get_config().map(|c| c.max_primary_supply).unwrap_or(MAX_PRIMARY);
   ```

2. **Fix**: Remove the fallback pattern entirely
   ```rust
   let max_primary_supply = get_config()
       .map(|c| c.max_primary_supply)
       .ok_or_else(|| ExecutionError::new_with_log(...))?;
   ```

3. **Justification**: Every tokenomics canister MUST be initialized with a max_supply. No fallback needed.

4. **Files to modify**:
   - Remove `pub const MAX_PRIMARY` from `src/utils.rs`
   - Update import in `src/lib.rs` (remove MAX_PRIMARY)
   - Update usage in `src/update.rs` to return error if config missing

### Phase 2: Handle Hardcoded Arrays (MEDIUM PRIORITY)
The arrays serve as fallbacks in the dynamic getters:

```rust
pub fn get_thresholds() -> Vec<u64> {
    DYNAMIC_THRESHOLDS.with(|t| {
        let thresholds = t.borrow();
        if thresholds.is_empty() {
            SECONDARY_THRESHOLDS.to_vec()  // Fallback to hardcoded
        } else {
            thresholds.clone()
        }
    })
}
```

**Options**:
1. **Keep as documentation** - Move to comments showing the original audited values
2. **Remove entirely** - Require proper initialization (recommended)
3. **Move to tests** - Use only for testing default behavior

**Recommended approach**: Option 2 - Remove entirely and return error if not initialized

### Phase 3: Update Error Handling (LOW PRIORITY)
Add proper error types for missing configuration:
```rust
ConfigurationMissing { 
    field: String,
    details: String 
}
```

## Implementation Steps

### Step 1: Update MAX_PRIMARY Usage
```rust
// In src/update.rs, replace:
let max_primary_supply = get_config().map(|c| c.max_primary_supply).unwrap_or(MAX_PRIMARY);

// With:
let config = get_config().ok_or_else(|| {
    ExecutionError::new_with_log(
        actual_caller,
        "mint_primary",
        ExecutionError::ConfigurationMissing {
            field: "max_primary_supply".to_string(),
            details: "Tokenomics canister not properly initialized".to_string(),
        }
    )
})?;
let max_primary_supply = config.max_primary_supply;
```

### Step 2: Update Dynamic Getters
```rust
// In src/storage.rs, update get_thresholds:
pub fn get_thresholds() -> Result<Vec<u64>, String> {
    DYNAMIC_THRESHOLDS.with(|t| {
        let thresholds = t.borrow();
        if thresholds.is_empty() {
            Err("Thresholds not initialized".to_string())
        } else {
            Ok(thresholds.clone())
        }
    })
}
```

### Step 3: Clean Up Constants
1. Delete `MAX_PRIMARY` from `src/utils.rs`
2. Move `SECONDARY_THRESHOLDS` and `PRIMARY_PER_THRESHOLD` to a comment block in `storage.rs`:
   ```rust
   // Original audited values for reference:
   // SECONDARY_THRESHOLDS: [21_000, 42_000, ...]
   // PRIMARY_PER_THRESHOLD: [50_000, 25_000, ...]
   ```

### Step 4: Update All Callers
Search for all uses of `get_thresholds()` and `get_rewards()` and handle the Result type.

## Testing Requirements
1. Ensure all existing tokens continue to work
2. Test that new tokens initialize properly
3. Verify error messages are clear when configuration is missing

## Risk Assessment
- **Low Risk**: Removing unused constants
- **Medium Risk**: Changing fallback behavior to errors
- **Mitigation**: Thorough testing of initialization flow

## Benefits
1. **Clarity**: No confusion about which values are used
2. **Safety**: Explicit errors instead of silent fallbacks
3. **Maintainability**: Single source of truth for configuration
4. **Audit Trail**: All changes documented in TOKENOMICS_CHANGE_LOG.md

## Important Notes
- Always update TOKENOMICS_CHANGE_LOG.md with every change
- Test with both new tokens and existing tokens
- Consider backwards compatibility for any deployed tokens
- The goal is minimal, surgical changes that improve clarity

## Next Agent Checklist
- [ ] Read this document completely
- [ ] Review current usage of constants in the codebase
- [ ] Implement Phase 1 (MAX_PRIMARY removal)
- [ ] Test thoroughly
- [ ] Document all changes in TOKENOMICS_CHANGE_LOG.md
- [ ] Consider if Phase 2 is necessary based on findings