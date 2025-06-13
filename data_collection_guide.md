# TokenomicsGraphsBackend Data Collection Guide

## Phase 1: Data Collection for Parameter Analysis

### Prerequisites
1. Run the build script: `./scripts/build.sh`
2. Start the frontend: `npm start`
3. Open browser to the frontend URL
4. Navigate to the token creation page

### Data Collection Process

#### Test Set A: Halving Step Impact Analysis
Fixed parameters:
- Hard Cap: 1,000,000
- Burn Unit: 1,000,000
- Initial Reward: 20,000
- Mint Cap: 50,000

Vary Halving Step: [25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90]

#### Test Set B: Burn Unit Scaling
Fixed parameters:
- Hard Cap: 1,000,000
- Halving Step: 50
- Initial Reward: 20,000
- Mint Cap: 50,000

Vary Burn Unit: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000]

#### Test Set C: Supply/Reward Ratio Testing
| Test ID | Hard Cap | Burn Unit | Initial Reward | Halving |
|---------|----------|-----------|----------------|---------|
| C1 | 100,000 | 1,000,000 | 50,000 | 50 |
| C2 | 100,000 | 1,000,000 | 1,000 | 50 |
| C3 | 10,000,000 | 1,000,000 | 1,000 | 50 |
| C4 | 10,000,000 | 1,000,000 | 100,000 | 50 |
| C5 | 1,000,000 | 1,000,000 | 1 | 50 |
| C6 | 1,000,000 | 100 | 1,000,000 | 50 |

#### Test Set D: Edge Cases
| Test ID | Hard Cap | TGE | Burn Unit | Halving | Initial Reward | Expected Issue |
|---------|----------|-----|-----------|---------|----------------|----------------|
| D1 | 1,000 | 1 | 100 | 25 | 1,000 | Minimum viable |
| D2 | 10,000,000 | 1 | 10,000,000 | 90 | 1,000,000 | Maximum stress |
| D3 | 1,000,000 | 999,999 | 1,000,000 | 50 | 20,000 | TGE warning |
| D4 | 1,000,000 | 1 | 100 | 99 | 20,000 | Invalid halving |
| D5 | 1,000,000 | 1 | 20,000,000 | 25 | 100,000 | Unreachable epochs |

### Data Collection Steps
1. Input parameters into form
2. Wait for graphs to render
3. Click "Copy Backend Table Data" button
4. Paste data into spreadsheet with test ID
5. Record any warnings displayed
6. Note key metrics from summary box

### Expected CSV Format
```
Epoch	Cumulative Secondary Burned	Cumulative Primary Minted	Primary Minted In Epoch	USD Cost per Primary Token ($)	Cumulative USD Cost ($)	Supply Minted (%)
TGE	0	[value]	[value]	[value]	$0.00	[value]%
[epoch]	[value]	[value]	[value]	[value]	[value]	[value]%
```

### Metrics to Track
- Total epochs generated
- Initial valuation ($)
- Final valuation ($)
- Cost progression curve shape
- Warning messages
- Edge case behaviors