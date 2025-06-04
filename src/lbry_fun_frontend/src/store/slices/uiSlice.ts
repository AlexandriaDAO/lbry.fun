import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store'; // Corrected path

// Define a type for the slice state
export type TokenPageActiveTab = 'CreateToken' | 'TokenPools';

interface UiState {
  activeTokenPageTab: TokenPageActiveTab;
}

// Define the initial state using that type
const initialState: UiState = {
  activeTokenPageTab: 'CreateToken', // Default to CreateToken
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActiveTokenPageTab: (state, action: PayloadAction<TokenPageActiveTab>) => {
      state.activeTokenPageTab = action.payload;
    },
  },
});

export const { setActiveTokenPageTab } = uiSlice.actions;

// Selector to get the active tab from the state
export const selectActiveTokenPageTab = (state: RootState) => state.ui.activeTokenPageTab;

export default uiSlice.reducer; 