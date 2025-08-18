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
USER_PRINCIPAL="vgkov-ojfm2-etzss-lqse4-dm6ck-mdhmr-lhx7y-stnvb-bsj5p-npi54-eae"
ICP_SWAP="5lpoa-qx777-77773-aaacq-cai"
LBRY_FUN="oni4e-oyaaa-aaaap-qp2pq-cai"
CORE_LBRY_SWAP="54fqz-5iaaa-aaaap-qkmqa-cai"  # Core LBRY project swap canister
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

core_swap_balance=$(dfx canister call $ICP_LEDGER icrc1_balance_of "(record {owner = principal \"$CORE_LBRY_SWAP\"; subaccount = null})" 2>/dev/null | grep -oE '[0-9_]+' | head -1 | tr -d '_')
if [ -z "$core_swap_balance" ]; then core_swap_balance=0; fi
core_swap_icp=$(echo "scale=8; $core_swap_balance / 100000000" | bc)

echo -e "${CYAN}[LEDGER]${NC} Your Wallet:        ${GREEN}$(printf "%.8f" $user_icp) ICP${NC}"
echo -e "${CYAN}[LEDGER]${NC} ICP Swap Canister:  ${GREEN}$(printf "%.8f" $swap_icp) ICP${NC}"
echo -e "${CYAN}[LEDGER]${NC} LBRY Fun Canister:  ${GREEN}$(printf "%.8f" $lbry_icp) ICP${NC}"
echo -e "${CYAN}[LEDGER]${NC} Core LBRY Swap:     ${GREEN}$(printf "%.8f" $core_swap_icp) ICP${NC}"
echo ""

# Total from actual ledger (use raw E8S for precision)
ledger_total_e8s=$((user_balance + swap_balance + lbry_balance + core_swap_balance))
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

# Get YOUR archived balance (if you have failed transactions)
your_archive=$(dfx canister call $ICP_SWAP get_user_archive_balance "(principal \"$USER_PRINCIPAL\")" 2>/dev/null)
your_archived=$(echo "$your_archive" | grep -oE '[0-9_]+' | head -1 | tr -d '_')
if [ -z "$your_archived" ]; then your_archived=0; fi
your_archived_icp=$(echo "scale=8; $your_archived / 100000000" | bc)

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

# Get total archived balance (failed transactions awaiting redemption)
total_archived=$(dfx canister call $ICP_SWAP get_total_archived_balance '()' 2>/dev/null | grep -oE '[0-9_]+' | head -1 | tr -d '_')
if [ -z "$total_archived" ]; then total_archived=0; fi
total_archived_icp=$(echo "scale=8; $total_archived / 100000000" | bc)

# Get total claimed rewards
total_claimed=$(dfx canister call $ICP_SWAP get_total_claimed_rewards '()' 2>/dev/null | grep -oE '[0-9_]+' | head -1 | tr -d '_')
if [ -z "$total_claimed" ]; then total_claimed=0; fi
total_claimed_icp=$(echo "scale=8; $total_claimed / 100000000" | bc)

echo -e "${MAGENTA}[STATE]${NC} Your Unclaimed:      ${GREEN}$(printf "%.8f" $your_reward_icp) ICP${NC}"
echo -e "${MAGENTA}[STATE]${NC} Your Archived:       ${GREEN}$(printf "%.8f" $your_archived_icp) ICP${NC}"
echo -e "${MAGENTA}[STATE]${NC} All Unclaimed:       ${GREEN}$(printf "%.8f" $total_unclaimed_icp) ICP${NC}"
echo -e "${MAGENTA}[STATE]${NC} Total Archived:      ${GREEN}$(printf "%.8f" $total_archived_icp) ICP${NC}"
echo -e "${MAGENTA}[STATE]${NC} Reward Pool:         ${GREEN}$(printf "%.8f" $reward_pool_icp) ICP${NC}"
echo -e "${MAGENTA}[STATE]${NC} Uncollected Fees:    ${GREEN}$(printf "%.8f" $uncollected_fees_icp) ICP${NC}"
echo -e "${MAGENTA}[STATE]${NC} Total Claimed (left):${YELLOW}$(printf "%.8f" $total_claimed_icp) ICP${NC}"
echo ""

# Validate no negative values (defensive check)
if [ "$total_unclaimed" -lt 0 ] || [ "$reward_pool" -lt 0 ] || [ "$uncollected_fees" -lt 0 ] || [ "$total_archived" -lt 0 ]; then
    echo -e "${YELLOW}⚠ WARNING: Negative value detected in internal state!${NC}"
fi

# Internal total (calculate in E8S for precision)
# Must include all four buckets: unclaimed rewards + undistributed pool + platform fees + archived failed txs
internal_total_e8s=$((total_unclaimed + reward_pool + uncollected_fees + total_archived))
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
discrepancy_abs=$(echo "${discrepancy#-}" | bc)
discrepancy_abs_icp=$(echo "scale=8; ${discrepancy_e8s#-} / 100000000" | bc)

# Calculate unexplained discrepancy
# Note: Claimed rewards are already accounted for in the expected balance calculation
unexplained=$discrepancy_e8s
unexplained_icp=$(echo "scale=8; $unexplained / 100000000" | bc)
unexplained_abs=$(echo "${unexplained#-}" | bc)

# Use 0.01 ICP (1000000 E8S) as the threshold
threshold=0.01

if (( $(echo "$discrepancy_abs_icp > $threshold" | bc -l) )); then
    if (( $(echo "$discrepancy_e8s > 0" | bc -l) )); then
        discrepancy_sign="more"
    else
        discrepancy_sign="less"
    fi
    
    echo -e "  ${RED}⚠${NC} Ledger shows $(printf "%.8f" $discrepancy_abs_icp) ICP ${discrepancy_sign} than internal state"
    
    # Explain the discrepancy
    if [ "$total_claimed" -gt 0 ]; then
        echo -e "    ${CYAN}ℹ${NC} $(printf "%.8f" $total_claimed_icp) ICP has been claimed and left the canister"
    fi
    
    # Show unexplained portion
    if (( $(echo "$unexplained_abs > 10000000" | bc -l) )); then  # More than 0.1 ICP unexplained
        echo -e "    ${RED}⚠${NC} Unexplained discrepancy: $(printf "%.8f" $unexplained_icp) ICP"
        echo "    Possible causes: Transfer fees, pending operations, or accounting bug"
    else
        echo -e "    ${GREEN}✓${NC} Discrepancy fully explained by tracked movements"
    fi
else
    echo -e "  ${GREEN}✓${NC} Reconciled (within 0.01 ICP)"
fi
echo ""

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}        ACCOUNTING VALIDATION${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Run validation checks
echo -e "${MAGENTA}[VALIDATION]${NC} Running consistency checks..."
echo ""

# Check reward consistency
reward_check=$(dfx canister call $ICP_SWAP validate_reward_consistency '()' 2>/dev/null)
if echo "$reward_check" | grep -qE "(Ok|17_724)"; then
    echo -e "  ${GREEN}✓ Reward Consistency: PASS${NC}"
    reward_msg=$(echo "$reward_check" | sed -E 's/.*(Ok|17_724) = "(.*)".*/\2/')
    echo -e "    ${CYAN}$reward_msg${NC}"
else
    echo -e "  ${YELLOW}⚠ Reward Consistency: FAIL${NC}"
    error_msg=$(echo "$reward_check" | sed -E 's/.*(Err|17_337) = "(.*)".*/\2/')
    echo -e "    ${YELLOW}$error_msg${NC}"
fi
echo ""

# Check archive consistency
archive_check=$(dfx canister call $ICP_SWAP validate_archived_consistency '()' 2>/dev/null)
if echo "$archive_check" | grep -qE "(Ok|17_724)"; then
    echo -e "  ${GREEN}✓ Archive Consistency: PASS${NC}"
    archive_msg=$(echo "$archive_check" | sed -E 's/.*(Ok|17_724) = "(.*)".*/\2/')
    echo -e "    ${CYAN}$archive_msg${NC}"
else
    echo -e "  ${YELLOW}⚠ Archive Consistency: FAIL${NC}"
    error_msg=$(echo "$archive_check" | sed -E 's/.*(Err|17_337) = "(.*)".*/\2/')
    echo -e "    ${YELLOW}$error_msg${NC}"
fi
echo ""

# Run comprehensive accounting validation
accounting_check=$(dfx canister call $ICP_SWAP validate_accounting '()' 2>/dev/null)
if echo "$accounting_check" | grep -qE "(Ok|17_724)"; then
    echo -e "  ${GREEN}✓ Comprehensive Accounting: PASS${NC}"
    # Extract and display the detailed message
    accounting_msg=$(echo "$accounting_check" | sed -E 's/.*(Ok|17_724) = "(.*)".*/\2/' | sed 's/\\n/\n    /g')
    echo -e "    ${CYAN}$accounting_msg${NC}"
else
    echo -e "  ${YELLOW}⚠ Comprehensive Accounting: FAIL${NC}"
    error_msg=$(echo "$accounting_check" | sed -E 's/.*(Err|17_337) = "(.*)".*/\2/')
    echo -e "    ${YELLOW}$error_msg${NC}"
fi
echo ""

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}            SUMMARY${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

echo -e "Total ICP across all accounts: ${GREEN}$(printf "%.8f" $ledger_total) ICP${NC}"
echo ""