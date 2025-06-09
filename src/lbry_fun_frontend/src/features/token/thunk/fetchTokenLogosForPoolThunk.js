import { createAsyncThunk } from "@reduxjs/toolkit";
import { fetchIcrc1Logo } from "../../../utils/logoUtils";
const fetchTokenLogosForPool = createAsyncThunk("token/fetchTokenLogosForPool", async (args, { rejectWithValue }) => {
    const { poolId, primaryTokenId, secondaryTokenId } = args;
    try {
        let primaryTokenLogo = undefined;
        let secondaryTokenLogo = undefined;
        if (primaryTokenId) {
            primaryTokenLogo = await fetchIcrc1Logo(primaryTokenId);
        }
        if (secondaryTokenId) {
            secondaryTokenLogo = await fetchIcrc1Logo(secondaryTokenId);
        }
        return { poolId, primaryTokenLogo, secondaryTokenLogo };
    }
    catch (error) {
        console.error("Error fetching token logos for pool:", poolId, error);
        return rejectWithValue(`Failed to fetch logos for pool ${poolId}`);
    }
});
export default fetchTokenLogosForPool;
