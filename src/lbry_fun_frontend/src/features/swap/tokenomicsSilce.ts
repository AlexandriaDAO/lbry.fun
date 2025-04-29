import {
  ActionReducerMapBuilder,
  createSlice,
} from "@reduxjs/toolkit";
import { toast } from "sonner";
import getPrimaryMintRate from "./thunks/tokenomics/getPrimaryMintRate";
// Define the interface for our node state
export interface SwapState {
  primaryMintRate: string;
  loading: boolean;
  error: string | null;
}

// Define the initial state using the ManagerState interface
const initialState: SwapState = {
  primaryMintRate: "",
  loading: false,
  error: null,
};

const tokenomicsSlice = createSlice({
  name: "tokenomics",
  initialState,
  reducers: {},
  extraReducers: (builder: ActionReducerMapBuilder<SwapState>) => {
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
    
  },
});

export default tokenomicsSlice.reducer;
