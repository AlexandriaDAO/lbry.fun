import { createSlice } from '@reduxjs/toolkit';
// Define the initial state using that type
const initialState = {
    activeTokenPageTab: 'CreateToken', // Default to CreateToken
};
export const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        setActiveTokenPageTab: (state, action) => {
            state.activeTokenPageTab = action.payload;
        },
    },
});
export const { setActiveTokenPageTab } = uiSlice.actions;
// Selector to get the active tab from the state
export const selectActiveTokenPageTab = (state) => state.ui.activeTokenPageTab;
export default uiSlice.reducer;
