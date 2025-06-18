import { ActionReducerMapBuilder, createSlice } from "@reduxjs/toolkit";
import createToken from "./thunk/createToken.thunk";
import getTokenPools, {
  TokenRecordStringified,
} from "./thunk/getTokenPools.thunk";
import getUpcomming from "./thunk/getUpcommingTokens.thunk";
import getLiveTokens from "./thunk/getLiveTokens.thunk";
import fetchTokenLogosForPool from "./thunk/fetchTokenLogosForPoolThunk";
import { ErrorMessage } from "@/features/swap/utlis/erorrs";
import previewTokenomics from "./thunk/previewTokenomics.thunk";
import getPoolsTvl, { TokenTvlMap } from "./thunk/getPoolsTvl.thunk";

export interface GraphData {
  cumulative_supply_data_x: string[];
  cumulative_supply_data_y: string[];
  minted_per_epoch_data_x: string[];
  minted_per_epoch_data_y: string[];
  cost_to_mint_data_x: string[];
  cost_to_mint_data_y: number[];
  cumulative_usd_cost_data_x: string[];
  cumulative_usd_cost_data_y: number[];
}

// Define the interface for our node state
export interface LbryFunState {
  loading: boolean;
  success: boolean;
  tokenPools: [string, TokenRecordStringified][];
  liveTokens: [string, TokenRecordStringified][];
  upcommingTokens: [string, TokenRecordStringified][];
  error: ErrorMessage | null;
  previewGraphData: GraphData | null;
  previewLoading: boolean;
  previewError: string | null;
  tvlData: TokenTvlMap;
  tvlLoading: boolean;
}

// Define the initial state using the ManagerState interface
const initialState: LbryFunState = {
  success: false,
  loading: false,
  error: null,
  tokenPools: [],
  liveTokens: [],
  upcommingTokens: [],
  previewGraphData: null,
  previewLoading: false,
  previewError: null,
  tvlData: {},
  tvlLoading: false,
};

const lbryFunSlice = createSlice({
  name: "LbryFun",
  initialState,
  reducers: {
    lbryFunFlagHandler: (state) => {
      state.success = false;
      state.error = null;
    },
    clearPreviewError: (state) => {
      state.previewError = null;
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
        // Failed to fetch token logos - background task, no user-facing error
        // No user-facing error toast or loading state for now as it's a background task
      })
      .addCase(previewTokenomics.pending, (state) => {
        state.previewLoading = true;
        state.previewError = null;
      })
      .addCase(previewTokenomics.fulfilled, (state, action) => {
        state.previewLoading = false;
        state.previewGraphData = action.payload;
      })
      .addCase(previewTokenomics.rejected, (state, action) => {
        state.previewLoading = false;
        state.previewError = action.payload?.message ?? 'An unknown error occurred';
      })
      .addCase(getPoolsTvl.pending, (state) => {
        state.tvlLoading = true;
      })
      .addCase(getPoolsTvl.fulfilled, (state, action) => {
        state.tvlLoading = false;
        state.tvlData = action.payload;
      })
      .addCase(getPoolsTvl.rejected, (state, action) => {
        state.tvlLoading = false;
        // TVL loading failure is non-critical, just log it
        console.warn("Failed to load TVL data:", action.payload);
      });
  },
});
export const { lbryFunFlagHandler, clearPreviewError } = lbryFunSlice.actions;
export default lbryFunSlice.reducer;