### **Revised Prompt: Fixing the Broken Integration Test Build**

**Persona:** You are an expert-level Rust developer specializing in setting up robust and isolated testing infrastructure for Internet Computer projects. You have a deep understanding of Cargo's build system, including workspace overrides.

**Primary Goal:** The primary goal is to fix the broken build of the `tests` crate and successfully execute the integration test. The core of the problem lies in finding a valid git reference for the `ic-cdk v0.12.1` dependency, which is required for the test environment's version of `pocket-ic`.

**Current State & Critical Context:**

*   The project is a Rust workspace where source canisters (e.g., `src/icp_swap`) use `ic-cdk` version `0.13.2`.
*   The `tests` crate must use `pocket-ic` version `2.2.0` to be compatible with the `pocket-ic` server bundled in your `dfx v0.27.0`.
*   This version of `pocket-ic` requires `ic-cdk` version `0.12.1`, creating a dependency conflict with the rest of the workspace.
*   An attempt to solve this was made by creating a local dependency override in `tests/.cargo/config.toml` using `[patch.crates-io]`. This correctly isolates the test environment.
*   All necessary code changes in `tests/Cargo.toml` and `tests/src/simulation_vs_reality.rs` have been applied.
*   **Core Conflict:** The build is failing because we have been unable to find a valid git `rev` (commit hash) or `tag` for the `v0.12.1` release of `ic-cdk` in the `dfinity/cdk-rs` repository. All attempts so far have resulted in `git fetch` errors. The current configuration in `tests/.cargo/config.toml` is using an invalid reference.

**The Only Acceptable Solution: Find the Correct Git Reference**

The solution **must not** involve downgrading the dependencies of the source canisters. The fix must come from finding the correct, valid git reference for `ic-cdk v0.12.1` and updating the patch configuration.

**Your Step-by-Step Task:**

1.  **Find the Correct Git Reference for `ic-cdk v0.12.1`:**
    *   This is the most critical step. You need to investigate the `dfinity/cdk-rs` git repository to find the exact commit or tag that corresponds to the `ic-cdk` crate's `v0.12.1` release.
    *   **Suggestion:** Clone the `dfinity/cdk-rs` repository locally. Navigate into the `ic-cdk` directory and inspect its `Cargo.toml` file's history (`git log -p -- ic-cdk/Cargo.toml`) to find the commit where the version was set to `0.12.1`. Alternatively, you can browse the repository's tags (`git tag`) to find one that corresponds to that release.

2.  **Update the Local Cargo Configuration:**
    *   Once you have found a valid commit hash or tag, open `tests/.cargo/config.toml`.
    *   Replace the incorrect `tag` or `rev` value with the correct one you discovered.

    For example, if you find a commit hash `abcdef123...`:
    ```toml
    [patch.crates-io]
    ic-cdk = { git = "https://github.com/dfinity/cdk-rs", rev = "abcdef123..." }
    ic-cdk-macros = { git = "https://github.com/dfinity/cdk-rs", rev = "abcdef123..." }
    #...
    ```
    Or, if you find a tag like `ic-cdk-v0.12.1`:
    ```toml
    [patch.crates-io]
    ic-cdk = { git = "https://github.com/dfinity/cdk-rs", tag = "ic-cdk-v0.12.1" }
    ic-cdk-macros = { git = "https://github.com/dfinity/cdk-rs", tag = "ic-cdk-v0.12.1" }
    #...
    ```

3.  **Clean and Rebuild:**
    *   It's good practice to clear out any cached build artifacts that might be causing issues. Run `cargo clean` from within the `tests` directory.

**Final Execution Command:**

To run the tests for this project, you must first navigate into the `tests` directory. This is critical so that Cargo uses the local `.cargo/config.toml` with the dependency patch.

Execute the test with:
`cd tests && cargo test -- --nocapture`

**Definition of Done:**

*   A valid `rev` or `tag` for `ic-cdk` v0.12.1 is found and successfully used.
*   The `tests/.cargo/config.toml` file is updated with the correct reference.
*   The project compiles successfully.
*   Running the test command **successfully executes** the `test_simulation_vs_reality` test without panicking.
*   The `println!` outputs from the test are visible.
*   **Crucially: No files outside of the `tests/` directory have been modified.**











































# Tokenomics


- Should definitely explain how the tokenomics works in the UI
- Need to require svg only because the images don't show.


# Scores

Bot Resistance = Low #Actions required in the first epoch
Fairness = Expensive to mint in the first epoch. 
































**Objective:** Implement a sophisticated, community-driven liquidity provision system within the `icp_swap` canister. This system will enable the protocol to deploy its accrued ICP treasury (which is already being funded by the `distribute_reward` function into the `LP_TREASURY` `StableCell`) to deepen its on-chain liquidity on the KongSwap DEX.

This will be achieved through a symbiotic partnership with any community member who provides the matching primary tokens. The system will feature a "swap-and-LP" model, where the user is compensated with ICP. A 1% fee on the protocol's portion of the deployed liquidity will be sent to the main `LBRY-FUN` canister to be burned, creating a positive feedback loop.

**Core Design Philosophy:**

*   **Code Encapsulation:** New, distinct functionality will be placed in new, dedicated Rust files (`dex_integration.rs`, `constants.rs`) to keep the existing, audited logic in `update.rs` clean and focused.
*   **Stateful Treasury:** The treasury for liquidity deployment is tracked in the `LP_TREASURY` `StableCell` within the canister's state. The new function will draw from this pre-funded treasury.
*   **Transactional Safety:** The multi-step process of adding liquidity and paying the user will be executed in a safe, atomic order. Liquidity will be added to the DEX *before* the user receives their ICP payout and before the treasury is debited.
*   **Symbiotic Value Accrual:** A hardcoded 1% fee on the protocol's portion of the deployed ICP will be sent to the `LBRY_FUN_CANISTER_ID`, which will handle the buy-and-burn of LBRY tokens.
*   **Economic Security:** The function will have a hardcoded cap on the amount of treasury ICP deployed per transaction to mitigate economic exploits.

---

### **List of Files to be Attached to the Prompt:**

To ensure the AI has full context, please attach the following files from the `icp_swap` directory:

1.  `icp_swap.did`
2.  `Cargo.toml`
3.  The entire `src/` directory and all its contents.

---

### **Instructions for Implementation:**

You are to enhance the `icp_swap` canister source code by creating two new files and modifying two existing ones. The `distribute_reward` function should NOT be altered.

#### **Part 1: Create New Files for Code Separation**

1.  **Create `src/constants.rs`:**
    *   This file will hold all static mainnet principals and configuration values.
    *   Populate it with the following `pub const` values:
        *   `KONG_BACKEND_CANISTER_ID: &str = "2ipq2-uqaaa-aaaar-qailq-cai";`
        *   `LBRY_FUN_CANISTER_ID: &str = "j362g-ziaaa-aaaap-qkt7q-cai";`
        *   `ICP_LEDGER_CANISTER_ID: &str = "nppha-riaaa-aaaal-ajf2q-cai";`
        *   `LIQUIDITY_DEPLOYMENT_CAP_E8S: u64 = 10 * 100_000_000; // 10 ICP`
        *   `LIQUIDITY_FEE_PERCENT: u64 = 1;`

2.  **Create `src/dex_integration.rs`:**
    *   This file will contain all logic for interacting with the KongSwap DEX, using the interface details provided at the end of this prompt.
    *   Define all necessary `CandidType` structs for KongSwap calls as specified.
    *   Implement two public async functions:
        *   `get_kong_swap_quote(pay_symbol: String, pay_amount: Nat, receive_symbol: String) -> Result<SwapAmountsReply, String>`: This function will call the `swap_amounts` method on the KongSwap canister.
        *   `add_liquidity_to_kong(primary_token_symbol: String, primary_token_amount: Nat, icp_amount: Nat) -> Result<AddLiquidityReply, String>`: This function must perform the full, multi-step liquidity addition process: (1) call `add_liquidity_amounts` to get proportional amounts, (2) call `icrc2_approve` on both the primary token ledger and the ICP ledger for the KongSwap canister, and (3) call `add_liquidity` to finalize.

#### **Part 2: Modify Existing Files**

1.  **Modify `src/storage.rs`:**
    *   Add a new public function `withdraw_from_lp_treasury(amount: u64) -> Result<(), ExecutionError>` that subtracts the given amount from the `LP_TREASURY` `StableCell`. Ensure it handles potential underflow errors.

2.  **Modify `src/update.rs`:**
    *   **Imports:** Add `use crate::{constants::*, dex_integration::*};`.
    *   **Create the Main User-Facing Function:**
        *   Add a new, public `update` function: `provide_liquidity_with_swap(primary_token_amount_provided: u64, max_icp_to_receive_e8s: u64) -> Result<String, ExecutionError>`.
        *   **Implement the following logic IN ORDER:**
            i.   **Get Treasury Balance:** Get the current balance from the `LP_TREASURY` `StableCell`.
            ii.  **Apply Cap:** Determine the `icp_to_deploy` by taking the minimum of the `LP_TREASURY` balance and the `LIQUIDITY_DEPLOYMENT_CAP_E8S` constant.
            iii. **Check User Approval:** Verify that the caller has approved this canister to spend at least `primary_token_amount_provided` of the primary token.
            iv.  **Get Quote:** Call `get_kong_swap_quote` to get the current market price for swapping the user's provided primary tokens into ICP.
            v.   **Calculate Swap:** Determine the `icp_for_user_swap` based on the quote. This must not exceed `max_icp_to_receive_e8s`. Calculate the `primary_tokens_for_swap` that this corresponds to.
            vi.  **Calculate LP Amounts:** The remaining primary tokens (`primary_tokens_for_lp`) and the remaining deployable ICP from the treasury (`icp_for_lp`) are now defined.
            vii. **Calculate and Send LBRY Fee:** Calculate the `lbry_fee` (1% of `icp_for_lp`). Using the existing `send_icp` utility, send this fee amount to the `LBRY_FUN_CANISTER_ID`.
            viii.**Add Liquidity to DEX:** Calculate the remaining ICP for liquidity (`icp_for_lp` - `lbry_fee`). Call `add_liquidity_to_kong` using the `primary_tokens_for_lp` and this post-fee ICP amount.
            ix.  **Update Treasury & Pay User:** **Only upon successful liquidity addition**, perform two actions: (1) call `withdraw_from_lp_treasury` to deduct the total ICP used (`icp_for_lp`), and (2) transfer the `icp_for_user_swap` amount to the user via the `send_icp` utility.
            x.   Return a detailed success message.

---

### **KongSwap DEX Integration Details**

Here are the precise Rust function signatures and `CandidType` struct definitions required to interact with the KongSwap DEX canister (`2ipq2-uqaaa-aaaar-qailq-cai`).

#### **1. `swap_amounts`**

This function is used to get a quote for a swap, detailing the expected amounts and fees.

**Candid Method:** `(pay_symbol: text, pay_amount: nat, receive_symbol: text) -> (variant { Ok: SwapAmountsReply; Err: text }) query`

**Rust Function Signature:**

```rust
async fn swap_amounts(
    &self,
    pay_symbol: &str,
    pay_amount: &Nat,
    receive_symbol: &str,
) -> Result<SwapAmountsReply>;
```

**Required `CandidType` Struct Definitions:**

```rust
use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Deserialize, Serialize)]
pub struct SwapAmountsTxReply {
    pub pool_symbol: String,
    pub pay_chain: String,
    pub pay_symbol: String,
    pub pay_address: String,
    pub pay_amount: Nat,
    pub receive_chain: String,
    pub receive_symbol: String,
    pub receive_address: String,
    pub receive_amount: Nat,
    pub price: f64,
    pub lp_fee: Nat,
    pub gas_fee: Nat,
}

#[derive(CandidType, Debug, Deserialize, Serialize)]
pub struct SwapAmountsReply {
    pub pay_chain: String,
    pub pay_symbol: String,
    pub pay_address: String,
    pub pay_amount: Nat,
    pub receive_chain: String,
    pub receive_symbol: String,
    pub receive_address: String,
    pub receive_amount: Nat,
    pub mid_price: f64,
    pub price: f64,
    pub slippage: f64,
    pub txs: Vec<SwapAmountsTxReply>,
}
```

---

#### **2. `add_liquidity_amounts`**

This function calculates the required amount of `token_1` needed to match a given amount of `token_0` for adding liquidity, based on the current pool price.

**Candid Method:** `(token_0: text, amount: nat, token_1: text) -> (variant { Ok: AddLiquidityAmountsReply; Err: text }) query`

**Rust Function Signature:**

```rust
async fn add_liquidity_amounts(
    &self,
    token_0: &str,
    amount: &Nat,
    token_1: &str,
) -> Result<AddLiquidityAmountsReply>;
```

**Required `CandidType` Struct Definitions:**

```rust
use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize)]
pub struct AddLiquidityAmountsReply {
    pub symbol: String,
    pub chain_0: String,
    pub symbol_0: String,
    pub address_0: String,
    pub amount_0: Nat,
    pub fee_0: Nat,
    pub chain_1: String,
    pub symbol_1: String,
    pub address_1: String,
    pub amount_1: Nat,
    pub fee_1: Nat,
    pub add_lp_token_amount: Nat,
}
```

---

#### **3. `add_liquidity`**

This function executes the addition of liquidity to a pool. It requires prior `icrc2_approve` calls for both tokens to have been successfully completed, granting the KongSwap canister permission to transfer the funds.

**Candid Method:** `(args: AddLiquidityArgs) -> (variant { Ok: AddLiquidityReply; Err: text })`

**Rust Function Signature:**

```rust
async fn add_liquidity(&self, add_liquidity_args: &AddLiquidityArgs) -> Result<AddLiquidityReply>;
```

**Required `CandidType` Struct Definitions:**

```rust
use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

// Dependency for AddLiquidityArgs
#[derive(CandidType, Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TxId {
    BlockIndex(Nat),
    TransactionHash(String),
}

// Argument for the 'add_liquidity' call
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct AddLiquidityArgs {
    pub token_0: String,
    pub amount_0: Nat,
    pub tx_id_0: Option<TxId>,
    pub token_1: String,
    pub amount_1: Nat,
    pub tx_id_1: Option<TxId>,
}

// ---- Reply Structs ----

// Dependency for AddLiquidityReply
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct TransferIdReply {
    pub transfer_id: u64,
    pub transfer: TransferReply,
}

// Dependency for AddLiquidityReply
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub enum TransferReply {
    IC(ICTransferReply),
}

// Dependency for AddLiquidityReply
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct ICTransferReply {
    pub chain: String,
    pub symbol: String,
    pub is_send: bool,
    pub amount: Nat,
    pub canister_id: String,
    pub block_index: Nat,
}

// Final reply for the 'add_liquidity' call
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct AddLiquidityReply {
    pub tx_id: u64,
    pub symbol: String,
    pub request_id: u64,
    pub status: String,
    pub chain_0: String,
    pub symbol_0: String,
    pub amount_0: Nat,
    pub chain_1: String,
    pub symbol_1: String,
    pub amount_1: Nat,
    pub add_lp_token_amount: Nat,
    pub transfer_ids: Vec<TransferIdReply>,
    pub claim_ids: Vec<u64>,
    pub ts: u64,
}
```






















