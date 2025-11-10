import { ActorSubclass } from "@dfinity/agent";
import { createAsyncThunk } from "@reduxjs/toolkit";
import { ErrorMessage } from "@/features/swap/utils/errors";
import { Principal } from "@dfinity/principal/lib/cjs";
import { _SERVICE as LBRY_SERVICE } from "../../../../../declarations/lbry_fun/lbry_fun.did";
import { _SERVICE as ICP_SERVICE } from "../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did";

// Define the thunk
const createToken = createAsyncThunk<
  boolean, // This is the return type of the thunk's payload
  { 
    lbryFunActor: ActorSubclass<LBRY_SERVICE>;
    icpLedgerActor: ActorSubclass<ICP_SERVICE>;
    formData: any; 
    userPrincipal: string 
  },
  { rejectValue: ErrorMessage }
>(
  "lbry_fun/createToken",
  async ({ lbryFunActor, icpLedgerActor, formData, userPrincipal }, { rejectWithValue }) => {
    try {
      const actor = lbryFunActor;
      const actorIcpLedger = icpLedgerActor;

      let amountFormatApprove: bigint = BigInt(
        Number((Number(5) + 0.0001) * 10 ** 8).toFixed(0)
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

      const result = await actor.create_token(
        formData.primary_token_name,
        formData.primary_token_symbol,
        formData.primary_token_description,
        formData.primary_token_logo_base64,
        formData.secondary_token_name,
        formData.secondary_token_symbol,
        formData.secondary_token_description,
        formData.secondary_token_logo_base64,
        BigInt(formData.primary_max_supply),
        BigInt(formData.initial_primary_mint),
        BigInt(formData.initial_secondary_burn),
        BigInt(formData.halving_step),
        formData.threshold_multiplier,
        BigInt(formData.initial_reward_per_burn_unit),
        BigInt(formData.distribution_interval_seconds)
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
