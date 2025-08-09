#!/bin/bash

# ICP Balance Check

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
USER_PRINCIPAL="6movs-6vcz3-5ltlm-a7okh-66epv-hs3is-gtsa7-hzwlh-ykci7-hegdd-oae"
ICP_SWAP="5lpoa-qx777-77773-aaacq-cai"
LBRY_FUN="oni4e-oyaaa-aaaap-qp2pq-cai"
ICP_LEDGER="ryjl3-tyaaa-aaaaa-aaaba-cai"

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}           ICP BALANCES${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Get balances
user_balance=$(dfx canister call $ICP_LEDGER icrc1_balance_of "(record {owner = principal \"$USER_PRINCIPAL\"; subaccount = null})" 2>/dev/null | grep -oE '[0-9_]+' | head -1 | tr -d '_')
user_icp=$(echo "scale=2; $user_balance / 100000000" | bc)

lbry_balance=$(dfx canister call $ICP_LEDGER icrc1_balance_of "(record {owner = principal \"$LBRY_FUN\"; subaccount = null})" 2>/dev/null | grep -oE '[0-9_]+' | head -1 | tr -d '_')
lbry_icp=$(echo "scale=2; $lbry_balance / 100000000" | bc)

# Get YOUR specific unclaimed rewards from your stake
your_stake=$(dfx canister call $ICP_SWAP get_stake "(principal \"$USER_PRINCIPAL\")" 2>/dev/null)
your_reward=$(echo "$your_stake" | grep -oE '[0-9_]+\s*:\s*nat[^6]' | grep -oE '[0-9_]+' | head -1 | tr -d '_')
if [ -z "$your_reward" ]; then your_reward=0; fi
your_reward_icp=$(echo "scale=2; $your_reward / 100000000" | bc)

# Get reward pool (ICP collected but not yet distributed)
reward_pool=$(dfx canister call $ICP_SWAP get_reward_pool_status 2>/dev/null | grep -oE '[0-9_]+' | head -1 | tr -d '_')
if [ -z "$reward_pool" ]; then reward_pool=0; fi
reward_pool_icp=$(echo "scale=2; $reward_pool / 100000000" | bc)

echo -e "Your Wallet:           ${GREEN}${user_icp} ICP${NC}"
echo -e "Your Unclaimed:        ${GREEN}${your_reward_icp} ICP${NC}"
echo -e "Reward Pool:           ${GREEN}${reward_pool_icp} ICP${NC} ${YELLOW}(pending distribution)${NC}"
echo -e "Platform Fees:         ${GREEN}${lbry_icp} ICP${NC}"
echo ""

# Calculate total
total=$(echo "$user_icp + $your_reward_icp + $reward_pool_icp + $lbry_icp" | bc)

echo -e "${BLUE}=========================================${NC}"
echo -e "TOTAL:                 ${GREEN}${total} ICP${NC}"
echo ""

# Verify ICP Swap canister's internal accounting matches actual balance
echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}         CANISTER RECONCILIATION${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Get actual ICP balance of the swap canister from the ledger
swap_actual_balance=$(dfx canister call $ICP_LEDGER icrc1_balance_of "(record {owner = principal \"$ICP_SWAP\"; subaccount = null})" 2>/dev/null | grep -oE '[0-9_]+' | head -1 | tr -d '_')
if [ -z "$swap_actual_balance" ]; then swap_actual_balance=0; fi
swap_actual_icp=$(echo "scale=2; $swap_actual_balance / 100000000" | bc)

# Get what the canister thinks it has internally
# This is: total unclaimed rewards + reward pool + uncollected fees
total_unclaimed=$(dfx canister call $ICP_SWAP get_total_unclaimed_icp_reward '()' 2>/dev/null | grep -oE '[0-9_]+' | head -1 | tr -d '_')
if [ -z "$total_unclaimed" ]; then total_unclaimed=0; fi

uncollected_fees=$(dfx canister call $ICP_SWAP get_uncollected_fees '()' 2>/dev/null | grep -oE '[0-9_]+' | head -1 | tr -d '_')
if [ -z "$uncollected_fees" ]; then uncollected_fees=0; fi

# Calculate internal total (what canister thinks it has)
internal_total=$((total_unclaimed + reward_pool + uncollected_fees))
internal_total_icp=$(echo "scale=2; $internal_total / 100000000" | bc)

echo -e "Actual Balance (from ledger):  ${GREEN}${swap_actual_icp} ICP${NC}"
echo -e "Internal Records:              ${GREEN}${internal_total_icp} ICP${NC}"

# Show breakdown of internal records
unclaimed_icp=$(echo "scale=2; $total_unclaimed / 100000000" | bc)
fees_icp=$(echo "scale=2; $uncollected_fees / 100000000" | bc)
echo ""
echo -e "  Breakdown of internal ${internal_total_icp} ICP:"
echo -e "    Unclaimed Rewards: ${unclaimed_icp} ICP"
echo -e "    Reward Pool:       ${reward_pool_icp} ICP"
echo -e "    Platform Fees:     ${fees_icp} ICP"

# Check for discrepancy
discrepancy=$(echo "$swap_actual_icp - $internal_total_icp" | bc)
echo ""
if (( $(echo "$discrepancy < 0.001 && $discrepancy > -0.001" | bc -l) )); then
    echo -e "${GREEN}✓ Canister accounting matches actual balance${NC}"
else
    if (( $(echo "$discrepancy > 0" | bc -l) )); then
        echo -e "${YELLOW}⚠ Canister has ${discrepancy} ICP more than records show${NC}"
    else
        abs_disc=$(echo "${discrepancy#-}" | bc)
        echo -e "${RED}⚠ Canister has ${abs_disc} ICP less than records show${NC}"
    fi
fi
echo ""