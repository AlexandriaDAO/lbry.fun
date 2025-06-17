import { createAsyncThunk } from "@reduxjs/toolkit";
import { Principal } from "@dfinity/principal";
import { TokenConversionService } from "@/utils/TokenConversionService";
import {
  getActorSwap,
  getIcpLedgerActor,
  validateActor,
} from "@/features/auth/utils/authUtils";
import { ErrorMessage, getErrorMessage } from "../utlis/erorrs";
// Define the async thunk
const swapSecondary = createAsyncThunk<
  string, // This is the return type of the thunk's payload
  { amount: string; userPrincipal: string,canisterId:string },
  { rejectValue: ErrorMessage }
>(
  "icp_swap/swapSecondary",
  async ({ amount, userPrincipal,canisterId }, { rejectWithValue }) => {
    try {
      const actorSwap = await getActorSwap(canisterId);
      
      // Validate ICP Swap actor before using it
      if (!validateActor(actorSwap, "ICP Swap")) {
        return rejectWithValue({ 
          title: "Unable to connect to ICP swap canister", 
          message: "Please ensure you are authenticated." 
        });
      }
      
      const actorIcpLedger = await getIcpLedgerActor();
      
      // Validate ICP Ledger actor before using it
      if (!validateActor(actorIcpLedger, "ICP Ledger")) {
        return rejectWithValue({ 
          title: "Unable to connect to ICP ledger canister", 
          message: "Please ensure you are authenticated." 
        });
      }
      // Convert user input to e8s format for backend operations
      const amountFormat = TokenConversionService.naturalToE8s(amount);
      // Add fee buffer for approval (0.0001 ICP fee)
      const amountFormatApprove = TokenConversionService.naturalToE8s(Number(amount) + 0.0001);

      const checkApproval = await actorIcpLedger.icrc2_allowance({
        account: {
          owner: Principal.fromText(userPrincipal),
          subaccount: [],
        },
        spender: {
          owner: Principal.fromText(canisterId),
          subaccount: [],
        },
      });
      if (checkApproval.allowance < amountFormatApprove) {
        const resultIcpApprove = await actorIcpLedger.icrc2_approve({
          spender: {
            owner: Principal.fromText(canisterId),
            subaccount: [],
          },
          amount: amountFormatApprove,
          fee: [BigInt(10000)],
          memo: [],
          from_subaccount: [],
          created_at_time: [],
          expected_allowance: [],
          expires_at: [],
        });
        if ("Err" in resultIcpApprove) {
          const error = resultIcpApprove.Err;
          let errorMessage = "Unknown error"; // Default error message
          if ("TemporarilyUnavailable" in error) {
            errorMessage = "Service is temporarily unavailable";
          }
          throw new Error(errorMessage);
        }
      }

      const result = await actorSwap.swap(amountFormat, []);
      if ("Ok" in result) return "success";
      if ("Err" in result) {
        const errorMessage = getErrorMessage(result.Err);
        return rejectWithValue(errorMessage);
      }
    } catch (error) {
      console.error(error);

      if (error instanceof Error) {
        return rejectWithValue({title:error.message,message:""});
      }
    }
    return rejectWithValue({title:"An unknown error occurred while Swapping",message:""});
  }
);

export default swapSecondary;
