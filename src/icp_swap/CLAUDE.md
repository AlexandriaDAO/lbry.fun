This canister has been audited. Don't make any edits without asking first, and every single change must be recorded in the ICP_SWAP_CHANGE_LOG.md file.

## ICP Swap Canister Specifics

See main CLAUDE.md for comprehensive E8S conversion patterns.

### Critical for this canister:
- `burn_secondary` is the ONLY operation expecting natural units from frontend
- All other operations (swap_icp, balances) use standard E8S format
- ICP_TRANSFER_FEE = 10,000 E8S