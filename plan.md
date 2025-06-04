- Cant navigate to 'swap' unless logged in?
- Do a logs canister instead of a frontend canister
- Launch Countdown is also going to be very important.




- y-axis label on graphs 1, 2 and 4
- Consistent slider and input option for all 4 parameters with default values.


Rules:
- Pool is actually 






dfx ledger transfer --icp 99 --memo 0 $(dfx ledger account-id --of-principal 3p5as-qtth3-qww4q-qhc55-unoun-3zyiy-d2rk7-537id-3bhfi-2rb5o-cqe)

// Test deploymenbt of ksICP.
dfx canister call nppha-riaaa-aaaal-ajf2q-cai icrc1_balance_of '(record { owner = principal "ffeoe-v7spt-7deo5-ujnp4-w5bgd-k7naw-pe36z-j54s6-eqip6-dquta-fae" })' 


# TO Topup
dfx identity use kong_user1

dfx canister call nppha-riaaa-aaaal-ajf2q-cai icrc1_transfer '(record { to = record { owner = principal "3p5as-qtth3-qww4q-qhc55-unoun-3zyiy-d2rk7-537id-3bhfi-2rb5o-cqe"; subaccount = null }; amount = (9_900_000_000 : nat) })'

dfx identity use default






**Report on `lbry_fun` Canister Files:**

**1. `/home/theseus/alexandria/lbryfun/src/lbry_fun/lbry_fun.did`**
    *   **Purpose:** This is a Candid interface definition file. Candid is a language used on the Internet Computer to describe the public interface of a canister (a smart contract).
    *   **Functionality:** It defines the methods that can be called on the `lbry_fun` canister, along with the types of data they expect as input and what they return as output. Specifically, it includes:
        *   `create_token`: A function to create new tokens. It takes details like token names, symbols, supply, etc.
        *   `deposit_icp_in_canister`: A function to deposit ICP (Internet Computer's native token) into the canister.
        *   `get_all_token_record`: A query function to retrieve records of all created tokens.
        *   `get_live`: A query function to get records of tokens that are currently "live".
        *   `get_upcomming`: A query function to get records of tokens that are "upcoming" (not yet live).
        *   It also defines various custom data types (`Result`, `TokenRecord`, `TransferFromError`) used by these functions.

**4. `/home/theseus/alexandria/lbryfun/src/lbry_fun/src/update.rs`**
    *   **Purpose:** This file contains the "update" call functions for the canister. Update calls are those that can modify the state of the canister (e.g., create data, transfer tokens).
    *   **Functionality:**
        *   `create_token`: The core logic for creating new tokens. This involves:
            *   Taking payment (depositing ICP).
            *   Creating new canisters for the primary token, secondary token, tokenomics, and a frontend.
            *   Installing ICRC-1 ledger Wasm (WebAssembly module) onto the new token canisters with specific initialization parameters (name, symbol, initial balances, etc.).
            *   Installing `tokenomics.wasm` and `icp_swap.wasm` onto their respective newly created canisters.
            *   Interacting with an external "Kong swap" canister to add the new token and potentially create a liquidity pool.
            *   Approving token transfers for the Kong swap canister.
            *   Storing a record of the newly created token (details like IDs, names, supply, associated canister IDs, creation time) in the canister's stable storage.
        *   `create_icrc1_canister`: An asynchronous helper function to create a new canister and install the `ic-icrc1-ledger.wasm` onto it with given parameters.
        *   `create_a_canister`: A simpler helper to just create a new empty canister.
        *   `install_tokenomics_wasm_on_existing_canister`: Installs the `tokenomics.wasm` onto a specified canister.
        *   `install_icp_swap_wasm_on_existing_canister`: Installs the `icp_swap.wasm` onto a specified canister.
        *   `add_token_to_kong_swap`: Interacts with the `KONG_BACKEND_CANISTER` to register a new token.
        *   `create_pool_on_kong_swap`: Interacts with the `KONG_BACKEND_CANISTER` to create a liquidity pool for a token.
        *   `approve_tokens_to_spender`: A generic function to call `icrc2_approve` on a ledger canister, allowing a spender (another canister or user) to transfer tokens on behalf of the owner.
        *   `deposit_icp_in_canister`: Handles the `icrc2_transfer_from` call to allow users to deposit ICP into this canister.
        *   `publish_eligible_tokens_on_kongswap`: A function likely called periodically to check for tokens that have met certain criteria (e.g., a 24-hour waiting period after creation) and then attempts to create a liquidity pool for them on KongSwap, marking them as "live".

**5. `/home/theseus/alexandria/lbryfun/src/lbry_fun/src/queries.rs`**
    *   **Purpose:** This file contains "query" call functions. Query calls are read-only operations that don't change the canister's state and are generally faster.
    *   **Functionality:**
        *   `get_all_token_record`: Retrieves all `TokenRecord`s stored in the canister.
        *   `get_upcomming`: Filters and retrieves `TokenRecord`s for tokens that are marked as `is_live == false`.
        *   `get_live`: Filters and retrieves `TokenRecord`s for tokens that are marked as `is_live == true`.

**6. `/home/theseus/alexandria/lbryfun/src/lbry_fun/src/storage.rs`**
    *   **Purpose:** Defines how data, specifically `TokenRecord`s, is stored persistently in the canister's stable memory.
    *   **Functionality:**
        *   Defines the `TokenRecord` struct, which holds all the information about a created token pair (primary and secondary token details, associated canister IDs, supply information, creation time, liveness status, etc.).
        *   Implements the `Storable` trait for `TokenRecord`, allowing it to be serialized and deserialized for storage in stable memory.
        *   Uses `ic_stable_structures::StableBTreeMap` to create a map (`TOKENS`) where token records are stored, keyed by a `u64` ID. This ensures data survives canister upgrades.
        *   Sets up a `MEMORY_MANAGER` to manage the stable memory used by the `StableBTreeMap`.

**7. `/home/theseus/alexandria/lbryfun/src/lbry_fun/src/utlis.rs`** (likely a typo, should be `utils.rs`)
    *   **Purpose:** Provides utility functions, constants, and data structures used across other modules in the canister.
    *   **Functionality:**
        *   Defines constants like `KONG_BACKEND_CANISTER` ID, `ICP_CANISTER_ID`, initial mint amounts, transfer fees, etc.
        *   Includes a helper function `get_principal` to convert a text representation of a principal ID into a `Principal` object.
        *   Defines various structs that represent arguments and replies for interacting with other canisters (like the Kong swap canister or ICRC-1 ledgers), e.g., `AddTokenArgs`, `AddPoolArgs`, `ApproveArgs`, `TokenomicsInitArgs`, `IcpSwapInitArgs`.
        *   Defines structs for ICRC-1 ledger initialization (`InitArgs`, `UpgradeArgs`, `LedgerArg`, `FeatureFlags`, `MetadataValue`, `ArchiveOptions`).

**8. `/home/theseus/alexandria/lbryfun/src/lbry_fun/src/script.rs`**
    *   **Purpose:** Contains logic related to canister initialization, upgrades, and periodic tasks (timers).
    *   **Functionality:**
        *   `init`: A function that runs once when the canister is first installed. It calls `setup_timers`.
        *   `post_upgrade`: A function that runs after the canister code is upgraded. It also calls `setup_timers` to ensure timers are reinstated.
        *   `setup_timers`: Sets up a periodic timer using `ic_cdk_timers::set_timer_interval`. This timer is configured to call the `publish_eligible_tokens_on_kongswap_wrapper` function every `INTERVAL` (defined as 60 seconds in this file, though a comment suggests 1 hour originally).
        *   `publish_eligible_tokens_on_kongswap_wrapper`: An async wrapper function that calls the `publish_eligible_tokens_on_kongswap` function (from `update.rs`) and prints success or error messages. This is the function executed by the timer.

**9. `/home/theseus/alexandria/lbryfun/src/lbry_fun/src/ic-icrc1-ledger.did`**
    *   **Purpose:** This is another Candid interface definition file, but specifically for an ICRC-1 compliant token ledger canister. The `lbry_fun` canister likely uses this definition to know how to interact with the token canisters it creates (which are based on `ic-icrc1-ledger.wasm`).
    *   **Functionality:** It defines a standard set of functions and data types for a token that adheres to the ICRC-1 standard (and includes extensions for ICRC-2 for approvals and potentially ICRC-3 for block access). This includes:
        *   Token metadata: `icrc1_name`, `icrc1_symbol`, `icrc1_decimals`, `icrc1_total_supply`, `icrc1_fee`.
        *   Balance queries: `icrc1_balance_of`.
        *   Token transfers: `icrc1_transfer`.
        *   Approval functions (ICRC-2): `icrc2_approve`, `icrc2_allowance`, `icrc2_transfer_from`.
        *   Block and transaction history: `get_transactions`, `get_blocks`, and archival functions.
        *   Initialization arguments (`InitArgs`, `LedgerArg`) for setting up a new ledger.
        *   Many supporting data types for accounts, transfers, approvals, errors, and metadata.

**In simple terms for a general person:**

Imagine the `lbry_fun` project is like a factory that creates new types of digital money (tokens) on a special computer network (the Internet Computer).

*   The `lbry_fun.did` file is like the front door sign of the factory, telling everyone what services it offers (like "create a new money type" or "show me all money types created").
*   The `Cargo.toml` is the factory's blueprint, listing all the parts and tools needed to build things.
*   The files inside the `src` folder are the different departments and machinery within the factory:
    *   `lib.rs` is the main control room that connects all departments.
    *   `update.rs` is the manufacturing department. It handles requests to create new digital money, sets up separate mini-factories (other canisters) for each new money type, and registers them with a digital marketplace (KongSwap).
    *   `queries.rs` is the information desk, providing lists of all the money types created, which ones are active, and which ones are coming soon.
    *   `storage.rs` is the factory's secure vault, keeping records of every digital money type created.
    *   `utlis.rs` (utils) is the toolbox, filled with common tools, measurements, and addresses needed by other departments.
    *   `script.rs` is the automated scheduler. It has a timer that periodically checks if any newly created money types are ready to be officially launched on the marketplace.
    *   `ic-icrc1-ledger.did` is like the instruction manual for the standard digital money system that this factory uses to create its new money types. It ensures all the new money works in a compatible way.

Essentially, this canister allows users to pay a fee to launch their own pair of tokens (a primary and a secondary one), manages the creation and setup of these tokens and their associated systems (like for trading and rules), and then lists them, eventually making them "live" for trading on an external platform called KongSwap.














lbry_fun PRD

### Purpose

The ALEX | LBRY Tokenomics Model was developed to address the problems with existing fair launch models:

- Bonding Curve (pump.fun) - Easily manipulated to favor the first creators/insiders.
- Liquidity Bootstrapping Pool - Fair, but mints all at once, before the public can make informed, product-based valuations.
- Proof of Work (Bitcoin) - Great, but wastes money/energy.

Alexandria used what we call the 'Fractal Harmonic Distribution (FHD)':

Fractals are mint actions: A recursive scheme of one pattern on an exponential scale where each halving requires twice the secondary token burn for the same unit of primary token minting.

Epochs follow harmonic growth, linking halving epochs to natural economic oscillations. Total supply freezes when price falls below cost to mint, and resumes when/if product value increases.

This autonomously aligns token distribution/funding with actual product development in a way that cannot be manipulated.

This model is currently open-source, but requires technical expertise to reproduce. The purpose of lbry_fun is to allow anyone to replicate this tokenomics with custom parameters in blackholed canisters.

As is the nature of permissionless software, people can use it however they want, but a social-fi memecoin launchpad is not the intention. The design is for a methodical and robust approach to cunducting a fair launch. As an agnostic tool, it should not encourage, market or otherwise promote any token.


### Architecture

lbry_fun logic is a simplified fork of lbry.app's core logic. It however makes no fork of Alexandria Tokens, and is designed to accrue all generated value back to $ALEX.

#### Core Canisters:

- frontend: A modified version of /swap page.
  - Authenticates to the same derivation origin of lbry.app (same wallets).
  - Modified with a view and support for many token pairs, not just LBRY/ALEX.
  - No 'topup'
  - Option to create a token that fills the user-selected portion of the deploy arguments.
  - Displays upcoming and live tokens. (Maybe live price feeds too from ICP swap, but this could always be changed after the fact).

- Backend: Logic for spawning new tokens.
  - Takes the parameters set by the user for a given token launch.
  - Spawns canisters, blackholes them.
  - Special rule, it cannot spawn tokens immediately but must be at least 24 hours, or more preferably 1 week ahead of time, so the frontend can display the upcoming launch and everyone can see when it will open.

- Storage:
  - Indexes launched tokens, and all their data, and all their logs, etc. I don't want this in the backend because it's really important this data doesn't get lost. It can be in one canister if it's really well architected and garenteed to not need breaking changes.

#### Spawned Canisters:

- icp_swap:
  - Removes 2/3 extra mints, so only mint the 1/3 to burners.
  - Custom params:
    - Replace hardocoded canistser ids in `utils.rs` (ALEX_CANISTER_ID, LBRY_CANISTER_ID, TOKENOMICS_CANISTER_ID)
    - I'm pretty sure everything else is going to be the same, but I could be wrong
- tokenomics:
  - Custom Params:
    - LBRY_THRESHOLDS & ALEX_PER_THRESHOLD (in storage.rs). These should be work based on a max/min slider that simulates the outcomes in graphs so the user can understand what the outcome will be.
    - pub const MAX_ALEX: u64 = 2100000000000000; // 21 million should be adjusted according to the THRESHOLDS that have been set by the user. So they don't enter this manually, but the computed value of the supply cap is shown to them, and the safety mechanism updated accordingly.
    - phase_mint_alex > 500_000_0000 (line 291 in update.rs). Should be set by the user, and should be capped very small so it's hard for first users to get too much of the supply.
    - What else are we missing here? 
- Logs: Basically what we have but remove nft stuff, and add the threshold information that would otherwise be in our whitepaper.
  - Primary Token Supply.
  - Secondary Token Supply.
  - Burned amounts.
  - Halvings.
  - Staked Amount.
  - The fixed information from the threshold setup should be shown in a simulated graph of what it would look like as halvings 
  continue.
  - Canister cycles balance in each of the spawned canisters so it can be watched by the community in-case one gets low.
- Primary and Secondary Tokens: Based on deploy parameters.


```
# We use ALEX here because it's convienent, but will be replaced with the other token's name.

# The same argument can be used for both the primary and secondary token.

dfx deploy ALEX --network ic --argument '(variant { Init = 
record {
     token_symbol = "ALEX";
     token_name = "ALEX";
     minting_account = record { owner = principal "'$(dfx canister id tokenomics --network ic)'" };
     transfer_fee = 10_000;
     metadata = vec {
        record { "icrc1:symbol"; variant { Text = "ALEX" } };
        record { "icrc1:name"; variant { Text = "User Selected Name" } };
        record { "icrc1:description"; variant { Text = "User generated descripton with whatever information they want in markdown format." } };
        record { "icrc1:decimals"; variant { Nat = 8 } };
        record { "icrc1:fee"; variant { Nat = 10_000 } };
        record { "icrc1:logo"; variant { Text = "<Actual raw encoded SVG. Must preview to the user before deploying.>" } };
     };
     initial_balances = vec {};
     archive_options = record {
         num_blocks_to_archive = 3000;
         trigger_threshold = 6000;
         controller_id = principal "'$(dfx canister id tokenomics --network ic)'";
         cycles_for_archive_creation = opt 10000000000000;
     };
     feature_flags = opt record {
        icrc2 = true;
        icrc3 = true;
     };
     maximum_number_of_accounts = opt 10_000_000;
     accounts_overflow_trim_quantity = opt 100_000;
     max_memo_length = opt 32;
 }
})'

```

### Big Economic Modifications

To launch a token should be relatively cheap. I say we just make the user pay in ICP to spawn the canisters and give them 2-5T cycles each (we'll decide together how much in each). No payment in LBRY required. Swapping, Burning, Staking, etc., also require no additional fee. It works exactly the same as the current LBRY/ALEX model.

Big Changes:

- Upon Spawning canisters, the primary token must mint with an initial supply of 1 token, and create a pool on ICPSwap that's paired with 0.1 ICP. Creating this pool costs 1 ICP, so when the token is launched on our site, it auto-generates the ICPSwap pool.

- The other big change is staking rewards. Instead of giving 100% to stakers, we split like this:
  - 1% uses our core 'swap' function to buy_back LBRY and send it to the burn address.
  - 49.5% is allocated to the pool that was created. So 1/2 of it buy's back the token, and then adds both assets to the pool. This liquidity, being provided by the icp_swap canister, is basically burned and should be impossible to remove.
  - 49.5% Goes to stakers as is standard on lbry.app.


If there are unforseen implementation challenges with this idea, we could modify accordingly. But generally speaking this is the ideal. LP grows with staking rewards so there's a nice moat for times when supply expansion stops.