#!/usr/bin/env python3
"""
Autonomous Tokenomics Data Collection Script
Collects data by directly calling the lbry_fun canister's preview_tokenomics_graphs function
"""

import asyncio
import json
import pandas as pd
from pathlib import Path
from ic.agent import Agent
from ic.identity import Identity
from ic.client import Client
from ic.candid import encode, decode, Types
import subprocess
import os

# Constants
E8S = 100_000_000  # 1 token = 100,000,000 e8s
LOCAL_URL = "http://localhost:4943"
SECONDARY_TOKEN_COST_USD = 0.005  # $0.005 per secondary token

class TokenomicsDataCollector:
    def __init__(self):
        self.output_dir = Path("./tokenomics_data")
        self.output_dir.mkdir(exist_ok=True)
        self.canister_id = None
        
    def get_canister_id(self):
        """Get the lbry_fun canister ID from dfx"""
        try:
            result = subprocess.run(
                ["dfx", "canister", "id", "lbry_fun"],
                capture_output=True,
                text=True,
                check=True
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError:
            print("Error: Could not get canister ID. Make sure dfx is running and lbry_fun is deployed.")
            return None
    
    def create_test_parameters(self):
        """Create all test parameter sets"""
        tests = []
        
        # Test Set A: Halving Step Impact
        for i, halving in enumerate([25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90]):
            tests.append({
                'test_id': f'A{i+1}',
                'params': {
                    'primary_max_supply': 1_000_000 * E8S,
                    'tge_allocation': 1 * E8S,
                    'initial_secondary_burn': 1_000_000 * E8S,
                    'halving_step': halving,
                    'initial_reward_per_burn_unit': 20_000 * E8S,
                },
                'description': f'Halving step {halving}%'
            })
        
        # Test Set B: Burn Unit Scaling
        burn_units = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000]
        for i, burn_unit in enumerate(burn_units):
            tests.append({
                'test_id': f'B{i+1}',
                'params': {
                    'primary_max_supply': 1_000_000 * E8S,
                    'tge_allocation': 1 * E8S,
                    'initial_secondary_burn': burn_unit * E8S,
                    'halving_step': 50,
                    'initial_reward_per_burn_unit': 20_000 * E8S,
                },
                'description': f'Burn unit {burn_unit:,}'
            })
        
        # Test Set C: Supply/Reward Ratios
        c_tests = [
            ('C1', 100_000, 1_000_000, 50_000, 50, 'Small supply, high reward'),
            ('C2', 100_000, 1_000_000, 1_000, 50, 'Small supply, low reward'),
            ('C3', 10_000_000, 1_000_000, 1_000, 50, 'Large supply, low reward'),
            ('C4', 10_000_000, 1_000_000, 100_000, 50, 'Large supply, high reward'),
            ('C5', 1_000_000, 1_000_000, 1, 50, 'Minimal reward test'),
            ('C6', 1_000_000, 100, 1_000_000, 50, 'Extreme reward test'),
        ]
        
        for test_id, hard_cap, burn_unit, reward, halving, desc in c_tests:
            tests.append({
                'test_id': test_id,
                'params': {
                    'primary_max_supply': hard_cap * E8S,
                    'tge_allocation': 1 * E8S,
                    'initial_secondary_burn': burn_unit * E8S,
                    'halving_step': halving,
                    'initial_reward_per_burn_unit': reward * E8S,
                },
                'description': desc
            })
        
        # Test Set D: Edge Cases
        d_tests = [
            ('D1', 1_000, 1, 100, 25, 1_000, 'Minimum viable'),
            ('D2', 10_000_000, 1, 10_000_000, 90, 1_000_000, 'Maximum stress'),
            ('D3', 1_000_000, 999_999, 1_000_000, 50, 20_000, 'TGE warning'),
            ('D4', 1_000_000, 1, 100, 99, 20_000, 'Invalid halving'),
            ('D5', 1_000_000, 1, 20_000_000, 25, 100_000, 'Unreachable epochs'),
        ]
        
        for test_id, hard_cap, tge, burn_unit, halving, reward, desc in d_tests:
            tests.append({
                'test_id': test_id,
                'params': {
                    'primary_max_supply': hard_cap * E8S,
                    'tge_allocation': tge * E8S,
                    'initial_secondary_burn': burn_unit * E8S,
                    'halving_step': halving,
                    'initial_reward_per_burn_unit': reward * E8S,
                },
                'description': desc
            })
        
        return tests
    
    def process_graph_data(self, graph_data, test_id, params):
        """Process the graph data into a structured format"""
        results = []
        
        # Calculate TGE data
        tge_amount = params['tge_allocation'] / E8S
        tge_percentage = (tge_amount / (params['primary_max_supply'] / E8S)) * 100
        
        # Add TGE row
        results.append({
            'test_id': test_id,
            'epoch': 'TGE',
            'cumulative_secondary_burned': 0,
            'cumulative_primary_minted': tge_amount,
            'primary_minted_in_epoch': tge_amount,
            'usd_cost_per_token': graph_data.get('cost_to_mint_data_y', [0])[0] if graph_data.get('cost_to_mint_data_y') else 0,
            'cumulative_usd_cost': 0,
            'supply_minted_pct': tge_percentage
        })
        
        # Process epoch data
        epochs = graph_data.get('minted_per_epoch_data_x', [])
        for i in range(len(epochs)):
            epoch_label = epochs[i]
            
            # Get data for this epoch
            secondary_burned = graph_data['cumulative_supply_data_x'][i] / E8S if i < len(graph_data['cumulative_supply_data_x']) else 0
            cumulative_primary = graph_data['cumulative_supply_data_y'][i] / E8S if i < len(graph_data['cumulative_supply_data_y']) else 0
            minted_in_epoch = graph_data['minted_per_epoch_data_y'][i] / E8S if i < len(graph_data['minted_per_epoch_data_y']) else 0
            cost_per_token = graph_data['cost_to_mint_data_y'][i] if i < len(graph_data['cost_to_mint_data_y']) else 0
            cumulative_usd = graph_data['cumulative_usd_cost_data_y'][i] if i < len(graph_data['cumulative_usd_cost_data_y']) else 0
            supply_pct = (cumulative_primary / (params['primary_max_supply'] / E8S)) * 100
            
            results.append({
                'test_id': test_id,
                'epoch': epoch_label,
                'cumulative_secondary_burned': secondary_burned,
                'cumulative_primary_minted': cumulative_primary,
                'primary_minted_in_epoch': minted_in_epoch,
                'usd_cost_per_token': cost_per_token,
                'cumulative_usd_cost': cumulative_usd,
                'supply_minted_pct': supply_pct
            })
        
        return results
    
    def calculate_metrics(self, test_data):
        """Calculate summary metrics for each test"""
        df = pd.DataFrame(test_data)
        
        # Group by test_id
        metrics = []
        for test_id in df['test_id'].unique():
            test_df = df[df['test_id'] == test_id]
            
            # Get test parameters
            test_info = next(t for t in self.all_tests if t['test_id'] == test_id)
            params = test_info['params']
            
            # Calculate metrics
            epochs_excl_tge = len(test_df) - 1
            initial_valuation = (params['initial_secondary_burn'] / E8S) * SECONDARY_TOKEN_COST_USD
            
            # Get costs
            first_epoch = test_df[test_df['epoch'] != 'TGE'].iloc[0] if len(test_df) > 1 else test_df.iloc[0]
            last_epoch = test_df.iloc[-1]
            
            metrics.append({
                'test_id': test_id,
                'hard_cap': params['primary_max_supply'] / E8S,
                'tge_allocation': params['tge_allocation'] / E8S,
                'burn_unit': params['initial_secondary_burn'] / E8S,
                'halving_step': params['halving_step'],
                'initial_reward': params['initial_reward_per_burn_unit'] / E8S,
                'epochs_generated': epochs_excl_tge,
                'initial_mint_cost': first_epoch['usd_cost_per_token'],
                'final_mint_cost': last_epoch['usd_cost_per_token'],
                'total_valuation': last_epoch['cumulative_usd_cost'],
                'initial_valuation': initial_valuation,
                'valuation_valid': initial_valuation >= 5000,
                'description': test_info['description']
            })
        
        return pd.DataFrame(metrics)
    
    async def collect_data_with_agent(self):
        """Collect data using ic-py agent (if available)"""
        # This would require ic-py to be installed
        # For now, we'll use the subprocess method
        pass
    
    def collect_data_with_dfx(self):
        """Collect data using dfx CLI commands"""
        print("Collecting data using dfx CLI...")
        
        self.canister_id = self.get_canister_id()
        if not self.canister_id:
            return None
        
        print(f"Using canister ID: {self.canister_id}")
        
        self.all_tests = self.create_test_parameters()
        all_results = []
        
        for test in self.all_tests:
            test_id = test['test_id']
            params = test['params']
            
            # Format the parameters for dfx
            dfx_params = f"record {{ " \
                        f"primary_max_supply = {params['primary_max_supply']} : nat64; " \
                        f"tge_allocation = {params['tge_allocation']} : nat64; " \
                        f"initial_secondary_burn = {params['initial_secondary_burn']} : nat64; " \
                        f"halving_step = {params['halving_step']} : nat64; " \
                        f"initial_reward_per_burn_unit = {params['initial_reward_per_burn_unit']} : nat64 " \
                        f"}}"
            
            try:
                # Call the canister method
                result = subprocess.run(
                    ["dfx", "canister", "call", self.canister_id, "preview_tokenomics_graphs", dfx_params],
                    capture_output=True,
                    text=True,
                    check=True
                )
                
                # Parse the result (this is a simplified parser - may need adjustment)
                # The actual parsing would depend on the exact output format
                print(f"✓ {test_id}: {test['description']}")
                
                # For now, we'll need to parse the candid output manually
                # This is where we'd process the graph data
                
            except subprocess.CalledProcessError as e:
                print(f"✗ {test_id}: Error - {e.stderr}")
        
        return all_results
    
    def save_results(self, results_df, metrics_df):
        """Save results to files"""
        # Save detailed results
        results_df.to_csv(self.output_dir / "tokenomics_detailed_results.csv", index=False)
        results_df.to_json(self.output_dir / "tokenomics_detailed_results.json", orient='records', indent=2)
        
        # Save summary metrics
        metrics_df.to_csv(self.output_dir / "tokenomics_summary_metrics.csv", index=False)
        metrics_df.to_json(self.output_dir / "tokenomics_summary_metrics.json", orient='records', indent=2)
        
        print(f"\nResults saved to {self.output_dir}/")
        print(f"- tokenomics_detailed_results.csv")
        print(f"- tokenomics_summary_metrics.csv")

def main():
    """Main entry point"""
    collector = TokenomicsDataCollector()
    
    print("Autonomous Tokenomics Data Collection")
    print("=====================================")
    
    # Try to collect data
    results = collector.collect_data_with_dfx()
    
    if results:
        # Convert to DataFrames
        results_df = pd.DataFrame(results)
        metrics_df = collector.calculate_metrics(results)
        
        # Save results
        collector.save_results(results_df, metrics_df)
        
        print("\nData collection complete!")
        print(f"Total data points: {len(results)}")
        print(f"Total tests: {len(metrics_df)}")
    else:
        print("\nNote: To use this script, you need to:")
        print("1. Run ./scripts/build.sh to deploy the canisters")
        print("2. Ensure dfx is running")
        print("3. Run this script")
        print("\nAlternatively, use the Node.js script (collect_tokenomics_data.js) if you have the frontend dependencies installed.")

if __name__ == "__main__":
    main()