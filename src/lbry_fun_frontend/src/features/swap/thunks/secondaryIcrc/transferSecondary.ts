import { createAsyncThunk } from "@reduxjs/toolkit";
import { Principal } from "@dfinity/principal";
import { Account } from "@dfinity/ledger-icp";
import { TokenConversionService } from "@/utils/TokenConversionService";
import { getICRCActor } from "@/features/auth/utils/authUtils";
import { RootState } from "@/store";
import { TransferArg } from "../../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did";

// Define the async thunk
const transferSecondary = createAsyncThunk<
  string,
  {
    amount: string;
    destination: string;
    subaccount?: number[];
  },
  { state: RootState, rejectValue: string }
>(
  "icp_swap/transferSecondary",
  async (
    { amount, destination, subaccount },
    {getState, rejectWithValue }
  ) => {
    try {
      const state = getState();
      if (!state.swap.activeSwapPool) {
        throw new Error("No active swap pool found");
      }
      const actor = await getICRCActor(state.swap.activeSwapPool?.[1].secondary_token_id);
      // Convert user input to e8s format for backend operations
      const amountFormat = TokenConversionService.naturalToE8s(amount);
      let recipientAccount: Account;
      
      recipientAccount = {
        owner: Principal.fromText(destination),
        subaccount: subaccount ? [subaccount] : [],
      };

      const transferArg: TransferArg = {
        to: recipientAccount,
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        amount: amountFormat
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
    return rejectWithValue(
      "An unknown error occurred while transfering Secondary"
    );
  }
);

export default transferSecondary;
