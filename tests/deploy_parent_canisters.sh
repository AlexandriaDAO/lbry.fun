#!/bin/bash
# Minimal script to deploy only the missing parent project canisters
# Assumes dfx is already running with existing lbry_fun and kongswap deployments

set -e  # Exit on error

echo "=== Deploying parent Alexandria's root canisters for lbry_fun testing ==="

# Navigate to parent Alexandria project
PARENT_PROJECT_PATH=${1:-"../../core"}

if [ ! -d "$PARENT_PROJECT_PATH" ]; then
    echo "Error: Parent Alexandria project not found at $PARENT_PROJECT_PATH"
    echo "Usage: ./deploy_parent_canisters.sh [path_to_alexandria_core]"
    exit 1
fi

cd "$PARENT_PROJECT_PATH"

# Check if canister already exists
if dfx canister id icp_swap 2>/dev/null; then
    echo "Root icp_swap canister already exists at $(dfx canister id icp_swap)"
else
    echo "=== Building root icp_swap canister ==="
    cargo build --release --target wasm32-unknown-unknown --package icp_swap
    
    echo "=== Creating and deploying root icp_swap canister ==="
    dfx canister create icp_swap --specified-id 54fqz-5iaaa-aaaap-qkmqa-cai
    dfx deploy icp_swap --specified-id 54fqz-5iaaa-aaaap-qkmqa-cai
fi

# Check if LBRY token exists
if dfx canister id LBRY 2>/dev/null; then
    echo "LBRY token already exists at $(dfx canister id LBRY)"
else
    echo "=== Creating and deploying LBRY token ==="
    dfx canister create LBRY --specified-id y33wz-myaaa-aaaap-qkmna-cai
    dfx deploy LBRY --specified-id y33wz-myaaa-aaaap-qkmna-cai --argument '(variant { Init = 
    record {
         token_symbol = "LBRY";
         token_name = "LBRY";
         minting_account = record { owner = principal "54fqz-5iaaa-aaaap-qkmqa-cai" };
         transfer_fee = 4_000_000;
         metadata = vec {};
         initial_balances = vec {};
         archive_options = record {
             num_blocks_to_archive = 1000;
             trigger_threshold = 2000;
             controller_id = principal "54fqz-5iaaa-aaaap-qkmqa-cai";
         };
         feature_flags = opt record {
            icrc2 = true;
         };
     }
    })'
fi

echo ""
echo "=== Parent canister deployment complete! ==="
echo "Root icp_swap: 54fqz-5iaaa-aaaap-qkmqa-cai"
echo "LBRY Token: y33wz-myaaa-aaaap-qkmna-cai"
echo ""

# Return to original directory
cd -