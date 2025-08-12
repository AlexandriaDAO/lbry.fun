- Duplicate logs stored in ICPSwap for the same init/burn/stake/etc. funcs


- The logs canister isn't getting real lp data from kongswap (and maybe fake data in other graphs)


- Show 'my holdings'/stakes. Need a scalable plan for this.
- Display price from ICP SWAP
- The backend currently accepts any initial parameters without validation. Need to set those.
  - We also don't cap the amount you could mint in one shot.



dfx canister call kong_backend force_add_token '("ryjl3-tyaaa-aaaaa-aaaba-cai")'


// Before mainnet: 
- Distribution backdoor function has to go beforehand.
- Timing before launch back to 24hrs.
- Minimum distribution intervals much higher than 1 second.









dfx canister call ryjl3-tyaaa-aaaaa-aaaba-cai icrc1_transfer '(record { to = record { owner = principal "c5uww-7b3td-uj2rq-53mpf-ujzzj-x3tnd-6ji2t-ahxek-ljrsf-h3loo-hqe"; subaccount = null }; amount = (10_000_000_000_000 : nat) })'



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