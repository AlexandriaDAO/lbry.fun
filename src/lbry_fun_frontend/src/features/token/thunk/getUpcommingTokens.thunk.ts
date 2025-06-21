import { createAsyncThunk } from "@reduxjs/toolkit";
import { getLbryFunActor } from "@/features/auth/utils/authUtils";
import { ErrorMessage } from "@/features/swap/utlis/erorrs";
import { TokenRecord } from "../../../../../declarations/lbry_fun/lbry_fun.did";
import { TokenRecordStringified } from "./getTokenPools.thunk";

const getUpcomming = createAsyncThunk<
  [string, TokenRecordStringified][],
  void,
  { rejectValue: ErrorMessage }
>("lbry_fun/getUpcomming", async (_, { rejectWithValue }) => {
  try {
    const actor = await getLbryFunActor();
    const result = await actor.get_upcomming(); // returns [bigint, TokenRecord][]

    // Convert every BigInt to string
    const safeResult: [string, TokenRecordStringified][] = result.map(
      ([poolId, record]) => [
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
          logs_canister_id: record.logs_canister_id.toString(),
          halving_step: record.halving_step.toString(),
          primary_token_max_supply: record.primary_token_max_supply.toString(),
          initial_primary_mint: record.initial_primary_mint.toString(),
          initial_secondary_burn: record.initial_secondary_burn.toString(),
          created_time: record.created_time.toString(),
          pool_created_at: record.pool_created_at.toString(),
          pool_creation_failed: record.pool_creation_failed,
          isLive: false, // Since get_upcomming() already filters for non-live tokens
        },
      ]
    );

    return safeResult;
  } catch (error) {
    console.error(error);
    return rejectWithValue({
      title: "Unknown Error",
      message: "An unknown error occurred",
    });
  }
});

export default getUpcomming;
