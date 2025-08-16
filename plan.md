- The backend currently accepts any initial parameters without validation. Need to set those.

- fill in execute_swap_and_burn function.
- Display price from ICP SWAP
- [LAUNCH_PENDING] reads 48 hours by default (when we send 24 hours).


dfx canister call kong_backend force_add_token '("ryjl3-tyaaa-aaaaa-aaaba-cai")'


// Before mainnet: 
- Timing before launch back to 24hrs.
- Minimum distribution intervals much higher than 1 second.
- Add popup warnings and admin-only launching.

  - We also don't cap the amount you could mint in one shot.

// Before v1
- Show 'my holdings'/stakes. Need a scalable plan for this.




# ICP Topup

dfx canister call ryjl3-tyaaa-aaaaa-aaaba-cai icrc1_transfer '(record { to = record { owner = principal "vgkov-ojfm2-etzss-lqse4-dm6ck-mdhmr-lhx7y-stnvb-bsj5p-npi54-eae"; subaccount = null }; amount = (100_000_000_000_000 : nat) })'

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