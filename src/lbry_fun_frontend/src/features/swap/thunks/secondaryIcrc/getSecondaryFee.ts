import { createAsyncThunk } from "@reduxjs/toolkit";
import { TokenConversionService } from "@/utils/TokenConversionService";
import { getICRCActor } from "@/features/auth/utils/authUtils";
import { RootState } from "@/store";

// Define the asyn thunk
const getSecondaryFee = createAsyncThunk<
  string, // This is the return type of the thunk's payload
  void,
  {    state: RootState,
   rejectValue: string }
>(
  "icp_swap/getSecondaryFee",
  async (_, {getState, rejectWithValue }) => {
    try {
      const state = getState();
    if (!state.swap.activeSwapPool) {
      return "0";
    //  throw new Error("No active swap pool found");
    }
      const actor = await getICRCActor(state.swap.activeSwapPool?.[1].secondary_token_id);
      const result = await actor.icrc1_fee();
      const fromatedFee = (
        Math.floor(TokenConversionService.e8sToNatural(result) * 10 ** 4) /
        10 ** 4
      ).toFixed(4);

      return fromatedFee;
    } catch (error) {
      console.error("Failed to get Secondary fee:", error);

      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
    }
    return rejectWithValue(
      "An unknown error occurred while fetching Secondary fee"
    );
  }
);

export default getSecondaryFee;
