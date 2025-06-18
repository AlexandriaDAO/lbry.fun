# LBRYFun Tokenomics Documentation

## TL;DR

**Core Flow**: Users swap ICP for secondary tokens at $0.01. ICP accumulates in canister. Every hour, 1% of total ICP pool is distributed: 1% to LBRY buyback, 49.5% to stakers, 49.5% to LP treasury.

**Key Mechanics**:
- Secondary tokens burn for 50% ICP return + primary tokens
- Primary tokens stake for ICP rewards
- LP treasury deploys liquidity to Kong DEX
- LBRY fees fund parent project buybacks

---

## Core Token Economics

### Dual Token System
- **Secondary Token**: Mint with ICP at $0.01 fixed rate
- **Primary Token**: Mint by burning secondary tokens (50% ICP returned)
- **Rate Management**: Secondary fixed, primary dynamic via tokenomics canister

### ICP Flow
1. **User Swap**: ICP → Secondary tokens (`update.rs:113-228`)
2. **Accumulation**: 100% ICP held in canister balance
3. **Hourly Distribution**: 1% of total pool distributed (`distribute_reward()`)

---

## Distribution Mechanics (1% of Pool Per Hour)

### Three-Way Split
- **1%** → LBRY Buyback (`update.rs:1206-1213`)
- **49.5%** → Staker Rewards (`update.rs:1224-1232`) 
- **49.5%** → LP Treasury (`update.rs:1215-1222`)

### Distribution Threshold
**Minimum**: 100,000 e8s (0.001 ICP) total distribution (`constants.rs:8`)
**Purpose**: Prevents failed small transfers
**Pool Requirement**: ~10,000,000 e8s (0.1 ICP) total needed

---

## LBRY Buyback (1% of Distribution)

### Process
1. **Transfer**: Immediate send to lbry_fun canister (`constants.rs:2`)
2. **Processing**: 0.01 ICP minimum for swap attempt (`lbry_fun/update.rs:617`)
3. **Failure Handling**: ICP remains in treasury, retry next hour

### Timeline
**Accumulation**: ~10 ICP total pool needed for processing (10 hours at 1 ICP/hour)

---

## Staker Rewards (49.5% of Distribution)

### Staking System
**Stake**: Primary tokens → earn proportional ICP rewards
**Distribution**: 0.01 ICP minimum (`update.rs:1257-1265`)
**Claiming**: 0.01 ICP minimum (`update.rs:1433-1443`)

### Calculation
Rewards distributed proportionally based on staked amount using scaling factor (`update.rs:1279-1309`)

---

## LP Treasury (49.5% of Distribution)

### Accumulation
**Storage**: Internal LP_TREASURY state (`storage.rs:130-152`)
**Threshold**: 0.2 ICP minimum for deployment (`constants.rs:11`)

### Deployment Strategy
**Usage**: 2% of treasury balance per deployment
**Bootstrap Mode**: If pool < 1 ICP, use all 2% to mint + add initial liquidity
**Normal Mode**: 1% buyback + 1% pairing with bought tokens
**Integration**: Kong DEX via `add_liquidity_to_kong()`

### Timeline
**Accumulation**: ~40.4 ICP total pool needed for deployment (1.7 days at 1 ICP/hour)

---

## Economic Thresholds

| Component | Threshold | Location | Purpose |
|-----------|-----------|----------|---------|
| Root Distribution | 0.001 ICP | `constants.rs:8` | Prevents failed transfers |
| Staker Distribution | 0.01 ICP | `update.rs:1257` | Minimum viable rewards |
| Staker Claiming | 0.01 ICP | `update.rs:1433` | Prevents dust claims |
| LP Deployment | 0.2 ICP | `constants.rs:11` | Meaningful liquidity |
| LBRY Processing | 0.01 ICP | `lbry_fun/update.rs:617` | Minimum swap attempt |

---

## Example: 10,000 ICP Pool

```
Hourly Distribution: 100 ICP (1%)
├── LBRY Buyback: 1 ICP → Parent project
├── LP Treasury: 49.5 ICP → Liquidity provision
└── Stakers: 49.5 ICP → Proportional rewards

LP Deployment (when >= 0.2 ICP):
├── 0.002 ICP → Buy primary tokens
└── 0.002 ICP + tokens → Kong DEX liquidity
```

---

## Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `swap()` | `update.rs:113-228` | ICP → Secondary tokens |
| `burn_secondary()` | `update.rs:231-534` | Secondary → ICP + Primary |
| `distribute_reward()` | `update.rs:1096-1421` | Hourly distribution |
| `claim_icp_reward()` | `update.rs:1423-1541` | Claim staking rewards |
| `provide_liquidity_from_treasury()` | `update.rs:957-1093` | Deploy liquidity |