import { ActorSubclass } from "@dfinity/agent";
import { _SERVICE as _SERVICELBRY } from "../../../../../../declarations/ICRC/ICRC.did";

import { createAsyncThunk } from "@reduxjs/toolkit";
import { Principal } from "@dfinity/principal";
import LedgerService from "@/utils/LedgerService";
import { getICRCActor } from "@/features/auth/utils/authUtils";

// Define the async thunk
const getSecondaryBalance = createAsyncThunk<
  string, // This is the return type of the thunk's payload
  {account:string,canisterId:string}, // This is the argument type
  { rejectValue: string }
>(
  "icp_swap/getSecondaryBalance",
  async ({account,canisterId}, { rejectWithValue }) => {
    try {
      const actor = await getICRCActor(canisterId);
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
      "An unknown error occurred while getting LBRY balance"
    );
  }
);

export default getSecondaryBalance;
