import { ActorSubclass } from "@dfinity/agent";
import { _SERVICE, TransferArg } from "../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did";
import { createAsyncThunk } from "@reduxjs/toolkit";
import { Account } from "@dfinity/ledger-icp";
import { Principal } from "@dfinity/principal";
import { TokenConversionService } from "@/utils/TokenConversionService";

// Define the async thunk
const transferICP = createAsyncThunk<
  string, // This is the return type of the thunk's payload
  {
    actor: ActorSubclass<_SERVICE>;
    amount: string;
    destination: string;
    accountType: string;
  },
  { rejectValue: string }
>(
  "icp_ledger/transferICP",
  async ({ actor, amount, destination, accountType }, { rejectWithValue }) => {
    try {
      // Convert user input to e8s format for backend operations
      const amountFormat = TokenConversionService.naturalToE8s(amount);
      
      let recipientAccount: Account;
      if (accountType === "principal") {
        recipientAccount = {
          owner: Principal.fromText(destination),
          subaccount: [],
        };
      } else {
        // For account ID, we still need to convert to principal
        // This is a simplified approach - in reality you might need different handling
        recipientAccount = {
          owner: Principal.fromText(destination),
          subaccount: [],
        };
      }
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
    return rejectWithValue("An unknown error occurred while Swaping");
  }
);

export default transferICP;
