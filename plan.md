First thing tomorrow: 
- We don't enforce the stake requirement or login for accepting proposals. We should, and make it look like an actual vote.
- Remove the DAO tab. Just make it two tabs.
- We should show the same lbry_fun kind of canister data.
- You should have to have staked tokens to be added as an operator.
- 














The question is, for the hackathon, should I do the locked liquidity thing or just leave it as is.





When you come back: 
- Do some stress integrationtesting with the bot1 canister and make sure the graphs align.
- Audit the existing code based on the changelogs.
- Remove the changelogs and declare things safe before moving on to switching staking for locked liquidity.
- Done.


- Minor vulnerability. There is a minor concern where if the XRC oracle fails, the tokens become permanently untradable. Why don't we look into using our core canister's XRC rate instead of having each one use its own.






Good test: Conservation analysis: (start with a set amount of ICP, mint, burn, lock lp, collect, sell, and repeat). Add up the locations of all the ICP at the end and ensure that all is conserved.





- Staking reward percent is a fake number in icp_swap
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
dfx canister call ryjl3-tyaaa-aaaaa-aaaba-cai icrc1_balance_of '(record { owner = principal "fgfvq-tsdhl-zwcim-o4fdb-qgxrm-wnsin-kkhws-ydt7x-az3cs-ovegm-2ae" })'


# To Topup
dfx identity use kong_user1

dfx canister call ryjl3-tyaaa-aaaaa-aaaba-cai icrc1_transfer '(record { to = record { owner = principal "jyf42-65z2k-o5zsk-7sto2-wvjlt-sk2cr-66ewi-q4qpg-snpgj-qsg5u-2qe"; subaccount = null }; amount = (999_900_000_000 : nat) })'

dfx identity use default

Orbit Wallet Local: http://werw6-ayaaa-aaaaa-774aa-cai.localhost:4943/en/login



Kong Fix after deployment:
dfx canister call kong_backend force_add_token '("ryjl3-tyaaa-aaaaa-aaaba-cai")'

dfx canister call kong_backend tokens '(opt "ICP")'



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









XWKa-Q2gppignoX_Ngs7VJYZPN_yhiy1ToovQ1NBMFs
NVkSolD-1AJcJ0BMfEASJjIuak3Y6CvDJZ4XOIUbU9g
8Pvu_hc9dQWqIPOIcEhtsRYuPtLiQe2TTvhgIj9zmq8
93mQRQG7zpvKQj3sUaDlNu_dOWFmb3-vp2Myu8sw03I 09/2022
QXvFGeh4LaqKQD7pxNOjs48FmFEjSAhhzxgvBairAFc
bqQgrxMXYFJXTqS5EF_XgmHUYyLNPXUv5Ze_c0RlW18 
- USDC version for the professional DAO builder.











### DAOPad


A story from a hackathon presentation:

How many people here earn a living, at least in part or in whole, in the crypto space?
Most people raised their hands.

Keep your had up if use an LLC or similar entity to wrap/document that income?
Most everyone kept their hand up.

How many of you withdraw crypto income/revenue from that buisiness directly to that LLC bank account?
Everyone put their hand down.





"business expenses should be deductible to accurately measure true economic profit" XvFGeh4LaqKQD7pxNOjs48FmFEjSAhhzxgvBairAFc
bqQgrxMXYFJXTqS5EF_XgmHUYyLNPXUv5Ze_c0RlW18 
- USDC version for the professional DAO builder.



Demo:
Just create a setup where ALEX stakers vote on a threshold to initiate the DAO