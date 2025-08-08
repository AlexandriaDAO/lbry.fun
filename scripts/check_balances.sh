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
    echo -e "  ${YELLOW}--- Staking Details ---${NC}"
    
    # Get all stakes from the canister
    stakes_raw=$(dfx canister call $ICP_SWAP get_all_stakes 2>/dev/null)
    
    # Initialize totals
    total_staked_amount=0
    total_unclaimed_rewards=0
    
    # Check if we have any stakes
    if echo "$stakes_raw" | grep -q "record"; then
        # Count number of stakers
        num_stakers=$(echo "$stakes_raw" | grep -c "principal")
        echo -e "  ${GREEN}Active Stakers:${NC} $num_stakers"
        echo ""
        
        # Get each principal's stake individually to avoid parsing issues
        # First, extract just the principals from the all_stakes response
        principals=$(echo "$stakes_raw" | grep -oE 'principal "[^"]+"' | cut -d'"' -f2)
        
        if [ ! -z "$principals" ]; then
            for principal in $principals; do
                # Get the stake info for this specific principal
                stake_info=$(dfx canister call $ICP_SWAP get_stake "(principal \"$principal\")" 2>/dev/null)
                
                # Check if stake exists (not empty opt)
                if echo "$stake_info" | grep -q "opt record"; then
                    # Parse the three fields from the record
                    # Format: opt record { field1 = timestamp : nat64; field2 = reward : nat; field3 = amount : nat64; }
                    # The order of fields may vary, so we look for specific patterns
                    
                    # Find the stake amount (last nat64 field typically)
                    amount=$(echo "$stake_info" | sed 's/;/\n/g' | grep 'nat64' | tail -1 | grep -oE '[0-9_]+' | head -1 | tr -d '_')
                    
                    # Find the reward (nat field, not nat64)
                    reward=$(echo "$stake_info" | sed 's/;/\n/g' | grep 'nat[^6]' | grep -oE '[0-9_]+' | head -1 | tr -d '_')
                    
                    # Skip if we couldn't parse the values
                    if [ -z "$amount" ]; then amount=0; fi
                    if [ -z "$reward" ]; then reward=0; fi
                    
                    # Convert to ICP/tokens for display using bc (handles large numbers)
                    amount_tokens=$(echo "scale=4; $amount / 100000000" | bc 2>/dev/null || echo "0")
                    reward_icp=$(echo "scale=8; $reward / 100000000" | bc 2>/dev/null || echo "0")
                    
                    # Add to totals using bc for large number arithmetic
                    total_staked_amount=$(echo "$total_staked_amount + $amount" | bc 2>/dev/null || echo "$total_staked_amount")
                    total_unclaimed_rewards=$(echo "$total_unclaimed_rewards + $reward" | bc 2>/dev/null || echo "$total_unclaimed_rewards")
                    
                    # Display individual staker info (only if they have a stake or reward)
                    if [ "$amount" != "0" ] || [ "$reward" != "0" ]; then
                        # Truncate principal for display
                        short_principal=$(echo "$principal" | cut -c1-5)...$(echo "$principal" | rev | cut -c1-3 | rev)
                        echo -e "  ${BLUE}Staker $short_principal:${NC}"
                        echo -e "    Staked: $amount_tokens primary tokens"
                        echo -e "    Unclaimed Reward: $reward_icp ICP"
                    fi
                fi
            done
        fi
        echo ""
    else
        echo -e "  ${YELLOW}No active stakes found${NC}"
        echo ""
    fi
    
    # Note: total_staked_amount is actually in PRIMARY tokens (not ICP)
    # So we shouldn't label it as ICP
    staked_tokens=$(echo "scale=4; $total_staked_amount / 100000000" | bc)
    unclaimed_rewards_icp=$(echo "scale=8; $total_unclaimed_rewards / 100000000" | bc)
    
    echo -e "  ${YELLOW}--- Totals ---${NC}"
    echo -e "  ${GREEN}Total Primary Tokens Staked:${NC} ${staked_tokens} tokens"
    echo -e "  ${GREEN}Total Unclaimed ICP Rewards:${NC} ${unclaimed_rewards_icp} ICP"
    echo -e "  ${YELLOW}Note: These rewards are claimable via claim_icp_reward()${NC}"
    
    # Calculate operational balance (for transfers, fees, etc)
    # Operational = Total - (reward_pool + alex_fees + unclaimed_rewards + archived)
    # Note: We don't subtract staked_amounts because those are PRIMARY tokens held by the canister, not ICP
    operational=$((icp_swap_balance - reward_pool - alex_fees - total_unclaimed_rewards - total_archived))
    operational_icp=$(echo "scale=8; $operational / 100000000" | bc)
    echo ""
    echo -e "  ${GREEN}Operational Balance:${NC} $operational e8s (${operational_icp} ICP)"
    
    echo ""
    echo -e "  ${BLUE}--- ICP Breakdown in Canister ---${NC}"
    echo -e "  ${GREEN}Total ICP in Canister:${NC} ${swap_icp} ICP"
    echo -e "    ├─ Unclaimed Rewards: ${unclaimed_rewards_icp} ICP"
    echo -e "    ├─ Reward Pool (next distribution): ${reward_pool_icp} ICP"
    echo -e "    ├─ Platform Fees (1% for LBRY): ${alex_fees_icp} ICP"
    echo -e "    ├─ Archived (failed transfers): ${total_archived_icp} ICP"
    echo -e "    └─ Operational (for fees): ${operational_icp} ICP"
    echo ""
    echo -e "  ${BLUE}--- Primary Tokens in Canister ---${NC}"
    echo -e "  ${GREEN}Total Staked:${NC} ${staked_tokens} primary tokens"
    
    # Verify the ICP breakdown adds up (not including staked primary tokens)
    total_icp_accounted=$((reward_pool + alex_fees + total_unclaimed_rewards + total_archived + operational))
    if [ "$total_icp_accounted" -eq "$icp_swap_balance" ]; then
        echo -e "  ${GREEN}✓ ICP Balance reconciled - all ICP accounted for${NC}"
    else
        difference=$((icp_swap_balance - total_icp_accounted))
        diff_icp=$(echo "scale=8; $difference / 100000000" | bc)
        echo -e "  ${RED}✗ ICP Reconciliation issue: ${diff_icp} ICP unaccounted${NC}"
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