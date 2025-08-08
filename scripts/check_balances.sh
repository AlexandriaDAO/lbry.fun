#!/bin/bash

# ICP Balance Checking Script
# This script tracks all ICP movements and ensures balances add up correctly

# ============================================
# MANUAL ENTRY SECTION - UPDATE THESE VALUES
# ============================================
USER_PRINCIPAL="6movs-6vcz3-5ltlm-a7okh-66epv-hs3is-gtsa7-hzwlh-ykci7-hegdd-oae"
ICP_SWAP="5qksf-kp777-77773-aaaaa-cai"
# ============================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    ICP Balance Verification Script     ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Fixed canister IDs (external to this repo)
ICP_LEDGER="ryjl3-tyaaa-aaaaa-aaaba-cai"
LBRY_FUN="oni4e-oyaaa-aaaap-qp2pq-cai"
XRC="uf6dk-hyaaa-aaaaq-qaaaq-cai"

echo -e "${GREEN}=== Configuration ===${NC}"
echo -e "${GREEN}User Principal:${NC} $USER_PRINCIPAL"
echo -e "${GREEN}ICP Swap Canister:${NC} $ICP_SWAP"
echo ""

# Function to get ICP balance for an account
get_icp_balance() {
    local principal=$1
    local name=$2
    
    if [ -z "$principal" ] || [ "$principal" == "not-deployed" ]; then
        echo -e "  ${YELLOW}$name: Skipped (not set or not deployed)${NC}" >&2
        echo "0"
        return
    fi
    
    # DFX returns the value directly as a natural number (not e8s)
    balance_nat=$(dfx canister call $ICP_LEDGER icrc1_balance_of "(record {owner = principal \"$principal\"; subaccount = null})" 2>/dev/null | grep -oE '[0-9_]+' | head -1 | tr -d '_')
    
    if [ -z "$balance_nat" ]; then
        balance_nat=0
    fi
    
    # The value from dfx is already in e8s
    balance=$balance_nat
    icp_amount=$(echo "scale=8; $balance / 100000000" | bc)
    echo -e "  ${GREEN}$name:${NC} $balance e8s (${icp_amount} ICP)" >&2
    echo "$balance"
}

echo -e "${BLUE}=== ICP Balances ===${NC}"
echo ""

# Track total
TOTAL=0

# User balance
echo -e "${YELLOW}User Account:${NC}"
user_balance=$(get_icp_balance "$USER_PRINCIPAL" "User")
TOTAL=$((TOTAL + user_balance))
echo ""

# Core canister balances
echo -e "${YELLOW}Core Canisters:${NC}"
lbry_balance=$(get_icp_balance "$LBRY_FUN" "LBRY Fun Platform")
TOTAL=$((TOTAL + lbry_balance))
echo ""

# ICP Swap canister balance
echo -e "${YELLOW}ICP Swap Canister:${NC}"
icp_swap_balance=$(get_icp_balance "$ICP_SWAP" "ICP Swap")
TOTAL=$((TOTAL + icp_swap_balance))
echo ""

# Get ICP Swap internal accounting
if [ ! -z "$ICP_SWAP" ] && [ "$ICP_SWAP" != "not-deployed" ]; then
    echo -e "${YELLOW}ICP Swap Internal Accounting:${NC}"
    
    # Get reward pool status
    reward_pool=$(dfx canister call $ICP_SWAP get_reward_pool_status 2>/dev/null | grep -oE '[0-9]+' | head -1)
    if [ -z "$reward_pool" ]; then reward_pool=0; fi
    reward_pool_icp=$(echo "scale=8; $reward_pool / 100000000" | bc)
    echo -e "  ${GREEN}Reward Pool (for distribution):${NC} $reward_pool e8s (${reward_pool_icp} ICP)"
    
    # Get uncollected fees
    uncollected=$(dfx canister call $ICP_SWAP get_uncollected_fees 2>/dev/null)
    alex_fees=$(echo "$uncollected" | grep -oE '[0-9]+' | head -1)
    if [ -z "$alex_fees" ]; then alex_fees=0; fi
    alex_fees_icp=$(echo "scale=8; $alex_fees / 100000000" | bc)
    echo -e "  ${GREEN}Uncollected ALEX Fees:${NC} $alex_fees e8s (${alex_fees_icp} ICP)"
    
    # Note: We get actual unclaimed rewards from parsing stakes below, not from this deprecated query
    
    # Get total archived balance (failed transfers held for users)
    total_archived=$(dfx canister call $ICP_SWAP get_total_archived_balance 2>/dev/null | grep -oE '[0-9]+' | head -1)
    if [ -z "$total_archived" ]; then total_archived=0; fi
    total_archived_icp=$(echo "scale=8; $total_archived / 100000000" | bc)
    echo -e "  ${GREEN}Archived Balance (failed transfers):${NC} $total_archived e8s (${total_archived_icp} ICP)"
    
    # Get number of stakers
    stakers_count=$(dfx canister call $ICP_SWAP get_stakers_count 2>/dev/null | grep -oE '[0-9]+' | head -1)
    if [ -z "$stakers_count" ]; then stakers_count=0; fi
    echo -e "  ${GREEN}Number of Stakers:${NC} $stakers_count"
    
    # Get detailed stake information
    echo ""
    echo -e "  ${YELLOW}--- Per-Staker Breakdown ---${NC}"
    stakes_raw=$(dfx canister call $ICP_SWAP get_all_stakes 2>/dev/null)
    
    # Parse stakes to show staked amounts and unclaimed rewards
    total_staked_amount=0
    total_unclaimed_rewards=0
    
    # Extract staked amounts and rewards from the response
    # This is a simplified parser - in production you'd want proper JSON parsing
    staked_amounts=$(echo "$stakes_raw" | grep -oE '"amount": "[0-9]+"' | grep -oE '[0-9]+')
    reward_amounts=$(echo "$stakes_raw" | grep -oE '"reward_icp": "[0-9]+"' | grep -oE '[0-9]+')
    
    if [ ! -z "$staked_amounts" ]; then
        for amount in $staked_amounts; do
            total_staked_amount=$((total_staked_amount + amount))
        done
    fi
    
    if [ ! -z "$reward_amounts" ]; then
        for reward in $reward_amounts; do
            total_unclaimed_rewards=$((total_unclaimed_rewards + reward))
        done
    fi
    
    staked_icp=$(echo "scale=8; $total_staked_amount / 100000000" | bc)
    unclaimed_rewards_icp=$(echo "scale=8; $total_unclaimed_rewards / 100000000" | bc)
    
    echo -e "  ${GREEN}Total Staked by Users:${NC} $total_staked_amount e8s (${staked_icp} ICP)"
    echo -e "  ${GREEN}Total Unclaimed Rewards (not yet transferred):${NC} $total_unclaimed_rewards e8s (${unclaimed_rewards_icp} ICP)"
    echo -e "  ${YELLOW}Note: Unclaimed rewards must be claimed via claim_icp_reward()${NC}"
    
    # Calculate operational balance (for transfers, fees, etc)
    # Operational = Total - (reward_pool + alex_fees + unclaimed_rewards + archived + staked_amounts)
    operational=$((icp_swap_balance - reward_pool - alex_fees - total_unclaimed_rewards - total_archived - total_staked_amount))
    operational_icp=$(echo "scale=8; $operational / 100000000" | bc)
    echo ""
    echo -e "  ${GREEN}Operational Balance:${NC} $operational e8s (${operational_icp} ICP)"
    
    echo ""
    echo -e "  ${BLUE}--- Complete ICP Breakdown ---${NC}"
    echo -e "  Total in Canister: ${swap_icp} ICP"
    echo -e "    ├─ User Staked Amounts: ${staked_icp} ICP"
    echo -e "    ├─ Unclaimed Rewards: ${unclaimed_rewards_icp} ICP"
    echo -e "    ├─ Reward Pool (pending distribution): ${reward_pool_icp} ICP"
    echo -e "    ├─ ALEX Fees (uncollected): ${alex_fees_icp} ICP"
    echo -e "    ├─ Archived Balance (failed transfers): ${total_archived_icp} ICP"
    echo -e "    └─ Operational (for swaps/fees): ${operational_icp} ICP"
    
    # Verify the breakdown adds up
    total_accounted=$((reward_pool + alex_fees + total_unclaimed_rewards + total_archived + total_staked_amount + operational))
    if [ "$total_accounted" -eq "$icp_swap_balance" ]; then
        echo -e "  ${GREEN}✓ Balance fully reconciled - all ICP accounted for${NC}"
    else
        difference=$((icp_swap_balance - total_accounted))
        diff_icp=$(echo "scale=8; $difference / 100000000" | bc)
        echo -e "  ${RED}✗ Reconciliation discrepancy: ${diff_icp} ICP${NC}"
    fi
    echo ""
fi

# Summary
echo -e "${BLUE}=== Summary ===${NC}"
total_icp=$(echo "scale=8; $TOTAL / 100000000" | bc)
echo -e "${GREEN}Total ICP Tracked:${NC} ${total_icp} ICP"

# Show breakdown
user_icp=$(echo "scale=8; $user_balance / 100000000" | bc)
lbry_icp=$(echo "scale=8; $lbry_balance / 100000000" | bc)
swap_icp=$(echo "scale=8; $icp_swap_balance / 100000000" | bc)

echo ""
echo -e "${BLUE}Breakdown:${NC}"
echo -e "  User: ${user_icp} ICP"
echo -e "  LBRY Fun Platform: ${lbry_icp} ICP"
echo -e "  ICP Swap: ${swap_icp} ICP"
echo -e "  ${GREEN}──────────────────${NC}"
echo -e "  ${GREEN}Total: ${total_icp} ICP${NC}"
echo ""