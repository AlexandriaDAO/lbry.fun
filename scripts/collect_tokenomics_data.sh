#!/bin/bash
# Autonomous Tokenomics Data Collection Script
# This script calls the preview_tokenomics_graphs function for all test cases

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Output directory
OUTPUT_DIR="tokenomics_data"
mkdir -p $OUTPUT_DIR

# Get canister ID
CANISTER_ID=$(dfx canister id lbry_fun 2>/dev/null || echo "")

if [ -z "$CANISTER_ID" ]; then
    echo -e "${RED}Error: Could not find lbry_fun canister ID. Make sure it's deployed.${NC}"
    exit 1
fi

echo "Using lbry_fun canister: $CANISTER_ID"
echo "Starting data collection..."
echo ""

# E8S constant
E8S=100000000

# Output files
CSV_FILE="$OUTPUT_DIR/collected_data.csv"
SUMMARY_FILE="$OUTPUT_DIR/summary.csv"

# Initialize CSV headers
echo "test_id,hard_cap,burn_unit,halving_step,initial_reward,tge_allocation,epochs,initial_cost,final_cost,total_valuation,description" > $SUMMARY_FILE

# Function to call preview_tokenomics_graphs
call_preview() {
    local test_id=$1
    local hard_cap=$2
    local tge=$3
    local burn_unit=$4
    local halving=$5
    local reward=$6
    local description=$7
    
    # Convert to e8s
    local hard_cap_e8s=$((hard_cap * E8S))
    local tge_e8s=$((tge * E8S))
    local burn_unit_e8s=$((burn_unit * E8S))
    local reward_e8s=$((reward * E8S))
    
    # Create the record parameter
    local params="record { \
        primary_max_supply = ${hard_cap_e8s} : nat64; \
        tge_allocation = ${tge_e8s} : nat64; \
        initial_secondary_burn = ${burn_unit_e8s} : nat64; \
        halving_step = ${halving} : nat64; \
        initial_reward_per_burn_unit = ${reward_e8s} : nat64 \
    }"
    
    echo -n "Testing $test_id: $description... "
    
    # Call the canister and save output
    if output=$(dfx canister call $CANISTER_ID preview_tokenomics_graphs "$params" 2>&1); then
        echo -e "${GREEN}✓${NC}"
        echo "$test_id|$output" >> "$OUTPUT_DIR/raw_responses.txt"
        
        # Extract some basic metrics from output (simplified)
        # In reality, you'd need to parse the candid response properly
        echo "$test_id,$hard_cap,$burn_unit,$halving,$reward,$tge,,,,,\"$description\"" >> $SUMMARY_FILE
    else
        echo -e "${RED}✗${NC}"
        echo "$test_id: Failed - $output" >> "$OUTPUT_DIR/errors.txt"
    fi
}

echo "Test Set A: Halving Step Impact Analysis"
echo "========================================="
# Fixed: hard_cap=1M, burn_unit=1M, reward=20k
for i in {0..13}; do
    halving=$((25 + i * 5))
    test_id="A$((i + 1))"
    call_preview "$test_id" 1000000 1 1000000 $halving 20000 "Halving $halving%"
done

echo ""
echo "Test Set B: Burn Unit Scaling"
echo "============================="
# Fixed: hard_cap=1M, halving=50%, reward=20k
burn_units=(100 500 1000 5000 10000 50000 100000 500000 1000000 5000000 10000000)
for i in "${!burn_units[@]}"; do
    test_id="B$((i + 1))"
    burn_unit="${burn_units[$i]}"
    initial_val=$(echo "scale=2; $burn_unit * 0.005" | bc)
    call_preview "$test_id" 1000000 1 $burn_unit 50 20000 "Burn unit $burn_unit (Initial val: \$$initial_val)"
done

echo ""
echo "Test Set C: Supply/Reward Ratios"
echo "================================"
call_preview "C1" 100000 1 1000000 50 50000 "Small supply, high reward"
call_preview "C2" 100000 1 1000000 50 1000 "Small supply, low reward"
call_preview "C3" 10000000 1 1000000 50 1000 "Large supply, low reward"
call_preview "C4" 10000000 1 1000000 50 100000 "Large supply, high reward"
call_preview "C5" 1000000 1 1000000 50 1 "Minimal reward test"
call_preview "C6" 1000000 1 100 50 1000000 "Extreme reward test"

echo ""
echo "Test Set D: Edge Cases"
echo "====================="
call_preview "D1" 1000 1 100 25 1000 "Minimum viable"
call_preview "D2" 10000000 1 10000000 90 1000000 "Maximum stress"
call_preview "D3" 1000000 999999 1000000 50 20000 "TGE warning"
call_preview "D4" 1000000 1 100 99 20000 "Invalid halving"
call_preview "D5" 1000000 1 20000000 25 100000 "Unreachable epochs"

echo ""
echo "Data collection complete!"
echo "Results saved to: $OUTPUT_DIR/"
echo ""
echo "Note: Raw candid responses are in raw_responses.txt"
echo "You'll need to parse these to extract the actual graph data."
echo "Consider using the Node.js or Python scripts for full data extraction."