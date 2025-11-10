# Tokenomics Validation Guide

## Quick Start

This guide explains how to validate tokenomics for **any** token launch on caffeinelauncher.com.

### Prerequisites

1. **dfx CLI** installed and configured
2. **Node.js** (already in project)
3. **Data files exported** from Analytics Terminal

---

## Step 1: Export Token Data

### From the Frontend (Analytics Terminal):

1. **Navigate** to the token you want to validate
2. **Projection Data:**
   - Click "TOKENOMICS" tab
   - Click "copy_graph_data" button
   - Save to `validation/data/pool_X_tokenomics_data.md`

3. **Insights Data:**
   - Click "INSIGHTS" tab
   - Click "copy_graph_data" button
   - Save to `validation/data/pool_X_insights_data.md`

**Example filenames:**
- `validation/data/pool_1_tokenomics_data.md`
- `validation/data/pool_1_insights_data.md`

---

## Step 2: Get Token Configuration

You need the token's creation parameters:

| Parameter | Description | Pool 1 Example |
|-----------|-------------|----------------|
| `halving_step` | Reward decrease per epoch (%) | 90 |
| `threshold_multiplier` | Threshold growth rate | 1.5 |
| `initial_secondary_burn` | First epoch threshold (E8S) | 1000000 |
| `initial_reward` | First epoch reward rate (E8S) | 1000000 |

**Where to find:** These are set during token creation. Check:
- Token creation transaction
- `lbry_fun` canister `get_pool()` method
- Or use defaults and let validator calculate from projection data

---

## Step 3: Get Tokenomics Canister ID

Each pool has its own tokenomics canister.

**Option A: From browser console** (on Analytics Terminal page):
```javascript
// Check the network requests for canister calls
// Look for calls to a canister ID different from lbry_fun
```

**Option B: Query lbry_fun canister:**
```bash
dfx canister call --network ic oni4e-oyaaa-aaaap-qp2pq-cai get_pool '(1 : nat64)'
# Returns pool info including tokenomics_canister_id
```

---

## Step 4: Run Validation

### Basic Usage (with defaults):

```bash
cd validation/tools
node tokenomics_validator.js <tokenomics-canister-id> \
  --projection ../data/pool_X_tokenomics_data.md \
  --insights ../data/pool_X_insights_data.md
```

### With Custom Token Configuration:

```bash
node tokenomics_validator.js <canister-id> \
  --projection ../data/pool_X_tokenomics_data.md \
  --insights ../data/pool_X_insights_data.md \
  --halving-step 95 \
  --threshold-multiplier 2.0 \
  --initial-secondary-burn 500000 \
  --initial-reward 2000000
```

### Against Local Replica:

```bash
node tokenomics_validator.js <canister-id> local \
  --projection ../data/pool_X_tokenomics_data.md \
  --insights ../data/pool_X_insights_data.md
```

---

## Step 5: Review Results

The validator outputs:

1. **Console Report** - Immediate pass/fail summary
2. **Markdown Report** - Detailed analysis saved to `validation/reports/`

**Report filename format:**
```
pool_X_validation_YYYY-MM-DDTHH-MM-SS.md
```

### What Gets Validated

| Check | Pass Criteria | Purpose |
|-------|---------------|---------|
| **Cumulative Accuracy** | < 5% variance | Verify overall supply curve |
| **Thresholds Array** | Exact match | Ensure correct epoch triggers |
| **Rewards Array** | ± 1 unit (4-decimal) | Verify reward calculations |
| **Halving Progression** | ± 1% per step | Confirm halving mechanics |
| **Current State** | Exact match | Validate live canister state |

---

## Common Validation Scenarios

### Scenario 1: New Token Launch

**When:** Right after token creation
**Purpose:** Verify tokenomics were initialized correctly

```bash
# Use token creation parameters
node tokenomics_validator.js <canister-id> \
  --halving-step <value> \
  --threshold-multiplier <value> \
  --initial-secondary-burn <value> \
  --initial-reward <value>
```

**Expected:** All checks should pass with near-zero variance

---

### Scenario 2: Periodic Health Check

**When:** Weekly/monthly for live tokens
**Purpose:** Confirm tokenomics remain accurate over time

```bash
# Use defaults if Pool 1, or saved config for other pools
node tokenomics_validator.js <canister-id>
```

**Monitor:**
- Cumulative variance (should stay < 0.01%)
- Halving progression (should match expected ratio)
- No anomalies in insights data

---

### Scenario 3: Post-Upgrade Validation

**When:** After canister upgrades
**Purpose:** Ensure upgrade didn't corrupt state

```bash
# Compare before/after reports
node tokenomics_validator.js <canister-id>
```

**Check:**
- Current threshold index is correct
- Rewards array unchanged
- Cumulative supply consistent

---

### Scenario 4: Debugging Issues

**When:** Users report unexpected rewards/thresholds
**Purpose:** Identify specific validation failures

```bash
# Run with debug output
DEBUG=1 node tokenomics_validator.js <canister-id>
```

**Analysis:**
- Check which specific validation failed
- Review threshold index vs burn amount
- Compare projected vs actual arrays

---

## Interpreting Results

### ✅ All Passed

```
✅ Overall Status: PASSED

Cumulative Accuracy: ✅ PASS (0.0012% variance)
Thresholds Array:    ✅ PASS (24 matches)
Rewards Array:       ✅ PASS (24 matches)
Halving Progression: ✅ PASS (0 violations)
Current State:       ✅ PASS (consistent)
```

**Meaning:** Tokenomics are working perfectly. No action needed.

---

### ❌ Cumulative Accuracy Failed

```
❌ Cumulative Accuracy: FAIL (8.5% variance)
   Actual:   4,500,000 primary
   Expected: 4,200,000 primary
```

**Possible causes:**
- Projection data is stale
- Token parameters changed
- Bug in minting logic

**Action:** Re-export projection data. If persists, investigate canister.

---

### ❌ Thresholds Mismatch

```
❌ Thresholds Array: FAIL
   Mismatches: 3
   Index 5: actual=8000000, expected=7593750
```

**Possible causes:**
- Wrong token configuration provided
- Thresholds were manually modified (shouldn't happen)

**Action:** Verify token creation parameters. Use correct CLI flags.

---

### ❌ Halving Violations

```
❌ Halving Progression: FAIL
   Violations: 2
   E5→E6: ratio=0.85, expected=0.90
```

**Possible causes:**
- Bug in reward calculation
- Halving step misconfigured at creation

**Action:** Critical issue. Investigate canister immediately.

---

### ❌ State Inconsistency

```
❌ Current State: FAIL
   Canister burned: 5663571
   Insights burned:  5660000
   Burned match: NO
```

**Possible causes:**
- Insights data is stale (most common)
- Synchronization delay
- Canister state corruption (rare)

**Action:** Re-export insights data. Wait 1 hour and retry.

---

## File Organization

After running validations, your structure should look like:

```
validation/
├── tools/
│   ├── lib/                    # Validation libraries
│   ├── tokenomics_validator.js # Main CLI tool
│   └── README.md              # Tool documentation
├── data/
│   ├── pool_1_tokenomics_data.md
│   ├── pool_1_insights_data.md
│   ├── pool_2_tokenomics_data.md
│   └── pool_2_insights_data.md
└── reports/
    ├── pool_1_validation_2025-11-08T10-30-00.md
    ├── pool_1_validation_2025-11-15T10-30-00.md
    └── pool_2_validation_2025-11-08T14-00-00.md
```

**Benefits:**
- All validation artifacts organized in one place
- Historical reports for tracking over time
- No clutter in main codebase
- Easy to add new token validations

---

## Automation Ideas

### Weekly Validation Cron Job

```bash
#!/bin/bash
# validate-all-pools.sh

for pool_id in 1 2 3; do
  node validation/tools/tokenomics_validator.js \
    $(get_tokenomics_canister $pool_id) \
    --projection validation/data/pool_${pool_id}_tokenomics_data.md \
    --insights validation/data/pool_${pool_id}_insights_data.md
done
```

### CI/CD Integration

```yaml
# .github/workflows/validate-tokenomics.yml
name: Validate Tokenomics
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: |
          node validation/tools/tokenomics_validator.js $CANISTER_ID
      - uses: actions/upload-artifact@v2
        with:
          name: validation-reports
          path: validation/reports/
```

---

## Troubleshooting

### "Cannot connect to canister"

**Error:**
```
Error: Failed to query canister: Failed to create AgentEnvironment
```

**Solution:**
1. Check canister ID format
2. Verify network (`ic` or `local`)
3. Ensure `dfx` is installed
4. For IC mainnet, check internet connection

---

### "Projection file not found"

**Error:**
```
Error: Projection file not found: validation/data/pool_X_tokenomics_data.md
```

**Solution:**
1. Export data from Analytics Terminal
2. Save to correct path
3. Use absolute path or correct relative path

---

### "Invalid canister ID format"

**Error:**
```
Error: Invalid canister ID format: abc123. Must contain only lowercase letters, numbers, and hyphens.
```

**Solution:**
Canister IDs must be valid IC Principal format:
- ✅ `abc123-cai`
- ✅ `rrkah-fqaaa-aaaaa-aaaaq-cai`
- ❌ `ABC123-cai` (uppercase)
- ❌ `abc_123` (underscore)

---

### "Thresholds array mismatch" with correct data

**Cause:** Wrong token configuration defaults

**Solution:**
Provide actual token configuration via CLI flags:
```bash
node tokenomics_validator.js <canister-id> \
  --halving-step 95 \
  --threshold-multiplier 2.0
```

---

## Advanced: JSON Output for Automation

For programmatic consumption (future enhancement):

```bash
node tokenomics_validator.js <canister-id> --format json > result.json
```

Then in scripts:
```javascript
const result = require('./result.json');
if (!result.passed) {
  sendAlert(`Tokenomics validation failed: ${result.failures}`);
}
```

---

## Best Practices

### 1. Validate Before Launch
Always run validation immediately after token creation to catch configuration errors early.

### 2. Keep Historical Reports
Save validation reports over time to track:
- Variance trends
- State evolution
- System stability

### 3. Automate Weekly Checks
Set up automated validations for all live tokens to detect issues proactively.

### 4. Document Token Configurations
Keep a registry of token parameters:
```json
{
  "pool_1": {
    "halving_step": 90,
    "threshold_multiplier": 1.5,
    "initial_secondary_burn": 1000000,
    "initial_reward": 1000000
  },
  "pool_2": {
    "halving_step": 95,
    "threshold_multiplier": 2.0,
    ...
  }
}
```

### 5. Version Reports
Include git commit hash in validation reports to track which code version was used.

---

## Need Help?

- **Documentation:** `/validation/tools/README.md`
- **Source Code:** `/validation/tools/lib/`
- **Examples:** This guide
- **Issues:** Check validation report for specific recommendations

---

*This validation system ensures mathematical correctness and on-chain accuracy for all caffeinelauncher.com tokenomics.*
