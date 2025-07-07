This canister has been audited. Don't make any edits without asking first, and every single change must be recorded in the TOKENOMICS_CHANGE_LOG.md file.

## Tokenomics Canister Specifics

See main CLAUDE.md for comprehensive E8S conversion patterns.

### Critical for this canister:
- Internal 4-decimal format for space efficiency (50,000 = 5.0 tokens)
- **Must multiply by 10,000** to convert to E8S
- Token creation parameters come as natural units, not E8S
- Halving step is plain percentage (70 = 70%)