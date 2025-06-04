import { createAsyncThunk } from "@reduxjs/toolkit";
import { fetchIcrc1Logo } from "../../../utils/logoUtils";
import { TokenRecordStringified } from "./getTokenPools.thunk"; // Assuming TokenRecordStringified might be useful here or for RootState

interface FetchTokenLogosArgs {
  poolId: string;
  primaryTokenId?: string;
  secondaryTokenId?: string;
}

interface FetchTokenLogosResult {
  poolId: string;
  primaryTokenLogo?: string;
  secondaryTokenLogo?: string;
}

const fetchTokenLogosForPool = createAsyncThunk<
  FetchTokenLogosResult,
  FetchTokenLogosArgs,
  { rejectValue: string }
>("token/fetchTokenLogosForPool", async (args, { rejectWithValue }) => {
  const { poolId, primaryTokenId, secondaryTokenId } = args;

  try {
    let primaryTokenLogo: string | undefined = undefined;
    let secondaryTokenLogo: string | undefined = undefined;

    if (primaryTokenId) {
      primaryTokenLogo = await fetchIcrc1Logo(primaryTokenId);
    }

    if (secondaryTokenId) {
      secondaryTokenLogo = await fetchIcrc1Logo(secondaryTokenId);
    }

    return { poolId, primaryTokenLogo, secondaryTokenLogo };
  } catch (error) {
    console.error("Error fetching token logos for pool:", poolId, error);
    return rejectWithValue(`Failed to fetch logos for pool ${poolId}`);
  }
});

export default fetchTokenLogosForPool; 