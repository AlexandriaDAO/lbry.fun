#!/bin/bash
# Best of both worlds script

set -ex 

dfx stop
dfx start --clean --background

# Step 2: II Canister
dfx deps pull
dfx deps init
dfx deps deploy
dfx deps deploy internet_identity

## xrc first because it's used in init functions of others.
dfx canister create xrc --specified-id uf6dk-hyaaa-aaaaq-qaaaq-cai
cargo build --release --target wasm32-unknown-unknown --package xrc
/home/theseus/.cargo/bin/ic-wasm target/wasm32-unknown-unknown/release/xrc.wasm -o target/wasm32-unknown-unknown/release/xrc.wasm shrink
candid-extractor target/wasm32-unknown-unknown/release/xrc.wasm > src/xrc/xrc.did
dfx deploy xrc --specified-id uf6dk-hyaaa-aaaaq-qaaaq-cai

# Step 4: Generate all other backend canisters.

# For icp_swap
cargo build --release --target wasm32-unknown-unknown --package icp_swap
/home/theseus/.cargo/bin/ic-wasm target/wasm32-unknown-unknown/release/icp_swap.wasm -o target/wasm32-unknown-unknown/release/icp_swap.wasm shrink
cp target/wasm32-unknown-unknown/release/icp_swap.wasm src/lbry_fun/src/icp_swap.wasm
candid-extractor target/wasm32-unknown-unknown/release/icp_swap.wasm > src/icp_swap/icp_swap.did

# For tokenomics
cargo build --release --target wasm32-unknown-unknown --package tokenomics
/home/theseus/.cargo/bin/ic-wasm target/wasm32-unknown-unknown/release/tokenomics.wasm -o target/wasm32-unknown-unknown/release/tokenomics.wasm shrink
cp target/wasm32-unknown-unknown/release/tokenomics.wasm src/lbry_fun/src/tokenomics.wasm
candid-extractor target/wasm32-unknown-unknown/release/tokenomics.wasm > src/tokenomics/tokenomics.did

# For Logs
cargo build --release --target wasm32-unknown-unknown --package logs
/home/theseus/.cargo/bin/ic-wasm target/wasm32-unknown-unknown/release/logs.wasm -o target/wasm32-unknown-unknown/release/logs.wasm shrink
cp target/wasm32-unknown-unknown/release/logs.wasm src/lbry_fun/src/logs.wasm
candid-extractor target/wasm32-unknown-unknown/release/logs.wasm > src/logs/logs.did

# For lbry_fun 
cargo build --release --target wasm32-unknown-unknown --package lbry_fun
candid-extractor target/wasm32-unknown-unknown/release/lbry_fun.wasm > src/lbry_fun/lbry_fun.did
dfx deploy lbry_fun

export LBRY_FUN_PRINCIPAL=$(dfx canister id lbry_fun)
dfx ledger fabricate-cycles --canister "$LBRY_FUN_PRINCIPAL" --cycles 10000000000000000

cargo update

# Define account IDs for ledger deployment
export MINTER_ACCOUNT_ID=$(dfx ledger account-id)
export DEFAULT_ACCOUNT_ID=$(dfx ledger account-id)
export ALICE_ACCOUNT_ID=$(dfx ledger account-id)
export BOB_ACCOUNT_ID=$(dfx ledger account-id)
export CHARLIE_ACCOUNT_ID=$(dfx ledger account-id)

# Generate frontend actors BEFORE deploying the ledger canister
echo "Generating type declarations..."
for canister in lbry_fun tokenomics logs xrc icp_ledger_canister icp_swap; do
  dfx generate "$canister"
done


#Kongswap already deployed its ksICP will be using it, so need to deploy our own icp

# Download and prepare the ICP ledger canister
export IC_VERSION=d87954601e4b22972899e9957e800406a0a6b929
mkdir -p src/icp_ledger_canister
curl -L -o src/icp_ledger_canister/ledger.wasm.gz "https://download.dfinity.systems/ic/$IC_VERSION/canisters/ledger-canister.wasm.gz"
gunzip -f src/icp_ledger_canister/ledger.wasm.gz
curl -L -o src/icp_ledger_canister/ledger.did "https://raw.githubusercontent.com/dfinity/ic/$IC_VERSION/rs/rosetta-api/icp_ledger/ledger.did"

# Deploy the ICP 
dfx deploy --specified-id ryjl3-tyaaa-aaaaa-aaaba-cai icp_ledger_canister --argument "
  (variant {  
    Init = record {  
      minting_account = \"$MINTER_ACCOUNT_ID\";  
      initial_values = vec {  
        record {  
          \"$MINTER_ACCOUNT_ID\";  
          record {  
            e8s = 8_681_981_000_000_000 : nat64;  
          };  
         
        };  
      };  
      send_whitelist = vec {};  
      transfer_fee = opt record {  
        e8s = 10_000 : nat64;  
      };  
      token_symbol = opt \"LICP\";  
      token_name = opt \"Local ICP\";  
    }  
  })  
"


# # How we get the icrc1 ledger wasm:
# curl -L -o src/lbry_fun/src/ic-icrc1-ledger.wasm.gz "https://download.dfinity.systems/ic/d87954601e4b22972899e9957e800406a0a6b929/canisters/ic-icrc1-ledger.wasm.gz" && gunzip -f src/lbry_fun/src/ic-icrc1-ledger.wasm.gz



npm i
dfx deploy lbry_fun_frontend --specified-id yn33w-uaaaa-aaaap-qpk5q-cai




