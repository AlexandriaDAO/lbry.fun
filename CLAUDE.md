Standard Workflow
1. First think through the problem, read the codebase for relevant files, and write a plan to projectplan.md.
2. The plan should have a list of todo items that you can check off as you complete them
3. Before you begin working, check in with me and I will verify the plan.
4. Then, begin working on the todo items, marking them as complete as you go.
5. Please every step of the way just give me a high level explanation of what changes you made
6. Make every task and code change you do as simple as possible. We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
7. Finally, add a review section to the projectplan.md file with a summary of the changes you made and any other relevant information.


Project Background:

This project is a Crypto Token Launchpad built on the Internet Computer Blockchain with a unique distribution mechanic.

Instead of being an LBP, it uses a dual token system. The secondary token is minted with ICP at a constant rate of $0.01 in $ICP, and the primary token is minted/mined by burning the secondary token at varying rates (burning also returns 1/2 the ICP value with the mint, so the 'true cost' of secondary tokens can be thought of as $0.005).

All ICP collected from minting secondary tokens is distributed accordingly (1% of the whole pool every hour):

- 1% to buy back and burn $LBRY, which is the secondary token of the parent project of which this is a fork.
- 49.5% to stakers of the primary token.
- 49.5% to buyback and provide locked liquidity in kongswap (which we deploy locally from a separate repo).

The project has:

2 core canisters:
- lbry_fun_frontend - The frontend repo.
- lbry_fun - The canister that spawns and tracks new token launches.

5 canisters that spawn for each newly created token:
- tokenomics - Controls supply dynamics, current minting rates, and halvings.
- icp_swap - Controls token minting/burning.
- logs - Collects real statistics on launched tokens once per hour.
- Primary Token - Actual ICRC1 Token Canister
- Secondary Token - Actual ICRC1 Token Canister

And 2 system canisters: XRC for price feeds and icp_ledger_canister for local icp tokens. Please don't mess with these as we already deploy them correctly.

Our full deployment methodology can be seen in /scripts/build.sh

All tests are done with a 'mock' canister using the pocket-ic library in the project root's /test folder.
