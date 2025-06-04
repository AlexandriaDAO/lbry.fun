import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Define the interface for our auth state
export interface AuthState {
    principal: string | null;
    isAuthenticated: boolean;
    isLoading: boolean; // For auth-related async operations (e.g., checking current II status)
    error: string | null;
    isInitialized: boolean; // True after initial auth check on app load
}

// Define the initial state using the AuthState interface
const initialState: AuthState = {
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
        setAuthLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        setAuthError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
        },
        setAuthInitialized: (state, action: PayloadAction<boolean>) => {
            state.isInitialized = action.payload;
            if (action.payload) { // When initialized, if not already loading, set loading to false.
                if (state.isLoading && !state.principal) { // If still loading but no principal, implies init check failed or user not logged in.
                    // This case might need more specific handling depending on app flow
                }
            }
        },
        setAuthSuccess: (state, action: PayloadAction<string>) => { // Sets principal on successful login
            state.principal = action.payload;
            state.isAuthenticated = true;
            state.isLoading = false;
            state.error = null;
        },
        clearAuth: (state) => { // Clears auth state on logout
            state.principal = null;
            state.isAuthenticated = false;
            state.isLoading = false;
            state.error = null;
        },
    },
});

export const { 
    setAuthLoading, 
    setAuthError, 
    setAuthInitialized, 
    setAuthSuccess, 
    clearAuth 
} = authSlice.actions;

export default authSlice.reducer;
