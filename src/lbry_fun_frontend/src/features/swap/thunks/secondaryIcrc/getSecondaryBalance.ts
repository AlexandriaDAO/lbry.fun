
import { createAsyncThunk } from "@reduxjs/toolkit";
import { Principal } from "@dfinity/principal";
import { TokenConversionService } from "@/utils/TokenConversionService";
import { getICRCActor, validateActor } from "@/features/auth/utils/authUtils";
import { RootState } from "@/store";

// Define the async thunk
const getSecondaryBalance = createAsyncThunk<
  string, // This is the return type of the thunk's payload
  string, // This is the argument type
  { state: RootState,rejectValue: string }
>(
  "icp_swap/getSecondaryBalance",
  async (account, {getState, rejectWithValue }) => {
    try {
      const state = getState();
      if (!state.swap.activeSwapPool) {
        throw new Error("No active swap pool found");
      }

      // Fetching secondary balance from canister

      const actor = await getICRCActor(state.swap.activeSwapPool[1].secondary_token_id);
      
      // Validate actor before using it
      if (!validateActor(actor, "Secondary Token ICRC")) {
        return rejectWithValue("Unable to connect to secondary token canister. Please ensure you are authenticated.");
      }

      const result = await actor.icrc1_balance_of({
        owner: Principal.fromText(account),
        subaccount: [],
      });
      
      // Convert e8s to natural units and format for display
      const formattedBal = TokenConversionService.formatE8sDisplay(result, 4);
      return formattedBal;
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
    }
    return rejectWithValue(
      "An unknown error occurred while getting Secondary balance"
    );
  }
);

export default getSecondaryBalance;
