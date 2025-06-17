import { createAsyncThunk } from "@reduxjs/toolkit";
import { getActorSwap, validateActor } from "@/features/auth/utils/authUtils";
import { ErrorMessage, getErrorMessage } from "../utlis/erorrs";
import { RootState } from "@/store";

// Define the async thunk
const claimReward = createAsyncThunk<
  string, // This is the return type of the thunk's payload
  { reward: string },
  { state: RootState; rejectValue: ErrorMessage }
>("icp_swap/claimReward", async ({ reward }, { getState, rejectWithValue }) => {
  try {
    if (Number(reward) < 0.01) {
      return rejectWithValue({
        title: "Must have at least 0.01 ICP reward to claim!",
        message: "",
      });
    }
    const state = getState();

    if (!state.swap.activeSwapPool) {
      throw new Error("No active swap pool found");
    }
    const actor = await getActorSwap(
      state.swap.activeSwapPool?.[1].icp_swap_canister_id
    );
    
    // Validate ICP Swap actor before using it
    if (!validateActor(actor, "ICP Swap")) {
      return rejectWithValue({ 
        title: "Unable to connect to ICP swap canister", 
        message: "Please ensure you are authenticated." 
      });
    }
    
    const result = await actor.claim_icp_reward([]);
    if ("Ok" in result) return "success";
    else if ("Err" in result) {
      const errorMessage = getErrorMessage(result.Err);
      return rejectWithValue(errorMessage);
    }
  } catch (error) {

    if (error instanceof Error) {
      return rejectWithValue({ title: error.message, message: "" });
    }
  }
  return rejectWithValue({
    title: "An unknown error occurred while claiming reward",
    message: "",
  });
});

export default claimReward;
