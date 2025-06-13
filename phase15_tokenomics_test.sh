#!/bin/bash
# Phase 1.5: Fair Launch Validation & Edge Case Testing
# Extends the working methodology from Phase 1

set -e

CANISTER_ID=$(dfx canister id lbry_fun)
OUTPUT_DIR="tokenomics_data"
mkdir -p $OUTPUT_DIR

echo "Phase 1.5: Fair Launch Validation & Edge Case Testing"
echo "====================================================="
echo ""

# Function to test and analyze tokenomics
test_config() {
    local test_id=$1
    local hard_cap=$2
    local burn_unit=$3
    local reward=$4
    local halving=$5
    local desc=$6
    
    # Calculate key metrics
    local initial_valuation=$(echo "scale=2; $burn_unit * 0.005" | bc)
    local remaining_supply=$((hard_cap - 1))  # TGE = 1
    local first_epoch_supply=$reward
    local first_epoch_percent=$(echo "scale=1; ($first_epoch_supply * 100) / $remaining_supply" | bc)
    
    # Use raw values directly (NOT multiplied by E8S)
    local params="record { \
        primary_max_supply = ${hard_cap} : nat64; \
        tge_allocation = 1 : nat64; \
        initial_secondary_burn = ${burn_unit} : nat64; \
        halving_step = ${halving} : nat64; \
        initial_reward_per_burn_unit = ${reward} : nat64 \
    }"
    
    echo -n "Testing $test_id: $desc... "
    
    # Call and analyze
    if output=$(dfx canister call $CANISTER_ID preview_tokenomics_graphs "$params" 2>&1); then
        epochs=$(echo "$output" | grep -o '"Epoch [0-9]*"' | wc -l)
        
        # Get costs and valuations
        final_cost=$(echo "$output" | grep -oE 'cost_to_mint_data_y.*\}' | grep -oE '[0-9]+\.[0-9]+' | tail -1)
        total_val=$(echo "$output" | grep -oE 'cumulative_usd_cost_data_y.*\}' | grep -oE '[0-9]+\.[0-9]+' | tail -1)
        
        # Bot risk assessment
        local bot_risk="LOW"
        if (( $(echo "$initial_valuation < 100" | bc -l) )); then
            bot_risk="EXTREME"
        elif (( $(echo "$initial_valuation < 1000" | bc -l) )); then
            bot_risk="HIGH"
        elif (( $(echo "$initial_valuation < 5000" | bc -l) )); then
            bot_risk="MODERATE"
        fi
        
        # Fair launch score
        local fair_score=10
        if (( $(echo "$first_epoch_percent > 50" | bc -l) )); then
            fair_score=$((fair_score - 5))
        elif (( $(echo "$first_epoch_percent > 30" | bc -l) )); then
            fair_score=$((fair_score - 3))
        elif (( $(echo "$first_epoch_percent > 20" | bc -l) )); then
            fair_score=$((fair_score - 1))
        fi
        
        if [ $epochs -lt 3 ]; then
            fair_score=$((fair_score - 3))
        elif [ $epochs -lt 5 ]; then
            fair_score=$((fair_score - 1))
        fi
        
        if (( $(echo "$initial_valuation < 1000" | bc -l) )); then
            fair_score=$((fair_score - 3))
        elif (( $(echo "$initial_valuation < 5000" | bc -l) )); then
            fair_score=$((fair_score - 1))
        fi
        
        [ $fair_score -lt 0 ] && fair_score=0
        
        # Result assessment
        local result="PASS"
        [ $fair_score -lt 4 ] && result="FAIL"
        [ $fair_score -ge 4 ] && [ $fair_score -lt 7 ] && result="WARN"
        
        echo "$epochs epochs | First: ${first_epoch_percent}% | Val: \$$initial_valuation | Risk: $bot_risk | Score: $fair_score/10 | $result"
        
        # Save detailed results
        echo "$test_id,$hard_cap,$burn_unit,$reward,$halving,$epochs,$initial_valuation,$first_epoch_percent,$bot_risk,$fair_score,$result,\"$desc\"" >> $OUTPUT_DIR/phase15_results.csv
        
        # Save degen analysis if failed
        if [ "$result" = "FAIL" ]; then
            echo "" >> $OUTPUT_DIR/phase15_failures.txt
            echo "=== $test_id: $desc ===" >> $OUTPUT_DIR/phase15_failures.txt
            echo "First Epoch: ${first_epoch_percent}% of supply for \$$initial_valuation" >> $OUTPUT_DIR/phase15_failures.txt
            echo "🤖 Bot: 'Easy money! I can grab ${first_epoch_percent}% for just \$$initial_valuation!'" >> $OUTPUT_DIR/phase15_failures.txt
            echo "🐋 Whale: 'Only $epochs epochs? I can dominate this.'" >> $OUTPUT_DIR/phase15_failures.txt
            echo "👥 Retail: 'By the time I see this, it's over. Another bot coin!'" >> $OUTPUT_DIR/phase15_failures.txt
        fi
    else
        echo "ERROR"
        echo "$test_id,ERROR,,,,,,,,,\"$desc\"" >> $OUTPUT_DIR/phase15_results.csv
    fi
}

# Initialize output files
echo "test_id,hard_cap,burn_unit,reward,halving,epochs,initial_valuation,first_epoch_percent,bot_risk,fair_score,result,description" > $OUTPUT_DIR/phase15_results.csv
echo "Phase 1.5 Critical Failures - Degen Analysis" > $OUTPUT_DIR/phase15_failures.txt
echo "===========================================" >> $OUTPUT_DIR/phase15_failures.txt

# Original test sets for comparison
echo "Test Set A: Halving Step Impact Analysis"
echo "========================================"
for halving in 25 35 50 70 90; do
    test_id="A$halving"
    test_config "$test_id" 1000000 1000000 20000 $halving "Halving $halving%"
done

echo ""
echo "Test Set B: Burn Unit Scaling"
echo "============================="
for burn in 100000 500000 1000000 5000000 10000000; do
    test_id="B$burn"
    test_config "$test_id" 1000000 $burn 20000 50 "Burn $burn"
done

# Phase 1.5: Bot Attack Vectors
echo ""
echo "Test Set E: Bot Attack Vectors 🤖"
echo "================================="
test_config "E1" 10000 100000 9000 50 "Bot scoops 90% for \$500"
test_config "E2" 100000 100000 50000 50 "Bot gets 50% for \$500"
test_config "E3" 1000000 100000 10000 50 "More balanced but still low"
test_config "E4" 50000 200000 25000 50 "50% in epoch 1 for \$1k"
test_config "E5" 100000 500000 30000 50 "30% for \$2.5k - borderline"

# Phase 1.5: Distribution Spread
echo ""
echo "Test Set F: Distribution Spread Tests 📊"
echo "======================================="
test_config "F1" 1000000 1000000 1000 50 "Even distribution test"
test_config "F2" 1000000 500000 5000 40 "Front-loaded fair test"
test_config "F3" 10000000 100000 500 30 "Long tail distribution"
test_config "F4" 500000 1000000 50000 70 "Minimum viable - 3 epochs"
test_config "F5" 5000000 50000 100 25 "Maximum spread - 20+ epochs"

# Phase 1.5: Extreme Edge Cases
echo ""
echo "Test Set G: Extreme Edge Cases 💥"
echo "================================="
test_config "G1" 5000 500000 4999 50 "99.98% in first epoch"
test_config "G2" 100000 10000 99000 50 "99% first epoch for \$50"
test_config "G3" 1000000 10000 500000 50 "50% for \$50 - extreme bot bait"
test_config "G4" 100 10000000 10 50 "Tiny supply, huge valuation"
test_config "G5" 100000000 100000 1000 50 "Huge supply, low valuation"

# Additional edge cases
echo ""
echo "Test Set H: Minimum Viable Fair Launch Tests"
echo "==========================================="
test_config "H1" 100000 1000000 10000 50 "10% first epoch at \$5k"
test_config "H2" 500000 1000000 50000 50 "10% first epoch at \$5k"  
test_config "H3" 1000000 1000000 100000 50 "10% first epoch at \$5k"
test_config "H4" 100000 200000 20000 50 "20% first epoch at \$1k"
test_config "H5" 100000 100000 30000 50 "30% first epoch at \$500"

# Generate summary report
echo ""
echo "Generating Phase 1.5 Analysis Report..."
echo "======================================="

# Count results
total_tests=$(grep -c "^[A-H]" $OUTPUT_DIR/phase15_results.csv || echo 0)
passed=$(grep -c ",PASS," $OUTPUT_DIR/phase15_results.csv || echo 0)
warned=$(grep -c ",WARN," $OUTPUT_DIR/phase15_results.csv || echo 0)
failed=$(grep -c ",FAIL," $OUTPUT_DIR/phase15_results.csv || echo 0)

echo ""
echo "PHASE 1.5 SUMMARY"
echo "================="
echo "Total Tests: $total_tests"
echo "✅ Passed (Score 7+): $passed"
echo "⚠️  Borderline (Score 4-6): $warned"
echo "❌ Failed (Score <4): $failed"

# Generate recommendations
echo ""
echo "RECOMMENDED CONSTRAINTS" > $OUTPUT_DIR/phase15_recommendations.txt
echo "======================" >> $OUTPUT_DIR/phase15_recommendations.txt
echo "" >> $OUTPUT_DIR/phase15_recommendations.txt
echo "Based on Phase 1.5 analysis, implement these constraints:" >> $OUTPUT_DIR/phase15_recommendations.txt
echo "" >> $OUTPUT_DIR/phase15_recommendations.txt
echo "1. Minimum Hard Cap: 100,000 tokens" >> $OUTPUT_DIR/phase15_recommendations.txt
echo "2. Maximum Initial Reward: 10% of (Hard Cap - TGE)" >> $OUTPUT_DIR/phase15_recommendations.txt
echo "3. Minimum Initial Valuation: \$1,000 (burn_unit >= 200,000)" >> $OUTPUT_DIR/phase15_recommendations.txt
echo "4. Minimum Epochs: 3" >> $OUTPUT_DIR/phase15_recommendations.txt
echo "5. Maximum First Epoch Mint: 30% of remaining supply" >> $OUTPUT_DIR/phase15_recommendations.txt
echo "" >> $OUTPUT_DIR/phase15_recommendations.txt
echo "Validation formula:" >> $OUTPUT_DIR/phase15_recommendations.txt
echo "const maxReward = (hardCap - tgeAllocation) * 0.1;" >> $OUTPUT_DIR/phase15_recommendations.txt
echo "const minBurnUnit = 200000; // \$1000 minimum valuation" >> $OUTPUT_DIR/phase15_recommendations.txt
echo "const firstEpochPercent = (initialReward / (hardCap - tgeAllocation)) * 100;" >> $OUTPUT_DIR/phase15_recommendations.txt
echo "if (firstEpochPercent > 30) { ERROR: 'First epoch captures too much supply' }" >> $OUTPUT_DIR/phase15_recommendations.txt

echo ""
echo "Results saved to:"
echo "- $OUTPUT_DIR/phase15_results.csv (full results)"
echo "- $OUTPUT_DIR/phase15_failures.txt (degen analysis of failures)"
echo "- $OUTPUT_DIR/phase15_recommendations.txt (constraint recommendations)"
echo ""
echo "Phase 1.5 analysis complete!"