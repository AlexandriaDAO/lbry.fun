#!/bin/bash

# ICP Balance Check

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
USER_PRINCIPAL="c5uww-7b3td-uj2rq-53mpf-ujzzj-x3tnd-6ji2t-ahxek-ljrsf-h3loo-hqe"
ICP_SWAP="645cs-bp777-77773-aaaka-cai"
LBRY_FUN="oni4e-oyaaa-aaaap-qp2pq-cai"
ICP_LEDGER="ryjl3-tyaaa-aaaaa-aaaba-cai"

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}      ICP TRACKING (FROM LEDGER)${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# === ACTUAL ICP BALANCES FROM LEDGER (store raw E8S values) ===
user_balance=$(dfx canister call $ICP_LEDGER icrc1_balance_of "(record {owner = principal \"$USER_PRINCIPAL\"; subaccount = null})" 2>/dev/null | grep -oE '[0-9_]+' | head -1 | tr -d '_')
if [ -z "$user_balance" ]; then user_balance=0; fi
user_icp=$(echo "scale=8; $user_balance / 100000000" | bc)

swap_balance=$(dfx canister call $ICP_LEDGER icrc1_balance_of "(record {owner = principal \"$ICP_SWAP\"; subaccount = null})" 2>/dev/null | grep -oE '[0-9_]+' | head -1 | tr -d '_')
if [ -z "$swap_balance" ]; then swap_balance=0; fi
swap_icp=$(echo "scale=8; $swap_balance / 100000000" | bc)

lbry_balance=$(dfx canister call $ICP_LEDGER icrc1_balance_of "(record {owner = principal \"$LBRY_FUN\"; subaccount = null})" 2>/dev/null | grep -oE '[0-9_]+' | head -1 | tr -d '_')
if [ -z "$lbry_balance" ]; then lbry_balance=0; fi
lbry_icp=$(echo "scale=8; $lbry_balance / 100000000" | bc)

echo -e "${CYAN}[LEDGER]${NC} Your Wallet:        ${GREEN}$(printf "%.8f" $user_icp) ICP${NC}"
echo -e "${CYAN}[LEDGER]${NC} ICP Swap Canister:  ${GREEN}$(printf "%.8f" $swap_icp) ICP${NC}"
echo -e "${CYAN}[LEDGER]${NC} LBRY Fun Canister:  ${GREEN}$(printf "%.8f" $lbry_icp) ICP${NC}"
echo ""

# Total from actual ledger (use raw E8S for precision)
ledger_total_e8s=$((user_balance + swap_balance + lbry_balance))
ledger_total=$(echo "scale=8; $ledger_total_e8s / 100000000" | bc)
echo -e "${BLUE}TOTAL (Ledger):              ${GREEN}$(printf "%.8f" $ledger_total) ICP${NC}"
echo ""

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}    SWAP CANISTER INTERNAL STATE${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# === INTERNAL STATE FROM SWAP CANISTER (store raw E8S values) ===
# Get YOUR specific unclaimed rewards from your stake
your_stake=$(dfx canister call $ICP_SWAP get_stake "(principal \"$USER_PRINCIPAL\")" 2>/dev/null)
your_reward=$(echo "$your_stake" | grep -oE '[0-9_]+\s*:\s*nat[^6]' | grep -oE '[0-9_]+' | head -1 | tr -d '_')
if [ -z "$your_reward" ]; then your_reward=0; fi
your_reward_icp=$(echo "scale=8; $your_reward / 100000000" | bc)

# Get reward pool (ICP collected but not yet distributed)
reward_pool=$(dfx canister call $ICP_SWAP get_reward_pool_status 2>/dev/null | grep -oE '[0-9_]+' | head -1 | tr -d '_')
if [ -z "$reward_pool" ]; then reward_pool=0; fi
reward_pool_icp=$(echo "scale=8; $reward_pool / 100000000" | bc)

# Get uncollected platform fees
uncollected_fees=$(dfx canister call $ICP_SWAP get_uncollected_fees '()' 2>/dev/null | grep -oE '[0-9_]+' | head -1 | tr -d '_')
if [ -z "$uncollected_fees" ]; then uncollected_fees=0; fi
uncollected_fees_icp=$(echo "scale=8; $uncollected_fees / 100000000" | bc)

# Get total unclaimed rewards from all users
total_unclaimed=$(dfx canister call $ICP_SWAP get_total_unclaimed_icp_reward '()' 2>/dev/null | grep -oE '[0-9_]+' | head -1 | tr -d '_')
if [ -z "$total_unclaimed" ]; then total_unclaimed=0; fi
total_unclaimed_icp=$(echo "scale=8; $total_unclaimed / 100000000" | bc)

echo -e "${MAGENTA}[STATE]${NC} Your Unclaimed:      ${GREEN}$(printf "%.8f" $your_reward_icp) ICP${NC}"
echo -e "${MAGENTA}[STATE]${NC} All Unclaimed:       ${GREEN}$(printf "%.8f" $total_unclaimed_icp) ICP${NC}"
echo -e "${MAGENTA}[STATE]${NC} Reward Pool:         ${GREEN}$(printf "%.8f" $reward_pool_icp) ICP${NC}"
echo -e "${MAGENTA}[STATE]${NC} Uncollected Fees:    ${GREEN}$(printf "%.8f" $uncollected_fees_icp) ICP${NC}"
echo ""

# Internal total (calculate in E8S for precision)
internal_total_e8s=$((total_unclaimed + reward_pool + uncollected_fees))
internal_total=$(echo "scale=8; $internal_total_e8s / 100000000" | bc)
echo -e "${BLUE}Swap Internal Total:         ${GREEN}$(printf "%.8f" $internal_total) ICP${NC}"
echo ""

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}           RECONCILIATION${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Compare ledger balance with internal state (use E8S for precision)
echo -e "Swap Canister Reconciliation:"
echo -e "  ${CYAN}[LEDGER]${NC} Actual balance:  ${GREEN}$(printf "%.8f" $swap_icp) ICP${NC}"
echo -e "  ${MAGENTA}[STATE]${NC} Internal total:  ${GREEN}$(printf "%.8f" $internal_total) ICP${NC}"

# Check for discrepancy (in E8S for precision)
discrepancy_e8s=$((swap_balance - internal_total_e8s))
discrepancy=$(echo "scale=8; $discrepancy_e8s / 100000000" | bc)

if (( $(echo "$discrepancy_e8s < 1000000 && $discrepancy_e8s > -1000000" | bc -l) )); then
    echo -e "  ${GREEN}✓ Reconciled (within 0.01 ICP)${NC}"
else
    if (( $(echo "$discrepancy_e8s > 0" | bc -l) )); then
        echo -e "  ${YELLOW}⚠ Ledger shows $(printf "%.8f" $discrepancy) ICP more than internal state${NC}"
    else
        abs_disc=$(echo "scale=8; ${discrepancy_e8s#-} / 100000000" | bc)
        echo -e "  ${YELLOW}⚠ Internal state shows $(printf "%.8f" $abs_disc) ICP more than ledger${NC}"
    fi
fi
echo ""

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}            SUMMARY${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

echo -e "Total ICP across all accounts: ${GREEN}$(printf "%.8f" $ledger_total) ICP${NC}"
echo ""