import {
  ActionReducerMapBuilder,
  createSlice,
} from "@reduxjs/toolkit";
import { toast } from "sonner";
import createToken from "./createToken.thunk";
// Define the interface for our node state
export interface LbryFunState {
  
  loading: boolean;
  success:boolean;

  error: string | null;
}

// Define the initial state using the ManagerState interface
const initialState: LbryFunState = {
  success: false,
  loading: false,
  error: null,
};

const lbryFunSlice = createSlice({
  name: "LbryFun",
  initialState,
  reducers: {
    alexFlagHandler: (state) => {
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
        state.success = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(createToken.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ? (action.payload as unknown as string) : "An unknown error occurred";
      })
  },
});
export const { alexFlagHandler } = lbryFunSlice.actions;
export default lbryFunSlice.reducer;
