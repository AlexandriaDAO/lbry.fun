#!/bin/bash

# ⚠️  MUST RUN FROM PROJECT ROOT: ~/alexandria/lbryfun or ~/alexandria/lbryfun-actor-management-fix
# This script is designed to be copy-pasted into your terminal for manual password entry

# Validate we're in the correct directory
if [ ! -f "dfx.json" ]; then
    echo "❌ Error: dfx.json not found. Please run from project root:"
    echo "   cd ~/alexandria/lbryfun (or worktree)"
    exit 1
fi

if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Detect if we're in a worktree
REPO_ROOT=$(git rev-parse --show-toplevel)
MAIN_REPO=$(git rev-parse --git-common-dir | sed 's|/.git$||')

echo "📍 Current location: $REPO_ROOT"

# If in worktree and dfx_mainnet.json doesn't exist, copy from main repo
if [ ! -f "dfx_mainnet.json" ] && [ -f "$MAIN_REPO/dfx_mainnet.json" ]; then
    echo "📋 Copying dfx_mainnet.json from main repo"
    cp "$MAIN_REPO/dfx_mainnet.json" dfx_mainnet.json
fi

# Copy mainnet config
cp dfx_mainnet.json dfx.json

# Setup .dfx directories
cd ./.dfx/
rm -rf local/canisters/
cp -r ic/canisters/ local/
cd ..

# Create directories for external canisters only (lbry_fun_frontend is already copied above)
mkdir -p .dfx/local/canisters/LBRY
mkdir -p .dfx/local/canisters/ALEX
mkdir -p src/icp_swap_factory && dfx canister --network ic metadata ggzvv-5qaaa-aaaag-qck7a-cai candid:service > src/icp_swap_factory/icp_swap_factory.did

wget https://raw.githubusercontent.com/dfinity/ic/b9a0f18dd5d6019e3241f205de797bca0d9cc3f8/rs/rosetta-api/icrc1/ledger/ledger.did -O .dfx/local/canisters/ALEX/ALEX.did
wget https://raw.githubusercontent.com/dfinity/ic/b9a0f18dd5d6019e3241f205de797bca0d9cc3f8/rs/rosetta-api/icrc1/ledger/ledger.did -O .dfx/local/canisters/LBRY/LBRY.did

# ✨ CLEAN FRONTEND BUILD - Force fresh rebuild
echo "🧹 Cleaning frontend build artifacts..."
rm -rf dist/lbry_fun_frontend/
rm -rf node_modules/.cache/
# Note: Don't delete .dfx canisters - they contain assetstorage.did needed by dfx generate

echo "🔨 Forcing fresh frontend build..."
dfx generate  # Regenerate type declarations
npm run build # Force webpack rebuild with clean output

# Deploy only frontend canister
dfx identity use alex
dfx deploy lbry_fun_frontend --network ic

echo "✅ Deployment complete from: $REPO_ROOT"
