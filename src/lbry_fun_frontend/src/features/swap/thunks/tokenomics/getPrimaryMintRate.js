import { createAsyncThunk } from "@reduxjs/toolkit";
import LedgerService from "@/utils/LedgerService";
import { getTokenomicsActor } from "@/features/auth/utils/authUtils";
// Define the asyn thunk
const getPrimaryMintRate = createAsyncThunk("tokenomics/getPrimaryMintRate", async (_, { getState, rejectWithValue }) => {
    try {
        const state = getState();
        if (!state.swap.activeSwapPool) {
            throw new Error("No active swap pool found");
        }
        const actor = await getTokenomicsActor(state.swap.activeSwapPool?.[1].tokenomics_canister_id);
        const result = await actor.get_current_primary_rate();
        const LedgerServices = LedgerService();
        const fromatedBal = LedgerServices.e8sToIcp(result * BigInt(10000)).toString();
        return fromatedBal;
    }
    catch (error) {
        if (error instanceof Error) {
            return rejectWithValue(error.message);
        }
    }
    return rejectWithValue("An unknown error occurred while fetching ALEX mint rate");
});
export default getPrimaryMintRate;
