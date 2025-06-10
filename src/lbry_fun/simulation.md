# Understanding the Tokenomics Simulation

This document explains the tokenomics model for creating a new primary token. The model is designed to control the issuance of the primary token through a mechanism that involves burning a secondary token. A simulation tool is provided to visualize the tokenomics based on a set of configurable parameters. This allows creators to design and preview the economic model of their token before launching it.

## Key Concepts

*   **Primary Token**: The new token being created. It has a maximum supply and offers staking rewards.
*   **Secondary Token**: An existing token that must be "burned" (permanently destroyed) to mint the Primary Token.
*   **ICP**: The native token of the Internet Computer, which is also part of the reward mechanism.
*   **Dual Reward Mechanism**: When a user burns Secondary Tokens, they receive a combination of newly minted Primary Tokens and a portion of ICP. This creates a direct incentive loop.
*   **Token Generation Event (TGE)**: An initial allocation of the Primary Token that is minted at the very beginning, before any burning occurs. This is for founders, investors, and the commuity treasury.
*   **Epoch**: The token minting process is divided into epochs. Each epoch defines a new "cost" to mint Primary Tokens. In our model, epochs are defined by progressively larger amounts of Secondary Tokens being burned.
*   **Burn**: The act of destroying Secondary Tokens to create Primary Tokens and claim ICP.

## Core Parameters

The simulation is driven by five key parameters that define the token's economic model:

*   `primary_max_supply`: The total maximum number of Primary Tokens that can ever exist (Hard Cap).
*   `tge_allocation`: The number of Primary Tokens to be created at the start and allocated (e.g., to the team, community, etc.). This is part of the `primary_max_supply`.
*   `initial_secondary_burn`: The amount of Secondary Tokens that need to be burned to complete the first minting epoch. This sets the scale for subsequent epochs, which typically double in size.
*   `halving_step`: The rate at which the minting reward decreases from one epoch to the next. For example, a `halving_step` of 50 means the reward is cut in half at each step. This is expressed as a percentage (e.g., 50 for 50%).
*   `initial_reward_per_burn_unit`: The number of Primary Tokens minted for each unit of Secondary Token burned in the first epoch. This is effectively the initial "price".
*   `max_primary_phase`: A parameter in the live canister (not in the simulation) that limits the maximum number of Primary Tokens that can be minted in a single burn transaction. This acts as a practical constraint to ensure system stability.

## The Simulation Process

The simulation models the entire lifecycle of the Primary Token minting process based on an "ideal" schedule. Here's how it works:

1.  **Schedule Generation**: The simulation first generates a complete, "ideal" tokenomics schedule. This schedule maps out all possible minting epochs, starting from zero and extending until the `primary_max_supply` would theoretically be minted. It does *not* account for the `tge_allocation` at this stage.
2.  **Epoch Progression**: The system defines a series of burn epochs. It starts with `initial_secondary_burn`. For each subsequent epoch, the amount of Secondary Tokens to be burned doubles.
3.  **Reward Halving**: The reward for burning decreases over time. The `initial_reward_per_burn_unit` sets the reward for the first epoch. For each new epoch, the reward is multiplied by the `halving_step` percentage. This makes it more rewarding to be an early participant.
4.  **"One Reward Mode"**: When the minting reward decays to its absolute minimum (1 e8s of the primary token), the halving stops. The simulation enters a final phase where the remaining token supply is minted at a new, fixed rate until the `primary_max_supply` is reached.
5.  **Hard Cap Enforcement**: Although the schedule is pre-calculated, the `primary_max_supply` is the ultimate limit. In the live system, minting will stop as soon as the TGE allocation plus all tokens minted from burning equals the hard cap, which may occur before the "ideal" schedule is fully completed.

This mechanism creates a predictable and transparent token issuance model that rewards early adopters while ensuring the supply is finite.

## Simulation vs. On-Chain Implementation

It's important to understand the distinction between the simulation and the live on-chain canister:

*   **Ideal vs. Real-Time**: The simulation generates a complete, "perfect" tokenomics schedule from start to finish. The on-chain implementation uses this same generation logic at initialization but executes it in real-time. The `primary_max_supply` acts as a hard cap that can interrupt the ideal schedule.
*   **ICP Rewards**: The simulation focuses only on the Primary and Secondary tokens. The live `icp_swap` canister also distributes ICP to users who burn the Secondary Token, creating a dual-reward system that is a key part of the economic design but not visualized in these graphs.
*   **Transaction Limits**: The live `tokenomics` canister enforces a `max_primary_phase` limit, capping the number of primary tokens minted per transaction. The simulation does not have this constraint and shows the aggregate results per epoch.
*   **TGE Allocation**: The simulation graphs start *after* the `tge_allocation` has been conceptually minted, showing the journey from the TGE amount to the `primary_max_supply`.

## Graph Explanations

The simulation generates several graphs to help visualize the tokenomics.

### 1. Cumulative Primary Supply vs. Burn

*   **What it shows**: This graph illustrates the total amount of Primary Tokens minted as more Secondary Tokens are burned.
*   **How to read it**: The Y-axis shows the cumulative Primary Tokens minted, and the X-axis shows the cumulative Secondary Tokens burned. A steep curve indicates that a large number of Primary Tokens are minted for a smaller amount of burned Secondary Tokens, which is typical in early epochs. As the curve flattens, it signifies that more Secondary Tokens must be burned to mint the same amount of Primary Tokens. The curve becomes completely flat when the `primary_max_supply` is reached.

### 2. Primary Tokens Minted per Epoch

*   **What it shows**: This chart displays the number of new Primary Tokens created in each burn epoch.
*   **How to read it**: The Y-axis represents the number of Primary Tokens minted, while the X-axis shows the epoch number. You'll typically see a sharp drop from left to right, demonstrating the effect of the `halving_step`. This visualization makes it clear how rewards diminish over time, incentivizing early participation.

### 3. Cost to Mint One Primary Token vs. Total Supply Minted

*   **What it shows**: This graph presents the "price" of minting one new Primary Token, expressed in terms of the USD value of the Secondary Tokens burned. The simulation assumes a fixed price for the Secondary Token (e.g., $0.005).
*   **How to read it**: The Y-axis is the cost in USD, and the X-axis is the cumulative supply of Primary Tokens minted. The graph will show a step-like pattern. Each step up represents a new epoch where the cost to mint increases. This clearly shows the increasing difficulty and cost of minting as more of the total supply is created.

### 4. Minting Valuation vs. Primary Minted

*   **What it shows**: This graph projects the total cumulative USD cost required to mint the Primary Tokens up to a certain point in the supply. It provides an estimate of the total "investment" flowing into the ecosystem through the burn mechanism.
*   **How to read it**: The left Y-axis shows the cumulative USD cost, while the X-axis shows the cumulative Primary Tokens minted. The right Y-axis also shows the percentage of the total supply that has been minted. This gives a sense of the overall market valuation created through the token generation process. The cost for TGE tokens is considered $0 in this projection.

## Key Metrics Summary

The dashboard also provides a summary of key metrics derived from the simulation:

*   **Minting Epochs**: The total number of epochs required in the "ideal" schedule to mint the entire `primary_max_supply`.
*   **TGE Allocation**: The percentage of the `primary_max_supply` that is allocated at the Token Generation Event.
*   **Initial Mint Cost**: The cost (in USD) to mint one Primary Token during the first epoch, based on the assumed price of the Secondary Token.
*   **Final Mint Cost**: The cost (in USD) to mint one Primary Token during the final epoch of the ideal schedule.
*   **Total Minting Valuation**: The total projected USD value of all Secondary Tokens that will be burned to mint the entire supply of the Primary Token (excluding the TGE allocation).

## Simulation Guarantees and Design Considerations

The simulation is a tool for designing and visualizing the economic model of your token. It operates on an "ideal" schedule and makes certain assumptions for clarity. The live on-chain canister that executes transactions has additional safeguards and real-world constraints that are not reflected in this design-phase simulation. Below is a breakdown of how various critical conditions are handled.

### Supply and Minting Integrity

*   **Minting Over the Hard Cap:** The simulation strictly enforces the `primary_max_supply`. If a calculated minting epoch would cause the total supply to exceed this cap, the simulation automatically calculates the exact amount of Secondary Tokens that need to be burned to mint only the remaining supply, and then stops. No tokens can be created beyond the hard cap.
*   **Minting After Hard Cap Reached:** Once the simulation reaches the `primary_max_supply`, the process concludes. In the live canister, any further burn attempts would fail.
*   **Per-Transaction Mint Limits (`max_primary_phase`):** This is a crucial safety feature of the **live canister** to ensure stability by limiting the number of tokens minted in a single transaction. The **simulation does not model this constraint**. Instead, it shows the aggregate results of each minting epoch to provide a clear overview of the tokenomic structure over its entire lifecycle. Simulating individual transaction limits would unnecessarily complicate the design phase.
*   **Minimum Mint Amount:** The simulation logic ensures that rewards for burning gradually decay. If the reward rate drops to a point where a valid burn would result in less than the smallest unit of the Primary Token, the minting schedule effectively ends. In the live canister, such a transaction would not result in a mint.

### Economic and Parameter Soundness

The simulation tool's frontend includes checks to guide creators toward sound economic parameters:

*   **Insufficient Initial Valuation:** The user interface will display a warning if the initial valuation of the first epoch (calculated as `initial_secondary_burn` * assumed USD price of the secondary token) is below a recommended threshold (e.g., $5,000). A low initial valuation could make the project vulnerable.
*   **Excessive TGE Allocation:** The interface prevents setting a `tge_allocation` that is equal to or greater than the `primary_max_supply`, as this would leave no tokens to be minted.
*   **Illogical Halving Rate:** The `halving_step` is constrained to a logical range (1-100%). The reward rate is guaranteed to be non-increasing.
*   **Inverted Reward Structure:** The simulation's core logic ensures that the reward rate per epoch can only decrease or stay the same (if `halving_step` is 100%), never increase. This preserves the core principle of rewarding early participants more.

### System State and Logic

These points primarily relate to the robustness of the live on-chain canister rather than the simulation itself.

*   **Regressive Epochs:** The simulation logic inherently prevents this. Each new epoch is defined by doubling the previous epoch's burn amount, ensuring the cumulative burn threshold is always strictly increasing.
*   **Handling Failed Mints:** The live canister is designed with a two-phase transaction model (e.g., `burn` then `mint`) and includes a remediation path. If a mint fails after a burn succeeds, the transaction is archived, allowing the user to `redeem` their funds later. This prevents loss of value and is a feature of the on-chain implementation, not the simulation.
*   **Anonymous Principal Minting:** The live canister enforces authentication. State-changing calls, particularly those involving burning or minting, require an authenticated principal (i.e., a logged-in user). Anonymous calls are rejected. This is a standard security practice for the on-chain canister and is outside the scope of the tokenomics simulation.
