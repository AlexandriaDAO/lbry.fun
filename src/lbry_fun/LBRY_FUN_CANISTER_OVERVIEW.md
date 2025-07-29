# LBRY_FUN Canister Overview - Plain English Pseudocode

## Purpose
The lbry_fun canister is a token factory that creates and manages crypto token launches on the Internet Computer blockchain with a unique dual-token economic model.

## Core Data Structure

```yaml
TokenRecord:
  # Basic token info
  token_name: "string"
  token_symbol: "string" 
  primary_token_canister_id: "canister_id"
  secondary_token_canister_id: "canister_id"
  
  # Associated canisters
  tokenomics_canister_id: "canister_id"
  swap_canister_id: "canister_id"
  logs_canister_id: "canister_id"
  
  # Economic parameters
  max_supply: "number (in e8s units)"
  initial_reward_per_burn_unit: "number"
  halving_step_percentage: "number (0-100)"
  distribution_interval_in_seconds: "number"
  
  # Status tracking
  created_at: "timestamp"
  launch_delay_seconds: "number (currently 1 microsecond for testing)"
  launch_time: "timestamp"
  pool_created: "boolean"
  pool_id: "optional number"
  
  # Creator info
  creator_principal: "principal_id"
```

## Main Functions

### create_token
```yaml
Purpose: Create a new token launch with all associated infrastructure
Cost: 5 ICP deposit required

Steps:
  1. Validate inputs:
     - Check token name and symbol are valid
     - Verify economic parameters make sense
     - Ensure user has paid 5 ICP
  
  2. Create infrastructure canisters:
     - Deploy swap canister (handles minting/burning)
     - Deploy tokenomics canister (controls supply dynamics)
     - Deploy logs canister (collects statistics)
  
  3. Create the actual tokens:
     - Deploy primary token (ICRC-1 standard)
       - Initial supply minted to tokenomics canister
     - Deploy secondary token (ICRC-1 standard)
       - Controlled by swap canister for minting
  
  4. Set up DEX integration:
     - Add primary token to KongSwap
     - Transfer initial liquidity (1 primary token + 0.1 ICP)
     - Create trading pool on KongSwap
     - If pool creation fails, mark for retry
  
  5. Record everything:
     - Store TokenRecord with all canister IDs
     - Set launch time (current time + delay)
     - Return token details to user

Returns: Complete token information including all canister IDs
```

### get_live
```yaml
Purpose: Get all tokens that are currently tradable

Logic:
  For each token in storage:
    if current_time > token.launch_time AND token.pool_created:
      include in results
  
  Sort by creation time (newest first)
  Return list of live tokens
```

### get_upcoming
```yaml
Purpose: Get tokens in the 24-hour launch delay period

Logic:
  For each token in storage:
    if current_time < token.launch_time:
      include in results
  
  Sort by launch time (soonest first)
  Return list of upcoming tokens
```

### preview_tokenomics_graphs
```yaml
Purpose: Generate preview graphs showing token economics before creation

Input: All the same parameters as create_token

Process:
  1. Simulate token economics over time:
     - Calculate how primary tokens are minted
     - Show effects of halving mechanism
     - Project supply curves
  
  2. Generate graph data:
     - X-axis: Time periods
     - Y-axis: Token amounts, rates, prices
     - Multiple series for different metrics
  
  3. Return formatted data for frontend visualization

Output: Graph data showing projected token economics
```

### retry_pool_creation
```yaml
Purpose: Retry failed KongSwap pool creation

Input: Token symbol to retry

Process:
  1. Find token record by symbol
  2. Check if pool creation previously failed
  3. Attempt to create pool again on KongSwap
  4. Update pool_created status if successful
  5. Store pool_id for future reference

Returns: Success/failure status
```

### deposit_icp_in_canister
```yaml
Purpose: Add ICP to the canister's treasury

Process:
  1. Transfer ICP from user to canister
  2. Update internal balance tracking
  3. Return new balance

Note: Used for funding operations and liquidity
```

### get_treasury_balance
```yaml
Purpose: Check canister's ICP balance

Returns: Current ICP balance in e8s units
```

## Background Processes

### Hourly Treasury Processing (not shown in code but referenced)
```yaml
Every hour:
  1. Calculate 1% of accumulated fees
  2. Use that amount to buy LBRY tokens (parent project)
  3. Burn the purchased LBRY tokens
  4. Distribute remaining fees according to tokenomics
```

## Integration Points

### KongSwap DEX
```yaml
Functions:
  - add_token: Register new token on the DEX
  - add_pool: Create liquidity pool with ICP pair
  - icrc1_transfer: Move tokens for liquidity

Error handling:
  - Gracefully handle pool creation failures
  - Provide retry mechanism
  - Log all interactions for debugging
```

### ICP Ledger
```yaml
Functions:
  - Transfer ICP for liquidity provision
  - Collect fees from token creators
  - Handle treasury operations

All transfers use proper fee calculations
```

### Spawned Canisters Communication
```yaml
Each spawned canister receives:
  - Initialization parameters
  - References to other related canisters
  - Proper permissions and controllers

Communication pattern:
  - lbry_fun → spawned canisters (initialization)
  - Spawned canisters operate independently after creation
```

## Economic Model

### Dual Token System
```yaml
Secondary Token:
  - Minted at constant rate: $0.01 USD worth of ICP
  - Can be burned to mint primary tokens
  - Burning returns 50% of ICP value
  - Effective cost: $0.005 per token

Primary Token:
  - Minted only by burning secondary tokens
  - Reward rate decreases over time (halving)
  - Limited max supply
  - Tradable on KongSwap

Fee Distribution (from secondary token sales):
  - 1%: Buy and burn LBRY tokens
  - 99% → Primary token stakers (will later be replaced with Permanently Locked Kongswap Liquidity)
```

### Halving Mechanism
```yaml
Process:
  - Initial reward rate set at creation
  - After each threshold of secondary tokens burned:
    - Reduce reward rate by halving_step_percentage
  - Continues until max supply reached
  - Creates scarcity over time
```

## Error Handling

```yaml
Common error scenarios:
  - Invalid token parameters → Reject creation
  - Insufficient ICP payment → Reject creation
  - Pool creation failure → Mark for retry
  - Canister creation failure → Rollback all changes
  - Network issues → Graceful degradation

All errors return descriptive messages for debugging
```

## Security Considerations

```yaml
Access control:
  - Only token creator can modify certain settings
  - Canister controllers properly set
  - No unauthorized minting possible

Economic security:
  - Fixed creation cost prevents spam
  - Launch delay prevents immediate dumps
  - Halving mechanism ensures sustainable economics
```