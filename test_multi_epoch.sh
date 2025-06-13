#!/bin/bash
# Test parameters that should generate multiple epochs

set -e

CANISTER_ID=$(dfx canister id lbry_fun)
E8S=100000000

echo "Testing parameters for multi-epoch generation..."
echo ""

# Function to test a single configuration
test_config() {
    local test_id=$1
    local hard_cap=$2
    local burn_unit=$3
    local reward=$4
    local halving=$5
    local desc=$6
    
    # Convert to e8s
    local hard_cap_e8s=$((hard_cap * E8S))
    local burn_unit_e8s=$((burn_unit * E8S))
    local reward_e8s=$((reward * E8S))
    
    local params="record { \
        primary_max_supply = ${hard_cap_e8s} : nat64; \
        tge_allocation = ${E8S} : nat64; \
        initial_secondary_burn = ${burn_unit_e8s} : nat64; \
        halving_step = ${halving} : nat64; \
        initial_reward_per_burn_unit = ${reward_e8s} : nat64 \
    }"
    
    echo "Testing $test_id: $desc"
    echo "  Parameters: cap=$hard_cap, burn=$burn_unit, reward=$reward, halving=$halving%"
    
    # Call and extract epoch count
    if output=$(dfx canister call $CANISTER_ID preview_tokenomics_graphs "$params" 2>&1); then
        epochs=$(echo "$output" | grep -o '"Epoch [0-9]*"' | wc -l)
        echo "  Result: $epochs epochs generated"
        
        # Save detailed output
        echo "$test_id|$output" >> tokenomics_data/multi_epoch_results.txt
    else
        echo "  Error: $output"
    fi
    echo ""
}

# Clear previous results
> tokenomics_data/multi_epoch_results.txt

echo "Test Set 1: Lower Reward Values"
echo "================================"
# Test with much lower rewards to generate more epochs
test_config "M1" 1000000 1000000 100 50 "Low reward (0.01% ratio)"
test_config "M2" 1000000 1000000 500 50 "Medium-low reward (0.05% ratio)"
test_config "M3" 1000000 1000000 1000 50 "Medium reward (0.1% ratio)"
test_config "M4" 1000000 1000000 2000 50 "Medium-high reward (0.2% ratio)"
test_config "M5" 1000000 1000000 5000 50 "High reward (0.5% ratio)"

echo "Test Set 2: Halving Impact with Low Rewards"
echo "==========================================="
# Test halving with a reward that generates multiple epochs
test_config "H1" 1000000 1000000 500 25 "25% halving"
test_config "H2" 1000000 1000000 500 50 "50% halving"
test_config "H3" 1000000 1000000 500 75 "75% halving"
test_config "H4" 1000000 1000000 500 90 "90% halving"

echo "Test Set 3: Optimal Parameter Search"
echo "===================================="
# Try to find parameters that generate 15-30 epochs
test_config "O1" 10000000 1000000 200 50 "Large supply, low reward"
test_config "O2" 1000000 100000 50 50 "Lower burn unit"
test_config "O3" 1000000 500000 250 40 "Balanced parameters"

echo "Results saved to tokenomics_data/multi_epoch_results.txt"