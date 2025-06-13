#!/usr/bin/env python3
"""
Parse the raw tokenomics data from the bash script output
"""
import re
import csv
from pathlib import Path

def parse_candid_response(text):
    """Extract key metrics from candid response"""
    data = {}
    
    # Extract minted_per_epoch_data_y values (total epochs)
    epochs_match = re.findall(r'minted_per_epoch_data_y = vec \{([^}]+)\}', text)
    if epochs_match:
        epochs_values = re.findall(r'\d+', epochs_match[0])
        data['epochs'] = len(epochs_values)
    
    # Extract cost values
    cost_match = re.findall(r'cost_to_mint_data_y = vec \{([^}]+)\}', text)
    if cost_match:
        costs = re.findall(r'[\d.]+', cost_match[0])
        if len(costs) >= 2:
            data['initial_cost'] = float(costs[1]) if costs[1] != '0.0' else 0
            data['final_cost'] = float(costs[-1])
    
    # Extract cumulative USD cost (total valuation)
    usd_match = re.findall(r'cumulative_usd_cost_data_y = vec \{([^}]+)\}', text)
    if usd_match:
        usd_values = re.findall(r'[\d.]+', usd_match[0])
        if usd_values:
            data['total_valuation'] = float(usd_values[-1])
    
    return data

def main():
    input_file = Path("tokenomics_data/raw_responses.txt")
    output_file = Path("tokenomics_data/parsed_data.csv")
    
    if not input_file.exists():
        print(f"Error: {input_file} not found")
        return
    
    results = []
    
    with open(input_file, 'r') as f:
        content = f.read()
        
    # Split by test ID
    tests = content.split('\n')
    
    for test in tests:
        if '|' not in test:
            continue
            
        test_id, response = test.split('|', 1)
        data = parse_candid_response(response)
        
        if data:
            # Extract test parameters from test ID
            if test_id.startswith('A'):
                halving = 25 + (int(test_id[1:]) - 1) * 5
                results.append({
                    'test_id': test_id,
                    'test_set': 'A',
                    'description': f'Halving {halving}%',
                    'hard_cap': 1000000,
                    'burn_unit': 1000000,
                    'halving_step': halving,
                    'initial_reward': 20000,
                    **data
                })
            elif test_id.startswith('B'):
                burn_units = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000]
                idx = int(test_id[1:]) - 1
                if idx < len(burn_units):
                    burn_unit = burn_units[idx]
                    results.append({
                        'test_id': test_id,
                        'test_set': 'B',
                        'description': f'Burn unit {burn_unit}',
                        'hard_cap': 1000000,
                        'burn_unit': burn_unit,
                        'halving_step': 50,
                        'initial_reward': 20000,
                        **data
                    })
    
    # Write results to CSV
    if results:
        fieldnames = ['test_id', 'test_set', 'description', 'hard_cap', 'burn_unit', 
                      'halving_step', 'initial_reward', 'epochs', 'initial_cost', 
                      'final_cost', 'total_valuation']
        
        with open(output_file, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(results)
        
        print(f"Parsed {len(results)} test results")
        print(f"Results saved to: {output_file}")
        
        # Print summary statistics
        print("\nSummary Statistics:")
        print("===================")
        
        # Test Set A analysis
        a_tests = [r for r in results if r['test_set'] == 'A']
        if a_tests:
            print("\nTest Set A (Halving Step Impact):")
            for test in a_tests:
                epochs = test.get('epochs', 'N/A')
                halving = test.get('halving_step', 'N/A')
                print(f"  Halving {halving}%: {epochs} epochs")
        
        # Test Set B analysis
        b_tests = [r for r in results if r['test_set'] == 'B']
        if b_tests:
            print("\nTest Set B (Burn Unit Scaling):")
            for test in b_tests:
                burn_unit = test.get('burn_unit', 'N/A')
                val = test.get('total_valuation', 0)
                initial_val = burn_unit * 0.005 if burn_unit != 'N/A' else 0
                print(f"  Burn unit {burn_unit}: Initial valuation ${initial_val:.2f}, Total valuation ${val:.2f}")

if __name__ == "__main__":
    main()