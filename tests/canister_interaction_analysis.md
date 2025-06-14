# Canister Interaction Analysis

## Overview
This document analyzes how the 5 canisters (primary token, secondary token, tokenomics, icp_swap, logs) interact with each other after deployment.

## Todo List
- [ ] Document the initialization flow
- [ ] Map out icp_swap minting secondary tokens flow
- [ ] Map out tokenomics burning secondary and minting primary flow
- [ ] Document cross-canister calls
- [ ] Describe user interaction flow

## Canister Initialization Flow

When a new token is created via `create_token` in the main lbry_fun canister:

1. **Canister Creation Order**:
   - icp_swap canister created
   - tokenomics canister created
   - frontend canister created (not analyzed here)
   - logs canister created
   - primary token (ICRC1) created with tokenomics as minting account
   - secondary token (ICRC1) created with icp_swap as minting account

2. **Configuration Setup**:
   - **Tokenomics** receives:
     - primary_token_id
     - secondary_token_id
     - swap_canister_id (icp_swap)
     - frontend_canister_id
     - max_primary_supply and other tokenomics parameters
   
   - **ICP_Swap** receives:
     - primary_token_id
     - secondary_token_id
     - tokenomics_canister_id

   - **Logs** receives all canister IDs for monitoring

## Key Interactions

### 1. ICP → Secondary Token Minting (via icp_swap)

**Function**: `swap(amount_icp, from_subaccount)`

**Flow**:
1. User calls `swap` on icp_swap canister with ICP amount
2. ICP is transferred from user to icp_swap canister via `deposit_icp_in_canister`
3. Exchange rate is calculated using `get_current_secondary_ratio()` 
4. Secondary tokens are minted via `mint_secondary_token`:
   - Calls `icrc1_transfer` on secondary token canister
   - Since icp_swap is the minting account, it can mint new tokens
   - Tokens are sent directly to the user

**Key Points**:
- Minimum swap: 0.1 ICP (10_000_000 e8s)
- Exchange rate: Dynamic based on ICP price in cents
- On failure: ICP is archived for later redemption

### 2. Secondary Token Burning → Primary Token Minting

**Function**: `burn_secondary(amount_secondary, from_subaccount)`

**Flow**:
1. User calls `burn_secondary` on icp_swap canister
2. Calculate ICP return (50% of original value due to burn mechanism)
3. Burn secondary tokens via `burn_token`:
   - Transfers secondary tokens from user to icp_swap canister
   - Since icp_swap owns them now, they're effectively burned
4. Send ICP back to user (50% of original value)
5. Call tokenomics canister to mint primary tokens:
   - `mint_primary(secondary_amount, caller, to_subaccount)`
   - Tokenomics calculates primary tokens based on burn thresholds
   - Mints primary tokens directly to user

**Key Points**:
- Users get back 50% of ICP value when burning secondary
- Primary minting rate varies based on tokenomics schedule
- Maximum 50 primary tokens per transaction

### 3. Cross-Canister Communication

**icp_swap → tokenomics**:
- `mint_primary`: Called after successful secondary burn
- Uses raw call to handle ExecutionError properly

**icp_swap → secondary_token**:
- `icrc1_transfer`: For minting new tokens
- `icrc2_transfer_from`: For burning tokens

**icp_swap → primary_token**:
- `icrc2_transfer_from`: For staking/unstaking operations

**tokenomics → primary_token**:
- `icrc1_transfer`: For minting primary tokens to users

**icp_swap → ICP ledger**:
- `icrc2_transfer_from`: For receiving ICP from users
- `icrc1_transfer`: For sending ICP to users

### 4. User Flow Summary

1. **Mint Secondary Tokens**:
   - User approves ICP to icp_swap
   - Calls `swap(amount)` 
   - Receives secondary tokens at current exchange rate

2. **Burn Secondary for Primary**:
   - User approves secondary tokens to icp_swap
   - Calls `burn_secondary(amount)`
   - Receives 50% ICP value back
   - Receives primary tokens based on tokenomics schedule

3. **Stake Primary Tokens**:
   - User approves primary tokens to icp_swap
   - Calls `stake_primary(amount)`
   - Tokens held in icp_swap, user earns ICP rewards

4. **Claim Rewards**:
   - User calls `claim_icp_reward()`
   - Receives accumulated ICP rewards from staking

## Additional Features

### Reward Distribution
- Runs hourly via `distribute_reward()`
- Distributes ICP collected from minting:
  - 1% to Alexandria project (lbry_fun canister)
  - 49.5% to LP treasury
  - 49.5% to stakers proportionally

### Liquidity Provision
- Runs every 4 hours via `provide_liquidity_from_treasury()`
- Uses 50% of LP treasury to:
  - Buy primary tokens on DEX
  - Add liquidity with bought tokens + remaining ICP

### Archive System
- Failed transactions archive ICP for later redemption
- Users can call `redeem()` to recover archived ICP

## Security Features

1. **Guard Functions**: 
   - `not_anon`: Prevents anonymous principals
   - `is_allowed`: Only allows calls from icp_swap (in tokenomics)

2. **Caller Guards**:
   - Rate limiting via CallerGuard
   - Prevents rapid repeated calls

3. **Balance Checks**:
   - Ensures sufficient ICP for burns
   - Validates staking amounts
   - Checks canister balances before transfers

## Review

The system implements a dual-token model where:
- Secondary tokens are minted with ICP at market rates
- Secondary tokens can be burned to mint primary tokens and recover 50% ICP
- Primary tokens follow a deflationary schedule with halvings
- Staking primary tokens earns ICP rewards from the mint fees
- Automated liquidity provision creates sustainable DEX pools

The architecture ensures proper separation of concerns with each canister having specific responsibilities while maintaining secure cross-canister communication.