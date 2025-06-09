import { createAsyncThunk } from "@reduxjs/toolkit";
import { Principal } from "@dfinity/principal";
import { getICRCActor } from "@/features/auth/utils/authUtils";
// Define the async thunk
const transferSecondary = createAsyncThunk("icp_swap/transferSecondary", async ({ amount, destination, subaccount }, { getState, rejectWithValue }) => {
    try {
        const state = getState();
        if (!state.swap.activeSwapPool) {
            throw new Error("No active swap pool found");
        }
        const actor = await getICRCActor(state.swap.activeSwapPool?.[1].secondary_token_id);
        const amountFormat = BigInt(Math.floor(Number(amount) * 10 ** 8));
        let recipientAccount;
        recipientAccount = {
            owner: Principal.fromText(destination),
            subaccount: subaccount ? [subaccount] : [],
        };
        const transferArg = {
            to: recipientAccount,
            fee: [],
            memo: [],
            from_subaccount: [],
            created_at_time: [],
            amount: amountFormat
        };
        const result = await actor.icrc1_transfer(transferArg);
        if ("Ok" in result)
            return "success";
        else {
            console.log("error is ", result.Err);
            throw result.Err;
        }
    }
    catch (error) {
        console.error(error);
        if (error instanceof Error) {
            return rejectWithValue(error.message);
        }
    }
    return rejectWithValue("An unknown error occurred while transfering Secondary");
});
export default transferSecondary;
