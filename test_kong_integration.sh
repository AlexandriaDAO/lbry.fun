#!/bin/bash
# Test Kong integration directly

echo "Testing Kong backend canister integration..."

# Test 1: Check if Kong canister is responsive
echo -e "\n1. Testing Kong canister responsiveness:"
dfx canister call 2ipq2-uqaaa-aaaar-qailq-cai pools '(null)'

# Test 2: Try to add a dummy token
echo -e "\n2. Testing add_token method with a dummy token:"
dfx canister call 2ipq2-uqaaa-aaaar-qailq-cai add_token '(record { token = "IC.ryjl3-tyaaa-aaaaa-aaaba-cai" })'

# Test 3: Check Kong canister info
echo -e "\n3. Getting Kong canister info:"
dfx canister info 2ipq2-uqaaa-aaaar-qailq-cai 2>&1 || echo "Cannot get canister info (expected if not controller)"

# Test 4: Try different token format
echo -e "\n4. Testing add_token with different format:"
dfx canister call 2ipq2-uqaaa-aaaar-qailq-cai add_token '(record { token = "IC.ryjl3-tyaaa-aaaaa-aaaba-cai" })' --query 2>&1 || echo "Query call failed"

echo -e "\nDone testing Kong integration."