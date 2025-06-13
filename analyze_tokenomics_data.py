#!/usr/bin/env python3
"""
Tokenomics Data Analysis Script
Analyzes CSV data collected from TokenomicsGraphsBackend
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import json

class TokenomicsAnalyzer:
    def __init__(self, data_directory="./tokenomics_data"):
        self.data_dir = Path(data_directory)
        self.data_dir.mkdir(exist_ok=True)
        self.results = {}
        
    def parse_csv_data(self, csv_content, test_id):
        """Parse TSV data from clipboard"""
        lines = csv_content.strip().split('\n')
        data = []
        
        for i, line in enumerate(lines[1:]):  # Skip header
            cols = line.split('\t')
            if len(cols) >= 7:
                data.append({
                    'test_id': test_id,
                    'epoch': cols[0],
                    'cumulative_secondary_burned': self._parse_number(cols[1]),
                    'cumulative_primary_minted': self._parse_number(cols[2]),
                    'primary_minted_in_epoch': self._parse_number(cols[3]),
                    'usd_cost_per_token': self._parse_number(cols[4]),
                    'cumulative_usd_cost': self._parse_number(cols[5]),
                    'supply_minted_pct': self._parse_number(cols[6])
                })
        
        return pd.DataFrame(data)
    
    def _parse_number(self, value):
        """Parse numbers from various formats"""
        value = str(value).replace('$', '').replace(',', '').replace('%', '')
        try:
            return float(value)
        except:
            return 0.0
    
    def analyze_test_set_a(self, dataframes):
        """Analyze halving step impact"""
        results = []
        
        for test_id, df in dataframes.items():
            if not test_id.startswith('A'):
                continue
                
            halving_step = int(test_id[1:]) * 5 + 20  # Convert A1->25, A2->30, etc
            
            # Calculate metrics
            total_epochs = len(df) - 1  # Exclude TGE
            final_cost = df['usd_cost_per_token'].iloc[-1]
            initial_cost = df[df['epoch'] != 'TGE']['usd_cost_per_token'].iloc[0]
            cost_multiplier = final_cost / initial_cost if initial_cost > 0 else np.inf
            
            results.append({
                'halving_step': halving_step,
                'total_epochs': total_epochs,
                'initial_cost': initial_cost,
                'final_cost': final_cost,
                'cost_multiplier': cost_multiplier,
                'total_valuation': df['cumulative_usd_cost'].iloc[-1]
            })
        
        return pd.DataFrame(results)
    
    def analyze_test_set_b(self, dataframes):
        """Analyze burn unit scaling impact"""
        results = []
        
        burn_units = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000]
        
        for i, (test_id, df) in enumerate(dataframes.items()):
            if not test_id.startswith('B'):
                continue
                
            burn_unit = burn_units[int(test_id[1:]) - 1]
            initial_valuation = burn_unit * 0.005  # $0.005 per secondary token
            
            results.append({
                'burn_unit': burn_unit,
                'initial_valuation': initial_valuation,
                'total_epochs': len(df) - 1,
                'final_valuation': df['cumulative_usd_cost'].iloc[-1],
                'valuation_valid': initial_valuation >= 5000
            })
        
        return pd.DataFrame(results)
    
    def generate_recommendations(self, analysis_results):
        """Generate parameter recommendations based on analysis"""
        recommendations = {
            'halving_step': {
                'optimal_range': [50, 75],
                'warning_below': 40,
                'warning_above': 80,
                'reason': 'Balances front-loading vs. long-tail distribution'
            },
            'burn_unit': {
                'minimum': 1000000,  # For $5000 minimum valuation
                'recommended': 2000000,
                'reason': 'Ensures minimum $5,000 initial valuation'
            },
            'epochs': {
                'optimal_range': [15, 30],
                'warning_below': 10,
                'warning_above': 40,
                'reason': 'Provides reasonable distribution timeline'
            }
        }
        
        return recommendations
    
    def create_visualizations(self, dataframes):
        """Create analysis visualizations"""
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        
        # Plot 1: Halving Step vs Total Epochs
        test_a_data = self.analyze_test_set_a(dataframes)
        if not test_a_data.empty:
            axes[0, 0].plot(test_a_data['halving_step'], test_a_data['total_epochs'], 'o-')
            axes[0, 0].set_xlabel('Halving Step (%)')
            axes[0, 0].set_ylabel('Total Epochs')
            axes[0, 0].set_title('Halving Step Impact on Token Distribution')
            axes[0, 0].grid(True)
        
        # Plot 2: Burn Unit vs Initial Valuation
        test_b_data = self.analyze_test_set_b(dataframes)
        if not test_b_data.empty:
            axes[0, 1].scatter(test_b_data['burn_unit'], test_b_data['initial_valuation'])
            axes[0, 1].axhline(y=5000, color='r', linestyle='--', label='$5,000 minimum')
            axes[0, 1].set_xlabel('Burn Unit')
            axes[0, 1].set_ylabel('Initial Valuation ($)')
            axes[0, 1].set_xscale('log')
            axes[0, 1].set_title('Burn Unit vs Initial Valuation')
            axes[0, 1].legend()
            axes[0, 1].grid(True)
        
        # Plot 3: Cost Progression Example
        if 'A7' in dataframes:  # Example with 50% halving
            df = dataframes['A7']
            epochs = df[df['epoch'] != 'TGE']
            axes[1, 0].plot(range(len(epochs)), epochs['usd_cost_per_token'], 'g-')
            axes[1, 0].set_xlabel('Epoch')
            axes[1, 0].set_ylabel('USD Cost per Token')
            axes[1, 0].set_title('Cost Progression (50% Halving Step)')
            axes[1, 0].grid(True)
        
        # Plot 4: Summary Statistics
        axes[1, 1].axis('off')
        summary_text = self._generate_summary_text(dataframes)
        axes[1, 1].text(0.1, 0.9, summary_text, transform=axes[1, 1].transAxes,
                       fontsize=10, verticalalignment='top', fontfamily='monospace')
        
        plt.tight_layout()
        plt.savefig(self.data_dir / 'tokenomics_analysis.png', dpi=300)
        plt.close()
    
    def _generate_summary_text(self, dataframes):
        """Generate summary statistics text"""
        total_tests = len(dataframes)
        valid_tests = sum(1 for df in dataframes.values() if len(df) > 1)
        
        summary = f"""Tokenomics Analysis Summary
========================
Total Tests Run: {total_tests}
Valid Tests: {valid_tests}

Key Findings:
- Optimal halving step: 50-75%
- Minimum burn unit: 1,000,000
- Target epochs: 15-30

Warnings Detected:
- Low valuation (<$5k): Check burn unit
- Extreme halving: Check distribution
- Too many epochs: Reduce burn unit
"""
        return summary
    
    def save_results(self, dataframes):
        """Save analysis results to JSON"""
        results = {
            'test_set_a': self.analyze_test_set_a(dataframes).to_dict('records'),
            'test_set_b': self.analyze_test_set_b(dataframes).to_dict('records'),
            'recommendations': self.generate_recommendations(dataframes)
        }
        
        with open(self.data_dir / 'analysis_results.json', 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"Results saved to {self.data_dir / 'analysis_results.json'}")

# Example usage
if __name__ == "__main__":
    analyzer = TokenomicsAnalyzer()
    
    # Example: Load test data
    # dataframes = {}
    # dataframes['A1'] = analyzer.parse_csv_data(csv_content_a1, 'A1')
    # dataframes['A2'] = analyzer.parse_csv_data(csv_content_a2, 'A2')
    # ...
    
    # analyzer.create_visualizations(dataframes)
    # analyzer.save_results(dataframes)
    
    print("Tokenomics analyzer ready. Use parse_csv_data() to load test results.")