import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  getIcpLedgerActor,
  getLbryFunActor,
} from "@/features/auth/utils/authUtils";
import { ErrorMessage } from "@/features/swap/utlis/erorrs";
import { Principal } from "@dfinity/principal/lib/cjs";

// Define the thunk
const createToken = createAsyncThunk<
  boolean, // This is the return type of the thunk's payload
  { formData: any; userPrincipal: string },
  { rejectValue: ErrorMessage }
>(
  "lbry_fun/createToken",
  async ({ formData, userPrincipal }, { rejectWithValue }) => {
    try {
      const actorIcpLedger = await getIcpLedgerActor();
      const actor = await getLbryFunActor();

      let amountFormatApprove: bigint = BigInt(
        Number((Number(2) + 0.0001) * 10 ** 8).toFixed(0)
      );

      const lbry_fun_canister_id = process.env.CANISTER_ID_LBRY_FUN!;
      const checkApproval = await actorIcpLedger.icrc2_allowance({
        account: {
          owner: Principal.fromText(userPrincipal),
          subaccount: [],
        },
        spender: {
          owner: Principal.fromText(lbry_fun_canister_id),
          subaccount: [],
        },
      });
      if (checkApproval.allowance < amountFormatApprove) {
        const resultIcpApprove = await actorIcpLedger.icrc2_approve({
          spender: {
            owner: Principal.fromText(lbry_fun_canister_id),
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
          console.log("Error in icrc2_approve:", resultIcpApprove.Err);
          const error = resultIcpApprove.Err;
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          return rejectWithValue({
            title: "Operation Failed",
            message: errorMessage,
          });
        }
      }

      const result = await (actor.create_token as any)(
        formData.primary_token_name,
        formData.primary_token_symbol,
        formData.primary_token_description,
        formData.primary_token_logo_base64,
        formData.secondary_token_name,
        formData.secondary_token_symbol,
        formData.secondary_token_description,
        formData.secondary_token_logo_base64,
        BigInt(formData.primary_max_supply),
        BigInt(formData.primary_max_phase_mint),
        BigInt(formData.initial_primary_mint),
        BigInt(formData.initial_secondary_burn),
        BigInt(formData.halving_step),
        BigInt(formData.initial_reward_per_burn_unit)
      );

      if ("Ok" in result) {
        console.log("Token created successfully", result.Ok);
        return true;
      } else {
        return rejectWithValue({
          title: "Token creation failed" + result.Err,
          message: result.Err,
        });
      }
    } catch (error) {
      console.error(error);
      return rejectWithValue({
        title: "Unknown Error",
        message: "An unknown error occurred",
      });
    }
  }
);

export default createToken;
