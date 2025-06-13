# Token Launch Parameter Testing & Validation Project Plan

## Project Overview
This project aims to ensure that token launch parameters produce sensible fair-launch outcomes and that the TokenomicsGraphsBackend.tsx projections accurately reflect actual backend behavior during token minting/burning operations.

### Context
This is a crypto token launchpad on the Internet Computer with a unique dual-token system:
- **Secondary tokens**: Minted with ICP at $0.01 per token
- **Primary tokens**: Minted by burning secondary tokens at varying rates (with 50% ICP refund)
- **Distribution**: 1% LBRY buyback, 49.5% to stakers, 49.5% to liquidity

### Key Components
- **TokenomicsGraphsBackend.tsx**: Frontend component that calls `preview_tokenomics_graphs()` 
- **Data Export**: "Copy Backend Table Data" button exports TSV format
- **Backend Function**: `preview_tokenomics_graphs()` in lbry_fun canister returns GraphData
- **Test Infrastructure**: Existing `/tests` folder with pocket-ic mock canisters

## Goals
1. Refine parameter sliders to constrain token launches within economically sound ranges
2. Validate that frontend projections match actual backend execution through comprehensive testing
3. Establish parameter validation rules based on real data analysis

---

## Phase 1: Data-Driven Parameter Analysis ✅ COMPLETED
**Objective**: Collect and analyze real CSV data from TokenomicsGraphsBackend to establish optimal parameter ranges

### Phase 1 Completion Summary
- ✅ Created and deployed data collection infrastructure
- ✅ Discovered critical API usage detail: `preview_tokenomics_graphs()` expects raw token values, not e8s
- ✅ Collected data from 33 parameter combinations achieving 1-17 epochs
- ✅ Identified parameter relationships and trade-offs
- ✅ Generated comprehensive analysis and recommendations

### Key Discovery
**IMPORTANT**: The backend `preview_tokenomics_graphs()` function expects raw token values (e.g., 1000000 for 1M tokens), NOT e8s values. The backend handles e8s conversion internally.

### ✅ Available Data Collection Methods
**Method 1: Autonomous (Recommended)**
```bash
# Deploy first
./scripts/build.sh

# Then collect data
./scripts/collect_tokenomics_data.sh  # Simplest
# OR
node collect_tokenomics_data.js       # Most complete
# OR  
python3 collect_tokenomics_data.py    # With analysis
```

**Method 2: Manual Frontend**
1. Run `npm start` after deployment
2. Use TokenomicsGraphsBackend "Copy Backend Table Data" button
3. Follow `data_collection_guide.md` methodology

### Data Collection Methodology

#### Step 1: Access the Token Creation Form
1. Navigate to the lbry_fun frontend create token page
2. Ensure all form fields are visible and TokenomicsGraphsBackend component is rendered
3. Verify the "Copy Backend Table Data" button is present below the graphs

#### Step 2: Systematic Parameter Testing

**Test Set A: Halving Step Impact Analysis**
For each test, set these fixed parameters:
- Hard Cap: 1,000,000
- Burn Unit: 1,000,000  
- Initial Reward: 20,000
- Mint Cap: 50,000

Then vary Halving Step: 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90

For each configuration:
1. Input parameters into form
2. Wait for graphs to render
3. Click "Copy Backend Table Data"
4. Paste into spreadsheet with test ID "A1", "A2", etc.
5. Record warnings displayed
6. Note key metrics from summary box

**Test Set B: Burn Unit Scaling**
Fixed parameters:
- Hard Cap: 1,000,000
- Halving Step: 50
- Initial Reward: 20,000
- Mint Cap: 50,000

Vary Burn Unit: 100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000

Process: Same as above, label as "B1", "B2", etc.
Special attention to: Initial valuation warnings (<$5,000)

**Test Set C: Supply/Reward Ratio Testing**
Test these specific combinations:
| Test ID | Hard Cap | Burn Unit | Initial Reward | Halving | Purpose |
|---------|----------|-----------|----------------|---------|----------|
| C1 | 100,000 | 1,000,000 | 50,000 | 50 | Small supply, high reward |
| C2 | 100,000 | 1,000,000 | 1,000 | 50 | Small supply, low reward |
| C3 | 10,000,000 | 1,000,000 | 1,000 | 50 | Large supply, low reward |
| C4 | 10,000,000 | 1,000,000 | 100,000 | 50 | Large supply, high reward |
| C5 | 1,000,000 | 1,000,000 | 1 | 50 | Minimal reward test |
| C6 | 1,000,000 | 100 | 1,000,000 | 50 | Extreme reward test |

**Test Set D: Edge Cases**
| Test ID | Hard Cap | TGE | Burn Unit | Halving | Initial Reward | Expected Issue |
|---------|----------|-----|-----------|---------|----------------|----------------|
| D1 | 1,000 | 1 | 100 | 25 | 1,000 | Minimum viable |
| D2 | 10,000,000 | 1 | 10,000,000 | 90 | 1,000,000 | Maximum stress |
| D3 | 1,000,000 | 999,999 | 1,000,000 | 50 | 20,000 | TGE warning |
| D4 | 1,000,000 | 1 | 100 | 99 | 20,000 | Invalid halving |
| D5 | 1,000,000 | 1 | 20,000,000 | 25 | 100,000 | Unreachable epochs |

#### Step 3: Data Analysis Framework

Create master spreadsheet with columns:
- Test_ID
- Hard_Cap
- TGE_Allocation  
- Burn_Unit
- Halving_Step
- Initial_Reward
- Mint_Cap
- Epochs_Generated
- TGE_Percentage
- Initial_Mint_Cost
- Final_Mint_Cost
- Total_Valuation
- Initial_Valuation
- Warning_Messages
- Notes

#### Step 4: Analysis Targets

From collected data, determine:
1. **Optimal Epoch Range**: Which parameters consistently produce 15-30 epochs?
2. **Cost Progression**: What creates smooth vs. extreme cost curves?
3. **Warning Triggers**: Exact thresholds for each warning type
4. **Failure Modes**: Parameter combinations that break the model
5. **Interdependencies**: How parameters affect each other

### Phase 1 Results Summary

#### Parameter Impact on Epoch Generation
| Parameter | Impact on Epochs | Key Finding |
|-----------|-----------------|-------------|
| Lower Halving % | MORE epochs | 25% halving → 6-9 epochs; 70% → 4 epochs |
| Lower Reward | MORE epochs | 100 reward → 11 epochs; 2000 → 4 epochs |
| Lower Burn Unit | MORE epochs | 10k burn → 17 epochs; 1M → 4 epochs |

#### Valuation vs Distribution Trade-off
| Goal | Parameters | Result |
|------|------------|---------|
| Many Epochs (15+) | Low burn unit (10-50k) | ⚠️ Initial valuation < $5k |
| Balanced (8-12) | Medium burn (100-500k) | ⚠️ Initial valuation < $5k |
| Quick (3-5) | High burn (1M+) | ✅ Meets $5k threshold |

---

## Phase 2: Frontend Parameter Constraints
**Objective**: Implement improved parameter validation and user guidance

### Tasks:
- [x] Create data collection infrastructure and templates
- [x] Create autonomous data collection scripts
- [x] Deploy local environment and collect comprehensive test data
- [x] Analyze collected data to identify optimal parameter ranges
- [x] Generate parameter constraint recommendations

### Ready to Implement:

#### Parameter Constraints
- [ ] Update parameter slider ranges in createTokenForm.tsx
  - Burn Unit: 100,000 - 10,000,000 (default: 1,000,000)
  - Initial Reward: 10 - 10,000 (default: 2,000)
  - Halving Step: 25% - 90% (default: 70%)
  - [ ] Add dynamic max reward = hard_cap * 0.01
  - [ ] Show initial valuation = burn_unit * 0.005

#### Validation Warnings
- [ ] If burn_unit < 1,000,000: "⚠️ Initial valuation below $5,000 threshold"
- [ ] If initial_reward > hard_cap * 0.01: "⚠️ High reward may result in few epochs"
- [ ] If predicted epochs < 3: "⚠️ Very short distribution period"
- [ ] If predicted epochs > 30: "⚠️ Extended distribution may reduce liquidity"

#### Parameter Presets
- [ ] **Extended Distribution** (15+ epochs)
  - Burn: 100,000, Reward: 200, Halving: 35%
  - Note: Initial valuation $500
- [ ] **Balanced** (8-12 epochs)
  - Burn: 500,000, Reward: 500, Halving: 45%
  - Note: Initial valuation $2,500
- [ ] **Quick Launch** (3-5 epochs)
  - Burn: 1,000,000, Reward: 2,000, Halving: 70%
  - Note: Initial valuation $5,000

---

## Phase 3: Backend Testing Infrastructure
**Objective**: Build comprehensive test suite for tokenomics calculations

### Tasks:
- [ ] Understand existing test infrastructure
  - [ ] Review `/tests` folder structure and pocket-ic setup
  - [ ] Examine existing test utilities in `tests/src/`
  - [ ] Document current test capabilities and gaps
- [ ] Extend test environment for parameter validation
  - [ ] Add parameter validation test utilities
  - [ ] Create helpers for testing edge cases
  - [ ] Build comparison utilities (projected vs actual)
- [ ] Create parameter test matrix
  - [ ] Define test cases for edge parameters
  - [ ] Include combinations that should fail validation
  - [ ] Test boundary conditions (min/max values)
- [ ] Build test data generators
  - [ ] Generate random valid parameter sets
  - [ ] Create specific edge case scenarios
  - [ ] Build utilities for comparing expected vs actual outcomes

---

## Phase 4: Core Tokenomics Testing
**Objective**: Validate tokenomics schedule generation and minting logic

### Tasks:
- [ ] Test tokenomics schedule generation against collected data
  - [ ] Compare `preview_tokenomics_graphs()` output with actual execution
  - [ ] Verify epoch calculations match between preview and runtime
  - [ ] Test edge cases identified in Phase 1 data collection
  - [ ] Validate cumulative calculations and "one reward mode" activation
- [ ] Test minting mechanics
  - [ ] Verify correct primary token minting per burn
  - [ ] Test max phase mint enforcement
  - [ ] Validate supply cap enforcement
  - [ ] Test partial epoch completions
- [ ] Test burning mechanics
  - [ ] Verify secondary token burn tracking
  - [ ] Test ICP return calculations (50% refund)
  - [ ] Validate epoch threshold crossings
  - [ ] Test concurrent burn operations
- [ ] Test edge cases
  - [ ] Zero/minimal burns
  - [ ] Attempts to exceed max supply
  - [ ] Rapid consecutive operations
  - [ ] Parameter updates mid-launch (if applicable)

---

## Phase 5: Graph Projection Validation
**Objective**: Ensure frontend graphs accurately predict backend behavior

### Tasks:
- [ ] Create comprehensive graph validation test suite
  - [ ] Use Phase 1 collected data as baseline for validation
  - [ ] Build automated comparison between frontend graphs and backend execution
  - [ ] Test all parameter combinations from Phase 1 test sets
  - [ ] Validate cost projections match actual minting costs
  - [ ] Check epoch transition accuracy across different halving steps
- [ ] Test graph generation edge cases
  - [ ] Very long tokenomics schedules (many epochs)
  - [ ] Extreme parameter combinations
  - [ ] Near-max-supply scenarios
- [ ] Build automated comparison tools
  - [ ] Create utilities to simulate full token lifecycle
  - [ ] Compare projected vs actual at key milestones
  - [ ] Generate reports on discrepancies
- [ ] Performance testing
  - [ ] Test graph generation with large epoch counts
  - [ ] Measure computation costs
  - [ ] Optimize if necessary

---

## Phase 6: Integration Testing
**Objective**: Test the complete token launch flow end-to-end

### Tasks:
- [ ] Test full token creation flow
  - [ ] Parameter submission through frontend
  - [ ] Canister spawning and initialization
  - [ ] Initial state verification
- [ ] Test user interactions
  - [ ] Minting secondary tokens with ICP
  - [ ] Burning secondary for primary tokens
  - [ ] Multiple users interacting simultaneously
- [ ] Test economic distribution
  - [ ] Verify 1% LBRY buyback
  - [ ] Validate 49.5% staker distribution
  - [ ] Check 49.5% liquidity provision
  - [ ] Test hourly distribution mechanics
- [ ] Stress testing
  - [ ] High volume minting/burning
  - [ ] Many concurrent users
  - [ ] Long-running token lifecycles

---

## Phase 7: Parameter Optimization
**Objective**: Finalize optimal parameter ranges based on test results

### Tasks:
- [ ] Analyze test results
  - [ ] Identify parameter combinations that failed
  - [ ] Document problematic scenarios
  - [ ] Calculate optimal ranges for fair launches
- [ ] Update parameter constraints
  - [ ] Implement final min/max values
  - [ ] Add dynamic constraints based on other parameters
  - [ ] Update validation logic
- [ ] Create parameter recommendation engine
  - [ ] Suggest parameters based on project goals
  - [ ] Provide economic impact analysis
  - [ ] Show projected outcomes clearly
- [ ] Documentation
  - [ ] Write parameter selection guide
  - [ ] Document economic principles
  - [ ] Create examples of good/bad launches

---

## Phase 8: Monitoring & Analytics
**Objective**: Implement ongoing validation of launched tokens

### Tasks:
- [ ] Build monitoring tools
  - [ ] Track actual vs projected metrics
  - [ ] Alert on significant deviations
  - [ ] Generate periodic reports
- [ ] Create analytics dashboard
  - [ ] Show launched token performance
  - [ ] Compare projections to reality
  - [ ] Identify parameter patterns in successful launches
- [ ] Implement feedback loop
  - [ ] Use real data to refine parameter constraints
  - [ ] Update recommendations based on outcomes
  - [ ] Continuous improvement process

---

## Success Criteria
1. All parameter combinations within allowed ranges produce economically sensible outcomes
2. Frontend projections match backend execution within 1% margin of error
3. No edge cases allow for unfair token distribution or economic exploitation
4. Users receive clear guidance on parameter selection and potential outcomes
5. Comprehensive test coverage (>90%) for all tokenomics calculations

---

## Risk Mitigation
- **Economic Exploits**: Thorough testing of edge cases and parameter combinations
- **Projection Accuracy**: Extensive validation between frontend and backend calculations
- **User Experience**: Clear documentation and UI guidance for parameter selection
- **Performance**: Optimization of graph generation and tokenomics calculations
- **Maintenance**: Automated testing to catch regressions

---

## Implementation Priority & Timeline

### Immediate Next Steps (Phase 2 Implementation)
1. **Implement parameter constraints** (1 day)
   - Update slider min/max values in createTokenForm.tsx
   - Add dynamic validation based on relationships
   - Implement initial valuation display

2. **Add validation warnings** (0.5 days)
   - Implement epoch count predictions
   - Add contextual warnings based on parameters
   - Show trade-offs clearly to users

3. **Create parameter presets** (0.5 days)
   - Implement three preset configurations
   - Add preset selector to UI
   - Allow custom configuration

### Updated Phase Implementation Order
- **Phase 1**: Data collection ✅ COMPLETED
- **Phase 2**: Frontend parameter constraints (IN PROGRESS - 2 days)
- **Phase 3-4**: Backend testing (next priority - 1 week)
- **Phase 5**: Graph validation (1 week)
- **Phase 6**: Integration testing (3 days)
- **Phase 7-8**: Optimization & monitoring (ongoing)

**Revised Total Estimate: 2-3 weeks** (Phase 1 complete, clear implementation path)

---

## Parameter Relationship Matrix

### How Parameters Affect Epoch Count
| Parameter Change | Effect on Epochs | Example |
|-----------------|------------------|---------|
| Halving ↓ (70% → 25%) | Epochs ↑ | 4 → 9 epochs |
| Reward ↓ (2000 → 100) | Epochs ↑ | 4 → 11 epochs |
| Burn Unit ↓ (1M → 10k) | Epochs ↑ | 4 → 17 epochs |

### Recommended Parameter Ranges by Goal
| Distribution Goal | Burn Unit | Initial Reward | Halving | Initial Valuation |
|------------------|-----------|----------------|---------|------------------|
| Extended (15+ epochs) | 10k-100k | 50-200 | 25-35% | $50-$500 ⚠️ |
| Moderate (8-12 epochs) | 100k-500k | 200-500 | 35-45% | $500-$2,500 ⚠️ |
| Balanced (5-8 epochs) | 500k-1M | 500-1000 | 45-60% | $2,500-$5,000 |
| Quick (3-5 epochs) | 1M-2M | 1000-5000 | 60-80% | $5,000-$10,000 ✅ |
| Rapid (1-3 epochs) | 2M+ | 5000+ | 80-90% | $10,000+ ✅ |

### Key Trade-offs
1. **More Epochs = Lower Initial Valuation**: Cannot achieve 15+ epochs with $5k+ valuation
2. **Inverse Relationships**: Lower rewards and more aggressive halving create MORE epochs
3. **Valuation Threshold**: $5,000 minimum requires burn_unit ≥ 1,000,000

---

## Review Section
*Phase 1 COMPLETED - Ready for Phase 2 Implementation*

### Executive Summary
Successfully collected and analyzed tokenomics data from 33 parameter combinations, achieving 1-17 epoch distributions. Discovered that `preview_tokenomics_graphs()` expects raw token values (not e8s), resolving initial confusion. The tokenomics model works correctly with clear parameter relationships identified.

### Key Discoveries
1. **API Usage**: Backend expects raw values (1000000), not e8s (100000000000000)
2. **Inverse Relationships**: Lower rewards and aggressive halving create MORE epochs
3. **Trade-off**: Extended distributions (15+ epochs) require initial valuations below $5k
4. **Current Defaults**: Provide balanced 4-epoch distribution at exactly $5k valuation

### Phase 2 Implementation Checklist
- [ ] Update parameter sliders with discovered constraints
- [ ] Add dynamic validation warnings based on predictions
- [ ] Implement three parameter presets (Extended/Balanced/Quick)
- [ ] Display initial valuation calculation (burn_unit * 0.005)
- [ ] Show epoch count prediction in real-time
- [ ] Add tooltips explaining parameter relationships

### Technical Implementation Notes
```typescript
// Parameter constraints to implement
const BURN_UNIT_MIN = 100_000;     // Warning if < 1M
const BURN_UNIT_MAX = 10_000_000;
const REWARD_MIN = 10;
const REWARD_MAX = (hardCap * 0.01); // Dynamic max
const HALVING_MIN = 25;
const HALVING_MAX = 90;
```

### Files for Reference
- `/phase1_corrected_findings.md` - Complete analysis with recommendations
- `/tokenomics_data/corrected_results.csv` - Test data
- `/test_tokenomics_corrected.sh` - Testing methodology