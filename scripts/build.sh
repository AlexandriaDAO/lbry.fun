# EVAN VERSION OG

set -x 
dfx start --clean --background
# Make mops accessible:
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc

#!/bin/bash
cp dfx_local.json dfx.json



# Step 2: II Canister
dfx deps pull
dfx deps init
dfx deps deploy
dfx deps deploy internet_identity

## xrc first because it's used in init functions of others.
dfx canister create xrc --specified-id uf6dk-hyaaa-aaaaq-qaaaq-cai
cargo build --release --target wasm32-unknown-unknown --package xrc
candid-extractor target/wasm32-unknown-unknown/release/xrc.wasm > src/xrc/xrc.did
dfx deploy xrc --specified-id uf6dk-hyaaa-aaaaq-qaaaq-cai



# Step 4: Generate all other backend canisters.


# For icp_swap
cargo build --release --target wasm32-unknown-unknown --package icp_swap
candid-extractor target/wasm32-unknown-unknown/release/icp_swap.wasm > src/icp_swap/icp_swap.did
# For tokenomics
cargo build --release --target wasm32-unknown-unknown --package tokenomics
candid-extractor target/wasm32-unknown-unknown/release/tokenomics.wasm > src/tokenomics/tokenomics.did
# for user
cargo build --release --target wasm32-unknown-unknown --package user
candid-extractor target/wasm32-unknown-unknown/release/user.wasm > src/user/user.did
dfx deploy user --specified-id yo4hu-nqaaa-aaaap-qkmoq-cai



# # For Logs
# cargo build --release --target wasm32-unknown-unknown --package logs
# candid-extractor target/wasm32-unknown-unknown/release/logs.wasm > src/logs/logs.did
# dfx deploy logs --specified-id yn33w-uaaaa-aaaap-qpk5q-cai

# For lbry_fun 
cargo build --release --target wasm32-unknown-unknown --package lbry_fun
candid-extractor target/wasm32-unknown-unknown/release/lbry_fun.wasm > src/lbry_fun/lbry_fun.did
dfx deploy lbry_fun

dfx ledger fabricate-cycles --canister zhcno-qqaaa-aaaap-qpv7a-cai --cycles 10000000000000000


cargo update


# Step 5: Configure Local Identities for token launches

export MINTER_ACCOUNT_ID=$(dfx ledger account-id)
# export MINTER_ACCOUNT_PRINCIPAL=$(dfx identity get-principal)



#Kongswap already deployed its ksICP will be using it, so need to deploy our own icp

dfx deploy --specified-id ryjl3-tyaaa-aaaaa-aaaba-cai icp_ledger_canister --argument "  
  (variant {  
    Init = record {  
      minting_account = \"$MINTER_ACCOUNT_ID\";  
      initial_values = vec {  
        record {  
          \"$DEFAULT_ACCOUNT_ID\";  
          record {  
            e8s = 8_681_981_000_000_000 : nat64;  
          };  
          \"$ALICE_ACCOUNT_ID\";  
          record {  
            e8s = 1_000_000_000 : nat64;  
          };
          \"$BOB_ACCOUNT_ID\";
          record {
            e8s = 1_000_000_000 : nat64;
          };
          \"$CHARLIE_ACCOUNT_ID\";
          record {
            e8s = 1_000_000_000 : nat64;
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




# For icp_swap_factory
mkdir -p src/icp_swap_factory && dfx canister --network ic metadata ggzvv-5qaaa-aaaag-qck7a-cai candid:service > src/icp_swap_factory/icp_swap_factory.did

echo "Generating type declarations..."
dfx generate

npm i
dfx deploy lbry_fun_frontend --specified-id yn33w-uaaaa-aaaap-qpk5q-cai

## Helpful extras for testing.
# dfx ledger balance
# dfx ledger transfer <to_account> --icp <amount> --memo 0
# dfx ledger transfer --icp 99 --memo 0 $(dfx ledger account-id --of-principal yvjik-zehkk-qo7nr-t4r7a-2aomx-mnp6e-htymf-r2adf-d7gjm-bpu3e-aae)

# # Load canister IDs from canister_ids.json
# ALEX_CANISTER_ID=$(jq -r '.ALEX.ic' canister_ids.json)
# LBRY_CANISTER_ID=$(jq -r '.LBRY.ic' canister_ids.json)
# TOKENOMICS_CANISTER_ID=$(jq -r '.tokenomics.ic' canister_ids.json)
# XRC_CANISTER_ID=$(jq -r '.xrc.ic' canister_ids.json)

# # Export canister IDs as environment variables
# export ALEX_CANISTER_ID
# export LBRY_CANISTER_ID
# export TOKENOMICS_CANISTER_ID
# export XRC_CANISTER_ID
