# Bot1 Token Launch Verification Prompt

I need you to verify that a token launch's actual results match the frontend projections using the bot1 canister's enhanced analysis features.

## Pool Information
- **Pool ID**: 4
- **Frontend Graph Data**: 
```json
<replace the table data>
```

## Background
The bot1 canister has enhanced tracking that separates actual transaction data from theoretical analysis. It can detect if tokenomics halvings are working correctly and explain why large burns show different rates than expected.

## Key Values to Extract from Graph Data
From the provided JSON, note these key values:
- **Halving Step**: `parameters.halvingStep` (e.g., 86 means 86%)
- **Threshold Multiplier**: `parameters.thresholdMultiplier` (e.g., 2 means epochs double in size)
- **Initial Reward**: `parameters.initialRewardPerBurnUnit` 
- **Max Supply**: `parameters.primaryMaxSupply`
- **Total Epochs**: `summaryData.epochs`
- **Final Total Minted**: `summaryData.actualTotalMinted`
- **Total Cost**: `summaryData.totalMintingValuation`

## Verification Steps

1. **First, validate the pool exists and is ready:**
```bash
dfx canister call bot1 validate_pool '(POOL_ID)'
```

2. **Start with a small test before full execution:**
```bash
# Test with 1 loop of 1 ICP first
dfx canister call bot1 execute_loops '(POOL_ID, 1, 1)'
# If successful, check the results before scaling up
dfx canister call bot1 get_table '(POOL_ID)'
```

3. **Run bot1 to execute burn loops:**
```bash
dfx canister call bot1 execute_loops '(POOL_ID, ICP_AMOUNT, NUMBER_OF_LOOPS)'
```
**IMPORTANT**: ICP_AMOUNT is in whole numbers, NOT E8S!
- ✅ Correct: `dfx canister call bot1 execute_loops '(1, 1, 10)'` runs 10 loops with 1 ICP each
- ❌ Wrong: `dfx canister call bot1 execute_loops '(1, 100000000, 10)'` would try to use 100 million ICP!

4. **Get the raw transaction data:**
```bash
dfx canister call bot1 get_table '(POOL_ID)'
```
This shows actual results without analysis - what really happened.

5. **Get the enhanced analysis summary:**
```bash
dfx canister call bot1 get_summary '(POOL_ID)'
```
This includes theoretical analysis and halving verification.

## What to Verify Against Graph Data

### 1. **Supply Curve Verification**
Compare `get_table` output's `cumulative_supply_data` with the frontend's `cumulativeSupplyData`:
- X-axis: cumulative secondary burned
- Y-axis: cumulative primary minted
- Values should match within 0.1%

### 2. **Epoch Minting Verification**
Compare `get_table` output's `minted_per_epoch_data` with the frontend's `mintedPerEpochData`:
- Each epoch's minted amount should match
- Number of epochs reached should match

### 3. **Cost Verification**
Compare actual costs with `costToMintData` and `cumulativeUsdCostData`:
- Cost per token at each point
- Total USD spent should match `summaryData.totalMintingValuation`

*Remember, get_table show ONLY actual results (what really happened), and get_summary adds theoretical analysis (what should have happened based on the schedule). If there's a mismatch, there's a big problem and the get_table is the truth.*

### 4. **Halving Verification**
In `get_summary` output, check:
- `rate_verification.configured_halving` should match `parameters.halvingStep`
- `rate_verification.status` should be "Verified"
- `observed_halvings` should show the actual halving percentage

## Analysis Sections to Review

**In get_summary output:**

1. **epoch_analysis**:
   - `single_epoch_burns`: Burns within one epoch (use for clean rate verification)
   - `multi_epoch_burns`: Burns crossing epochs (check theoretical breakdown)

2. **rate_verification**:
   - Confirms if halving matches the configured percentage
   - Status: "Verified" / "InsufficientData" / "Mismatch"

3. **largest_multi_epoch_burn** (if any):
   - Shows how tokens were distributed across epochs
   - `deviation_percent` should be <1%

## Verification Report Template

```
## Token Launch Verification Report

**Pool ID**: [X]
**Date**: [DATE]

### Configuration Match
- Expected Halving: [X]% (from parameters.halvingStep)
- Observed Halving: [X]% (from rate_verification)
- ✅/❌ Match

### Supply Verification
- Frontend Final: [X] tokens
- Bot1 Actual: [X] tokens  
- Deviation: [X]%
- ✅/❌ Within tolerance (<0.1%)

### Cost Verification
- Frontend Total Cost: $[X]
- Bot1 Actual Cost: $[X]
- Deviation: [X]%
- ✅/❌ Within tolerance (<0.1%)

### Epoch Analysis
- Epochs Expected: [X]
- Epochs Reached: [X]
- Single-Epoch Burns: [X] (showing [X]% deviation)
- Multi-Epoch Burns: [X] (showing [X]% deviation)

### Halving Verification Status
[COPY rate_verification section]

### Warnings
[LIST any analysis_warnings]

### Conclusion
✅/❌ The token launch performed as expected by frontend projections.

[Any additional observations or recommendations]
```

## Quick Checklist
- [ ] Pool validated successfully
- [ ] Bot1 executed without errors
- [ ] Final supply matches projection (±0.1%)
- [ ] Total cost matches projection (±0.1%)
- [ ] Halving percentage verified correct
- [ ] No high deviation warnings (>1%)
- [ ] Epoch progression matches expectation

## Common Issues and Debugging

*Timeouts if there are more than 5 loops. Always execute_loops() with 5 loops or less so it doesn't timeout.*

### 1. **"Maximum primary token supply reached" Error**
If you get this error immediately when trying to burn:
```bash
# Check how much primary token has been minted
dfx canister call [PRIMARY_TOKEN_ID] icrc1_total_supply
```
If it shows only ~100010000 (1.00010 tokens), there's likely a unit conversion issue during pool creation.

**Root Cause**: The tokenomics canister's `max_primary_supply` was likely converted to 4-decimal format when it should remain in E8S format.

### 2. **Unit System Reference**
The tokenomics system uses different units for different values:

| Value Type | Format | Example | Represents |
|------------|--------|---------|------------|
| max_primary_supply | E8S | 2,100,000,000,000,000 | 21M tokens |
| rewards array | 4-decimal | 1,050 | 0.105 tokens/secondary |
| thresholds | Natural | 1,000,000 | 1M secondary tokens |
| execute_loops ICP | Whole numbers | 1 | 1 ICP |

**Critical**: Never convert max_primary_supply to 4-decimal format!

### 3. **Debugging Commands**
```bash
# Check tokenomics schedule initialization
dfx canister call [TOKENOMICS_ID] get_tokenomics_schedule

# Test with minimal amount first
dfx canister call bot1 execute_loops '(POOL_ID, 1, 1)'

# Check secondary token balance
dfx canister call [SECONDARY_TOKEN_ID] icrc1_balance_of '(record {owner=principal "[YOUR_PRINCIPAL]"; subaccount=null})'
```

## Important Notes

### Bot1 Reporting Fix (2025-07-08)
Bot1 previously had a bug where it multiplied secondary burn amounts by E8S when reporting, inflating the displayed values by 100 million times. This has been fixed. The bot now correctly reports secondary tokens burned in E8S format without the extra multiplication.

### Rewards Calculation Fix (2025-07-08)
Fixed a critical issue where the tokenomics rewards array was being incorrectly calculated from preview data, causing rates to be ~7.9x lower than configured. The fix:
- Directly converts `initial_reward_per_burn_unit` from E8S to 4-decimal format
- Formula: `E8S_value / 10,000 = 4-decimal_value`
- Example: 10,500,000 E8S (0.105 tokens) → 1,050 in 4-decimal format

### Critical Unit Conversion Rules
1. **Rewards array**: E8S → 4-decimal (divide by 10,000)
2. **Max supply**: Keep in E8S format (do NOT convert!)
3. **Thresholds**: E8S → natural units (divide by 100,000,000)
4. **execute_loops ICP**: Use whole numbers (1 = 1 ICP)

### Tokenomics Threshold Behavior
The tokenomics canister does NOT block burning past the last threshold. When burns exceed the final threshold in the schedule:
- Burning continues to be allowed
- The final reward rate (often the floor rate of 0.01) is used for all subsequent burns
- Minting only stops when the max supply is reached

This means pools can continue accepting burns even after passing all thresholds, contrary to some earlier assumptions.