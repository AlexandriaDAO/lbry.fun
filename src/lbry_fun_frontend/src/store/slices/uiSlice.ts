import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store'; // Corrected path

// Define a type for the slice state
export type TokenPageView = 'CreateToken' | 'TokenPools';

interface UiState {
  activeTokenView: TokenPageView;
}

// Define the initial state using that type
const initialState: UiState = {
  activeTokenView: 'TokenPools', // Default to TokenPools
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActiveTokenView: (state, action: PayloadAction<TokenPageView>) => {
      state.activeTokenView = action.payload;
    },
  },
});

export const { setActiveTokenView } = uiSlice.actions;

// Selector to get the active view from the state
export const selectActiveTokenView = (state: RootState) => state.ui.activeTokenView;

export default uiSlice.reducer; 