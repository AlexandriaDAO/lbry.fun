# Token Testing Structure

## Organization

Tests are organized into categories for better maintainability:

### `/unit/`
Individual canister deployment and basic functionality tests.
- `individual_canister_tests.rs` - Tests each canister type in isolation

### `/integration/`
Multi-canister workflows and complex interactions.
- `integrated_token_tests.rs` - Full 6-canister environment setup
- `phase1_environment_tests.rs` - Basic environment validation
- `phase2_token_operations.rs` - Core token operations (swap, burn, stake)
- `phase3_*` - Distribution and reward system tests
- `real_execution*.rs` - Full deployment flow tests

### `/simulation/`
Economic model validation and backend calculations.
- `backend_validation_tests.rs` - Frontend/backend consistency
- `tokenomics_lifecycle_tests.rs` - Halving and supply mechanics
- `phase5_stress_testing.rs` - Performance under load

### `/helpers/`
Shared utilities and test infrastructure.
- `shared_helpers.rs` - Common helper functions
- `token_testing/` - Token deployment utilities

## Running Tests

### Quick Start (Recommended)
```bash
# Assumes you already have dfx running with lbry_fun deployed
# From tests/ directory:
./run_tests_with_parent.sh [path_to_alexandria]

# Default assumes alexandria core is at ../../core
./run_tests_with_parent.sh
```

### Manual Testing
```bash
# Step 1: Deploy parent project's canisters (from tests/ directory)
./deploy_parent_canisters.sh ../../core

# Step 2: Run tests (from project root)
cargo test

# Run specific test file
cargo test phase2

# Run with output
cargo test -- --nocapture
```

### Prerequisites
- dfx must already be running
- lbry_fun canisters should be deployed (./scripts/build.sh)
- Parent Alexandria project must be available locally

### Test Without Parent Project
Some tests will fail without the parent project's root icp_swap canister deployed.
To run only tests that don't require distribution:
```bash
cargo test phase1
cargo test phase2
cargo test simulation
```

## Current Status

See `token_results.md` for detailed test results and known issues.