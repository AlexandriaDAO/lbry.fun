- Either I edited the wrong spot, or the AI is false and the frontend is actually not mediated by the backend 24 hour timer.















- Add the expected graphs as a tab.


- Initial allocation percentage.
- Definitely going to need to display the price chart.
- "We are here" on all the live graphs.
- Upload a non-svg cover image (an nft?) (optional)
- Dynamic price feeds from kongswap.
- y-axis label on graphs 1, 2 and 4
- Consistent slider and input option for all 4 parameters with default values.
- Annual APY history in the logs canister.
- Understand if the countdown is reliable across timezones.
- Can we make the create_token() atomic in case of character limit or other failures?
- The logs canister isn't getting real lp data from kongswap (and maybe fake data in other graphs)
- Since pool creation happens on a timer we need a safer way to make it closer to atomic and with no silent failures.
- How do we get ksICP pool to be ICP pool on mainnet.
- The backend currently accepts any initial parameters without validation.



// Before mainnet: 
- Distribution backdoor function has to go beforehand.
- Timing before launch back to 24hrs.








dfx ledger transfer --icp 99 --memo 0 $(dfx ledger account-id --of-principal 3p5as-qtth3-qww4q-qhc55-unoun-3zyiy-d2rk7-537id-3bhfi-2rb5o-cqe)

// Test deploymenbt of ksICP.
dfx canister call ryjl3-tyaaa-aaaaa-aaaba-cai icrc1_balance_of '(record { owner = principal "q5tir-zikyg-44in4-6txuu-vuya3-pmuy6-5kjev-fgvua-4njnq-qmtph-pqe" })'


# To Topup
dfx identity use kong_user1

dfx canister call ryjl3-tyaaa-aaaaa-aaaba-cai icrc1_transfer '(record { to = record { owner = principal "t677x-quppn-fa3t4-j7rwi-fejlc-jz4pv-5dxi7-baawk-pfk6a-va7x3-uae"; subaccount = null }; amount = (9_900_000_000 : nat) })'

dfx identity use default





# Claude Commands: 
- Background agent: claude -p "<prompt>"
- Slash commands: ./claude/commands/command1.md
- claude --continue/resume // for old chats

# Change Launch Times: 
  For local testing with different countdowns:
  // In frontend constants:
  export const LAUNCH_PERIOD_NANOS = BigInt(60 * 1_000_000_000); // 1 minute for quick testing

  // In backend constants:
  pub const LAUNCH_PERIOD_NANOS: u64 = 60 * 1_000_000_000; // 1 minute








# Prompts


### Migrate to new conversation:
That's a good plan but this conversation is running long and I'll like a new agent to start fresh from the document instructions. Please consolidate all our related markdown files into one accordingly, deleting old ones after absorbing them into one single master plan for this so the next agent can pick up where you left off..


### Checklist
Before we start building this out though, I want to do some planning with you. Ultrathink through this. I first want you to make a project plan for this. Inside the appropriate markdown file please build an in depth plan for the task. Have high level checkpoints for each major step and feature, then in each checkpoint have a broken down list of small tasks you'll need to do to complete that checkpoint. We will then review this plan together.







  Complete ICP Flow from Swap Function with Thresholds

  When users swap ICP for secondary tokens:
  - 100% of ICP goes directly to the icp_swap canister's balance
  - ICP accumulates until hourly distribution

  Every hour (automatic distribution):
  - 1% of the total ICP pool is distributed as follows:
    - 49.5% → Stakers (added to claimable rewards)
    - 49.5% → LP Treasury (internal accounting)
    - 1% → LBRY buyback (immediate transfer)

  Sub-distribution Details:

  LBRY Buyback (1% of distribution)

  - Threshold: None - transfers immediately if > 0
  - Destination: Sent directly to lbry_fun canister
  - Purpose: Buyback and burn LBRY tokens

  Stakers Rewards (49.5% of distribution)

  - Distribution Threshold: Must have at least 1,000,000 e8s (0.01 ICP) to distribute
  - Claiming Threshold: Users must have > 1,000,000 e8s (0.01 ICP) rewards to claim
  - Process: Rewards accumulate in each staker's reward_icp field proportional to their stake
  - No stakers case: Returns error, but LBRY and LP treasury still get their shares

  LP Treasury (49.5% of distribution)

  - Accumulation: Stored internally in LP_TREASURY state
  - Deployment Threshold: 1 ICP minimum (100,000,000 e8s)
  - Deployment Process: When threshold met, uses 2% of treasury balance to:
    - 1% for buying primary tokens on DEX
    - 1% paired with bought tokens to add liquidity
  - Deployment Frequency: Checked periodically by internal timer

  Example with 10,000 ICP pool:
  - 100 ICP distributed per hour
  - 1 ICP → LBRY (immediate transfer)
  - 49.5 ICP → LP treasury (waits for 1 ICP minimum)
  - 49.5 ICP → Stakers (distributed if > 0.01 ICP total)
