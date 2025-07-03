#!/bin/bash
# Test script for the new get_pool_logs function

# Example usage:
# Query logs for pool ID 1, with optional pagination (page 0, page_size 10)
echo "Querying logs for pool 1..."
dfx canister call bot1 get_pool_logs '(1, opt 0, opt 10)'

# Query logs without pagination (gets default page)
echo -e "\nQuerying logs for pool 1 without pagination..."
dfx canister call bot1 get_pool_logs '(1, null, null)'

# Example of how to interpret the results:
# The function returns a PoolLogs record containing:
# - tokenomics_logs: Optional paginated logs from the tokenomics canister
# - icp_swap_logs: Optional paginated logs from the icp_swap canister
#
# Each log entry contains:
# - function: The function that generated the log
# - log_type: Either Error (with error details) or Info (with info message)
# - log_id: Unique ID for the log entry
# - timestamp: When the log was created
# - caller: Principal that triggered the logged operation
#
# This is particularly useful for debugging the "999" error you mentioned,
# as you can now see the error logs from both canisters to understand
# exactly why "No more primary can be minted" errors occur.