import { createAsyncThunk } from "@reduxjs/toolkit";
import { getLbryFunActor } from "@/features/auth/utils/authUtils";
import { ErrorMessage } from "@/features/swap/utlis/erorrs";
import { TokenRecord } from "../../../../../declarations/lbry_fun/lbry_fun.did";

const getTokenPools = createAsyncThunk<
  [bigint, TokenRecord][],
  void,
  { rejectValue: ErrorMessage }
>("lbry_fun/getTokenPools", async (_, { rejectWithValue }) => {
  try {
    const actor = await getLbryFunActor();

    const result = await actor.get_all_token_record();

    return result as [bigint, TokenRecord][];
  } catch (error) {
    console.error(error);
    return rejectWithValue({
      title: "Unknown Error",
      message: "An unknown error occurred",
    });
  }
});

export default getTokenPools;
