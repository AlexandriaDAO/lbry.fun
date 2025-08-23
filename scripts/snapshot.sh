!/bin/bash
dfx canister snapshot list lbry_fun_frontend --network ic

# # Load snapshot
# dfx canister stop lbry_fun_frontend --network ic
# dfx canister snapshot load lbry_fun_frontend 00000000000000000000000001f07ea00101 --network ic
# dfx canister start lbry_fun_frontend --network ic

set -x

dfx identity use mainnet


# lbry_fun_frontend
dfx canister stop lbry_fun_frontend --network ic
dfx canister snapshot create lbry_fun_frontend --replace 000000000000000b0000000001f0531c0101 --network ic
dfx canister start lbry_fun_frontend --network ic









