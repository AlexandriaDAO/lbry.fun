import { createAsyncThunk } from "@reduxjs/toolkit";
import { getLbryFunActor } from "@/features/auth/utils/authUtils";
import { ErrorMessage } from "@/features/swap/utlis/erorrs";
import { TokenRecord } from "../../../../../declarations/lbry_fun/lbry_fun.did";

const getTokenPools = createAsyncThunk<
  [string, TokenRecordStringified][],
  void,
  { rejectValue: ErrorMessage }
>("lbry_fun/getTokenPools", async (_, { rejectWithValue }) => {
  try {
    const actor = await getLbryFunActor();
    const result = await actor.get_all_token_record(); // returns [bigint, TokenRecord][]

    // Convert every BigInt to string
   const safeResult: [string, TokenRecordStringified][] = result.map(([poolId, record]) => [
        poolId.toString(),
        {
          primary_token_name: record.primary_token_name,
          primary_token_symbol: record.primary_token_symbol,
          secondary_token_name: record.secondary_token_name,
          secondary_token_symbol: record.secondary_token_symbol,
          id: record.id.toString(),
          icp_swap_canister_id: record.icp_swap_canister_id.toString(),
          caller: record.caller.toString(),
          primary_token_id: record.primary_token_id.toString(),
          secondary_token_id: record.secondary_token_id.toString(),
          tokenomics_canister_id: record.tokenomics_canister_id.toString(),
          primary_max_phase_mint: record.primary_max_phase_mint.toString(),
          primary_token_max_supply: record.primary_token_max_supply.toString(),
          initial_primary_mint: record.initial_primary_mint.toString(),
          initial_secondary_burn: record.initial_secondary_burn.toString(),
          liquidity_provided_at: record.liquidity_provided_at ? record.liquidity_provided_at.toString() : null,
          isLive: record.is_live,
        },
      ]);

    return safeResult;
  } catch (error) {
    console.error(error);
    return rejectWithValue({
      title: "Unknown Error",
      message: "An unknown error occurred",
    });
  }
});


export default getTokenPools;


export type TokenRecordStringified = {
  id: string;
  secondary_token_symbol: string;
  secondary_token_id: string;
  primary_token_name: string;
  tokenomics_canister_id: string;
  secondary_token_name: string;
  primary_token_symbol: string;
  icp_swap_canister_id: string;
  primary_max_phase_mint: string;
  primary_token_max_supply: string;
  initial_primary_mint: string;
  primary_token_id: string;
  caller: string;
  initial_secondary_burn: string;
  liquidity_provided_at: string | null;
  isLive: boolean;
  primary_token_logo_base64?: string;

};
