import { createAsyncThunk } from "@reduxjs/toolkit";
import { Principal } from "@dfinity/principal";
import { TokenConversionService } from "@/utils/TokenConversionService";
import { getActorSwap, getICRCActor } from "@/features/auth/utils/authUtils";
import { ErrorMessage, getErrorMessage } from "../utlis/erorrs";
import { RootState } from "@/store";

// Define the async thunk
const stakePrimary = createAsyncThunk<
  string, // This is the return type of the thunk's payload
  { amount: string; userPrincipal: string },
  { state: RootState; rejectValue: ErrorMessage }
>(
  "icp_swap/stakePrimary",
  async ({ amount, userPrincipal }, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      if (!state.swap.activeSwapPool) {
        throw new Error("No active swap pool found");
      }
      const actor = await getICRCActor(
        state.swap.activeSwapPool?.[1].primary_token_id
      );
      const icp_swap_canister_id =       state.swap.activeSwapPool?.[1].icp_swap_canister_id;
      
      // Convert user input to e8s format for backend operations
      const amountFormat = TokenConversionService.naturalToE8s(amount);

      // Get the primary token fee from state and convert to e8s
      const primaryFee = state.primary.primaryFee;
      const feeInE8s = TokenConversionService.naturalToE8s(primaryFee);
      
      // Add fee buffer to approval amount
      const approvalAmount = amountFormat + feeInE8s;

      const checkApproval = await actor.icrc2_allowance({
        account: {
          owner: Principal.fromText(userPrincipal),
          subaccount: [],
        },
        spender: {
          owner: Principal.fromText(icp_swap_canister_id),
          subaccount: [],
        },
      });

      if (checkApproval.allowance < approvalAmount) {
        const resultPrimaryApprove = await actor.icrc2_approve({
          spender: {
            owner: Principal.fromText(icp_swap_canister_id),
            subaccount: [],
          },
          amount: approvalAmount,
          fee: [],
          memo: [],
          from_subaccount: [],
          created_at_time: [],
          expected_allowance: [],
          expires_at: [],
        });
        if ("Err" in resultPrimaryApprove) {
          const error = resultPrimaryApprove.Err;
          let errorMessage = "Insufficent funds"; // Default error message
          if ("TemporarilyUnavailable" in error) {
            errorMessage = "Service is temporarily unavailable";
          }
          throw new Error(errorMessage);
        }
      }

      const actorSwap = await getActorSwap(icp_swap_canister_id);
      const result = await actorSwap.stake_primary(amountFormat, []);
      if ("Ok" in result) return "success";
      if ("Err" in result) {
        const errorMessage = getErrorMessage(result.Err);
        return rejectWithValue(errorMessage);
      }
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue({ title: error.message, message: "" });
      }
    }
    return rejectWithValue({
      title: "An unknown error occurred while Staking",
      message: "",
    });
  }
);

export default stakePrimary;
