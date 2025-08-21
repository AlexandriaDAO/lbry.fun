- The backend currently accepts any initial parameters without validation. Need to set those.

Before Mainnet:
- distribution constants: 
  - lbry_fun/collections.rs | const CHECK_INTERVAL: u64 = 3600;          // Check every hour
  - icp_swap/script.rs | pub const ALEX_FEE_PUSH_INTERVAL: Duration = Duration::from_secs(24 * 60 * 60); // 24 hours - push platform fees to lbry_fun
- Block token creation for non-authorized principals.
- Change the creation interval minimums so there's at least 1 hour notice.





// Before v1
- Show 'my holdings'/stakes. Need a scalable plan for this.




# ICP Topup

dfx canister call ryjl3-tyaaa-aaaaa-aaaba-cai icrc1_transfer '(record { to = record { owner = principal "3tukv-wqvf4-y6kvm-cos2t-pkir5-gamsa-osl4p-26g3v-q7hk2-esvdc-rqe"; subaccount = null }; amount = (100_000_000_000_000 : nat) })'

# To fix Kong

// If you build fresh uses ALEX as token 1. If you just redeploy kong, skip 1 and ICP fills in with 2. 

dfx canister call kong_backend force_add_token '("ysy5f-2qaaa-aaaap-qkmmq-cai")'

dfx canister call kong_backend force_add_token '("ryjl3-tyaaa-aaaaa-aaaba-cai")'

dfx canister call kong_backend tokens '(opt "ICP")'



# Claude Commands wrth trying.: 
- Background agent: claude -p "<prompt>"
- Slash commands: ./claude/commands/command1.md
- claude --continue/resume // for old chats

# Change Launch Times:
  For local testing with different countdowns:
  // In frontend constants:
  export const LAUNCH_PERIOD_NANOS = BigInt(60 * 1_000_000_000); // 1 minute for quick testing

  // In backend constants:
  pub const LAUNCH_PERIOD_NANOS: u64 = 60 * 1_000_000_000; // 1 minute


# Example Arweave IDs.

XWKa-Q2gppignoX_Ngs7VJYZPN_yhiy1ToovQ1NBMFs
NVkSolD-1AJcJ0BMfEASJjIuak3Y6CvDJZ4XOIUbU9g
8Pvu_hc9dQWqIPOIcEhtsRYuPtLiQe2TTvhgIj9zmq8 
93mQRQG7zpvKQj3sUaDlNu_dOWFmb3-vp2Myu8sw03I 09/2022
QXvFGeh4LaqKQD7pxNOjs48FmFEjSAhhzxgvBairAFc
bqQgrxMXYFJXTqS5EF_XgmHUYyLNPXUv5Ze_c0RlW18 