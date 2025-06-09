import { createSlice } from "@reduxjs/toolkit";
// Define the initial state using the LoginState interface
const initialState = {
    open: false,
    loading: false,
    error: null,
};
const loginSlice = createSlice({
    name: "login",
    initialState,
    reducers: {
        setError: (state, action) => {
            state.error = action.payload;
        },
        setLoading: (state, action) => {
            state.loading = action.payload;
        },
        setOpen: (state, action) => {
            state.open = action.payload;
        },
    },
    // extraReducers: (builder: ActionReducerMapBuilder<LoginState>) => {
    // \tbuilder
    // \t\t// login.ts
    // \t\t.addCase(login.pending, (state) => {
    // \t\t\tstate.loading = true;
    // \t\t\tstate.error = null;
    // \t\t})
    // \t\t.addCase(login.fulfilled, (state) => {
    // \t\t\tstate.loading = false;
    // \t\t\tstate.error = null;
    // \t\t})
    // \t\t.addCase(login.rejected, (state, action) => {
    // \t\t\tstate.loading = false;
    // \t\t\tstate.error = action.payload as string;
    // \t\t})
    // \t}
});
export const { setError, setLoading, setOpen } = loginSlice.actions;
export default loginSlice.reducer;
