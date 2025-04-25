import { ActionReducerMapBuilder, createSlice } from "@reduxjs/toolkit";
import { toast } from "sonner";
import createToken from "./createToken.thunk";
import { TokenRecord } from "../../../../../declarations/lbry_fun/lbry_fun.did";
import getTokenPools, { TokenRecordStringified } from "./getTokenPools.thunk";
import getUpcomming from "./getUpcommingTokens.thunk";
import getLiveTokens from "./getLiveTokens.thunk";

// Define the interface for our node state
export interface LbryFunState {
  loading: boolean;
  success: boolean;
  tokenPools: [string, TokenRecordStringified][];
  liveTokens: [string, TokenRecordStringified][];
  upcommingTokens: [string, TokenRecordStringified][];


  error: string | null;
}

// Define the initial state using the ManagerState interface
const initialState: LbryFunState = {
  success: false,
  loading: false,
  error: null,
  tokenPools: [],
  liveTokens: [],
  upcommingTokens:[]
};

const lbryFunSlice = createSlice({
  name: "LbryFun",
  initialState,
  reducers: {
    lbryFunFlagHandler: (state) => {
      state.success = false;
      state.error = null;
    },
  },
  extraReducers: (builder: ActionReducerMapBuilder<LbryFunState>) => {
    builder
      .addCase(createToken.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createToken.fulfilled, (state, action) => {
        state.success = true;
        state.loading = false;
        state.error = null;
      })
      .addCase(createToken.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.title ||"An unknown error occurred";
      })
      .addCase(getTokenPools.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getTokenPools.fulfilled, (state, action) => {
        state.tokenPools = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(getTokenPools.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload
          ? (action.payload as unknown as string)
          : "An unknown error occurred";
      })
      .addCase(getUpcomming.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getUpcomming.fulfilled, (state, action) => {
        state.upcommingTokens = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(getUpcomming.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload
          ? (action.payload as unknown as string)
          : "An unknown error occurred";
      })
      .addCase(getLiveTokens.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getLiveTokens.fulfilled, (state, action) => {
        state.liveTokens = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(getLiveTokens.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload
          ? (action.payload as unknown as string)
          : "An unknown error occurred";
      });
      
  },
});
export const { lbryFunFlagHandler } = lbryFunSlice.actions;
export default lbryFunSlice.reducer;
