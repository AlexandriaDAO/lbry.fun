import { createAsyncThunk } from "@reduxjs/toolkit";
import { getICRCActor } from "@/features/auth/utils/authUtils";
import { ErrorMessage } from "@/features/swap/utlis/erorrs";

const getTotalPrimarySupply = createAsyncThunk<
  string,
  string, // primary token canister ID
  { rejectValue: ErrorMessage }
>(
  "swap/getTotalPrimarySupply",
  async (primaryTokenId, { rejectWithValue }) => {
    try {
      const actor = await getICRCActor(primaryTokenId);
      const totalSupply = await actor.icrc1_total_supply();
      return totalSupply.toString();
    } catch (error) {
      console.error("Error fetching total primary supply:", error);
      return rejectWithValue({
        title: "Failed to fetch total supply",
        message: "Unable to retrieve the total primary token supply",
      });
    }
  }
);

export default getTotalPrimarySupply;