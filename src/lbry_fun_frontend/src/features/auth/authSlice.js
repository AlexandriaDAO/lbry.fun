import { createSlice } from "@reduxjs/toolkit";
// Define the initial state using the AuthState interface
const initialState = {
    principal: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    isInitialized: false,
};
const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        setAuthLoading: (state, action) => {
            state.isLoading = action.payload;
        },
        setAuthError: (state, action) => {
            state.error = action.payload;
        },
        setAuthInitialized: (state, action) => {
            state.isInitialized = action.payload;
            if (action.payload) { // When initialized, if not already loading, set loading to false.
                if (state.isLoading && !state.principal) { // If still loading but no principal, implies init check failed or user not logged in.
                    // This case might need more specific handling depending on app flow
                }
            }
        },
        setAuthSuccess: (state, action) => {
            state.principal = action.payload;
            state.isAuthenticated = true;
            state.isLoading = false;
            state.error = null;
        },
        clearAuth: (state) => {
            state.principal = null;
            state.isAuthenticated = false;
            state.isLoading = false;
            state.error = null;
        },
    },
});
export const { setAuthLoading, setAuthError, setAuthInitialized, setAuthSuccess, clearAuth } = authSlice.actions;
export default authSlice.reducer;
