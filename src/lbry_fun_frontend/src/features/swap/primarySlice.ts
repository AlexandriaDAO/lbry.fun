import {
  ActionReducerMapBuilder,
  createSlice,
} from "@reduxjs/toolkit";
import { toast } from "sonner";
import { balanceThunks } from "./thunks/balanceThunks";
import { tradingThunks } from "./thunks/tradingThunks";

// Destructure for easier access
const { getPrimaryBalance, getPrimaryFee, getPrimaryPrice } = balanceThunks;
const { transferPrimary } = tradingThunks;
// Define the interface for our node state
export interface PrimaryState {
  primaryBal: string;
  primaryFee:string;
  loading: boolean;
  transferSuccess:boolean;
  primaryPriceUsd:string;
  error: string | null;
}

// Define the initial state using the ManagerState interface
const initialState: PrimaryState = {
  primaryBal: "0",
  loading: false,
  primaryPriceUsd:"0",
  transferSuccess:false,
  primaryFee:"0",
  error: null,
};

const primarySlice = createSlice({
  name: "primary",
  initialState,
  reducers: {
    primaryFlagHandler: (state) => {
      state.transferSuccess = false;
      state.error = null;
    },
  },
  extraReducers: (builder: ActionReducerMapBuilder<PrimaryState>) => {
    builder
      .addCase(getPrimaryBalance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getPrimaryBalance.fulfilled, (state, action) => {
        state.primaryBal = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(getPrimaryBalance.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(transferPrimary.pending, (state) => {
        toast.info("[PROCESSING] ALEX TRANSFER...");
        state.loading = true;
        state.error = null;
      })
      .addCase(transferPrimary.fulfilled, (state, action) => {
        toast.success("[SUCCESS] TRANSFER COMPLETE");
        state.transferSuccess = true;
        state.loading = false;
        state.error = null;
      })
      .addCase(transferPrimary.rejected, (state, action) => {
        toast.error("[ERROR] ALEX TRANSFER FAILED");
        state.loading = false;
        state.error = action.payload as string;
      }).addCase(getPrimaryFee.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getPrimaryFee.fulfilled, (state, action) => {
        state.primaryFee = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(getPrimaryFee.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      }).addCase(getPrimaryPrice.fulfilled, (state, action) => {
        state.primaryPriceUsd = action.payload;
        state.loading = false;
      })
      .addCase(getPrimaryPrice.pending, (state) => {
        state.loading = true;
      })
      .addCase(getPrimaryPrice.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to get ALEX/USD price!";
      })
  },
});
export const { primaryFlagHandler } = primarySlice.actions;
export default primarySlice.reducer;
