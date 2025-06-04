# Tokenomics

## Token Creation Parameters: A Deep Dive

The `create_token` function initializes a new token ecosystem with two core tokens: a Primary Token and a Secondary Token. The economics of their interaction, especially how the Primary Token comes into existence, are governed by four critical parameters provided during creation. Understanding these is key to designing a sustainable and effective token model.

These parameters are primarily used to configure the `tokenomics` canister, which manages the scheduled minting of the Primary Token in response to the burning of the Secondary Token.

Let's break down each parameter from a tokenomics expert's and crypto degen's perspective:

### 1. `primary_max_supply` (Total Cap of Primary Token)

*   **What it is:** This is the absolute maximum number of Primary Tokens that can ever exist. This figure includes both the `initial_primary_mint` (see below) and all Primary Tokens that will be minted over time through the burning of Secondary Tokens via the `tokenomics` canister's schedule.
*   **Tokenomics Perspective:**
    *   **Scarcity and Value:** A fundamental lever for controlling the scarcity of the Primary Token. A lower max supply can, ceteris paribus, lead to higher per-token value if demand is constant or grows.
    *   **Long-term Vision:** Defines the ultimate size of the Primary Token economy. This number should reflect the project's long-term goals and the total value it aims to represent or facilitate.
    *   **Inflation Control:** Once this cap is reached (through initial minting and scheduled minting), no more Primary Tokens can be created by the `tokenomics` canister, effectively capping inflation from this source.
*   **Degen Perspective:**
    *   **"Wen Moon?":** A lower max supply is often seen as bullish ("less supply, price go up!"). Degens will compare this to other projects' total supplies.
    *   **Fully Diluted Value (FDV):** This number is critical for calculating the FDV (`max_primary_supply` * current price).
    *   **Is it *really* capped?** Degens will scrutinize if there are other mechanisms (e.g., governance, other minting contracts) that could bypass this cap. In this system, the `tokenomics` canister respects this cap for its scheduled mints.

### 2. `initial_primary_mint` (Upfront Primary Token Supply & Initial Mint Rate)

*   **What it is:**
    1.  **Initial Allocation:** This is the quantity of Primary Tokens minted immediately when the Primary Token ledger is created. These tokens are typically allocated to the project treasury, team, early investors, or for initial liquidity provision *before* the burn-to-mint mechanism in the `tokenomics` canister becomes the primary source of new supply.
    2.  **Initial Minting Rate Setter:** This value also sets the *initial rate* for `primary_per_threshold` within the `tokenomics` canister's schedule generator. The `generate_tokenomics_schedule` function uses `initial_primary_mint` as the starting value for `primary_per_threshold`. This determines how many Primary Tokens are minted per unit of Secondary Token burned in the *first tier* of the schedule (scaled by a factor of 10,000, i.e., `(primary_per_threshold * in_slot_burn) / 10000`).
*   **Tokenomics Perspective:**
    *   **Bootstrapping:** Provides the initial tokens needed to kickstart the ecosystem, fund development, or establish initial market liquidity.
    *   **Initial Minting Efficiency:** A higher `initial_primary_mint` (when used as the starting `primary_per_threshold`) means the burn-to-mint mechanism is more "generous" in the early stages, minting more Primary Tokens for each Secondary Token burned. This can incentivize early participation in burning.
    *   **Balance:** A careful balance is needed. Too high an `initial_primary_mint` (as an allocation) might lead to concerns about centralization or selling pressure. As a rate setter, it influences how quickly the `max_primary_supply` (excluding the initial allocation) is approached in the early phases.
*   **Degen Perspective:**
    *   **"Team Tokens / VC Dump?":** Degens will be keen to know where these initial tokens go. Transparency in allocation is crucial.
    *   **"Early Burner Bonus":** If this sets a high initial mint rate for burning, early degens who burn Secondary Tokens will get more Primary Tokens ("alpha leak!"). They'll be trying to get in before the mint rate decreases in later tiers.

### 3. `initial_secondary_burn` (First Burn Tier Size)

*   **What it is:** This parameter defines the size of the *first tier* in the Secondary Token burn schedule. Specifically, it sets the `current_burn` value for the first entry in the `secondary_thresholds` vector within the `TokenomicsSchedule`. To mint Primary Tokens according to the initial rate (set by `initial_primary_mint`), this amount of Secondary Tokens must be collectively burned.
*   **Tokenomics Perspective:**
    *   **Pacing of Minting:** Sets the scale for the burn mechanism. A lower `initial_secondary_burn` means the first tier of Primary Token minting (and subsequent tiers, which double in size) is reached with less Secondary Token burn, potentially accelerating early Primary Token supply expansion. A higher value makes it more challenging to unlock the initial tranches of Primary Tokens.
    *   **Commitment Signal:** The size of this first tier (and the subsequent exponentially increasing tiers) can signal the level of commitment (in terms of Secondary Token burning) required from the community to expand the Primary Token supply.
    *   **Schedule Dynamics:** The `generate_tokenomics_schedule` function creates subsequent burn thresholds by doubling the previous one (e.g., if `initial_secondary_burn` is 1000, the thresholds might be 1000, 2000, 4000, 8000...). Simultaneously, the `primary_per_threshold` (mint rate) halves at each tier.
*   **Degen Perspective:**
    *   **"How much to burn to get X?":** This helps estimate how much collective effort (burning) is needed to unlock the first batch of scheduled Primary Token mints.
    *   **"Is it too hard/easy?":** If this value is too high, degens might feel it's too difficult to participate in the burn-to-mint. If too low, the early minting phases might pass too quickly. They'll be looking for the "sweet spot" for their participation strategy.

### 4. `primary_max_phase_mint` (Max Primary Mint Per Burn Event/Transaction)

*   **What it is:** This parameter acts as a rate limiter or a cap on the amount of Primary Token that can be minted in a *single transaction* or call to the `mint_primary` function in the `tokenomics` canister, regardless of how many Secondary Tokens are burned in that specific event. For example, if the schedule dictates that 1000 Primary Tokens *could* be minted based on a large Secondary Token burn, but `primary_max_phase_mint` is set to 100, then only 100 Primary Tokens will be minted in that transaction.
*   **Tokenomics Perspective:**
    *   **Supply Smoothing:** Prevents large, sudden influxes of Primary Tokens into circulation due to a massive single burn event. This promotes a more gradual and predictable supply increase.
    *   **Preventing Manipulation:** Reduces the ability of a single entity with a large amount of Secondary Tokens to trigger a disproportionately large minting of Primary Tokens at once, potentially impacting price stability.
    *   **Fairness:** Ensures that the opportunity to mint Primary Tokens is distributed over more potential burn events rather than being captured by a few large ones.
*   **Degen Perspective:**
    *   **"Anti-Whale Dump/Pump":** This can be seen as a measure to prevent whales from burning massive amounts of Secondary Token to mint and then immediately dump a large number of Primary Tokens, or to control the pace of "supply unlock."
    *   **"How often can I mint?":** If a degen plans a large burn, they'll need to understand that they might not get all the corresponding Primary Tokens in one go if this limit is hit. They might need multiple transactions or will see their effective mint capped by this.
    *   **Gas / Transaction Strategy:** Could influence how users batch their Secondary Token burns if they are trying to maximize their Primary Token mints per transaction fee paid.

### Interplay and Strategic Considerations:

These four parameters are interconnected and must be considered holistically:

*   **`initial_primary_mint` (allocation) + Scheduled Mints (derived from `initial_primary_mint` as rate, `initial_secondary_burn` as first tier, and halving/doubling logic) ≤ `max_primary_supply`.**
*   The **`initial_secondary_burn`** sets the entry point for the burn tiers. The **`initial_primary_mint`** (as a rate) sets how rewarding those early tiers are.
*   The rate of minting decreases (halving `primary_per_threshold`) as the amount of Secondary Token required for the next tier increases (doubling `current_burn`). This creates a dynamic where early burners are rewarded more significantly per unit of Secondary Token burned.
*   **`primary_max_phase_mint`** acts as a global speed bump on any single minting event, ensuring the path to `max_primary_supply` is more controlled, regardless of the underlying schedule's generosity at any given point.

**Simulating Outcomes:**
By inputting different values for these parameters, projects can model various scenarios for Primary Token supply emission. This allows for tuning the tokenomics to achieve desired outcomes regarding:
*   Pace of decentralization of Primary Token supply.
*   Incentives for early vs. late burners of Secondary Tokens.
*   Overall rate of Primary Token inflation until the `max_primary_supply` is reached.
*   Resilience against supply shocks from large individual burn events.

Choosing these numbers carefully is paramount to launching a token with well-defined, predictable, and strategically aligned economic properties.