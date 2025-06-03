import { ActorSubclass } from "@dfinity/agent";
import { _SERVICE as _SERVICESWAP } from "../../../../../declarations/icp_swap/icp_swap.did";
import { _SERVICE as _SERVICEALEX } from "../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did";
import { createAsyncThunk } from "@reduxjs/toolkit";
import { Principal } from "@dfinity/principal";
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
      
      let amountFormat: bigint = BigInt(
        Number(Number(amount) * 10 ** 8).toFixed(0)
      );

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

      if (checkApproval.allowance < amountFormat) {
        const resultPrimaryApprove = await actor.icrc2_approve({
          spender: {
            owner: Principal.fromText(icp_swap_canister_id),
            subaccount: [],
          },
          amount: amountFormat,
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
      console.log("result is is ", result);
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
