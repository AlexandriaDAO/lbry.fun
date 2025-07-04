When you come back: 
- Do some stress integrationtesting with the bot1 canister and make sure the graphs align.
- Audit the existing code based on the changelogs.
- Remove the changelogs and declare things safe before moving on to switching staking for locked liquidity.
- Done.







- Could we make all the terminals into expanders?
- Get launch pending to update the state when time runs out.
- Success page should update state with the new token page.
- Definitely going to need to display the price chart.
- Upload a non-svg cover image (an nft?) and a real project description (optional)
- Dynamic price feeds from kongswap.
- y-axis label on graphs 1, 2 and 4
- Annual APY fix in logs canister.
- The logs canister isn't getting real lp data from kongswap (and maybe fake data in other graphs)
- Since pool creation happens on a timer we need a safer way to make it closer to atomic and with no silent failures.
- The backend currently accepts any initial parameters without validation.



// Quick terminal UI grevances from testing things.
- The swap does not give you proper estimates for secondary tokens



// Before mainnet: 
- Distribution backdoor function has to go beforehand.
- Timing before launch back to 24hrs.
- Minimum distribution intervals much higher than 1 second.








// Test deploymenbt of ksICP.
dfx canister call ryjl3-tyaaa-aaaaa-aaaba-cai icrc1_balance_of '(record { owner = principal "yo4wh-4iihj-wmxgq-tcelx-2h4l2-5oiwe-guow3-yn6qx-l2jtl-bpocb-dae" })'


# To Topup
dfx identity use kong_user1

dfx canister call ryjl3-tyaaa-aaaaa-aaaba-cai icrc1_transfer '(record { to = record { owner = principal "ebonj-26ttl-oubal-a5j6o-5fpbs-uk5b5-to7c2-uwttl-icxwd-aaorh-zqe"; subaccount = null }; amount = (999_900_000_000 : nat) })'

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

### Make a plan
Ultrathink about the best and most optimized and 
  simple way to get these features working. How could we do this without making more backend 
  fetches than nessasary? Do we keep redux thunks as optimized as possible? Are we minimizing the 
  amount of code while keeping things reusable? These are the questions we should answer while 
  thinking about a plan. Then when the plan is finalized, write a full markdown document with 
  precise instructions of how to imlement it so the task can be passed off. Be detailed and always 
  reference the actual files you're talking about so the one who implements the task has all the 
  context they need.





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




XWKa-Q2gppignoX_Ngs7VJYZPN_yhiy1ToovQ1NBMFs
NVkSolD-1AJcJ0BMfEASJjIuak3Y6CvDJZ4XOIUbU9g
8Pvu_hc9dQWqIPOIcEhtsRYuPtLiQe2TTvhgIj9zmq8
93mQRQG7zpvKQj3sUaDlNu_dOWFmb3-vp2Myu8sw03I 09/2022
QXvFGeh4LaqKQD7pxNOjs48FmFEjSAhhzxgvBairAFc
bqQgrxMXYFJXTqS5EF_XgmHUYyLNPXUv5Ze_c0RlW18 
- USDC version for the professional DAO builder.