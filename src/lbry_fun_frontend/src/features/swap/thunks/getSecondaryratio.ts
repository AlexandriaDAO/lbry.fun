import { createAsyncThunk } from "@reduxjs/toolkit";
import { getActorSwap } from "@/features/auth/utils/authUtils";
import { RootState } from "@/store"; 

const getSecondaryratio = createAsyncThunk<
  string, // Return type of the payload
  void,   // Argument type (none)
  {
    state: RootState; 
    rejectValue: string;
  }
>("icp_swap/getSecondaryratio", async (_, { getState, rejectWithValue }) => {
  try {
    
    const state = getState();
    if (!state.swap.activeSwapPool) {
      return "0";
      //throw new Error("No active swap pool found");
    }
    const actor = await getActorSwap(state.swap.activeSwapPool?.[1].icp_swap_canister_id);
    const result = await actor.get_current_secondary_ratio();
    return result.toString();
  } catch (error) {
    console.error("Failed to get Secondary_ratio:", error);

    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }
  }
  return rejectWithValue("An unknown error occurred while fetching Secondary ratio");
});

export default getSecondaryratio;
