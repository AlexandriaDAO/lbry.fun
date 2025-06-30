# TOKENOMICS Implementation Progress

## Overview
Implementing ONLY the good changes from @TOKENOMICS_DIFFERENCES.md into the original audited canister, following the guidelines from @SYSTEM_ARCHITECTURE.md and @implementation_guidelines.md. Make sure every implemented change is fully documented in @TOKENOMICS_CHANGELOG.md

**Key Decision**: Keep economic parameters (thresholds/rewards) hardcoded to preserve the audited economic model. Only token canister IDs will be configurable.

## Completed Tasks ✓
- [ ] None yet - starting fresh implementation

## Remaining Tasks from @TOKENOMICS_DIFFERENCES.md

### High Priority
- [ ] Simplify distribution model to 100% burner
  - [ ] Remove NFT-related code and dependencies
  - [ ] Remove get_two_random_nfts function
  - [ ] Update mint_primary to send 100% to burner
  - [ ] Remove nft_canister_id from configuration

- [ ] Generic token naming (primary/secondary instead of ALEX/LBRY)
  - [ ] Rename all ALEX references to primary_token
  - [ ] Rename all LBRY references to secondary_token
  - [ ] Update function names and parameters
  - [ ] Update comments and documentation

### Medium Priority (Minimal Configuration)
- [ ] Minimal configurable parameters (store in stable memory)
  - [ ] Add simple Configs storage type for token canister IDs only
  - [ ] IMPORTANT: Keep all economic parameters (thresholds/rewards) hardcoded
  - [ ] Create get_configs() query function
  - [ ] IMPORTANT: Keep 10,000 multiplication with clear comment explaining why

- [ ] Update InitArgs to accept minimal configuration
  - [ ] primary_token_ledger (required)
  - [ ] secondary_token_ledger (required)
  - [ ] Note: Economic parameters remain hardcoded for safety

### Low Priority
- [ ] ICRC standard compliance
  - [ ] Update ic-ledger-types dependency if needed
  - [ ] Ensure using latest ICRC interfaces

- [ ] Error handling improvements
  - [ ] Add better error messages
  - [ ] Add new error types as needed

- [ ] Query function additions
  - [ ] get_tokenomics_schedule() - returns thresholds and rewards

## CRITICAL - Changes to AVOID ❌
- ❌ DO NOT remove the 10,000 multiplication (lines 348-358)
- ❌ Keep hardcoded thresholds as primary implementation

## Implementation Notes

### Decimal Handling
The original code multiplies by 10,000 for decimal conversion. This is NOT a bug - it's likely converting from 4 decimals (LBRY) to 8 decimals (ALEX). Keep this logic and add clear comments:
```rust
// Convert from 4 decimal places (LBRY) to 8 decimal places (ALEX)
// by multiplying by 10,000 (10^4)
let mint_amount = reward_per_token * secondary_burned * 10_000;
```

### Configuration Approach
1. Keep all original hardcoded economic values (thresholds, rewards, halving)
2. Allow configuration only for:
   - Token canister IDs (primary and secondary)
3. Future enhancement: Template system with pre-validated economic models

### Distribution Model
For the launchpad version, simplify to 100% distribution:
- 100% to burner (no NFT integration needed)
- Remove get_two_random_nfts function
- Remove NFT canister dependencies

## Future Enhancements (NOT part of current implementation)
- [ ] Full configurability of economic parameters
  - [ ] Custom thresholds and rewards
  - [ ] Validation system for parameter bounds
  - [ ] Economic modeling tools
- [ ] Template system with pre-validated configurations
  - [ ] "Conservative" template (slower rewards)
  - [ ] "Standard" template (like original)
  - [ ] "Aggressive" template (faster rewards)

## Reference
All changes must align with:
- @TOKENOMICS_DIFFERENCES.md analysis
- @SYSTEM_ARCHITECTURE.md requirements
- @implementation_guidelines.md risk categories