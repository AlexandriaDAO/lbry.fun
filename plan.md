- Start testing in full, ensuring the 1% actually goes back to buying and burning lbry, and the system conserves all ICP.

- started with 1000 icp.
  - 5 icp to launch
  - 





- y-axis label on graphs 1, 2 and 4


- Annual APY fix in logs canister.
- The logs canister isn't getting real lp data from kongswap (and maybe fake data in other graphs)


- Definitely going to need to display the price chart.
- Dynamic price feeds from kongswap.
- The backend currently accepts any initial parameters without validation. Need to set those.



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

dfx canister call ryjl3-tyaaa-aaaaa-aaaba-cai icrc1_transfer '(record { to = record { owner = principal "vz6l5-juldl-nazyt-hfogx-whip7-ppasi-hrom7-lcnxn-czdhb-7xvr4-gqe"; subaccount = null }; amount = (100_000_000_000 : nat) })'

dfx identity use default

Orbit Wallet Local: http://werw6-ayaaa-aaaaa-774aa-cai.localhost:4943/en/login



# To fix Kong

// If you build fresh uses ALEX as token 1. If you just redeploy kong, skip 1 and ICP fills in with 2. 
### Add alex as token 1
dfx canister call kong_backend force_add_token '("ysy5f-2qaaa-aaaap-qkmmq-cai")'

### Add Icp as token 2
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











