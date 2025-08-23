import { ActorSubclass } from "@dfinity/agent";
import { createAsyncThunk } from "@reduxjs/toolkit";
import { ErrorMessage } from "@/features/swap/utils/errors";
import { _SERVICE, TokenRecord, TokenStatus } from "../../../../../declarations/lbry_fun/lbry_fun.did";
import fetchTokenLogosForPool from "./fetchTokenLogosForPoolThunk";

const getTokenPools = createAsyncThunk<
  [string, TokenRecordStringified][],
  { actor: ActorSubclass<_SERVICE> },
  { rejectValue: ErrorMessage; dispatch: any }
>("lbry_fun/getTokenPools", async ({ actor }, { rejectWithValue, dispatch }) => {
  try {
    const result = await actor.get_all_token_record(); // returns [bigint, TokenRecord][]

    // Convert every BigInt to string
   const safeResult: [string, TokenRecordStringified][] = result.map(([poolId, record]) => {
        const currentTime = Date.now() * 1000000; // Convert to nanoseconds
        
        // Calculate isLive status based on status field AND launch time
        // A token is live if it has Live status AND current time >= launched_at
        const hasLiveStatus = 'Live' in record.status;
        const launchedAtNanos = BigInt(record.launched_at);
        const currentTimeNanos = BigInt(currentTime);
        const isLive = hasLiveStatus && currentTimeNanos >= launchedAtNanos;
        
        return [
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
            initial_reward_per_burn_unit: (BigInt(record.initial_reward_per_burn_unit) / BigInt(100_000_000)).toString(),
            created_time: record.created_time.toString(),
            launched_at: record.launched_at.toString(),
            launch_delay_seconds: record.launch_delay_seconds.toString(),
            threshold_multiplier: record.threshold_multiplier,
            distribution_interval_seconds: record.distribution_interval_seconds.toString(),
            status: record.status,
            codebase_version: record.codebase_version,
            isLive: isLive,
          },
        ];
      });

    // After fetching pools, dispatch actions to fetch logos for each pool
    safeResult.forEach(pool => {
      const poolData = pool[1];
      // Check if logos are already fetched (e.g. by a previous call or another mechanism)
      // For simplicity, we can always dispatch, or add a check like:
      // if (!poolData.primary_token_logo_base64 && poolData.primary_token_id) { ... }
      // if (!poolData.secondary_token_logo_base64 && poolData.secondary_token_id) { ... }
      // However, the thunk itself is conditional, so just dispatching is fine.
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
    console.error('Error fetching token pools:', error instanceof Error ? error.message : 'Unknown error');
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
  logs_canister_id: string;
  halving_step: string;
  primary_token_max_supply: string;
  initial_primary_mint: string;
  primary_token_id: string;
  caller: string;
  initial_secondary_burn: string;
  initial_reward_per_burn_unit: string;
  created_time: string;
  launched_at: string;
  launch_delay_seconds: string;
  threshold_multiplier: number;
  distribution_interval_seconds: string;
  status: TokenStatus;
  codebase_version: string;
  isLive: boolean;
  primary_token_logo_base64?: string;
  secondary_token_logo_base64?: string;
};
