## Canister Rebuilding
To rebuild canisters for test use these commands with the correct canister name:
```bash
cargo build --release --target wasm32-unknown-unknown --package icp_swap
/home/theseus/.cargo/bin/ic-wasm target/wasm32-unknown-unknown/release/icp_swap.wasm -o target/wasm32-unknown-unknown/release/icp_swap.wasm shrink
cp target/wasm32-unknown-unknown/release/icp_swap.wasm src/lbry_fun/src/icp_swap.wasm
candid-extractor target/wasm32-unknown-unknown/release/icp_swap.wasm > src/icp_swap/icp_swap.did
```

## Test Patterns
- Use `TokenTestEnvironment` for integration tests (deploys all 6 canisters)
- Use `shared_helpers.rs` functions for common operations:
  - `swap_icp()` - mint secondary tokens
  - `setup_user_with_primary()` - complete setup with primary tokens
  - Use proper ICRC2 approve before token operations
- Operations expect natural units, not e8s (except balance queries)
- All operations return `Result<String, ExecutionError>` from canisters
- Never change a test to make it pass unless you're absolutely positive that the test failure is not a reflection of an issue in the core logic.

## E8S Conversions in Tests

See main CLAUDE.md for comprehensive E8S conversion patterns.

**Test-Specific Notes**:
- Test helpers accept natural units for readability
- Balance queries return E8S (divide by 100_000_000 for assertions)
- `burn_secondary` expects natural units (matches frontend)