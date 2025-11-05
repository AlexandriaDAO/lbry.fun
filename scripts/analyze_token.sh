#!/bin/bash

# Token Launch Analysis Tool
# Performs comprehensive biopsy of a token launch using query calls
# Usage: ./analyze_token.sh [network]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Hardcoded mainnet canister IDs
ICP_SWAP_ID="bsarm-wqaaa-aaaap-qqcea-cai"
TOKENOMICS_ID="bvbxy-3iaaa-aaaap-qqceq-cai"
LOGS_ID="b4c4e-naaaa-aaaap-qqcfa-cai"
PRIMARY_TOKEN_ID="b3d2q-ayaaa-aaaap-qqcfq-cai"
SECONDARY_TOKEN_ID="boel5-bqaaa-aaaap-qqcga-cai"

# Parse network argument (optional)
NETWORK=${1:-ic}

# Set dfx network flag
if [ "$NETWORK" = "local" ]; then
    NETWORK_FLAG=""
    echo -e "${BLUE}Analyzing LOCAL deployment${NC}"
else
    NETWORK_FLAG="--network ic"
    echo -e "${BLUE}Analyzing MAINNET deployment${NC}"
fi

# Output file
REPORT_FILE="MAINNET_TOKEN_BIOPSY.md"
echo -e "${GREEN}Generating analysis report: ${REPORT_FILE}${NC}"

# Helper function to query a canister
query_canister() {
    local canister_id=$1
    local method=$2
    local args=$3

    if [ -z "$args" ]; then
        dfx canister call $NETWORK_FLAG "$canister_id" "$method" --query 2>&1
    else
        dfx canister call $NETWORK_FLAG "$canister_id" "$method" "$args" --query 2>&1
    fi
}

# Helper function to query a canister (update call, not query)
update_canister() {
    local canister_id=$1
    local method=$2
    local args=$3

    if [ -z "$args" ]; then
        dfx canister call $NETWORK_FLAG "$canister_id" "$method" 2>&1
    else
        dfx canister call $NETWORK_FLAG "$canister_id" "$method" "$args" 2>&1
    fi
}

# Start report
cat > "$REPORT_FILE" << EOF
# Token Launch Analysis Report
Generated: $(date)

## Deployment Information
- **ICP Swap Canister**: \`${ICP_SWAP_ID}\`
- **Tokenomics Canister**: \`${TOKENOMICS_ID}\`
- **Logs Canister**: \`${LOGS_ID}\`
- **Primary Token**: \`${PRIMARY_TOKEN_ID}\`
- **Secondary Token**: \`${SECONDARY_TOKEN_ID}\`
- **Network**: \`${NETWORK}\`

---

EOF

echo -e "${YELLOW}[1/7] Health Check & Accounting...${NC}"

# =============================================================================
# SECTION 1: HEALTH CHECK
# =============================================================================

cat >> "$REPORT_FILE" << EOF
## 1. Health Check & Accounting

EOF

echo "  - Querying reconciliation status..."
RECONCILIATION=$(update_canister "$ICP_SWAP_ID" "get_reconciliation_status" "")

cat >> "$REPORT_FILE" << EOF
### Reconciliation Status

\`\`\`
${RECONCILIATION}
\`\`\`

EOF

echo "  - Running validation checks..."
REWARD_VALIDATION=$(query_canister "$ICP_SWAP_ID" "validate_reward_consistency" "")
ARCHIVE_VALIDATION=$(query_canister "$ICP_SWAP_ID" "validate_archived_consistency" "")
ACCOUNTING_VALIDATION=$(update_canister "$ICP_SWAP_ID" "validate_accounting" "")

cat >> "$REPORT_FILE" << EOF
### Validation Results

**Reward Consistency Check:**
\`\`\`
${REWARD_VALIDATION}
\`\`\`

**Archived Balance Consistency Check:**
\`\`\`
${ARCHIVE_VALIDATION}
\`\`\`

**Full Accounting Validation:**
\`\`\`
${ACCOUNTING_VALIDATION}
\`\`\`

---

EOF

echo -e "${YELLOW}[2/7] Supply & Mechanics...${NC}"

# =============================================================================
# SECTION 2: SUPPLY & MECHANICS
# =============================================================================

cat >> "$REPORT_FILE" << EOF
## 2. Supply & Token Mechanics

EOF

echo "  - Querying primary token supply..."
PRIMARY_SUPPLY=$(query_canister "$PRIMARY_TOKEN_ID" "icrc1_total_supply" "")
PRIMARY_NAME=$(query_canister "$PRIMARY_TOKEN_ID" "icrc1_name" "")
PRIMARY_SYMBOL=$(query_canister "$PRIMARY_TOKEN_ID" "icrc1_symbol" "")

echo "  - Querying secondary token supply..."
SECONDARY_SUPPLY=$(query_canister "$SECONDARY_TOKEN_ID" "icrc1_total_supply" "")
SECONDARY_NAME=$(query_canister "$SECONDARY_TOKEN_ID" "icrc1_name" "")
SECONDARY_SYMBOL=$(query_canister "$SECONDARY_TOKEN_ID" "icrc1_symbol" "")

echo "  - Querying tokenomics status..."
TOTAL_BURNED=$(query_canister "$TOKENOMICS_ID" "get_total_secondary_burn" "")
CURRENT_THRESHOLD_INDEX=$(query_canister "$TOKENOMICS_ID" "get_current_threshold_index" "")
CURRENT_PRIMARY_RATE=$(query_canister "$TOKENOMICS_ID" "get_current_primary_rate" "")
CURRENT_SECONDARY_THRESHOLD=$(query_canister "$TOKENOMICS_ID" "get_current_secondary_threshold" "")
MAX_STATS=$(query_canister "$TOKENOMICS_ID" "get_max_stats" "")
TOKENOMICS_SCHEDULE=$(query_canister "$TOKENOMICS_ID" "get_tokenomics_schedule" "")

cat >> "$REPORT_FILE" << EOF
### Token Information

**Primary Token (Reward Token):**
- Name: ${PRIMARY_NAME}
- Symbol: ${PRIMARY_SYMBOL}
- Total Supply: ${PRIMARY_SUPPLY}

**Secondary Token (Mining Token):**
- Name: ${SECONDARY_NAME}
- Symbol: ${SECONDARY_SYMBOL}
- Total Supply: ${SECONDARY_SUPPLY}

### Halving Mechanics

- **Total Secondary Burned**: ${TOTAL_BURNED}
- **Current Threshold Index**: ${CURRENT_THRESHOLD_INDEX}
- **Current Primary Reward Rate**: ${CURRENT_PRIMARY_RATE}
- **Next Halving Threshold**: ${CURRENT_SECONDARY_THRESHOLD}
- **Max Stats**: ${MAX_STATS}

### Tokenomics Schedule

\`\`\`
${TOKENOMICS_SCHEDULE}
\`\`\`

---

EOF

echo -e "${YELLOW}[3/7] ICP Flows...${NC}"

# =============================================================================
# SECTION 3: ICP FLOWS
# =============================================================================

cat >> "$REPORT_FILE" << EOF
## 3. ICP Flows & Treasury

EOF

echo "  - Querying reward pool status..."
REWARD_POOL=$(query_canister "$ICP_SWAP_ID" "get_reward_pool_status" "")

echo "  - Querying uncollected fees..."
UNCOLLECTED_FEES=$(query_canister "$ICP_SWAP_ID" "get_uncollected_fees" "")

echo "  - Querying total claimed rewards..."
TOTAL_CLAIMED=$(query_canister "$ICP_SWAP_ID" "get_total_claimed_rewards" "")

echo "  - Querying archived balances..."
TOTAL_ARCHIVED=$(query_canister "$ICP_SWAP_ID" "get_total_archived_balance" "")
ALL_ARCHIVES=$(query_canister "$ICP_SWAP_ID" "get_all_archive_balances" "")

echo "  - Querying distribution settings..."
DISTRIBUTION_INTERVAL=$(query_canister "$ICP_SWAP_ID" "get_distribution_interval" "")
STAKING_PERCENTAGE=$(query_canister "$ICP_SWAP_ID" "get_current_staking_reward_percentage" "")

echo "  - Querying launch status..."
LAUNCH_STATUS=$(query_canister "$ICP_SWAP_ID" "get_launch_status" "")

cat >> "$REPORT_FILE" << EOF
### Treasury Breakdown

- **Reward Pool (Awaiting Distribution)**: ${REWARD_POOL}
- **Uncollected Platform Fees**: ${UNCOLLECTED_FEES}
- **Total Claimed Rewards (ICP that left system)**: ${TOTAL_CLAIMED}
- **Total Archived (Failed Transactions)**: ${TOTAL_ARCHIVED}

### Distribution Settings

- **Distribution Interval**: ${DISTRIBUTION_INTERVAL} seconds
- **Staking Reward Percentage**: ${STAKING_PERCENTAGE}
- **Launch Status**: ${LAUNCH_STATUS}

### Archived Balances Detail

\`\`\`
${ALL_ARCHIVES}
\`\`\`

---

EOF

echo -e "${YELLOW}[4/7] Staking Analytics...${NC}"

# =============================================================================
# SECTION 4: STAKING ANALYTICS
# =============================================================================

cat >> "$REPORT_FILE" << EOF
## 4. Staking Analytics

EOF

echo "  - Querying staking statistics..."
STAKERS_COUNT=$(query_canister "$ICP_SWAP_ID" "get_stakers_count" "")
TOTAL_UNCLAIMED=$(query_canister "$ICP_SWAP_ID" "get_total_unclaimed_icp_reward" "")

echo "  - Querying APY data..."
APY_VALUES=$(query_canister "$ICP_SWAP_ID" "get_all_apy_values" "")

echo "  - Querying all stakes (may be large)..."
ALL_STAKES=$(query_canister "$ICP_SWAP_ID" "get_all_stakes" "" || echo "Error: Stakes data too large or unavailable")

cat >> "$REPORT_FILE" << EOF
### Staking Overview

- **Total Stakers**: ${STAKERS_COUNT}
- **Total Unclaimed ICP Rewards**: ${TOTAL_UNCLAIMED}

### Historical APY Data

\`\`\`
${APY_VALUES}
\`\`\`

### All Stakes

\`\`\`
${ALL_STAKES}
\`\`\`

---

EOF

echo -e "${YELLOW}[5/7] Historical Performance...${NC}"

# =============================================================================
# SECTION 5: HISTORICAL PERFORMANCE
# =============================================================================

cat >> "$REPORT_FILE" << EOF
## 5. Historical Performance (Logs Canister)

EOF

echo "  - Querying all historical logs..."
ALL_LOGS=$(query_canister "$LOGS_ID" "get_all_logs" "")

cat >> "$REPORT_FILE" << EOF
### Hourly Snapshots

The logs canister collects statistics every 60 minutes. Below is the complete history:

\`\`\`
${ALL_LOGS}
\`\`\`

---

EOF

echo -e "${YELLOW}[6/7] Anomaly Detection...${NC}"

# =============================================================================
# SECTION 6: ANOMALY DETECTION
# =============================================================================

cat >> "$REPORT_FILE" << EOF
## 6. Anomaly Detection & Error Logs

EOF

echo "  - Querying tokenomics logs..."
TOKENOMICS_LOGS=$(query_canister "$TOKENOMICS_ID" "get_logs" "")
TOKENOMICS_TOKEN_LOGS=$(query_canister "$TOKENOMICS_ID" "get_token_logs" "(opt 0, opt 100)")

echo "  - Querying icp_swap logs..."
ICP_SWAP_LOGS=$(query_canister "$ICP_SWAP_ID" "get_logs" "(opt 0, opt 100)")

cat >> "$REPORT_FILE" << EOF
### Tokenomics Canister Logs

**General Logs:**
\`\`\`
${TOKENOMICS_LOGS}
\`\`\`

**Function Call Logs (Last 100):**
\`\`\`
${TOKENOMICS_TOKEN_LOGS}
\`\`\`

### ICP Swap Canister Logs (Last 100)

\`\`\`
${ICP_SWAP_LOGS}
\`\`\`

---

EOF

echo -e "${YELLOW}[7/7] Secondary Token Ratio...${NC}"

# =============================================================================
# SECTION 7: ADDITIONAL METRICS
# =============================================================================

cat >> "$REPORT_FILE" << EOF
## 7. Additional Metrics

EOF

echo "  - Querying current secondary ratio..."
SECONDARY_RATIO=$(query_canister "$ICP_SWAP_ID" "get_current_secondary_ratio" "")

echo "  - Querying config..."
SWAP_CONFIG=$(query_canister "$ICP_SWAP_ID" "get_config" "")

cat >> "$REPORT_FILE" << EOF
### Pricing & Configuration

- **Current Secondary Token Ratio**: ${SECONDARY_RATIO}

### ICP Swap Configuration

\`\`\`
${SWAP_CONFIG}
\`\`\`

---

EOF

# =============================================================================
# EXECUTIVE SUMMARY
# =============================================================================

echo -e "${YELLOW}Generating executive summary...${NC}"

cat >> "$REPORT_FILE" << EOF
## Executive Summary

### Key Findings

1. **System Health**: Review the reconciliation status above for any discrepancies
2. **Token Distribution**: Primary supply shows total rewards distributed
3. **ICP Treasury**: Reward pool + uncollected fees + staker reserves = total system ICP
4. **Staking Participation**: ${STAKERS_COUNT} stakers with rewards accumulating
5. **Halving Progress**: Currently at threshold index ${CURRENT_THRESHOLD_INDEX}

### Recommendations

- ✅ **Green**: If reconciliation shows small positive discrepancy (<0.5 ICP), this is normal operational buffer
- ⚠️ **Yellow**: If reconciliation shows "requires_attention", investigate discrepancy breakdown
- 🔴 **Red**: If validation checks fail, immediate investigation needed
- 📊 **Analytics**: Use hourly logs data to plot supply growth and APY trends over time

### Next Steps

1. Review reconciliation status for any red flags
2. Check validation results for consistency errors
3. Analyze APY trends to understand staking returns
4. Review error logs for any failed operations
5. Compare expected vs actual behavior based on tokenomics schedule

---

*Report generated by Token Launch Analysis Tool*
*For questions or issues, review the detailed sections above*

EOF

echo -e "${GREEN}✅ Analysis complete!${NC}"
echo -e "${GREEN}Report saved to: ${REPORT_FILE}${NC}"
echo ""
echo -e "${BLUE}Quick Summary:${NC}"
echo -e "  Primary Supply: ${PRIMARY_SUPPLY}"
echo -e "  Secondary Supply: ${SECONDARY_SUPPLY}"
echo -e "  Total Stakers: ${STAKERS_COUNT}"
echo -e "  Reward Pool: ${REWARD_POOL}"
echo ""
echo -e "${YELLOW}Review ${REPORT_FILE} for complete analysis${NC}"
echo -e "${BLUE}File location: $(pwd)/${REPORT_FILE}${NC}"
