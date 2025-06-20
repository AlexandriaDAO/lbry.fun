# Tokenomics Real Issue Analysis

## The Problem

The frontend and backend have a parameter scaling mismatch.

### Frontend Presets (Natural Units)

**Quick Launch:**
- initial_secondary_burn: 1,000,000 tokens
- initial_reward_per_burn_unit: 2,000
- Calculation: 2000 * 1000000 / 10000 = 200,000 tokens (20% of supply)

**Balanced:**
- initial_secondary_burn: 500,000 tokens  
- initial_reward_per_burn_unit: 500
- Calculation: 500 * 500000 / 10000 = 25,000 tokens (2.5% of supply)

**Extended Distribution:**
- initial_secondary_burn: 200,000 tokens
- initial_reward_per_burn_unit: 100
- Calculation: 100 * 200000 / 10000 = 2,000 tokens (0.2% of supply)

### What Frontend Does

1. User enters values in natural units (e.g., 2000 for Quick Launch)
2. Frontend multiplies by E8S before sending: 2000 * 100_000_000 = 200_000_000_000
3. Sends to backend as E8S values

### What Backend Does

```rust
// Backend receives E8S values
let reward_e8s = primary_per_threshold * in_slot_burn * 10000;
// With Quick Launch: 200_000_000_000 * 100_000_000_000_000 * 10000
// This gives an astronomical number!
```

## The Real Issue

The backend formula was designed for natural units, but receives E8S values:
- It expects: reward = 2000 * 1_000_000 * 10000 / E8S = 200,000 tokens
- It gets: reward = 200_000_000_000 * 100_000_000_000_000 * 10000 / E8S = 20,000,000,000,000 tokens!

## Why Only 1 Epoch Now?

When I "fixed" it by dividing by E8S twice, the rewards became so small they round to 0:
- reward_e8s = (200_000_000_000 * 100_000_000_000_000) / 100_000_000 / 10000
- This gives a tiny number that rounds to 0
- No rewards = only 1 epoch (just the TGE)

## The Solution

The backend needs to handle E8S inputs properly. The formula should be:

```rust
// Convert E8S inputs back to natural units for the calculation
let burn_natural = in_slot_burn / E8S;
let reward_per_burn_natural = primary_per_threshold / E8S;
let reward_natural = (reward_per_burn_natural * burn_natural) / 10000;
let reward_e8s = reward_natural * E8S;
```

Or more simply:
```rust
// Since both values are in E8S, dividing their product by E8S gives the correct scale
let reward_e8s = (primary_per_threshold * in_slot_burn) / E8S / 10000;
```

But this needs to be done correctly without double-dividing by E8S.