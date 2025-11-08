# Tokenomics Validation Tools

## Overview

This directory contains three levels of tokenomics validation:

### 1. Superficial Validation (Cumulative Accuracy Only)

**File:** `compare_data.js`

**What it validates:**
- Final cumulative numbers match projection

**What it doesn't validate:**
- Individual epoch mechanics
- Halving progression
- Threshold transitions

**Usage:**
```bash
node scripts/compare_data.js
# OR
npm run validate:superficial
```

**When to use:** Quick sanity check that system arrived at correct destination

---

### 2. Legacy Deep Validation (UNRELIABLE)

**File:** `deep_validation.js`

**Status:** ⚠️ FLAWED - Do not rely on results

**Problem:** Attempts to detect epochs from hourly cumulative snapshots, which is fundamentally incorrect

**Usage:**
```bash
node scripts/deep_validation.js  # NOT RECOMMENDED
# OR
npm run validate:legacy-deep
```

**When to use:** Never (kept for historical reference only)

---

### 3. Comprehensive Validation (RECOMMENDED)

**File:** `tokenomics_validator.js`

**What it validates:**
- ✅ Cumulative supply accuracy
- ✅ Thresholds array matches projection
- ✅ Rewards array matches projection
- ✅ Halving mechanics (95% step verification)
- ✅ Current canister state consistency

**Requirements:**
- `dfx` CLI installed and configured
- Access to IC network (or local replica)
- Canister ID for tokenomics canister

**Usage:**
```bash
# Validate against mainnet canister
node scripts/tokenomics_validator.js <canister-id>
# OR
npm run validate:tokenomics <canister-id>

# Validate against local replica
node scripts/tokenomics_validator.js <canister-id> local

# Custom data files
node scripts/tokenomics_validator.js <canister-id> ic \
  --projection data/my_tokenomics.md \
  --insights data/my_insights.md
```

**Output:**
- Console report with pass/fail results
- Detailed markdown report: `data/comprehensive_validation_report.md`
- Exit code: 0 (pass), 1 (fail), 2 (error)

**When to use:**
- After any tokenomics canister changes
- Periodic validation of live tokens
- Debugging halving mechanics issues
- Verifying projection accuracy

---

## Data File Format

### Projection Data (from Tokenomics tab)

Expected location: `data/zero_tokenomics_data.md`

```json
{
  "poolId": "1",
  "graphs": {
    "cumulativeSupply": {
      "xAxis": [0, 1000000, ...],  // Secondary burned (cumulative)
      "yAxis": [0, 1000000, ...]   // Primary minted (cumulative)
    },
    "mintedPerEpoch": {
      "xAxis": ["Epoch 1", "Epoch 2", ...],
      "yAxis": [1000000, 450000, ...]  // Primary minted per epoch
    }
  }
}
```

### Insights Data (from Insights tab)

Expected location: `data/zero_insights_data.md`

```json
{
  "poolId": "1",
  "timestamp": "2025-11-08T12:17:42.199Z",
  "graphs": {
    "time": ["8/21/2025", ...],
    "primaryTokenSupply": { "xAxis": [...], "yAxis": [...] },
    "totalSecondaryBurned": { "xAxis": [...], "yAxis": [...] }
  },
  "summary": {
    "primaryTokenSupply": 4339666.98,
    "totalSecondaryBurned": 5663571
  }
}
```

---

## How to Export Data

### From Frontend (Analytics Terminal):

1. **Get Projection Data:**
   - Navigate to Analytics Terminal
   - Click "TOKENOMICS" tab
   - Click "copy_graph_data" button
   - Paste into `data/zero_tokenomics_data.md`

2. **Get Insights Data:**
   - Navigate to Analytics Terminal
   - Click "INSIGHTS" tab
   - Click "copy_graph_data" button
   - Paste into `data/zero_insights_data.md`

---

## Validation Pass Criteria

### Cumulative Accuracy
- **Pass:** Variance < 5% between actual and projected primary supply
- **Typical:** ~0.001% variance (nearly perfect)

### Thresholds Array
- **Pass:** All thresholds match projection exactly
- **Note:** Integer values, no tolerance

### Rewards Array
- **Pass:** All rewards match projection within ±1 unit (4-decimal format)
- **Note:** Small rounding tolerance due to format conversion

### Halving Progression
- **Pass:** Each epoch reward = previous × (halving_step / 100) ± 1%
- **Example:** With 95% halving, each epoch should be 95% of previous

### Current State
- **Pass:** Canister's total burned matches insights data
- **Pass:** Current threshold index is correct for burn amount

---

## Troubleshooting

### "Cannot connect to canister"
- Verify canister ID is correct
- Check network is accessible (IC mainnet or local replica running)
- Ensure `dfx` is installed and configured

### "Thresholds array mismatch"
- Projection may have been generated with different parameters
- Re-export projection data from frontend
- Check if token was created with custom parameters

### "Halving violations detected"
- May indicate bug in tokenomics canister
- Verify halving_step was set correctly at creation
- Check if rewards array was manually modified (shouldn't happen)

### "Current state inconsistency"
- Insights data may be stale (old snapshot)
- Re-export insights data
- Check if there's a synchronization delay

---

## Architecture

### Component Structure

```
scripts/
├── tokenomics_validator.js      (Main CLI entry point)
└── lib/
    ├── canister_client.js       (dfx canister query wrapper)
    ├── projection_analyzer.js   (Analyze projection data)
    ├── insights_analyzer.js     (Analyze insights data)
    ├── epoch_validator.js       (Core validation logic)
    └── report_generator.js      (Format reports)
```

### Validation Flow

1. **Load Data:** Read projection and insights data files
2. **Connect to Canister:** Query actual tokenomics state via dfx
3. **Run Validations:**
   - Cumulative accuracy check
   - Thresholds array comparison
   - Rewards array comparison
   - Halving progression verification
   - Current state consistency
4. **Generate Reports:** Console output + markdown file

### Key Concepts

**E8S Format:**
- 1 token = 100,000,000 E8S (8 decimals)
- All on-chain amounts use E8S

**4-Decimal Format (Tokenomics Internal):**
- Rewards stored as 4-decimal (space optimization)
- 1.0 token = 10,000 units
- Must multiply by 10,000 to get E8S

**Thresholds:**
- Secondary burn amounts that trigger epoch transitions
- Stored in E8S format
- Grow by threshold_multiplier each epoch

**Rewards:**
- Primary tokens minted per unit of secondary burned
- Stored in 4-decimal format
- Decrease by halving_step each epoch

---

## Testing

### Manual Testing

```bash
# Test with existing data
node scripts/tokenomics_validator.js <canister-id>

# Expected output:
# - Cumulative accuracy: ~0.001% variance (PASS)
# - All arrays match projection (PASS)
# - Exit code: 0
```

### Error Testing

```bash
# Invalid canister ID
node scripts/tokenomics_validator.js invalid-id
# Should error gracefully with clear message

# Missing data files
mv data/zero_tokenomics_data.md data/backup.md
node scripts/tokenomics_validator.js <canister-id>
# Should error: "Projection file not found"
```

---

## Development Notes

### No External Dependencies

Uses only Node.js built-ins:
- `fs` - File system operations
- `path` - Path manipulation
- `child_process` - Execute dfx commands
- `util` - Promisify exec

### Candid Parsing

The canister client parses candid output using regex:

```javascript
// u32/u64: (5 : nat32)
const match = output.match(/\(([0-9_]+)\s*:/);

// Result: (variant { Ok = 123 : nat64 })
const match = output.match(/Ok\s*=\s*([0-9_]+)/);

// Vec: vec { 1_000_000 : nat64; 1_500_000 : nat64 }
const numbers = vecContent.match(/([0-9_]+)\s*:/g);
```

### Error Handling

All errors are caught and formatted with:
- Clear error message
- Suggested resolution
- Exit code 2 (error)

---

## Future Enhancements

### Potential Improvements

1. **Token Config Detection:** Auto-detect halving_step and threshold_multiplier from canister
2. **Multiple Pools:** Support validating multiple tokens in one run
3. **Historical Validation:** Compare multiple snapshots over time
4. **Anomaly Detection:** Statistical analysis of unusual patterns
5. **Performance Metrics:** Track validation execution time
6. **JSON Output:** Machine-readable report format for CI/CD

### Integration Ideas

1. **CI/CD Pipeline:** Run validation on every deployment
2. **Monitoring Dashboard:** Real-time validation status
3. **Alerting:** Notify when validation fails
4. **Automated Reports:** Schedule periodic validations

---

## Related Files

- `compare_data.js` - Superficial validation (existing)
- `deep_validation.js` - Legacy deep validation (flawed, existing)
- `VALIDATION_REPORT.md` - Output from compare_data.js
- `CORRECTED_VALIDATION.md` - Explanation of validation issues
- `deep_validation_results.json` - Output from deep_validation.js (unreliable)

---

*For questions or issues, refer to the COMPREHENSIVE_TOKENOMICS_VALIDATOR_PLAN.md*
