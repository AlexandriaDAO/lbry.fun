#!/bin/bash
# Test if we can query a newly created token

echo "Testing token readiness after creation..."

# Create a test ICRC-1 token canister
echo "1. Creating test token canister..."
TEST_TOKEN_ID=$(dfx canister create test_token 2>&1 | grep -o 'canister ID: [a-z0-9-]*' | cut -d' ' -f3 || echo "")

if [ -z "$TEST_TOKEN_ID" ]; then
    # Try to get existing canister ID
    TEST_TOKEN_ID=$(dfx canister id test_token 2>/dev/null || echo "")
fi

if [ -n "$TEST_TOKEN_ID" ]; then
    echo "Test token canister: $TEST_TOKEN_ID"
    
    # Try to query the token
    echo -e "\n2. Querying token name (should fail if not installed):"
    dfx canister call "$TEST_TOKEN_ID" icrc1_name '()' 2>&1 || echo "Expected: Token not yet installed"
    
    # Check canister status
    echo -e "\n3. Checking canister status:"
    dfx canister status "$TEST_TOKEN_ID" 2>&1 | grep -E "Status:|Memory allocation:|Module hash:" || echo "Cannot get status"
    
    # Clean up
    echo -e "\n4. Cleaning up test canister..."
    dfx canister delete test_token --yes 2>/dev/null || echo "Cleanup skipped"
else
    echo "Could not create test canister"
fi

echo -e "\nDone testing."