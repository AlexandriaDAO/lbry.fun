# CLAUDE.md

## lbry_fun Canister Overview

Token launch factory that creates and manages all token infrastructure. Each launch spawns 5 canisters (primary/secondary tokens, tokenomics, icp_swap, logs) and creates a KongSwap pool.

## Architecture
```
create_token() → spawns:
├── Primary Token (ICRC-1) - minted to tokenomics canister
├── Secondary Token (ICRC-1) - controlled by swap canister
├── Tokenomics Canister - manages supply and rewards
├── ICP Swap Canister - handles minting/burning
├── Logs Canister - collects statistics
└── KongSwap Pool - trading liquidity
```

## Critical Implementation Details

### E8S Conversion for Tokenomics
```rust
// Frontend sends rewards in E8S: 0.105 tokens = 10,500,000 E8S
// Tokenomics expects 4-decimal format: 0.105 tokens = 1,050
let initial_reward_4decimal = initial_reward_per_burn_unit / 10_000;
```

### Pool Creation & Retry
- KongSwap pool creation can fail - check `pool_creation_failed` flag
- Use `retry_pool_creation(token_id)` to manually retry
- Tokens aren't "live" until pool succeeds and launch delay passes

## Key Functions

- `create_token()`: Main factory (requires 5 ICP deposit, 16 parameters)
- `get_live()`: Returns tokens with successful pools past launch delay
- `get_upcoming()`: Returns tokens pending launch or with failed pools
- `get_tokenomics_graphs()`: Returns simulation data for existing tokens
- `preview_tokenomics_graphs()`: Pre-creation tokenomics simulation

## Common Errors & Solutions

- **"Invalid reward below minimum"**: Rewards dropped below 100 (0.01 tokens in 4-decimal)
- **Pool creation failed**: KongSwap issues - use retry function
- **Transfer failed**: Check approvals include 10,000 E8S transfer fee

## Testing
```bash
cd tests && cargo test test_create_token
```

## Key Integration Points
- KongSwap: `2ipq2-uqaaa-aaaar-qailq-cai`
- ICP Ledger: `ryjl3-tyaaa-aaaaa-aaaba-cai`