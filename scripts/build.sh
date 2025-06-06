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

dfx deploy --specified-id nppha-riaaa-aaaal-ajf2q-cai icp_ledger_canister --argument "  
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