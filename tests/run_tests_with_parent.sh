#!/bin/bash
# Test runner that deploys parent project canisters and runs lbry_fun tests
# Assumes dfx is already running with lbry_fun deployed

set -e

echo "=== LbryFun Test Runner ==="
echo "This script will:"
echo "1. Deploy missing parent project canisters (root icp_swap and LBRY token)"
echo "2. Run all lbry_fun tests"
echo ""

# Check for parent project path
PARENT_PROJECT_PATH=${1:-"../../core"}

# Step 1: Deploy parent project canisters
echo "=== Step 1: Deploying parent Alexandria canisters ==="
./deploy_parent_canisters.sh "$PARENT_PROJECT_PATH"

if [ $? -ne 0 ]; then
    echo "Failed to deploy parent project canisters"
    exit 1
fi

# Give canisters time to initialize
sleep 2

# Step 2: Run lbry_fun tests
echo ""
echo "=== Step 2: Running lbry_fun tests ==="
cd ..
cargo test -- --nocapture

# Step 3: Show summary
echo ""
echo "=== Test Summary ==="
cargo test 2>&1 | grep -E "test result:|passed|failed" | tail -5

echo ""
echo "=== Test run complete! ==="