# Tokenomics Tab Implementation

## Summary

Added a new "Tokenomics" tab to the SwapMain component that displays tokenomics graphs for individual tokens.

## Changes Made

### 1. Created TokenomicsTab Component
- **File**: `/src/lbry_fun_frontend/src/features/swap/components/tokenomics/TokenomicsTab.tsx`
- **Description**: A wrapper component that:
  - Fetches tokenomics configuration from the specific token's tokenomics canister
  - Creates a dynamic actor connection to the correct tokenomics canister
  - Passes the fetched data to the existing `TokenomicsGraphsBackend` component
  - Handles loading and error states

### 2. Updated SwapMain Component
- **File**: `/src/lbry_fun_frontend/src/features/swap/swapMain.tsx`
- **Changes**:
  - Imported the new `TokenomicsTab` component
  - Added a new tab entry with id 12 for "Tokenomics"
  - Added hover text: "View tokenomics graphs and distribution schedules"

### 3. Added Route Configuration
- **File**: `/src/lbry_fun_frontend/src/routes/index.tsx`
- **Changes**:
  - Added route: `/swap/tokenomics`
  - Follows the same pattern as other swap sub-routes

## Technical Details

### Dynamic Actor Connection
The TokenomicsTab creates a dynamic actor connection because each token has its own tokenomics canister. It:
1. Gets the tokenomics canister ID from the active swap pool
2. Creates an HttpAgent with the user's identity
3. Creates an actor instance targeting the specific tokenomics canister
4. Fetches both `get_config()` and `get_tokenomics_schedule()` data

### Data Calculation
- Converts BigInt values to strings for the TokenomicsGraphsBackend component
- Calculates `initialRewardPerBurnUnit` from the tokenomics schedule data
- Uses the first mint reward value from `primary_mint_per_threshold` array

## Usage

Users can now:
1. Navigate to any token's swap page
2. Click the "Tokenomics" tab
3. View interactive graphs showing:
   - Cumulative Primary Supply vs. Burn
   - Primary Tokens Minted per Epoch
   - Cost to Mint One Primary Token
   - Minting Valuation vs. Primary Minted
   - Key metrics summary

## Testing

To test the implementation:
1. Navigate to a token's swap page (e.g., `/swap/balance?id=<token_id>`)
2. Click on the "Tokenomics" tab
3. Verify that the graphs load and display correctly
4. Check that the data matches the token's configured parameters