# lbry_fun Canister Function Documentation

## Token Creation & Deployment Functions

### 1. **create_token**
**Purpose**: All-in-one token creation function that creates a complete token ecosystem
**When used**: Frontend uses this for simple one-step token creation
**What it does**: Takes 16 parameters → internally uses two-phase system → creates 5 canisters → sets up KongSwap pool → returns success/error message

### 2. **initiate_token_deployment**
**Purpose**: Start a token deployment and get an ID immediately (Phase 1 of two-phase system)
**When used**: When resilience against disconnection is needed - user can reconnect with deployment ID
**What it does**: Takes 5 ICP payment → validates parameters → creates deployment record → returns deployment ID for later use

### 3. **execute_token_deployment**
**Purpose**: Actually create the token infrastructure using deployment ID (Phase 2)
**When used**: After initiate_token_deployment, when user is ready to continue
**What it does**: Creates 5 canisters → installs WASM code → creates Kong pool → updates deployment status → returns token ID

### 4. **recover_stuck_deployment**
**Purpose**: Cancel a stuck deployment and trigger automatic refund
**When used**: If deployment process was interrupted and 5+ minutes have passed
**What it does**: Checks inactivity period → marks deployment as failed → triggers automatic cleanup/refund

## Query Functions (Read-only)

### 5. **get_all_token_record**
**Purpose**: Get complete list of all tokens ever created
**When used**: Frontend needs full token listing for pools page
**What it does**: Returns all token records with metadata (status, symbols, canisters, etc.)

### 6. **get_live**
**Purpose**: Get tokens currently available for trading
**When used**: Frontend showing active/tradeable tokens
**What it does**: Returns tokens with successful pools AND past their launch delay time

### 7. **get_upcoming**
**Purpose**: Get tokens not yet available for trading
**When used**: Frontend showing upcoming launches or tokens with delays
**What it does**: Returns tokens still deploying OR before their launch time

### 8. **get_failed**
**Purpose**: Get tokens that failed deployment
**When used**: Debugging failed launches or showing error states
**What it does**: Returns all tokens with Failed status

### 9. **get_token_detail**
**Purpose**: Get detailed info about a specific token
**When used**: Token detail pages needing comprehensive info
**What it does**: Returns status, time until live, symbols, and live state for a token ID

### 10. **get_token_status**
**Purpose**: Get just the status enum of a token
**When used**: Quick status checks without full details
**What it does**: Returns Live/Failed/Deploying status enum

### 11. **get_my_deployments**
**Purpose**: Get user's deployment history
**When used**: User checking their deployment status/history
**What it does**: Returns all deployments for the calling principal with status info

## Financial Functions

### 12. **deposit_icp_in_canister**
**Purpose**: Transfer ICP from user to canister using ICRC2 transfer_from
**When used**: Internally by initiate_token_deployment for 5 ICP payment
**What it does**: Executes ICRC2 transfer_from → returns block index or error

### 13. **retry_pool_creation**
**Purpose**: Manually retry failed KongSwap pool creation
**When used**: When initial pool creation failed but token deployment succeeded
**What it does**: Transfers tokens to Kong → attempts pool creation again → updates token status

### 14. **get_treasury_balance**
**Purpose**: Check canister's ICP balance
**When used**: Monitoring platform treasury or available funds
**What it does**: Queries ICP ledger → returns balance in E8S units

### 15. **get_canister_cycle_balance**
**Purpose**: Check cycles balance of any canister
**When used**: Monitoring canister health and cycle levels
**What it does**: Calls IC management canister → returns cycles as Nat

## Preview/Simulation Functions

### 16. **preview_tokenomics_graphs**
**Purpose**: Simulate tokenomics graphs before token creation
**When used**: Frontend preview feature during token setup
**What it does**: Runs simulation with provided parameters → returns graph data without creating anything

### 17. **preview_tokenomics_schedule**
**Purpose**: Generate halving schedule preview
**When used**: Showing epoch/halving table before creation
**What it does**: Calculates all epochs with thresholds and rewards → returns schedule table

### 18. **get_tokenomics_graphs**
**Purpose**: Get tokenomics graphs for an existing token
**When used**: Token detail pages showing supply curves
**What it does**: Looks up token parameters → runs simulation → returns graph data

## Treasury & Collection Functions

### 19. **get_audit_state**
**Purpose**: Monitor fee collection system health
**When used**: Checking collection failures or system health
**What it does**: Returns last successful collection, consecutive failures, de-pegging status

### 20. **get_collection_status**
**Purpose**: Current state of the fee collection process
**When used**: Monitoring if collection is in progress
**What it does**: Returns Idle/Collecting/Swapping/Burning state + accumulated ICP amount

### 21. **get_collection_metrics**
**Purpose**: Performance metrics for fee collections
**When used**: Analytics dashboard or performance monitoring
**What it does**: Returns total collected ICP, burned LBRY, efficiency percentage, timing stats

### 22. **get_system_reconciliation**
**Purpose**: Check for ICP balance discrepancies across all tokens
**When used**: System-wide audit and reconciliation checks
**What it does**: Queries all token swap canisters → sums expected fees → finds discrepancies

### 23. **get_token_reconciliation**
**Purpose**: Detailed reconciliation for a specific token
**When used**: Investigating balance issues for individual tokens
**What it does**: Calls token's ICP swap canister → returns balance breakdown and discrepancies

## Key Design Patterns

1. **Two-Phase Deployment**: Prevents loss of payment if user disconnects
2. **Automatic Cleanup**: Failed deployments auto-refund via heartbeat (3 retry attempts)
3. **Pool Retry**: KongSwap failures don't kill entire deployment
4. **Collection System**: Hourly fee collection from all tokens → swap to LBRY → burn

## Critical Numbers
- Token creation cost: 5 ICP
- Platform fee on failure: 1 ICP  
- Collection threshold: 1 ICP minimum
- Inactivity timeout: 5 minutes
- Cleanup retries: 3 attempts
- Collection interval: 1 hour