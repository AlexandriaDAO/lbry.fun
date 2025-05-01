import { TransferArg } from "../../../../../../declarations/ICRC/ICRC.did";

import { createAsyncThunk } from "@reduxjs/toolkit";
import { Principal } from "@dfinity/principal";
import { Account } from "@dfinity/ledger-icp";
import { getICRCActor } from "@/features/auth/utils/authUtils";
import { RootState } from "@/store";

// Define the async thunk
const transferPrimary = createAsyncThunk<
  string, // This is the return type of the thunk's payload
  {
    amount: string;
    destination: string;
  },
  { state: RootState; rejectValue: string }
>(
  "primary/transferPrimary",
  async ({ amount, destination }, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      if (!state.swap.activeSwapPool) {
        throw new Error("No active swap pool found");
      }
      const actor = await getICRCActor(
        state.swap.activeSwapPool?.[1].primary_token_id
      );
      const amountFormat = BigInt(Math.floor(Number(amount) * 10 ** 8));
      let recipientAccount: Account;
      recipientAccount = {
        owner: Principal.fromText(destination),
        subaccount: [],
      };

      const transferArg: TransferArg = {
        to: recipientAccount,
        fee: [], //default fee
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        amount: amountFormat,
      };
      const result = await actor.icrc1_transfer(transferArg);
      if ("Ok" in result) return "success";
      else {
        console.log("error is ", result.Err);
        throw result.Err;
      }
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
    }
    return rejectWithValue("An unknown error occurred while transfering ALEX");
  }
);

export default transferPrimary;
