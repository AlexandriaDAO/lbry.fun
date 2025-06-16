// TODO: Get primary price dynamically from kongswap canister




import { createAsyncThunk } from "@reduxjs/toolkit";

const getPrimaryPrice = createAsyncThunk<string, void, { rejectValue: string }>(
  "primary/getPrimaryPrice",
  async (_, { rejectWithValue }) => {
    try {
      // const factorySwapCanister = await getIcpSwapFactoryCanister();
      // const poolData = await factorySwapCanister.getPoolsForToken(
      //   "ysy5f-2qaaa-aaaap-qkmmq-cai"
      // );
      // return poolData[0].token0Price.toString();
      return "1";
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue(
        "An unknown error occurred while fetching ALEX price"
      );
    }
  }
);

export default getPrimaryPrice;
