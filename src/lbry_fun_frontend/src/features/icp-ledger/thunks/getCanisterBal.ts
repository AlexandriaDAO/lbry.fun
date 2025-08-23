import { createAsyncThunk } from "@reduxjs/toolkit";
import { TokenConversionService } from "@/utils/TokenConversionService";
import { Principal } from "@dfinity/principal";
import { ActorSubclass } from "@dfinity/agent";
import { _SERVICE } from "../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did";
import { RootState } from "@/store";

// Define the async thunk
const getCanisterBal = createAsyncThunk<
  {formatedAccountBal:string}, // This is the return type of the thunk's payload
  { actor: ActorSubclass<_SERVICE> },
  { state: RootState,rejectValue: string }
>("icp_ledger/getCanisterBal", async ( { actor },{ getState,rejectWithValue }) => {
  try {
    const state = getState();

    if (!state.swap.activeSwapPool) {
      throw new Error("No active swap pool found");
    }
    const icp_swap_canister_id = state.swap.activeSwapPool?.[1].icp_swap_canister_id;

    let resultAccountBal = await actor.icrc1_balance_of({
      owner: Principal.fromText(icp_swap_canister_id),
      subaccount: []
    });
    const formatedAccountBal = (Math.floor(TokenConversionService.e8sToNatural(resultAccountBal) * 10 ** 4) / 10 ** 4).toFixed(4);
    return ({formatedAccountBal})
  } catch (error) {
    console.error("Failed to get ICP Balance:", error);

    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }
  }
  return rejectWithValue(
    "An unknown error occurred while fetching ICP balance"
  );
});

export default getCanisterBal;
