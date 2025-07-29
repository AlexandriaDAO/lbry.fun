# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Standard Workflow
1. First think through the problem, read the codebase for relevant files, and write a plan to appropriate file.
2. The plan should have a list of todo items that you can check off as you complete them
3. Before you begin working, check in with me and I will verify the plan.
4. Then, begin working on the todo items, marking them as complete as you go.
5. Please every step of the way just give me a high level explanation of what changes you made
6. Make every task and code change you do as simple as possible. We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
7. Finally, add a review section to the appropriate markdown instruction list file with a summary of the changes you made and any other relevant information.

## Common Development Commands

### Build & Deploy
```bash
# For reference only (includes all canisters and frontend).
./scripts/build.sh 

 Never run this because it restarts the network and resets data, but you can use these commands to learn and upgrade local canisters. 
```

### Testing
```bash
# Run all Rust integration tests (uses pocket-ic)
cd tests && cargo test

# Run specific test
cd tests && cargo test test_name

# Run frontend tests
npm test
```

### Frontend Development
```bash
# Start development server
npm start

# Build frontend
npm run build

# Check TypeScript types
npm run check
```

## Project Background

This project is a Crypto Token Launchpad built on the Internet Computer Blockchain with a unique distribution mechanic.

Instead of being an LBP, it uses a dual token system. The secondary token is minted with ICP at a constant rate of $0.01 in $ICP, and the primary token is minted/mined by burning the secondary token at varying rates (burning also returns 1/2 the ICP value with the mint, so the 'true cost' of secondary tokens can be thought of as $0.005).

All ICP collected from minting secondary tokens is distributed accordingly (1% of the whole pool every hour):

- 1% to buy back and burn $LBRY, which is the secondary token of the parent project of which this is a fork.
99% → Primary token stakers (will later be replaced with Permanently Locked Kongswap Liquidity)

## Project Architecture

The project has:

### 2 core canisters:
- `lbry_fun_frontend` - The frontend repo.
- `lbry_fun` - The canister that spawns and tracks new token launches.

### 5 canisters that spawn for each newly created token:
- `tokenomics` - Controls supply dynamics, current minting rates, and halvings.
- `icp_swap` - Controls token minting/burning.
- `logs` - Collects real statistics on launched tokens once per hour.
- Primary Token - Actual ICRC1 Token Canister
- Secondary Token - Actual ICRC1 Token Canister

### 2 system canisters:
- `xrc` - Price feeds (Please don't mess with these as we already deploy them correctly)
- `icp_ledger_canister` - Local icp tokens (Please don't mess with these as we already deploy them correctly)

Our full deployment methodology can be seen in @/scripts/build.sh

All tests are done with a 'mock' canister using the pocket-ic library in the project root's /test folder.

## Technical Stack
- Backend: Rust with Internet Computer SDK
- Frontend: React with TypeScript, Tailwind CSS, and ShadCN
- Testing: pocket-ic for canister testing, Jest for frontend
- Build: Webpack, cargo, dfx

## E8S Token Value Conversions (Critical)

### Overview
E8S is the smallest unit for tokens on the Internet Computer (1 token = 100,000,000 E8S).

### Standard Frontend → Backend Flow
1. **Most Operations**: Frontend sends E8S format
   ```typescript
   const e8sAmount = TokenConversionService.naturalToE8s(amount); // 1 → 100,000,000
   ```
2. **Display**: Backend returns E8S, frontend converts for display
   ```typescript
   const natural = TokenConversionService.e8sToNatural(e8s); // 100,000,000 → 1
   ```

### Critical Exceptions
1. **`burn_secondary`**: Frontend sends natural units (backend multiplies by 100,000,000)
2. **Token Creation**: All parameters sent as BigInt without E8S conversion
3. **Halving Step**: Plain percentage (70 = 70%, NOT 70 × 10^8)

### Special Cases
- **ICP Transfer Fee**: Always 10,000 E8S (0.0001 ICP)
- **Tokenomics Internal**: 4-decimal format (50,000 = 5.0 tokens), multiply by 10,000 for E8S
- **E8S × E8S = E16S**: When multiplying E8S values, divide by E8S to correct units

## Dual Token System Mechanics

### Overview
Each token launch creates two tokens: Primary (reward) and Secondary (mining).

### Token Flow
1. **Mint Secondary**: ICP → Secondary tokens at fixed rate ($0.01 worth of ICP)
2. **Burn Secondary**: Secondary tokens → Primary tokens at varying rates (with 50% ICP refund)
3. **Halving**: Primary reward rate decreases at thresholds (e.g., 70% of previous rate)

### ICP Distribution (1% of pool hourly)
- 1% → Buy/burn $LBRY (parent project token)
- 99% → Primary token stakers (will later be replaced with Permanently Locked Kongswap Liquidity)

## Common Error Patterns & Solutions

### Frontend Errors
- **"Insufficient balance"**: Check approval amounts include fees
- **BigInt conversion errors**: Ensure proper string conversion before BigInt()
- **Display showing scientific notation**: Use TokenConversionService.formatE8sDisplay()

### Backend Errors
- **Overflow in calculations**: Check for E8S × E8S multiplication
- **"Transfer failed"**: Verify approval includes transfer fee (10,000 E8S)
- **Archive errors**: Ensure timer intervals don't overlap

## Important Notes

- Kongswap is deployed locally for liquidity functionality (separate repo)
- Uses WASM compilation with `ic-wasm` for size optimization
- All canisters use stable memory for upgrade persistence

## Responses
- When providing technical advice, ultra deep think about specific actionable steps rather than abstract concepts.
- If troubleshooting leads to a dead end, go back to planning in a fresh markdown file that we discuss together.
- Don't make core changes unless you're confident we have an optimized solution.
- Never worry about backend compatability because this project is not launched live. Instead, refactor for optimizationo both simply and surgically.
