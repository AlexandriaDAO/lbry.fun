# Tokenomics Unit Mismatch Analysis

## Executive Summary
There is a significant discrepancy between the frontend projection and actual bot1 results for primary token minting. The frontend shows an initial rate of 5.457 tokens per secondary token, while bot1 achieves only 0.6897 tokens per secondary token - approximately 7.9x less than expected.

## Data Comparison

### Frontend Projection (from graph)
- Initial rate: **5.457 primary tokens per secondary token**
- For 3,200,000 secondary tokens burned: 17,462,400 primary tokens expected

### Bot1 Actual Results
- Loop 1: Burned 10 secondary tokens → Got 6.897 primary tokens
- Actual rate: **0.6897 primary tokens per secondary token**
- Secondary burned (E8S): 1,000,000,000 (10 tokens * 100,000,000)
- Primary received (E8S): 689,714,048 (6.897 tokens * 100,000,000)

## Root Cause Analysis

### Code Flow
1. **bot1/execute.rs** (line 124): Converts secondary balance to natural units for burn
   ```rust
   let burn_amount_natural = available_for_burn / E8S;  // 1,000,000,000 / 100,000,000 = 10
   ```

2. **icp_swap/update.rs** (line 414): Passes natural units to tokenomics
   ```rust
   mint_primary(amount_secondary, caller, from_subaccount).await  // amount_secondary = 10
   ```

3. **tokenomics/update.rs**: Receives `secondary_burn = 10` (natural units) but:
   - Thresholds are stored in natural units: [11,600,000, 23,200,000, ...]
   - Rewards are in 4-decimal format: [46,280, 37,024, ...] (46,280 = 4.628)
   - The code doesn't convert the incoming natural units properly

### The Unit Mismatch
The tokenomics canister is treating the `secondary_burn` parameter inconsistently:
- When checking against thresholds, it uses the value as-is (10 natural units)
- When calculating rewards, it multiplies by the 4-decimal reward rate
- This results in: 10 * 46,280 * 10,000 = 4,628,000,000 (in some internal unit)

### Expected vs Actual Calculation

**Expected (based on frontend):**
- 10 secondary tokens burned
- Rate: 5.457 (from initial_reward_per_burn_unit)
- Result: 10 * 5.457 = 54.57 primary tokens

**Actual (from code):**
- 10 secondary tokens burned
- The code path suggests it's using a different rate or calculation
- Result: 6.897 primary tokens (about 7.9x less)

## Hypothesis
The discrepancy appears to be related to:
1. **Unit conversion issues** between natural units and E8S in the tokenomics calculations
2. **Mismatch between `initial_reward_per_burn_unit` and `primary_rewards` array** - The frontend shows 5.457 as the initial rate, but the actual rewards array might contain different values
3. **The 4-decimal format** in rewards array (46,280 = 4.628) doesn't match the frontend's expected 5.457

## Key Finding
The TokenomicsInitArgs has two separate fields:
- `initial_reward_per_burn_unit: u64` - What the frontend displays (5.457)
- `primary_rewards: Vec<u64>` - What actually gets used in calculations (appears to be [46,280, ...] in 4-decimal format)

The bot1 calculation shows:
- 10 tokens × 46,280 (4-decimal) × 10,000 (to E8S) / E8S = 46.28 tokens expected
- But actual result is 6.897 tokens, suggesting another division or conversion issue

## Investigation Steps
1. Verify the actual `primary_rewards` array values for pool ID 4
2. Check if there's a conversion factor missing in the tokenomics mint_primary function
3. Confirm whether `initial_reward_per_burn_unit` is being used to generate the rewards array correctly
4. Trace the exact calculation: 10 × 46,280 × 10,000 = 4,628,000,000, then what happens?

## Impact
This 7.9x discrepancy means:
- Users receive significantly fewer primary tokens than the frontend suggests
- The tokenomics curve shown in the UI doesn't match the actual contract behavior
- This could be a critical issue affecting user trust and token economics

## Recommended Actions
1. **Immediate**: Query the tokenomics canister for pool ID 4 to get the actual rewards array
2. **Debug**: Add logging to trace the exact calculation path in tokenomics mint_primary
3. **Verify**: Check if the rewards array generation from initial_reward_per_burn_unit is correct
4. **Fix Options**:
   - If rewards array is wrong: Fix the generation logic to match frontend expectations
   - If calculation is wrong: Fix the unit conversion in mint_primary
   - If frontend is wrong: Update frontend to show actual rates from the rewards array

## Query Commands for Investigation
```bash
# Get the actual rewards array for pool ID 4
dfx canister call <tokenomics_canister_id> get_tokenomics_schedule

# Get the config to see max_primary_supply and other settings
dfx canister call <tokenomics_canister_id> get_config
```