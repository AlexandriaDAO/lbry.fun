#!/bin/bash
# Corrected tokenomics test script - using raw values, not e8s

set -e

CANISTER_ID=$(dfx canister id lbry_fun)

echo "Testing tokenomics with correct parameter format (raw values)..."
echo "=============================================================="
echo ""

# Function to test and extract epoch count
test_config() {
    local test_id=$1
    local hard_cap=$2
    local burn_unit=$3
    local reward=$4
    local halving=$5
    local desc=$6
    
    # Use raw values directly (NOT multiplied by E8S)
    local params="record { \
        primary_max_supply = ${hard_cap} : nat64; \
        tge_allocation = 1 : nat64; \
        initial_secondary_burn = ${burn_unit} : nat64; \
        halving_step = ${halving} : nat64; \
        initial_reward_per_burn_unit = ${reward} : nat64 \
    }"
    
    echo -n "Testing $test_id: $desc... "
    
    # Call and count epochs
    if output=$(dfx canister call $CANISTER_ID preview_tokenomics_graphs "$params" 2>&1); then
        epochs=$(echo "$output" | grep -o '"Epoch [0-9]*"' | wc -l)
        
        # Get final cost
        final_cost=$(echo "$output" | grep -oE 'cost_to_mint_data_y.*\}' | grep -oE '[0-9]+\.[0-9]+' | tail -1)
        
        # Get total valuation
        total_val=$(echo "$output" | grep -oE 'cumulative_usd_cost_data_y.*\}' | grep -oE '[0-9]+\.[0-9]+' | tail -1)
        
        echo "$epochs epochs (Final cost: \$$final_cost, Total val: \$$total_val)"
        
        # Save for analysis
        echo "$test_id,$hard_cap,$burn_unit,$reward,$halving,$epochs,$final_cost,$total_val,\"$desc\"" >> tokenomics_data/corrected_results.csv
    else
        echo "ERROR"
    fi
}

# Initialize CSV
echo "test_id,hard_cap,burn_unit,reward,halving,epochs,final_cost,total_val,description" > tokenomics_data/corrected_results.csv

echo "Test Set A: Halving Step Impact (with UI default params)"
echo "========================================================"
# Using UI defaults: cap=1M, burn=1M, reward=2000
for halving in 25 30 35 40 45 50 55 60 65 70 75 80 85 90; do
    test_id="A$halving"
    test_config "$test_id" 1000000 1000000 2000 $halving "Halving $halving%"
done

echo ""
echo "Test Set B: Initial Reward Impact"
echo "================================="
# Fixed: cap=1M, burn=1M, halving=70% (UI default)
for reward in 100 500 1000 2000 5000 10000 20000; do
    test_id="B$reward"
    test_config "$test_id" 1000000 1000000 $reward 70 "Reward $reward"
done

echo ""
echo "Test Set C: Burn Unit Scaling"
echo "============================="
# Fixed: cap=1M, reward=2000, halving=70%
for burn in 10000 50000 100000 500000 1000000 2000000 5000000; do
    test_id="C$burn"
    initial_val=$(echo "scale=2; $burn * 0.005" | bc)
    test_config "$test_id" 1000000 $burn 2000 70 "Burn $burn (Init val \$$initial_val)"
done

echo ""
echo "Test Set D: Target 15-30 Epochs"
echo "==============================="
# Try to find parameters that generate 15-30 epochs
test_config "D1" 1000000 1000000 500 50 "Lower reward, 50% halving"
test_config "D2" 1000000 1000000 200 40 "Very low reward, 40% halving"
test_config "D3" 1000000 1000000 100 35 "Minimal reward, 35% halving"
test_config "D4" 10000000 1000000 1000 45 "10M supply, 45% halving"
test_config "D5" 1000000 500000 1000 50 "Lower burn unit"

echo ""
echo "Results saved to tokenomics_data/corrected_results.csv"
echo ""

# Analyze results
echo "Summary of Epoch Generation:"
echo "============================"
awk -F',' 'NR>1 {print $6}' tokenomics_data/corrected_results.csv | sort | uniq -c | awk '{print $2 " epochs: " $1 " tests"}'