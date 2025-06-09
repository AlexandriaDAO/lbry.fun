import { createAsyncThunk } from "@reduxjs/toolkit";
// Define the async thunk
const transferICPFromUserWalletcanister = createAsyncThunk("icp_swap/transferICPFromUserWalletcanister", async ({ actorSwap, destination, amount }, { rejectWithValue }) => {
    try {
        let amountFormatted8s = BigInt(Math.floor(Number(amount) * 10 ** 8));
        let fee = BigInt(10000);
        amountFormatted8s = amountFormatted8s - fee;
        //@ts-ignore
        const result = await actorSwap.transfer_from_user_wallet(amountFormatted8s, destination);
        if ('Ok' in result)
            return "success";
        if ('Err' in result)
            throw new Error(result.Err);
    }
    catch (error) {
        console.error(error);
        if (error instanceof Error) {
            return rejectWithValue(error.message);
        }
    }
    return rejectWithValue("An unknown error occurred while burning Secondary");
});
export default transferICPFromUserWalletcanister;
