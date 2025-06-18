# Kongswap Integration Security Audit

## Executive Summary

This audit examines the kongswap DEX integration within the LBRY Fun token launchpad system. The integration handles automated liquidity provision, token swaps, and treasury management. Several critical vulnerabilities were identified that could lead to fund loss, manipulation, and system disruption.

## How the Kongswap Integration Works

### 1. Architecture Overview

The kongswap integration consists of three main components:

- **Treasury Management**: Collects 49.5% of distributed rewards into an `LP_TREASURY`
- **Automated Liquidity Provision**: Scheduled function that deploys treasury funds to kongswap
- **Swap Execution**: Performs token buybacks and liquidity additions

### 2. Liquidity Provision Flow

```
LP_TREASURY (49.5% of rewards) 
    ↓
provide_liquidity_from_treasury() [Every 4 hours]
    ↓
Split treasury: 50% for buyback, 50% for pairing
    ↓
execute_swap_on_dex(ICP → Primary Token)
    ↓
add_liquidity_to_kong(Primary Token + ICP)
```

**Key Implementation** (`src/icp_swap/src/update.rs:956-1020`):
1. Uses 50% of treasury balance when above 1 ICP minimum
2. Splits deployment amount: half for buyback, half for LP pairing
3. Executes buyback swap on kongswap
4. Adds liquidity with bought tokens + remaining ICP
5. Updates treasury balance with actual spent amounts

### 3. DEX Integration Points

**Swap Execution** (`src/icp_swap/src/dex_integration.rs:126-166`):
- Gets quote from kongswap
- Approves tokens via ICRC2
- Executes swap with 0.5% slippage protection
- Calculates minimum receive amount as 99.5% of quote

**Liquidity Addition** (`src/icp_swap/src/dex_integration.rs:175-198`):
- Approves both token pairs
- Calls kongswap's `add_liquidity` function
- DEX determines final ratios and takes what's needed

## Critical Vulnerabilities

### 1. **MEV/Frontrunning Vulnerability** ⚠️ HIGH RISK

**Location**: `dex_integration.rs:127-140`

**Issue**: The system gets a quote, then executes the swap in a separate transaction. This creates a time window where MEV bots can:
1. See the incoming large buy order
2. Front-run with their own buy orders
3. Sell into the protocol's buy order at inflated prices
4. Extract value from the treasury

**Attack Scenario**:
```
1. Treasury has 100 ICP to deploy
2. Protocol calls get_kong_swap_quote(50 ICP → MYTOKEN)
3. MEV bot sees this pending transaction
4. MEV bot buys MYTOKEN, pushing price up 3%
5. Protocol executes swap at inflated price
6. MEV bot sells back to market, keeping profit
7. Treasury receives 3% fewer tokens than expected
```

**Real Impact**: This drains treasury funds over time through sandwich attacks.

### 2. **Oracle Manipulation via Quote-Execute Gap** ⚠️ HIGH RISK

**Location**: `dex_integration.rs:127-128`

**Issue**: The quote is fetched separately from execution, allowing attackers to manipulate the price between these calls.

**Attack Scenario**:
```
1. Attacker observes scheduled liquidity provision
2. Right before execution, attacker dumps large amount of primary tokens
3. Quote shows low price for ICP → Primary Token swap
4. System executes buyback at artificially low price
5. Attacker buys back tokens after protocol's purchase
```

### 3. **Insufficient Slippage Protection** ⚠️ MEDIUM RISK

**Location**: `dex_integration.rs:138-140`

**Issue**: While there's 0.5% slippage protection, this may be insufficient for:
- Low liquidity tokens (common in token launches)
- High volatility periods
- Large treasury deployments relative to pool size

**Real Scenario**:
```
1. New token launch with $10k liquidity
2. Treasury deploys $5k (50% of pool size)
3. Even with 0.5% slippage, price impact is massive
4. System gets terrible execution, depleting treasury efficiency
```

### 4. **Race Condition in Treasury Updates** ⚠️ MEDIUM RISK

**Location**: `update.rs:1003` and `storage.rs:137-147`

**Issue**: Treasury balance updates happen after DEX operations complete. If multiple operations run simultaneously or if one fails partially, the treasury state can become inconsistent.

**Attack Scenario**:
```
1. Distribution function adds 10 ICP to LP_TREASURY
2. Liquidity provision function reads balance (20 ICP)
3. Another distribution adds 5 ICP (total should be 25 ICP)  
4. Liquidity provision spends 10 ICP and sets balance to 10 ICP
5. Treasury balance is now incorrect (should be 15 ICP)
```

### 5. **Hardcoded Canister ID Dependency** ⚠️ MEDIUM RISK

**Location**: `constants.rs:1`

**Issue**: Kong backend canister ID is hardcoded. If kongswap upgrades or changes canisters, the entire system breaks.

```rust
pub const KONG_BACKEND_CANISTER_ID: &str = "2ipq2-uqaaa-aaaar-qailq-cai";
```

**Real Scenario**:
```
1. Kongswap upgrades to new canister version
2. Old canister stops responding or has deprecated API
3. All liquidity provision fails
4. Treasury funds get stuck
5. System requires code update and redeployment
```

### 6. **Approval Front-Running** ⚠️ LOW-MEDIUM RISK

**Location**: `dex_integration.rs:133` and `dex_integration.rs:183-184`

**Issue**: The system approves full amounts before swaps. A malicious kongswap (or compromised kong canister) could drain approved amounts.

**Attack Scenario**:
```
1. System approves 50 ICP to kong canister
2. Malicious kong canister (or attacker with kong control) calls transfer_from
3. Drains the full approved amount instead of just swap amount
4. System loses treasury funds
```

### 7. **Timing Predictability** ⚠️ LOW RISK

**Location**: `update.rs:1022-1031`

**Issue**: Liquidity provision happens every 4 hours predictably. This allows:
- MEV bots to prepare for known large transactions
- Market manipulation around known times
- Reduced execution efficiency

### 8. **No Emergency Stop Mechanism** ⚠️ MEDIUM RISK

**Issue**: There's no way to halt automated liquidity provision if:
- Kongswap is experiencing issues
- Token prices are being manipulated
- Treasury is being drained by MEV

**Real Scenario**:
```
1. Kongswap has a bug causing bad pricing
2. System continues deploying treasury every 4 hours
3. All deployments get terrible execution
4. Treasury depletes before issue is noticed
5. No way to pause the process without full canister upgrade
```

## Economic Attack Vectors

### Treasury Drain Attack

**Vulnerability**: Combination of MEV + predictable timing
1. Attacker monitors for scheduled liquidity provisions
2. Front-runs each provision with price manipulation
3. Extracts 2-5% of each deployment via sandwich attacks
4. Over time, significantly reduces treasury efficiency

**Estimated Impact**: 10-25% reduction in LP effectiveness over 6 months

### Governance Attack via Liquidity Manipulation

**Vulnerability**: Large treasury deployments affect token prices
1. Attacker accumulates large position before deployment
2. Treasury buyback increases token price
3. Attacker sells at inflated price
4. Reduces amount of tokens actually added to liquidity

## Recommendations

### Immediate Fixes (High Priority)

1. **Implement TWAP-based Execution**
   - Use time-weighted average pricing instead of spot quotes
   - Execute swaps in smaller chunks over time

2. **Add Circuit Breakers**
   - Maximum slippage tolerance (e.g., 2%)
   - Maximum price impact limits
   - Emergency pause functionality

3. **Improve Slippage Protection**
   - Dynamic slippage based on trade size vs pool liquidity
   - Minimum liquidity requirements before deployment

### Medium Priority

1. **Add Governance for Critical Parameters**
   - Kong canister ID should be updateable
   - Deployment percentages should be adjustable
   - Timing intervals should be configurable

2. **Implement Randomized Timing**
   - Random intervals between 3-5 hours instead of fixed 4 hours
   - Random deployment amounts within ranges

3. **Add Monitoring and Alerts**
   - Track execution efficiency vs quotes
   - Alert on unusual slippage or price impact
   - Monitor treasury drain rates

### Long-term Improvements

1. **Multi-DEX Integration**
   - Support multiple DEXes to reduce single point of failure
   - Price comparison and best execution routing

2. **Advanced Execution Strategies**
   - VWAP (Volume Weighted Average Price) execution
   - Iceberg orders for large trades
   - Time-based distribution of large orders

## Conclusion

The kongswap integration contains several vulnerabilities that could lead to significant fund loss through MEV attacks, oracle manipulation, and system failures. The most critical issues are the MEV vulnerability and lack of emergency controls. Implementing the recommended fixes, particularly TWAP execution and circuit breakers, should be prioritized to protect treasury funds and ensure sustainable liquidity provision.

The current implementation prioritizes simplicity over security, which is problematic for a system handling substantial treasury funds. A phased approach to implementing security improvements is recommended, starting with the high-priority fixes that address the most severe fund-loss scenarios.