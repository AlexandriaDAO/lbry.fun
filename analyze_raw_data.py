#!/usr/bin/env python3
"""
Analyze raw tokenomics data to extract key insights
"""
import re

def analyze_data():
    with open('tokenomics_data/raw_responses.txt', 'r') as f:
        content = f.read()
    
    # Split by test
    tests = content.split('\n')
    
    print("TOKENOMICS DATA ANALYSIS")
    print("========================\n")
    
    # Analyze Test Set A - Halving Impact
    print("Test Set A: Halving Step Impact")
    print("--------------------------------")
    print("All tests use: hard_cap=1M, burn_unit=1M, reward=20k")
    print("\nKey Finding: All halving percentages (25%-90%) produce only 1 epoch!")
    print("This suggests the parameters create a situation where all tokens are minted in the first epoch.\n")
    
    # Analyze Test Set B - Burn Unit Scaling  
    print("Test Set B: Burn Unit Scaling")
    print("-----------------------------")
    burn_units = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000]
    
    for i, burn_unit in enumerate(burn_units):
        test_id = f'B{i+1}'
        initial_val = burn_unit * 0.005
        
        # Find the test result
        for test in tests:
            if test.startswith(test_id + '|'):
                # Count epochs
                epochs = len(re.findall(r'"Epoch \d+"', test))
                # Get total valuation
                val_match = re.search(r'cumulative_usd_cost_data_y = vec \{[^}]+?([\d.]+) : float64 \}', test)
                total_val = float(val_match.group(1)) if val_match else 0
                
                print(f"{test_id}: Burn unit {burn_unit:,} (Initial val ${initial_val:,.2f})")
                print(f"     Epochs: {epochs}, Total valuation: ${total_val:,.2f}")
                
                if initial_val < 5000:
                    print(f"     ⚠️  WARNING: Initial valuation below $5,000 threshold")
                break
    
    print("\n")
    
    # Key insights
    print("KEY INSIGHTS")
    print("============")
    print("\n1. EPOCH GENERATION ISSUE:")
    print("   - With burn_unit=1M and reward=20k, only 1 epoch is generated")
    print("   - This happens regardless of halving percentage (25%-90%)")
    print("   - Suggests the reward/burn ratio may be too high")
    
    print("\n2. VALUATION THRESHOLDS:")
    print("   - Burn units below 1,000,000 result in initial valuations < $5,000")
    print("   - This triggers the warning in the UI")
    print("   - Minimum burn_unit for $5k valuation: 1,000,000")
    
    print("\n3. PARAMETER RECOMMENDATIONS:")
    print("   - For 15-30 epochs: Reduce initial_reward or increase burn_unit")
    print("   - Current 20k reward with 1M burn unit is too generous")
    print("   - Consider reward/burn ratios between 0.001 and 0.01")
    
    print("\n4. HALVING STEP ANALYSIS:")
    print("   - Current parameters don't allow halving to take effect")
    print("   - Need multiple epochs to see halving impact")
    print("   - Recommend testing with lower reward values")

if __name__ == "__main__":
    analyze_data()