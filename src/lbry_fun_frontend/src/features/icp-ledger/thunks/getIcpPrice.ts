import { createAsyncThunk } from "@reduxjs/toolkit";
import { RootState } from "@/store";
import { getActorSwap, validateActor } from "@/features/auth/utils/authUtils";

const ICP_PRICE_STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// Define the async thunk
const getIcpPrice = createAsyncThunk<
  number, // This is the return type of the thunk's payload
  void,
  { rejectValue: string; state: RootState } // Add state to thunk arguments
>("icp_swap/getIcpPrice", async (_, { getState, rejectWithValue }) => {
  // Check if a recent price already exists in the state
  const state = getState();
  const { icpPrice, icpPriceTimestamp } = state.icpLedger;

  if (icpPrice && icpPriceTimestamp && (Date.now() - icpPriceTimestamp < ICP_PRICE_STALE_THRESHOLD_MS)) {
    // Using cached ICP price from Redux store
    return icpPrice as number;
  }

  // Check if we have an active swap pool to get the ICP price from
  if (!state.swap.activeSwapPool) {
    console.warn("No active swap pool found, using fallback ICP price of $4.00");
    return 4.0;
  }

  // Fetching fresh ICP price from XRC canister via icp_swap canister
  try {
    const actor = await getActorSwap(state.swap.activeSwapPool[1].icp_swap_canister_id);
    
    // Validate actor before using it
    if (!validateActor(actor, "ICP Swap")) {
      console.warn("Unable to connect to swap canister, using fallback ICP price of $4.00");
      return 4.0;
    }

    // Get the secondary ratio (ICP price in cents) from the canister
    const result = await actor.get_current_secondary_ratio();
    const priceInCents = Number(result);
    
    // Convert from cents to dollars (e.g., 1000 cents = $10.00)
    const priceInDollars = priceInCents / 100;
    
    // ICP Price from XRC canister
    return priceInDollars;
  } catch (error) {
    console.error("Failed to get ICP price from XRC canister:", error);

    // If we have a cached price, use it even if it's stale rather than failing completely
    if (icpPrice) {
      console.warn("XRC canister call failed, using cached ICP price:", icpPrice);
      return icpPrice as number;
    }

    // As a last resort, return a fallback price to prevent complete failure
    console.warn("No cached price available, using fallback ICP price of $4.00");
    return 4.0;
  }
});

export default getIcpPrice;
