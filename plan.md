Refresh states prompt:


I want to he able to refresh my icp balance at the top: 
```
[CONNECTED]951.7645 ICP
```

I'm already able to refresh my wallet assets which is nice, but I want the button to look better. Right now it just spins on hover but doesn't actually indicate when it's clicked or when it has been put into effect or when it's loading or when it finished the refresh. All those subtlties of a nice refresh button would be really helpful here: 
```
> wallet_assets
icp_balance:
951.7645[$3807.0580]
asdf:
0.0000[$0.0000]
fdsa:
99899.9999[$999.0000]
```

We should be able to refresh the max_burn_allowed here in this UI component: 
```
Burn Details
Network Fee:0.0001 FDSA
Max Burn Allowed:86352.4000 FDSA
Exchange Rate:1 FDSA = 0.1050 ASDF
ICP Return Rate:1000.0000 FDSA = 0.5 ICP
```

And it should be here for all the staking info, or at least the amount pending. And : 
>> stake_interface
staked_amount:10.4998 ASDF
reward_interval:[EVERY 1 HOUR]
current_apy:0.00%
total_staked:10.4998 ASDF
stakers:1

Same thing with this area in staking terminal.
```
staked_amount:10 ASDF
reward_interval:[EVERY 1 HOUR]
current_apy:0.00%0
total_staked:10.4998 ASDF
stakers:1
```



The thing is I don't want to make messy and wordy state management. I still want to keep an architecture that's as clean and robust as possible, and I don't know the best way to go about making these update without adding so much code. Ideally it stays as a neat and clean replacement to existing state management but I don't know how practical it is.

























- Duplicate logs stored in ICPSwap for the same init/burn/stake/etc. funcs



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

dfx canister call ryjl3-tyaaa-aaaaa-aaaba-cai icrc1_transfer '(record { to = record { owner = principal "6movs-6vcz3-5ltlm-a7okh-66epv-hs3is-gtsa7-hzwlh-ykci7-hegdd-oae"; subaccount = null }; amount = (100_000_000_000 : nat) })'

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











