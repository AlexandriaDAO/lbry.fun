#!/bin/bash

echo "Testing tokenomics fix..."

# Quick Launch preset parameters
PRIMARY_PER_THRESHOLD="200000000000"  # 2000 * E8S
MAX_PRIMARY_SUPPLY="100000000000000"   # 1M * E8S  
INITIAL_SECONDARY_BURN="100000000000000"  # 1M * E8S
HALVING="7000000000000"  # 70k * E8S

echo -e "\nTesting Quick Launch preset:"
echo "  primary_per_threshold: $PRIMARY_PER_THRESHOLD (2000 tokens)"
echo "  max_primary_supply: $MAX_PRIMARY_SUPPLY (1M tokens)"
echo "  initial_secondary_burn: $INITIAL_SECONDARY_BURN (1M tokens)"
echo "  halving: $HALVING (70k tokens)"

# Create PreviewArgs record
echo -e "\nCalling preview_tokenomics_graphs..."
dfx canister call lbry_fun preview_tokenomics_graphs "(record {
  initial_reward_per_burn_unit = $PRIMARY_PER_THRESHOLD : nat64;
  primary_max_supply = $MAX_PRIMARY_SUPPLY : nat64;
  initial_secondary_burn = $INITIAL_SECONDARY_BURN : nat64;
  halving_step = $HALVING : nat64;
  tge_allocation = 10000000000 : nat64
})"

echo -e "\n\nExpected Results:"
echo "- Should show 4 epochs (not 1)"
echo "- Total supply minted should be ~100%"
echo "- No epoch should mint billions of tokens"
echo "- Epoch 1 should mint 200,000 tokens (not 18.6 billion)"