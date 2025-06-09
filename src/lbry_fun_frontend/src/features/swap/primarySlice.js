import { createSlice, } from "@reduxjs/toolkit";
import { toast } from "sonner";
import getAccountPrimaryBalance from "./thunks/primaryIcrc/getAccountPrimaryBalance";
import transferPrimary from "./thunks/primaryIcrc/transferPrimary";
import getPrimaryFee from "./thunks/primaryIcrc/getPrimaryFee";
import getPrimaryPrice from "./thunks/primaryIcrc/getPrimaryPrice";
// Define the initial state using the ManagerState interface
const initialState = {
    primaryBal: "0",
    loading: false,
    primaryPriceUsd: "0",
    transferSuccess: false,
    primaryFee: "0",
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
    extraReducers: (builder) => {
        builder
            .addCase(getAccountPrimaryBalance.pending, (state) => {
            state.loading = true;
            state.error = null;
        })
            .addCase(getAccountPrimaryBalance.fulfilled, (state, action) => {
            state.primaryBal = action.payload;
            state.loading = false;
            state.error = null;
        })
            .addCase(getAccountPrimaryBalance.rejected, (state, action) => {
            state.loading = false;
            state.error = action.payload;
        })
            .addCase(transferPrimary.pending, (state) => {
            toast.info("Processing ALEX transfer!");
            state.loading = true;
            state.error = null;
        })
            .addCase(transferPrimary.fulfilled, (state, action) => {
            toast.success("Successfully transfered!");
            state.transferSuccess = true;
            state.loading = false;
            state.error = null;
        })
            .addCase(transferPrimary.rejected, (state, action) => {
            toast.error("Error while transfering ALEX");
            state.loading = false;
            state.error = action.payload;
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
            state.error = action.payload;
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
        });
    },
});
export const { primaryFlagHandler } = primarySlice.actions;
export default primarySlice.reducer;
