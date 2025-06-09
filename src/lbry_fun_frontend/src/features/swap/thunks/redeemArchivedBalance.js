import { createAsyncThunk } from "@reduxjs/toolkit";
import { getActorSwap } from "@/features/auth/utils/authUtils";
import { getErrorMessage } from "../utlis/erorrs";
// Define the async thunk
const redeemArchivedBalance = createAsyncThunk("icp_swap/redeemArchivedBalance", async (_, { getState, rejectWithValue }) => {
    try {
        const state = getState();
        if (!state.swap.activeSwapPool) {
            throw new Error("No active swap pool found");
        }
        const actor = await getActorSwap(state.swap.activeSwapPool?.[1].icp_swap_canister_id);
        const result = await actor.redeem([]);
        if ("Ok" in result)
            return "success";
        else if ("Err" in result) {
            const errorMessage = getErrorMessage(result.Err);
            return rejectWithValue(errorMessage);
        }
    }
    catch (error) {
        console.error(error);
        if (error instanceof Error) {
            return rejectWithValue({ title: error.message, message: "" });
        }
    }
    return rejectWithValue({ title: "An unknown error occurred while unstaking", message: "" });
});
export default redeemArchivedBalance;
