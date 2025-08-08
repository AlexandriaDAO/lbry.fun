# LBRY_FUN

A token launchpad built on the Internet Computer with unique dual-token distribution mechanics.

## Local Setup LBRY_FUN

```bash
# Run the BUILD script
./scripts/build.sh
```

### Parent Project Dependencies

- Alexandria Core
- KongSwap Backend

1. **Root icp_swap canister** (`54fqz-5iaaa-aaaap-qkmqa-cai`) - Receives 1% of distributions for LBRY token buyback/burn
2. **LBRY token** (`y33wz-myaaa-aaaap-qkmna-cai`) - The token that gets bought and burned

To deploy these parent canisters:

```bash
# From the tests directory
cd tests
./deploy_parent_canisters.sh ../../core

# Or specify your Alexandria core path
./deploy_parent_canisters.sh /path/to/alexandria/core
```

Note: This assumes you have the Alexandria core project available locally at `../core` relative to this repository.