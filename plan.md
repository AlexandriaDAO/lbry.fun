Next, I'm looking for a way to test the custom parameters for token launches that users provide to ensure there's no edge cases with the minting/burning/etc. actions. Particularly, I want to know that the 'TokenomicsGraphsBackend.tsx' graphs are sound with best economic principals and actually reflected precicely by how things end up being minted in the backend. So there's two main goals are (1) Change the parameter sliders for the create token form that keep all possible token launches in a range with sensible fair-launch outcomes and (2) ensure those outcomes are reflected as projected by the actual backend launch with real tests. 

Before we start building this out though, I want to do some planning with you. Ultra Think through this. I first want you to make a project plan for this. Inside the appropriate markdown file please build an in depth plan for the task. Have high level checkpoints for each major step and feature, then in each checkpoint have a broken down list of small tasks you'll need to do to complete that checkpoint. We will then review this plan together.








- Upload a non-svg cover image (an nft?) (optional)
- Dynamic price feeds from kongswap.
- y-axis label on graphs 1, 2 and 4
- Consistent slider and input option for all 4 parameters with default values.

- Understand if the countdown is reliable across timezones.





dfx ledger transfer --icp 99 --memo 0 $(dfx ledger account-id --of-principal 3p5as-qtth3-qww4q-qhc55-unoun-3zyiy-d2rk7-537id-3bhfi-2rb5o-cqe)

// Test deploymenbt of ksICP.
dfx canister call nppha-riaaa-aaaal-ajf2q-cai icrc1_balance_of '(record { owner = principal "pqfkz-a2dfx-yzm4o-vzw26-tdsby-vky6p-ueknm-qvxbk-yr45c-pinei-zqe" })'


# To Topup
dfx identity use kong_user1

dfx canister call nppha-riaaa-aaaal-ajf2q-cai icrc1_transfer '(record { to = record { owner = principal "pqfkz-a2dfx-yzm4o-vzw26-tdsby-vky6p-ueknm-qvxbk-yr45c-pinei-zqe"; subaccount = null }; amount = (9_900_000_000 : nat) })'

dfx identity use default





# Claude Commands: 
- Background agent: claude -p "<prompt>"
- Slash commands: ./claude/commands/command1.md
