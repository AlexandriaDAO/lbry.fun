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
    // The result is in e8s format, need to convert to natural units
    const rateInNaturalUnits = TokenConversionService.e8sToNatural(result);
    return rateInNaturalUnits.toString();
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
