import { createAsyncThunk } from "@reduxjs/toolkit";
import { getLbryFunActor } from "@/features/auth/utils/authUtils";
import { ErrorMessage } from "@/features/swap/utlis/erorrs";
import { TokenRecord } from "../../../../../declarations/lbry_fun/lbry_fun.did";
import { TokenRecordStringified } from "./getTokenPools.thunk";
import fetchTokenLogosForPool from "./fetchTokenLogosForPoolThunk";

const getLiveTokens = createAsyncThunk<
  [string, TokenRecordStringified][],
  void,
  { rejectValue: ErrorMessage; dispatch: any }
>("lbry_fun/getLiveTokens", async (_, { rejectWithValue, dispatch }) => {
  try {
    const actor = await getLbryFunActor();
    const result = await actor.get_live(); // returns [bigint, TokenRecord][]
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

    // After fetching live tokens, dispatch actions to fetch logos for each token
    safeResult.forEach(pool => {
      const poolData = pool[1];
      if (poolData.primary_token_id || poolData.secondary_token_id) {
        dispatch(fetchTokenLogosForPool({
          poolId: pool[0],
          primaryTokenId: poolData.primary_token_id,
          secondaryTokenId: poolData.secondary_token_id,
        }));
      }
    });

    return safeResult;
  } catch (error) {
    console.error(error);
    return rejectWithValue({
      title: "Unknown Error",
      message: "An unknown error occurred",
    });
  }
});

export default getLiveTokens;

// export type TokenRecordStringified = {
//   id: string;
//   secondary_token_symbol: string;
//   secondary_token_id: string;
//   primary_token_name: string;
//   tokenomics_canister_id: string;
//   secondary_token_name: string;
//   primary_token_symbol: string;
//   icp_swap_canister_id: string;
//   primary_max_phase_mint: string;
//   primary_token_max_supply: string;
//   initial_primary_mint: string;
//   primary_token_id: string;
//   caller: string;
//   initial_secondary_burn: string;
//   liquidity_provided_at: string | null;
//   isLive: boolean;
// };