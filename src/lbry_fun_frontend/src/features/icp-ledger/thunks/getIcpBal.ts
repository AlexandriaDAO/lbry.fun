import { ActorSubclass } from "@dfinity/agent";
import { _SERVICE } from "../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did";
import { createAsyncThunk } from "@reduxjs/toolkit";
import { TokenConversionService } from "@/utils/TokenConversionService";
import { Principal } from "@dfinity/principal";

// Define the async thunk
const getIcpBal = createAsyncThunk<
  {formatedAccountBal:string}, // This is the return type of the thunk's payload
  {
    actor: ActorSubclass<_SERVICE>;
    account: string;
  },
  { rejectValue: string }
>("icp_ledger/getIcpBal", async ({ actor, account }, { rejectWithValue }) => {
  try {
    // Validate account parameter
    if (!account || account === 'null' || account === 'undefined') {
      return { formatedAccountBal: "0.0000" };
    }
    let resultAccountBal = await actor.icrc1_balance_of({
      owner: Principal.fromText(account),
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

export default getIcpBal;
