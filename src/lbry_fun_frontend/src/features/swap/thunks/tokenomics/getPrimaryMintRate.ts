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
    // The backend returns a rate that when multiplied by secondary tokens gives primary tokens in e8s
    // rate * secondary_tokens = primary_tokens_in_e8s
    // To get the rate per secondary token in natural units:
    // rate_per_token = rate / E8S
    const ratePerToken = Number(result) / TokenConversionService.getE8S();
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
