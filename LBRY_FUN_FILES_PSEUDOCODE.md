# LBRY_FUN Canister Files - Plain English Pseudocode

This document provides plain-English pseudocode for every file in the `src/lbry_fun/` directory.

## Table of Contents
1. [lib.rs](#librs)
2. [preview_canister.rs](#preview_canisterrs)
3. [queries.rs](#queriesrs)
4. [script.rs](#scriptrs)
5. [simulation_new.rs](#simulation_newrs)
6. [storage.rs](#storagers)
7. [tokenomics_simple.rs](#tokenomics_simplers)
8. [update.rs](#updaters)
9. [utlis.rs](#utlisrs)
10. [lbry_fun.did](#lbry_fundid)

---

## lib.rs

```yaml
Purpose: Main library entry point and module organization

Structure:
  1. Module declarations:
     - storage (public)
     - tokenomics_simple (public - exports TokenomicsSchedule, EpochData)
     - simulation_new (public - exports PreviewArgs, GraphData)
     - preview_canister (public - exports preview_tokenomics_with_real_canister)
     - queries (public)
     - update (public)
     - utils (public)
  
  2. Type definitions:
     LogsInitArgs:
       - primary_token_id: Principal
       - secondary_token_id: Principal
       - parent_canister_id: Principal  
       - pool_creation_delay: u64
       - icp_swap_canister_id: Principal
       - distribution_interval_seconds: u64
  
  3. Candid export:
     - Generates interface definitions for all public functions
```

---

## preview_canister.rs

```yaml
Purpose: Create temporary tokenomics canisters for preview/testing

Main Function: preview_tokenomics_with_real_canister(args)
  Input: PreviewArgs with tokenomics parameters
  Returns: GraphData for visualization
  
  Process:
    1. Deploy temporary preview canister
    2. Query canister for graph data
    3. Delete preview canister
    4. Return graph data

Helper Function: deploy_preview_tokenomics(args)
  Process:
    1. Create new canister with cycles
    2. Generate tokenomics schedule from parameters
    3. Extract arrays for initialization
    4. Install tokenomics WASM with init args
    5. Return canister principal
  
  Error handling: Convert all errors to strings

Helper Function: get_preview_graph_data(tokenomics_id)
  Process:
    1. Call tokenomics canister's get_tokenomics_graph_data()
    2. Parse response as GraphData
    3. Return graph data for visualization
  
  Used for: Frontend preview before actual token creation

Function: delete_preview_canister(canister_id)
  Process:
    1. Stop the canister
    2. Delete the canister
    3. Clean up resources
  
  Purpose: Remove temporary preview canisters after use
```

---

## queries.rs

```yaml
Purpose: Read-only functions for retrieving data

Function: get_all_token_record()
  Returns: Map of all tokens (ID → TokenRecord)
  Process:
    1. Access TOKENS storage
    2. Convert to iterator
    3. Collect all entries
    4. Return as vector of tuples

Function: get_upcomming()
  Returns: Tokens not yet live
  Process:
    1. Get current time
    2. For each token in storage:
       if pool_creation_failed OR pool_not_created OR 
       current_time < created_time + launch_delay_seconds:
         include in results
    3. Return filtered list

Function: get_live()
  Returns: Currently tradable tokens
  Process:
    1. Get current time
    2. For each token in storage:
       if pool_created AND NOT failed AND
       current_time >= created_time + launch_delay_seconds:
         include in results
    3. Sort by creation time (newest first)
    4. Return filtered list

Function: get_treasury_balance()
  Returns: Canister's ICP balance
  Process:
    1. Call get_self_icp_balance()
    2. Return balance

Function: preview_tokenomics_graphs(args)
  Input: PreviewArgs with economic parameters
  Returns: GraphData for visualization
  Process:
    1. Call simulation_new::preview_tokenomics(args)
    2. Return graph data

Function: preview_tokenomics_schedule(params)
  Input: Raw tokenomics parameters
  Returns: TokenomicsSchedule with epochs
  Process:
    1. Call preview_tokenomics_from_frontend with parameters
    2. Return complete schedule

Function: get_token_status(token_id)
  Input: Numeric token ID
  Returns: Detailed status information
  Process:
    1. Look up token by ID
    2. Calculate if live using launch_delay_seconds
    3. Calculate time until live
    4. Return TokenStatusDetail

Function: get_token_status_by_swap_canister(swap_id)
  Input: Swap canister principal
  Returns: Basic status information
  Process:
    1. Find token with matching swap canister
    2. Extract status fields
    3. Return TokenStatus
```

---

## script.rs

```yaml
Purpose: Post-upgrade timer management

Function: post_upgrade()
  Called: After canister upgrades
  Process:
    1. Clear any existing global timers
    2. Set new recurring timer:
       - Interval: 60 seconds
       - Action: publish_to_kong()

Function: publish_to_kong()
  Purpose: Publish eligible tokens to KongSwap
  Process:
    1. Get current time
    2. For each token in storage:
       if is_live AND NOT pool_created:
         try to create pool on KongSwap
    3. Handle errors gracefully
    4. Update pool_created status on success
```

---

## simulation_new.rs

```yaml
Purpose: Tokenomics simulation and graph generation for frontend preview

Type Definitions:
  TokenomicsSchedule:
    - secondary_burn_thresholds: Vec<u64>
    - primary_mint_per_threshold: Vec<u64>

  PreviewArgs:
    - primary_max_supply: u64
    - tge_allocation: u64
    - initial_secondary_burn: u64
    - halving_step: u64
    - initial_reward_per_burn_unit: u64

  GraphData:
    - cumulative_supply_data_x: Vec<u64>
    - cumulative_supply_data_y: Vec<u64>
    - minted_per_epoch_data_x: Vec<String>
    - minted_per_epoch_data_y: Vec<u64>
    - cost_to_mint_data_x: Vec<u64>
    - cost_to_mint_data_y: Vec<f64>
    - cumulative_usd_cost_data_x: Vec<u64>
    - cumulative_usd_cost_data_y: Vec<f64>

Function: preview_tokenomics(args)
  Input: PreviewArgs
  Returns: GraphData for visualization
  
  Process:
    1. Call preview_tokenomics_from_frontend() to generate schedule
    2. Initialize empty graph data arrays
    3. For each epoch in schedule:
       - Calculate cumulative supply data points
       - Calculate minted per epoch data
       - Calculate cost data (using $0.005 USD per secondary token)
       - Format epoch labels
    4. Return complete GraphData
```

---

## storage.rs

```yaml
Purpose: Define persistent storage structures

TokenRecord Structure:
  Identification:
    - id: Unique numeric identifier
    - caller: Creator's principal ID
    - created_time: Unix timestamp nanoseconds
  
  Token Information:
    - primary_token_name: Full name
    - primary_token_symbol: Trading symbol
    - primary_token_id: Canister principal
    - primary_token_max_supply: In E8S units
    - secondary_token_name: Full name
    - secondary_token_symbol: Trading symbol
    - secondary_token_id: Canister principal
  
  Associated Canisters:
    - tokenomics_canister_id: Controls supply
    - icp_swap_canister_id: Handles swaps
    - logs_canister_id: Records statistics
  
  Economic Parameters:
    - initial_primary_mint: Starting reward rate
    - initial_secondary_burn: Burn threshold
    - halving_step: Percentage reduction
    - initial_reward_per_burn_unit: Reward rate
    - distribution_interval_seconds: Payout frequency
  
  Launch Status:
    - launch_delay_seconds: Time before trading (user configurable)
    - pool_created_at: Timestamp or 0
    - pool_creation_failed: Boolean flag

Storage Implementation:
  - Uses IC stable structures v0.5.6
  - BTreeMap with u64 keys
  - Persists across upgrades
  - Thread-local access pattern
  - Memory manager for stable storage
```

---

## tokenomics_simple.rs

```yaml
Purpose: Core tokenomics calculation engine (dynamic parameters)

Constants:
  E8S: 100_000_000 (conversion factor)
  SECONDARY_TOKEN_USD_COST: 0.005 (effective cost after 50% ICP return)

Type Definitions:
  TokenomicsParams:
    - max_supply_e8s: Maximum primary tokens
    - tge_allocation_e8s: Initial distribution
    - initial_burn_e8s: First burn threshold
    - initial_reward_rate_e8s: Starting mint rate
    - halving_percentage: Reward reduction per epoch

  EpochData:
    - epoch_number: Sequential counter
    - secondary_burned_this_epoch_e8s: Amount burned
    - primary_minted_this_epoch_e8s: Amount minted
    - cumulative_secondary_burned_e8s: Total burned
    - cumulative_primary_minted_e8s: Total minted
    - cost_per_primary_token_usd: USD price

  TokenomicsSchedule:
    - epochs: Vec<EpochData>
    - total_epochs: Count of epochs
    - total_supply_percentage: Percent of max supply reached

Main Function: generate_tokenomics_schedule(params)
  Process:
    1. Initialize with TGE allocation as epoch 0
    2. Calculate dynamic epochs:
       while cumulative_primary < max_supply:
         - Calculate burn threshold for current epoch
         - Calculate reward rate for current epoch
         - Calculate primary tokens to mint
         - Apply supply cap if needed
         - Track cumulative amounts
         - Add epoch to schedule
    3. Return complete schedule

Function: preview_tokenomics_from_frontend(params)
  Purpose: Convert frontend parameters to backend format
  Process:
    1. Convert natural units to E8S where needed
    2. Create TokenomicsParams structure
    3. Call generate_tokenomics_schedule
    4. Return schedule

Helper Functions:
  calculate_burn_threshold(epoch_index, initial_burn, halving_percentage):
    - exponential growth: initial * (100/(100-halving))^epoch
  
  calculate_reward_rate(epoch_index, initial_rate, halving_percentage):
    - exponential decay: initial * ((100-halving)/100)^epoch
  
  calculate_primary_minted(secondary_burned, reward_rate):
    - Prevents E8S × E8S = E16S bug
    - Returns (secondary_burned / E8S) * reward_rate
  
  calculate_cost_per_token(secondary_burned, primary_minted):
    - Returns USD cost per primary token

Tests:
  - E8S conversion validation
  - Halving mechanics verification
  - Edge case handling
  - Frontend/backend consistency
```

---

## update.rs

```yaml
Purpose: State-changing operations (the main business logic)

Main Function: create_token(15 parameters)
  Input: All token configuration parameters
  Returns: Success with token ID or error message
  
  Process:
    1. Validate inputs:
       - Check name/symbol validity
       - Verify numeric parameters
       - Ensure caller has 5 ICP
    
    2. Transfer 5 ICP fee:
       - 4.5 ICP to canister treasury
       - 0.5 ICP for canister creation
    
    3. Generate tokenomics schedule:
       - Call preview_tokenomics_from_frontend
       - Extract thresholds and rewards arrays
    
    4. Deploy infrastructure:
       create_tokenomics_canister()
       create_icp_swap_canister()
       create_logs_canister()
    
    5. Create tokens:
       create_icrc1_token(primary_token_params)
       create_icrc1_token(secondary_token_params)
    
    6. Set up liquidity:
       - Add tokens to KongSwap
       - Transfer initial liquidity
       - Create trading pool (may be delayed by launch_delay_seconds)
       - Handle pool creation errors
    
    7. Record token:
       - Generate unique ID
       - Store TokenRecord with launch_delay_seconds
       - Update counters
    
    8. Return success with details

Helper Function: create_canister_install_code(wasm_module, init_arg)
  Process:
    1. Create new canister with cycles
    2. Install WASM code
    3. Set controller to self
    4. Return canister ID

Helper Function: install_tokenomics_wasm_on_existing_canister()
  Process:
    1. Takes dynamic arrays (secondary_thresholds, primary_rewards)
    2. Creates TokenomicsCanisterInitArgs
    3. Installs tokenomics WASM
    4. Returns success/error

Function: retry_pool_creation(token_id)
  Input: Token ID to retry
  Process:
    1. Find token record
    2. Verify pool not already created
    3. Check if launch delay has passed
    4. Get necessary balances
    5. Attempt pool creation again
    6. Update status on success
    7. Return result with time remaining if not yet live

Internal Functions:
  - add_token_on_kong: Register token on DEX
  - add_pool_on_kong: Create liquidity pool
  - approve_tokens: Set spending allowances
  - Various ICRC1 interaction helpers
```

---

## utlis.rs

```yaml
Purpose: Utility functions and type definitions

Constants:
  KONG_BACKEND_CANISTER: Principal ID of KongSwap
  ICP_CANISTER_ID: Principal ID of ICP ledger
  INTITAL_PRIMARY_MINT: Initial mint amount with buffer
  ICP_TRANSFER_FEE: 10,000 E8S
  E8S: 100,000,000
  CHAIN_ID: "IC"

Type Definitions:
  AddTokenArgs:
    - token: String (principal ID)
  
  AddTokenResponse:
    - Ok(TokenDetail) or Err(String)
  
  TokenDetail:
    - IC(TokenInfo)
  
  TokenInfo:
    - token_id, chain, canister_id
    - name, symbol, decimals
    - fee, icrc1/2/3 flags
    - is_removed flag
  
  AddPoolArgs:
    - token_0/1: String
    - amount_0/1: Nat
    - tx_id_0/1: Option<TxId>
    - lp_fee_bps: Option<u8>
  
  TokenomicsInitArgs:
    - primary/secondary_token_id: Option<Principal>
    - swap_canister_id: Option<Principal>
    - max_primary_supply: u64
    - initial_primary_mint: u64
    - initial_secondary_burn: u64
    - halving_step: u64
    - initial_reward_per_burn_unit: u64
    - secondary_thresholds: Vec<u64> (NEW - dynamic)
    - primary_rewards: Vec<u64> (NEW - dynamic)
  
  TokenomicsCanisterInitArgs:
    - primary_token_ledger: Principal
    - secondary_token_ledger: Principal
    - secondary_thresholds: Vec<u64>
    - primary_rewards: Vec<u64>

Helper Functions:
  get_principal(id: &str):
    Converts string to Principal, panics on error
  
  get_self_icp_balance():
    Returns: This canister's ICP balance
    Process:
      1. Get own principal
      2. Query ICP ledger
      3. Return balance
```

---

## lbry_fun.did

```yaml
Purpose: Candid interface definition (the public API)

Type Definitions:
  EpochData:
    - epoch_number: Sequential counter
    - secondary_burned_this_epoch_e8s: Burned amount
    - cumulative_secondary_burned_e8s: Total burned
    - primary_minted_this_epoch_e8s: Minted amount
    - cumulative_primary_minted_e8s: Total minted
    - cost_per_primary_token_usd: USD price
  
  GraphData:
    - Multiple X/Y data arrays for visualization
    - Different series for different metrics
  
  TokenRecord:
    - Complete token information
    - All associated canister IDs
    - Economic parameters
    - Status flags
    - launch_delay_seconds (user configurable)
  
  TokenomicsSchedule:
    - epochs: vec EpochData
    - total_epochs: nat
    - total_supply_percentage: float64
  
  Other types for errors, results, and parameters

Service Interface:
  Update Methods (modify state):
    - create_token: Main token creation with dynamic tokenomics
    - deposit_icp_in_canister: Add funds
    - retry_pool_creation: Retry failed pools
    - preview_tokenomics_schedule: Generate schedule preview
  
  Query Methods (read-only):
    - get_all_token_record: All tokens
    - get_live: Trading tokens
    - get_upcomming: Launching tokens  
    - get_treasury_balance: ICP balance
    - get_token_status: Token details
    - preview_tokenomics_graphs: Preview graphs
```

---

## Summary

The lbry_fun canister is a sophisticated token factory that:

1. **Creates dual-token systems** with dynamic, user-configurable economics
2. **Manages the entire lifecycle** from creation to trading with configurable launch delays
3. **Integrates with KongSwap** for liquidity
4. **Provides detailed analytics** through graphs and schedules
5. **Handles errors gracefully** with retry mechanisms
6. **Uses dynamic tokenomics** allowing users to experiment with parameters
7. **Maintains clean architecture** after removing legacy hardcoded implementations

Recent changes:
- Removed hardcoded tokenomics constants and functions
- Consolidated to single dynamic tokenomics implementation
- Made launch delays configurable per token
- Removed duplicate simulation modules
- Cleaned up unused test and debug files