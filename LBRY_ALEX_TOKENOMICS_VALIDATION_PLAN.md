# Plan: Set LBRY/ALEX Tokenomics as Default and Validate Graph Outputs

## 1. Analyze LBRY/ALEX Parameters

### From the provided data table:
- **Max Supply**: 21,000,000 ALEX tokens
- **Initial Burn Threshold**: 21,000 LBRY tokens
- **Initial Reward Rate**: 5.0 ALEX per LBRY burned
- **Halving**: 50% (5.0 → 2.5 → 1.25 → 0.625...)
- **TGE Allocation**: 315,000 ALEX (1.5% of max supply)

### Key observations:
- Burn thresholds double each epoch (21k → 42k → 84k)
- Rewards halve each epoch (5.0 → 2.5 → 1.25)
- Total epochs: 18 before reaching final 0.0001 reward rate

### LBRY/ALEX Reference Data:
```
LBRY Burned     ALEX Reward     Total ALEX Minted     Fully Diluted Valuation (XDR)
21,000.00       5.0000          315,000.00           $21,000.00
42,000.00       2.5000          472,500.00           $42,000.00
84,000.00       1.2500          630,000.00           $84,000.00
168,000.00      0.6250          787,500.00           $168,000.00
336,000.00      0.3125          945,000.00           $336,000.00
672,000.00      0.1562          1,102,500.00         $672,000.00
1,344,000.00    0.0781          1,260,000.00         $1,344,000.00
2,688,000.00    0.0391          1,417,500.00         $2,688,000.00
5,376,000.00    0.0195          1,575,000.00         $5,376,000.00
10,752,000.00   0.0098          1,732,500.00         $10,752,000.00
21,504,000.00   0.0049          1,890,000.00         $21,504,000.00
43,008,000.00   0.0024          2,047,500.00         $43,008,000.00
86,016,000.00   0.0012          2,205,000.00         $86,016,000.00
172,032,000.00  0.0006          2,362,500.00         $172,032,000.00
344,064,000.00  0.0003          2,520,000.00         $344,064,000.00
688,128,000.00  0.0002          2,677,500.00         $688,128,000.00
1,376,256,000.00 0.0001         2,883,938.40         $1,000,000,000.00
61,763,128,000.00 0.0001        21,000,000.00        $1,000,000,000.00
```

## 2. Convert to Frontend Parameters

The frontend expects these fields:
- `primary_max_supply`: 21000000 (natural units)
- `tge_allocation`: 315000 (natural units)
- `initial_secondary_burn`: 21000 (natural units)
- `halving_step`: 50 (percentage)
- `initial_reward_per_burn_unit`: 5 (natural units)

## 3. Implementation Steps

### Step 1: Update createTokenForm.tsx defaults
Location: `src/lbry_fun_frontend/src/features/token/components/createTokenForm.tsx`

Find the initial form state and update to:
```typescript
const [form, setForm] = useState<TokenFormValues>({
  primary_token_name: '',
  primary_token_symbol: '',
  primary_token_description: '',
  primary_token_logo_base64: '',
  secondary_token_name: '',
  secondary_token_symbol: '',
  secondary_token_logo_base64: '',
  primary_max_supply: '21000000',        // LBRY/ALEX default
  tge_allocation: '315000',              // LBRY/ALEX default
  initial_secondary_burn: '21000',       // LBRY/ALEX default
  halving_step: '50',                    // LBRY/ALEX default
  initial_reward_per_burn_unit: '5',     // LBRY/ALEX default
});
```

### Step 2: Add validation markers
Add comments explaining these are LBRY/ALEX reference values:
```typescript
// LBRY/ALEX Reference Parameters
// These defaults match the parent project's tokenomics
// Expected outputs:
// - 18 epochs total
// - First epoch: 21,000 LBRY burn → 105,000 ALEX mint
// - No overminting (stays at 21M max)
// - Final valuation: $1B
// See LBRY_ALEX_TOKENOMICS_VALIDATION_PLAN.md for full validation
```

### Step 3: Expected outputs for validation
Based on LBRY/ALEX data, the graphs should show:

**First 5 epochs:**
```
Epoch 1: Burn 21,000 → Mint 105,000 → Cumulative 420,000 (315k TGE + 105k)
Epoch 2: Burn 21,000 → Mint 52,500 → Cumulative 472,500
Epoch 3: Burn 42,000 → Mint 52,500 → Cumulative 525,000
Epoch 4: Burn 84,000 → Mint 52,500 → Cumulative 577,500
Epoch 5: Burn 168,000 → Mint 52,500 → Cumulative 630,000
```

**Note**: The mint amounts per epoch need to be calculated based on the burn within each threshold.

## 4. Testing Process

### Step 1: Launch frontend with defaults
```bash
cd src/lbry_fun_frontend
npm start
```
- Navigate to token creation page
- Verify all 5 tokenomics fields show LBRY/ALEX defaults

### Step 2: Generate and analyze graphs
1. Let the graphs render with default values
2. Observe the 4 graphs:
   - Cumulative Primary Supply vs. Burn
   - Primary Tokens Minted per Epoch
   - Cost to Mint One Primary Token
   - Minting Valuation vs. Primary Minted

3. Use "Copy Table Data" button
4. Paste into spreadsheet for analysis

### Step 3: Create comparison table
| Metric | LBRY/ALEX Expected | Frontend Actual | Match? |
|--------|-------------------|-----------------|---------|
| Initial burn threshold | 21,000 | ? | ? |
| Initial reward rate | 5.0 | ? | ? |
| First epoch mint | 105,000 | ? | ? |
| Total epochs | 18 | ? | ? |
| Max supply reached | 21,000,000 | ? | ? |
| Final token count | 21,000,000 | ? | ? |
| Overminting | No (100%) | ? | ? |
| Final valuation | ~$1,000,000,000 | ? | ? |

### Step 4: Document discrepancies
Expected issues based on bug documentation:
- **Overminting**: Due to `* 10000` bug, may see 142-176% of max supply
- **Wrong epoch count**: May show 10-11 epochs instead of 18
- **Incorrect rewards**: First epoch may mint 2.1M tokens (100x too much)

## 5. Validation Calculations

### Correct calculation for first epoch:
```
Burn amount in epoch 1: 21,000 LBRY
Reward rate: 5.0 ALEX per LBRY
Expected mint: 21,000 * 5.0 = 105,000 ALEX
Total after epoch 1: 315,000 (TGE) + 105,000 = 420,000 ALEX
```

### Current buggy calculation (hypothesis):
```
reward_e8s = primary_per_threshold * in_slot_burn * 10000
reward_e8s = 5 * 21,000 * 10,000 = 1,050,000,000
reward = reward_e8s / E8S = 1,050,000,000 / 100,000,000 = 10.5
But in E8S: 10.5 * E8S = 1,050,000,000 (10.5M tokens!)
```

## 6. Success Criteria

The implementation is correct when:
- [ ] Default values in form match LBRY/ALEX parameters
- [ ] First epoch mints exactly 105,000 ALEX for 21,000 LBRY burn
- [ ] Graph shows exactly 18 epochs
- [ ] Total minted = 21,000,000 (no overminting)
- [ ] Cost progression matches LBRY/ALEX table
- [ ] Final valuation approximates $1B

## 7. Debugging Steps

If validation fails:

1. **Check E8S conversions**
   - Ensure frontend sends natural units
   - Verify backend expects E8S
   - Check UnifiedTokenomicsGraphs conversions

2. **Verify formula**
   - Current: `reward = rate * burn * 10000 / E8S`
   - Should be: `reward = rate * burn` (if rate is already in tokens per burn unit)

3. **Check halving logic**
   - Should be exactly 50% each epoch
   - Verify it uses percentage (50) not decimal (0.5)

## 8. Validation Results (2025-06-23)

### Frontend Setup ✅
- Updated createTokenForm.tsx with LBRY/ALEX defaults
- Added validation comments explaining expected outputs
- Frontend server started successfully with defaults loaded

### CRITICAL BUG DISCOVERED: 10,000× Minting Error

#### Actual Frontend Output vs Expected
When using LBRY/ALEX default parameters, the frontend produces catastrophically wrong results:

| Metric | Expected (LBRY/ALEX) | Actual Frontend Output | Error Factor |
|--------|---------------------|------------------------|--------------|
| First epoch mint | 105,000 ALEX | 10.5 ALEX | **10,000× too small** |
| Total epochs | 18 | 50 | 2.8× too many |
| Per-epoch pattern | Decreasing (105k→52.5k→52.5k...) | Constant 10.5 ALEX | Wrong pattern |
| Final supply | 21,000,000 ALEX | 21,000,000 ALEX | ✓ Correct (capped) |

#### Sample of Actual Graph Data (First 10 Epochs):
```
Epoch    Cumulative Secondary Burned    Cumulative Primary Minted    Primary Minted In Epoch
TGE      0                              315000.0000                  315000.0000
Epoch 1  2,100,000,000,000             315010.5000                  10.5000
Epoch 2  6,300,000,000,000             315021.0000                  10.5000
Epoch 3  14,700,000,000,000            315031.5000                  10.5000
Epoch 4  31,500,000,000,000            315042.0000                  10.5000
Epoch 5  65,100,000,000,000            315052.5000                  10.5000
...continues for 50 epochs with same 10.5 ALEX per epoch...
```

### Root Cause Analysis

#### 1. The 10,000× Division Bug
The frontend validation code contains this suspicious line:
```typescript
const firstEpochMint = initialReward * initialBurnAmount / 10000;
```

This suggests the backend has a similar bug where it incorrectly divides by 10,000.

#### 2. Correct Calculation
```
Epoch 1: 21,000 LBRY × 5.0 ALEX/LBRY = 105,000 ALEX ✓
```

#### 3. Actual (Buggy) Calculation
```
Epoch 1: 21,000 LBRY × 5.0 ALEX/LBRY ÷ 10,000 = 10.5 ALEX ✗
```

#### 4. E8S Values Are Correct
The burn amounts in E8S are correct:
- "2,100,000,000,000" = 21,000 tokens × 10^8 ✓
- Pattern correctly doubles each epoch ✓

### Impact of the Bug

1. **Tokenomics Completely Broken**: Minting 10,000× less than intended makes the token economics nonsensical
2. **Distribution Timeline Wrong**: Takes 50 epochs instead of 18 to distribute tokens
3. **Cost Calculations Invalid**: All USD cost calculations are off by 10,000×
4. **User Experience**: Users would need to burn 10,000× more secondary tokens than intended

### Comparison with Expected LBRY/ALEX Behavior

#### How It Should Work (First 5 Epochs):
```
Epoch    Burn This Epoch    Reward Rate    Mint This Epoch    Cumulative
TGE      0                  -              315,000            315,000
1        21,000            5.0            105,000            420,000
2        21,000            2.5            52,500             472,500
3        42,000            1.25           52,500             525,000
4        84,000            0.625          52,500             577,500
5        168,000           0.3125         52,500             630,000
```

#### Pattern Analysis:
- Burn amounts: Start at 21k, stay at 21k for epoch 2, then double each epoch
- Reward rates: Halve each epoch (5 → 2.5 → 1.25 → 0.625...)
- Mint amounts: Start at 105k, then stabilize at 52.5k for several epochs

## 9. Immediate Actions Required

### For Backend Investigation:
1. **Find the /10000 bug**: Search for any division by 10000 or 10_000 in:
   - `preview_tokenomics_graphs` function
   - Any tokenomics calculation functions
   - E8S conversion logic

2. **Check the formula**: The backend should implement:
   ```
   mint_amount = burn_amount × reward_rate
   ```
   NOT:
   ```
   mint_amount = burn_amount × reward_rate ÷ 10000
   ```

3. **Verify E8S handling**: Ensure E8S conversions are applied correctly and not duplicated

### For Frontend Fix:
1. **Remove the /10000 division** in validation code
2. **Update preview calculations** to match correct formula
3. **Add unit tests** to prevent regression

### Test Cases for Verification:
With LBRY/ALEX parameters:
- ✓ First epoch should mint 105,000 ALEX (not 10.5)
- ✓ Total epochs should be ~18 (not 50)
- ✓ Final supply should reach 21M without overminting
- ✓ Minting pattern should decrease over time

## 10. Summary for Next Agent

**THE BUG**: The tokenomics calculations are dividing by 10,000 when they shouldn't, causing all minting to be 10,000× smaller than intended.

**WHERE TO LOOK**: 
1. Backend: `preview_tokenomics_graphs` and related functions
2. Frontend: Validation code in `createTokenForm.tsx` (line ~132)

**THE FIX**: Remove the erroneous ÷10,000 operation from the minting calculation formula.

**VALIDATION**: After fixing, the first epoch with LBRY/ALEX parameters should mint 105,000 ALEX, not 10.5 ALEX.

This is a critical bug that makes the entire tokenomics system unusable until fixed.

## 11. Code Review Summary (2025-06-23)

### Fixed: The 10,000× Division Bug

#### Changes Made:

1. **Frontend (createTokenForm.tsx:140)**:
   - Removed: `const firstEpochMint = initialReward * initialBurnAmount / 10000;`
   - Fixed to: `const firstEpochMint = initialReward * initialBurnAmount;`

2. **Backend - tokenomics_simple.rs**:
   - Removed the `* 10000` multiplication from the minting formula
   - Corrected formula: `reward = burn_amount × reward_rate`

3. **Backend - simulation.rs**:
   - Removed the `.saturating_div(10000)` from potential mint calculation

4. **Backend - script.rs**:
   - Removed the `* 10000` from reward calculation
   - Fixed: `reward_e8s = (primary_per_threshold * in_slot_burn) / E8S`

5. **Backend - update.rs**:
   - Removed two instances of `slot_mint.checked_mul(10000)`
   - Removed one instance of `phase_mint_primary.checked_mul(10000)`
   - Fixed error message to use correct E8S division

#### Root Cause:
The bug was an erroneous multiplication by 10,000 in the tokenomics calculations, causing all minting to be 10,000× smaller than intended. This appears to have been a misunderstanding of the unit conversion requirements.

#### Expected Results After Fix:
With LBRY/ALEX parameters (21M max supply, 21k initial burn, 5.0 reward rate):
- First epoch should mint **105,000 ALEX** (not 10.5)
- Total epochs should be ~**18** (not 50)
- Minting pattern should show decreasing rewards per epoch
- Final supply should reach 21M without overminting

#### Next Steps:
1. Run tests with LBRY/ALEX parameters to verify fix
2. Check that tokenomics graphs now show correct values
3. Verify no overminting occurs
4. Ensure cost calculations are correct