import { createAsyncThunk } from "@reduxjs/toolkit";
import { TokenConversionService } from "@/utils/TokenConversionService";
import { getICRCActor, getTokenomicsActor } from "@/features/auth/utils/authUtils";
import { RootState } from "@/store";
// Define the asyn thunk
const getPrimaryMintRate = createAsyncThunk<
  string, // This is the return type of the thunk's payload
  void,
  { state: RootState; rejectValue: string }
>("tokenomics/getPrimaryMintRate", async (_, { getState,rejectWithValue }) => {
  try {
    const state = getState();
    if (!state.swap.activeSwapPool) {
      throw new Error("No active swap pool found");
    }
    const actor = await getTokenomicsActor(
      state.swap.activeSwapPool?.[1].tokenomics_canister_id
    );
    const result = await actor.get_current_primary_rate();
    // The result is a rate multiplier, not in e8s format
    // When multiplied by burn amount and 10000, it gives e8s units
    // So we need to convert the final result from e8s to natural units
    // rate * burn_amount * 10000 / E8S = primary tokens
    // For display, we show: rate * 10000 / E8S per secondary token
    const ratePerToken = (Number(result) * 10000) / TokenConversionService.getE8S();
    return ratePerToken.toString();
  } catch (error) {
    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }
  }
  return rejectWithValue(
    "An unknown error occurred while fetching ALEX mint rate"
  );
});

export default getPrimaryMintRate;
