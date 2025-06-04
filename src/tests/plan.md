- Cant navigate to 'swap' unless logged in?














dfx ledger transfer --icp 99 --memo 0 $(dfx ledger account-id --of-principal 3p5as-qtth3-qww4q-qhc55-unoun-3zyiy-d2rk7-537id-3bhfi-2rb5o-cqe)

// Test deploymenbt of ksICP.
dfx canister call nppha-riaaa-aaaal-ajf2q-cai icrc1_balance_of '(record { owner = principal "ffeoe-v7spt-7deo5-ujnp4-w5bgd-k7naw-pe36z-j54s6-eqip6-dquta-fae" })' 


# TO Topup
dfx identity use kong_user1

dfx canister call nppha-riaaa-aaaal-ajf2q-cai icrc1_transfer '(record { to = record { owner = principal "3p5as-qtth3-qww4q-qhc55-unoun-3zyiy-d2rk7-537id-3bhfi-2rb5o-cqe"; subaccount = null }; amount = (9_900_000_000 : nat) })'

dfx identity use default