
import { createAsyncThunk } from "@reduxjs/toolkit";
import { Principal } from "@dfinity/principal";
import LedgerService from "@/utils/LedgerService";
import { getICRCActor } from "@/features/auth/utils/authUtils";
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
      const actor = await getICRCActor(state.swap.activeSwapPool?.[1].secondary_token_id);
      const result = await actor.icrc1_balance_of({
        owner: Principal.fromText(account),
        subaccount: [],
      });
      const LedgerServices = LedgerService();
      // const fromatedBal=LedgerServices.e8sToIcp(result).toString();
      const fromatedBal = (
        Math.floor(LedgerServices.e8sToIcp(result) * 10 ** 4) /
        10 ** 4
      ).toFixed(4);

      return fromatedBal;
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
