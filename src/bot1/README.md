# Bot1 - Tokenomics Validation Bot

## Purpose
Automated bot that validates tokenomics by executing swap/burn cycles and comparing results with predictions.

## Quick Start

### Deploy
```bash
cargo build --release --target wasm32-unknown-unknown --package bot1
dfx deploy bot1 --specified-id ucwa4-rx777-77774-qaada-cai
```

### Fund Bot
```bash
# Add cycles for computation
dfx ledger fabricate-cycles --canister ucwa4-rx777-77774-qaada-cai --cycles 1000000000000000

# Add ICP for trading (100 ICP)
dfx canister call ryjl3-tyaaa-aaaaa-aaaba-cai icrc1_transfer '(record { to = record { owner = principal "ucwa4-rx777-77774-qaada-cai"; subaccount = null }; amount = 10000000000 })'
```

### Use Bot
```bash
# Validate pool before execution
dfx canister call bot1 validate_pool '(1)'

# Execute 10 loops with 1 ICP each for pool ID 1 (human-readable: 1 = 1 ICP)
dfx canister call bot1 execute_loops '(1, 1, 10)'

# Get results
dfx canister call bot1 get_table '(1)'
```

## File Structure
```
src/
├── lib.rs          # Main canister entry points
├── types.rs        # Data structures (LoopSnapshot, ValidationTable, etc.)
├── storage.rs      # State management (thread-local storage)
├── execute.rs      # Core loop execution logic
├── queries.rs      # Query functions (get_table)
└── utils.rs        # Helper functions for canister calls
```

## Key Functions

### execute_loops(pool_id, icp_amount, number_of_loops)
Executes trading loops:
- `pool_id`: The ID of the token pool to test
- `icp_amount`: Amount of ICP per loop in natural units (1 = 1 ICP)
- `number_of_loops`: How many swap/burn cycles to execute

Process:
1. Validates pool exists and is live
2. For each loop:
   - Swaps ICP for secondary tokens
   - Burns ALL secondary tokens for primary
   - Records metrics
   - Waits 2 seconds before next loop

### get_table(pool_id)
Returns validation data:
- All loop snapshots with detailed metrics
- Graph-formatted data matching frontend
- Summary statistics

## Recent Improvements
1. ✅ Fixed `get_token_by_id` method - now uses `get_all_token_record`
2. ✅ Added pool validation before execution
3. ✅ Improved error messages with structured error types
4. ✅ Added comprehensive logging throughout execution
5. ✅ ICP amounts now accept human-readable values (1 = 1 ICP)

## Data Flow
```
ICP → [swap] → Secondary Tokens → [burn] → Primary Tokens
         ↓                            ↓
    Record metrics              Record metrics
         ↓                            ↓
    Store snapshot  ←─────────────────┘
```

## Metrics Collected
- ICP spent per loop
- Secondary tokens received/burned
- Primary tokens minted
- Token total supplies
- Mint rates and costs
- Dust accumulation

See `BOT1_IMPROVEMENT_PLAN.md` for detailed improvement roadmap.