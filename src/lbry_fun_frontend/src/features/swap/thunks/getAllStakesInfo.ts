import { createAsyncThunk } from "@reduxjs/toolkit";
import LedgerService from "@/utils/LedgerService";
import { getICRCActor } from "@/features/auth/utils/authUtils";
import { Principal } from "@dfinity/principal";
import { RootState } from "@/store";

// Define the async thunk
const getALlStakesInfo = createAsyncThunk<
  string,
  void,
  { state: RootState; rejectValue: string }
>("icp_swap/getALlStakesInfo", async (_, { getState,rejectWithValue }) => {
  try {
    const state = getState();
    if (!state.swap.activeSwapPool) {
      throw new Error("No active swap pool found");
    }
    const icp_swap_canister_id =state.swap.activeSwapPool?.[1].icp_swap_canister_id;
    ;
    const actor =await getICRCActor(
      state.swap.activeSwapPool?.[1].primary_token_id
    );
    const LedgerServices = LedgerService();

    const result = await actor.icrc1_balance_of({
      owner: Principal.fromText(icp_swap_canister_id),
      subaccount: [],
    });
    const fromatedBal = (
      Math.floor(LedgerServices.e8sToIcp(result) * 10 ** 4) /
      10 ** 4
    ).toFixed(4);
    return fromatedBal;
  } catch (error) {
    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }
  }
  return rejectWithValue(
    "An unknown error occurred while fetching  all staked info"
  );
});

export default getALlStakesInfo;
