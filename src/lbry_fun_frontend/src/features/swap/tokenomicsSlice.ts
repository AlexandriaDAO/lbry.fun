import {
  ActionReducerMapBuilder,
  createSlice,
} from "@reduxjs/toolkit";
import { toast } from "sonner";
import { analyticsThunks } from "./thunks/analyticsThunks";

// Destructure for easier access
const { getPrimaryMintRate, getTokenomicsInfo, getTotalPrimarySupply } = analyticsThunks;

// Define the interface for our node state
export interface TokenomicsState {
  primaryMintRate: string;
  totalPrimarySupply: string | null;
  currentPrimaryRate: string | null;
  currentSecondaryThreshold: string | null;
  currentThresholdIndex: number | null;
  totalSecondaryBurned: string | null;
  maxSecondaryThreshold: string | null;
  loading: boolean;
  error: string | null;
}

// Define the initial state using the ManagerState interface
const initialState: TokenomicsState = {
  primaryMintRate: "",
  totalPrimarySupply: null,
  currentPrimaryRate: null,
  currentSecondaryThreshold: null,
  currentThresholdIndex: null,
  totalSecondaryBurned: null,
  maxSecondaryThreshold: null,
  loading: false,
  error: null,
};

const tokenomicsSlice = createSlice({
  name: "tokenomics",
  initialState,
  reducers: {},
  extraReducers: (builder: ActionReducerMapBuilder<TokenomicsState>) => {
    builder
      .addCase(getPrimaryMintRate.pending, (state) => {
        // toast.info("Fetching ALEX mint rate!");
        state.loading = true;
        state.error = null;
      })
      .addCase(getPrimaryMintRate.fulfilled, (state, action) => {
        // toast.success("Fetched ALEX mint rate!");
        state.primaryMintRate = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(getPrimaryMintRate.rejected, (state, action) => {
        toast.error("Could not fetched ALEX mint rate!");
        state.loading = false;
        state.error = action.payload as string;
      })
      // Total primary supply
      .addCase(getTotalPrimarySupply.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getTotalPrimarySupply.fulfilled, (state, action) => {
        state.totalPrimarySupply = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(getTotalPrimarySupply.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || "Failed to fetch total supply";
      })
      // Tokenomics info
      .addCase(getTokenomicsInfo.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getTokenomicsInfo.fulfilled, (state, action) => {
        state.currentPrimaryRate = action.payload.currentPrimaryRate;
        state.currentSecondaryThreshold = action.payload.currentSecondaryThreshold;
        state.currentThresholdIndex = action.payload.currentThresholdIndex;
        state.totalSecondaryBurned = action.payload.totalSecondaryBurned;
        state.maxSecondaryThreshold = action.payload.maxSecondaryThreshold;
        state.loading = false;
        state.error = null;
      })
      .addCase(getTokenomicsInfo.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || "Failed to fetch tokenomics info";
      })
    
  },
});

export default tokenomicsSlice.reducer;
