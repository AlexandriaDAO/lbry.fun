import { createAsyncThunk } from "@reduxjs/toolkit";
import { getLbryFunActor } from "@/features/auth/utils/authUtils";
const getUpcomming = createAsyncThunk("lbry_fun/getUpcomming", async (_, { rejectWithValue }) => {
    try {
        const actor = await getLbryFunActor();
        const result = await actor.get_upcomming(); // returns [bigint, TokenRecord][]
        // Convert every BigInt to string
        const safeResult = result.map(([poolId, record]) => [
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
                created_time: record.created_time.toString(),
                liquidity_provided_at: record.liquidity_provided_at
                    ? record.liquidity_provided_at.toString()
                    : null,
                isLive: record.is_live,
            },
        ]);
        return safeResult;
    }
    catch (error) {
        console.error(error);
        return rejectWithValue({
            title: "Unknown Error",
            message: "An unknown error occurred",
        });
    }
});
export default getUpcomming;
