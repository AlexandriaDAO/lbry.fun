# Phase 1 Quick Start Guide

## Overview
Complete Phase 1 data collection to establish optimal parameter ranges for the token launchpad.

## Prerequisites Created ✅
- Autonomous data collection scripts
- Analysis framework  
- Test parameter matrices (38 test cases)
- Output templates

## Next Steps (Execute in Order)

### 1. Deploy Environment
```bash
./scripts/build.sh
```
**Time**: ~10-15 minutes  
**Purpose**: Deploy all canisters locally

### 2. Collect Data (Choose One Method)

**Option A: Bash Script (Simplest)**
```bash
./scripts/collect_tokenomics_data.sh
```

**Option B: Node.js (Most Complete)**
```bash
node collect_tokenomics_data.js
```

**Option C: Python (With Analysis)**
```bash
python3 collect_tokenomics_data.py
```

**Time**: ~5-10 minutes  
**Output**: `tokenomics_data/` directory with CSV/JSON files

### 3. Analyze Results
```bash
python3 analyze_tokenomics_data.py
```

**Time**: ~2-3 minutes  
**Output**: Analysis charts and parameter recommendations

### 4. Review Key Findings
Check generated files for:
- Parameter ranges that produce 15-30 epochs
- Warning thresholds (halving <40%, >80%)
- Minimum valuation requirements ($5,000)
- Edge case failure modes

## Expected Outcomes
- ✅ Complete dataset (38 test scenarios)
- ✅ Parameter constraint matrix
- ✅ Warning threshold documentation
- ✅ Recommendations for Phase 2 implementation

## What This Enables
- **Phase 2**: Update frontend parameter sliders with data-driven constraints
- **Phase 5**: Validate frontend projections against real backend behavior
- **Phases 3-4**: Use data for comprehensive backend testing

## Key Files to Reference
- `projectplan.md` - Complete project roadmap
- `data_collection_guide.md` - Manual collection methodology
- `collect_tokenomics_data.*` - Autonomous collection scripts
- `analyze_tokenomics_data.py` - Data analysis framework

## Troubleshooting
- **Canister not found**: Ensure `./scripts/build.sh` completed successfully
- **dfx errors**: Run `dfx start --clean` and retry deployment
- **No data output**: Check canister IDs and network connectivity

---
**Ready to proceed? Start with step 1 above.**