# Tokenomics

- Maybe make a 'Step' parameter instead of initial supply.

- Should definitely explain how the tokenomics works in the UI.

- We could add a line graph of amount of money vs. percent of supply minted.


- Initial supply should be based on something.
  - A percent of total supply (fixed to estimate initial mcap)






Max Supply: 
- Doesn't matter a whole lot

Initial mint: 
- Valuation = InitSupply (* 1ICP) * total_supply
  - So this decision should be proportional to what people want the initial valuation to be (in ICP, assuming it's pooled with 1 ICP)

First Epoch Supply Growth:
- Burn unit that you need to get a mint unit.



# Scores

Bot Resistance = Low #Actions required in the first epoch
Fairness = Expensive to mint in the first epoch. 














**Objective:** Implement a sophisticated, community-driven liquidity provision system within each `icp_swap` canister. This system will enable the protocol to use its accrued ICP treasury to deepen its on-chain liquidity on the KongSwap DEX. This will be achieved through a symbiotic partnership with any community member who provides the matching primary tokens. The system will feature a "swap-and-LP" model, where the user is compensated with ICP, and a 1% fee will be directed to the parent Alexandria protocol to create a positive feedback loop.

**Core Design Philosophy:**

*   **Code Encapsulation:** New, distinct functionality will be placed in new, dedicated Rust files (`dex_integration.rs`, `alexandria_integration.rs`, `constants.rs`) to keep the existing, audited logic in `update.rs` clean and focused.
*   **On-Chain Accounting:** The ICP treasury will not be tracked in a `StableCell`. It will be calculated dynamically as the canister's own ICP balance on the ledger, minus any outstanding ICP rewards owed to stakers. This is a simpler, more robust accounting method.
*   **Community Partnership, Not Reliance:** Any user, not just a "whale," can provide primary tokens. The function will allow them to specify how much ICP they wish to "swap" for, giving them control and a clear incentive.
*   **Transactional Safety:** The multi-step process of adding liquidity and paying the user will be executed in a safe, atomic order to protect the protocol's funds. Liquidity will be added to the DEX *before* the user receives their ICP payout.
*   **Symbiotic Value Accrual:** A hardcoded 1% fee on the protocol's portion of the deployed ICP will be used to buy and burn LBRY tokens, directly supporting the parent ALEX ecosystem.
*   **Economic Security:** The function will have a hardcoded cap on the amount of treasury ICP deployed per transaction to mitigate economic exploits like sandwich attacks.

---

### **List of Files to be Attached to the Prompt:**

To ensure the AI has full context, please attach the following files from the `icp_swap` directory:

1.  `icp_swap.did`
2.  `Cargo.toml`
3.  The entire `src/` directory and all its contents.

---

### **Instructions for Implementation:**

You are to refactor the `icp_swap` canister source code by creating three new files and modifying two existing ones.

#### **Part 1: Create New Files for Code Separation**

1.  **Create `src/constants.rs`:**
    *   This file will hold all static mainnet principals.
    *   Populate it with the following `pub const` string slices:
        *   `KONG_BACKEND_CANISTER_ID: &str = "2ipq2-uqaaa-aaaar-qailq-cai";`
        *   `ALEXANDRIA_ICP_SWAP_CANISTER_ID: &str = "54fqz-5iaaa-aaaap-qkmqa-cai";`
        *   `LBRY_TOKEN_CANISTER_ID: &str = "y33wz-myaaa-aaaap-qkmna-cai";`
        *   `ICP_LEDGER_CANISTER_ID: &str = "ryjl3-tyaaa-aaaaa-aaaba-cai";`
        *   `LIQUIDITY_DEPLOYMENT_CAP_E8S: u64 = 10 * 100_000_000; // 10 ICP`
        *   `LBRY_BURN_ADDRESS: &str = "54fqz-5iaaa-aaaap-qkmqa-cai"; // The main icp_swap canister`
        *   `LBRY_FEE_PERCENT: u64 = 1;`

2.  **Create `src/dex_integration.rs`:**
    *   This file will contain all logic for interacting with the KongSwap DEX.
    *   Define the necessary `CandidType` structs for KongSwap calls (`SwapAmountsReply`, `AddLiquidityAmountsReply`, `AddLiquidityArgs`, etc.), using the user-provided examples as a guide.
    *   Implement two public async functions:
        *   `get_kong_swap_quote(pay_symbol: String, pay_amount: Nat, receive_symbol: String) -> Result<SwapAmountsReply, String>`: This function will call the `swap_amounts` method on the KongSwap canister.
        *   `add_liquidity_to_kong(primary_token_symbol: String, primary_token_amount: Nat, icp_amount: Nat) -> Result<AddLiquidityReply, String>`: This function must perform the full, multi-step liquidity addition process as detailed in the user's example: (1) call `add_liquidity_amounts` to get proportional amounts, (2) call `icrc2_approve` on both the primary token ledger and the ICP ledger, and (3) call `add_liquidity` to finalize.

3.  **Create `src/alexandria_integration.rs`:**
    *   This file will contain the logic for the 1% fee mechanism.
    *   Implement one public async function: `buy_and_burn_lbry(icp_fee_amount_e8s: u64) -> Result<String, String>`.
    *   The function must perform the following steps:
        a. Approve the `ALEXANDRIA_ICP_SWAP_CANISTER_ID` to spend the `icp_fee_amount_e8s` from this canister's account on the ICP ledger.
        b. Call the `swap` function on the `ALEXANDRIA_ICP_SWAP_CANISTER_ID` to exchange the ICP for LBRY tokens.
        c. Upon receiving the LBRY, call `icrc1_transfer` on the `LBRY_TOKEN_CANISTER_ID`, sending the newly acquired LBRY to the `LBRY_BURN_ADDRESS`.

#### **Part 2: Modify Existing Files**

1.  **Modify `src/storage.rs`:**
    *   This file should remain largely unchanged. **Do not** add a `StableCell` for the ICP treasury. The treasury is an account balance, not a piece of canister state.

2.  **Modify `src/update.rs`:**
    *   **Imports:** Add `use crate::{constants::*, dex_integration::*, alexandria_integration::*};`.
    *   **Modify `distribute_reward`:**
        *   After calculating `total_icp_allocated`, simply proceed with the existing logic to distribute 100% of it to the stakers' reward balances.
        *   **Remove** any logic that splits the pool or sends it to a treasury. The treasury is now the canister's entire "profit" balance, which will be used directly.
    *   **Create the Main User-Facing Function:**
        *   Add a new, public `update` function: `provide_liquidity_with_swap(primary_token_amount_provided: u64, max_icp_to_receive_e8s: u64) -> Result<String, ExecutionError>`.
        *   **Implement the following logic IN ORDER:**
            i.   **Get Treasury Balance:** Fetch the canister's ICP balance (`fetch_canister_icp_balance`) and subtract the total unclaimed staker rewards (`get_total_unclaimed_icp_reward`) to get the `available_treasury_icp`.
            ii.  **Apply Cap:** Determine the `icp_to_deploy` by taking the minimum of `available_treasury_icp` and the `LIQUIDITY_DEPLOYMENT_CAP_E8S` constant.
            iii. **Check User Approval:** Verify that the caller has approved the canister to spend at least `primary_token_amount_provided` of the primary token.
            iv.  **Get Quote:** Call `get_kong_swap_quote` to get the current market price for swapping the user's provided primary tokens into ICP.
            v.   **Calculate Swap:** Determine the `icp_for_user_swap` based on the quote. This must not exceed `max_icp_to_receive_e8s`. Calculate the `primary_tokens_for_swap` that this corresponds to.
            vi.  **Calculate LP Amounts:** The remaining primary tokens (`primary_tokens_for_lp`) and the remaining deployable ICP from the treasury (`icp_for_lp`) are now defined.
            vii. **Calculate and Execute LBRY Fee:** Calculate the `lbry_fee` (1% of `icp_for_lp`). Call `buy_and_burn_lbry` with this amount.
            viii.**Add Liquidity to DEX:** Call `add_liquidity_to_kong` using the `primary_tokens_for_lp` and the post-fee `icp_for_lp`.
            ix.  **Pay User:** **Only upon successful liquidity addition**, transfer the `icp_for_user_swap` amount to the user.
            x.   Return a detailed success message.































### **AI Assistant Prompt**

**Objective:** Refactor the `icp_swap` canister's reward distribution logic to implement a three-way split of profits. Currently, 100% of profits go to stakers. The new design will allocate profits as follows:
*   **49.5%** to Staking Rewards.
*   **49.5%** to a new LP Treasury pool.
*   **1%** to a new Alexandria Fee pool.

**Functional Requirements:**
*   Two new persistent storage variables (`StableCell`) must be created to track the balances of the LP Treasury and the Alexandria Fee pool.
*   The `distribute_reward` function must be modified to calculate this three-way split.
*   The amounts for the two new pools will be added to their respective storage variables for accrual. No spending logic for these new pools is required in this task.
*   The stakers' portion will use the existing reward distribution logic.

---

### **List of Files to be Attached to the Prompt:**

*   The entire `src/` directory from the `icp_swap` canister.

---

### **Step-by-Step Implementation Instructions:**

#### **File 1: `src/icp_swap/src/storage.rs`**

1.  **Define New Storage Pools:**
    *   Add two new `pub static` `StableCell` variables to hold the balances of the new pools. Initialize them to `0`.
        *   `LP_TREASURY: RefCell<StableCell<u64, DefaultMemoryImpl>>`
        *   `ALEXANDRIA_FEE_POOL: RefCell<StableCell<u64, DefaultMemoryImpl>>`

2.  **Create Helper Functions:**
    *   Create two new public functions to safely add funds to these new cells. Both must check for arithmetic overflows and return a `Result<(), ExecutionError>`.
        *   `add_to_lp_treasury(amount: u64)`
        *   `add_to_alexandria_fee_pool(amount: u64)`

#### **File 2: `src/icp_swap/src/update.rs`**

1.  **Import Helper Functions:**
    *   At the top of the file, add `use crate::storage::{add_to_lp_treasury, add_to_alexandria_fee_pool};`.

2.  **Modify the `distribute_reward` function:**
    *   Locate the `total_icp_allocated` variable, which represents the total profits for the cycle.
    *   **Immediately after its definition, insert the logic for the three-way split.** Use integer arithmetic to avoid floating-point errors.
        ```rust
        // Calculate the 1% fee for the Alexandria project.
        let alexandria_fee_share = total_icp_allocated / 100;

        // Calculate the 49.5% share for the LP Treasury.
        // Multiplying by 495 and dividing by 1000 is a safe way to handle 49.5%.
        let lp_treasury_share = (total_icp_allocated * 495) / 1000;

        // The remainder is for the stakers. This avoids potential rounding errors.
        let staker_share = total_icp_allocated - alexandria_fee_share - lp_treasury_share;
        ```
    *   **Route the Funds to Their Pools:**
        *   Call `add_to_alexandria_fee_pool(alexandria_fee_share as u64)?;`
        *   Call `add_to_lp_treasury(lp_treasury_share as u64)?;`
    *   **Update Staker Logic:**
        *   Replace all subsequent uses of `total_icp_allocated` in the function with the new `staker_share` variable. This ensures only the stakers' 49.5% portion is used to calculate and assign their individual rewards.