# LBRY_FUN Canister - Simple Overview

The LBRY_FUN canister is a token factory that creates dual-token systems with configurable economics.

## Core Files

### 📁 lib.rs
**Entry point** - Imports all modules and defines the canister interface

### 📁 storage.rs
**Data storage** - Stores all created tokens and their details
- Token names, symbols, and canister IDs
- Economic parameters (supply, burn rates, halving)
- Launch status and timing

### 📁 update.rs
**Token creation** - Main business logic
- `create_token()` - Creates a new token pair with 5 associated canisters
- Validates inputs, collects fees, deploys infrastructure
- Sets up initial liquidity on KongSwap

### 📁 queries.rs
**Read data** - Get information without changing state
- `get_live()` - Currently tradable tokens
- `get_upcoming()` - Tokens waiting to launch
- `preview_tokenomics_graphs()` - Preview economics before creating

### 📁 tokenomics_simple.rs
**Economic calculations** - The math engine
- Calculates how many primary tokens you get for burning secondary tokens
- Applies 3x multiplier and halving schedule
- Generates complete mining schedule showing all epochs

### 📁 simulation_new.rs
**Graph generation** - Creates visualization data
- Converts tokenomics calculations into graph-friendly format
- Shows supply curves, costs, and mining rates

### 📁 preview_canister.rs
**Test deployments** - Try before you buy
- Deploys temporary canister to test parameters
- Returns graph data without permanent deployment
- Cleans up after preview

### 📁 script.rs
**Background tasks** - Runs every 60 seconds
- Publishes tokens to KongSwap when launch delay expires
- Handles pool creation retries

### 📁 utils.rs
**Helper functions** - Common utilities
- Type definitions for KongSwap integration
- ICP balance checks
- Constants like canister IDs

### 📁 lbry_fun.did
**API definition** - Public interface in Candid format
- All callable functions
- Parameter and return types
- Used by frontend to interact with canister

## How It Works

1. **User calls `create_token`** with parameters like:
   - Token names and symbols
   - Max supply and initial burn threshold
   - Halving percentage

2. **System deploys 5 canisters**:
   - Primary token (ICRC1)
   - Secondary token (ICRC1)
   - Tokenomics (controls minting)
   - ICP Swap (handles burning/minting)
   - Logs (records statistics)

3. **Economics work like this**:
   - Mint secondary tokens with ICP ($0.01 each)
   - Burn secondary tokens to get primary tokens
   - Rate decreases each epoch (halving)
   - Burn requirement doubles each epoch

4. **After launch delay**:
   - Tokens become tradable on KongSwap
   - Stakers earn rewards
   - Liquidity gets locked

## Key Concepts

- **E8S**: 1 token = 100,000,000 E8S (like Bitcoin satoshis)
- **3x Multiplier**: Burn rate × 3 = actual mint rate
- **Epochs**: Mining periods with different rates
- **Launch Delay**: User-configured waiting period before trading