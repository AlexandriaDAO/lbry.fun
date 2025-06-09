import { ActionReducerMapBuilder, createSlice } from "@reduxjs/toolkit";
import createToken from "./thunk/createToken.thunk";
import getTokenPools, {
  TokenRecordStringified,
} from "./thunk/getTokenPools.thunk";
import getUpcomming from "./thunk/getUpcommingTokens.thunk";
import getLiveTokens from "./thunk/getLiveTokens.thunk";
import fetchTokenLogosForPool from "./thunk/fetchTokenLogosForPoolThunk";
import { ErrorMessage } from "@/features/swap/utlis/erorrs";

// Define the interface for our node state
export interface LbryFunState {
  loading: boolean;
  success: boolean;
  tokenPools: [string, TokenRecordStringified][];
  liveTokens: [string, TokenRecordStringified][];
  upcommingTokens: [string, TokenRecordStringified][];
  error: ErrorMessage | null;
}

// Define the initial state using the ManagerState interface
const initialState: LbryFunState = {
  success: false,
  loading: false,
  error: null,
  tokenPools: [],
  liveTokens: [],
  upcommingTokens: [],
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
        state.error = action.payload ?? {
          title: "Token Creation Failed",
          message: "An unknown error occurred.",
        };
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
        state.error = action.payload ?? {
          title: "Get Token Pools Failed",
          message: "An unknown error occurred.",
        };
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
        state.error = action.payload ?? {
          title: "Get Upcoming Tokens Failed",
          message: "An unknown error occurred.",
        };
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
        state.error = action.payload ?? {
          title: "Get Live Tokens Failed",
          message: "An unknown error occurred.",
        };
      })
      .addCase(fetchTokenLogosForPool.fulfilled, (state, action) => {
        const { poolId, primaryTokenLogo, secondaryTokenLogo } =
          action.payload;
        const updateLogos = (
          pool: [string, TokenRecordStringified]
        ): [string, TokenRecordStringified] => {
          if (pool[0] === poolId) {
            const updatedRecord = { ...pool[1] };
            if (primaryTokenLogo !== undefined) {
              updatedRecord.primary_token_logo_base64 = primaryTokenLogo;
            }
            if (secondaryTokenLogo !== undefined) {
              updatedRecord.secondary_token_logo_base64 = secondaryTokenLogo;
            }
            return [pool[0], updatedRecord];
          }
          return pool;
        };
        state.tokenPools = state.tokenPools.map(updateLogos);
        state.liveTokens = state.liveTokens.map(updateLogos);
        // No loading state change here as it's a background update
      })
      .addCase(fetchTokenLogosForPool.rejected, (state, action) => {
        // Optionally handle logo fetching errors, e.g., log them
        console.warn("Failed to fetch token logos:", action.payload);
        // No user-facing error toast or loading state for now as it's a background task
      });
  },
});
export const { lbryFunFlagHandler } = lbryFunSlice.actions;
export default lbryFunSlice.reducer;