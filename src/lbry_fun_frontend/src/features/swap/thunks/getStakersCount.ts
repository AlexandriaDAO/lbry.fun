import { createAsyncThunk } from "@reduxjs/toolkit";
import LedgerService from "@/utils/LedgerService";
import { getActorSwap } from "@/features/auth/utils/authUtils";
import { RootState } from "@/store";


// Define the async thunk
const getStakersCount = createAsyncThunk<
  string,
  void,
  {state: RootState, rejectValue: string }
>("icp_swap/getTotalStakerCount", async (_, { getState,rejectWithValue }) => {
  try {
    const state = getState();

    if (!state.swap.activeSwapPool) {
      throw new Error("No active swap pool found");
    }
    const actor = await getActorSwap(state.swap.activeSwapPool?.[1].icp_swap_canister_id);
   
    const result = await actor.get_stakers_count();
    
    return result.toString();
  } catch (error) {
    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }
  }
  return rejectWithValue(
    "An unknown error occurred while fetching  all staked info"
  );
});

export default getStakersCount;


// -Limit on icp price, Lbry should be not be minted less than 500.
