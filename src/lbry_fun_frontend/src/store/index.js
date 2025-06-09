import { configureStore } from '@reduxjs/toolkit';
import rootReducer from './rootReducer';
export const store = configureStore({
    reducer: rootReducer,
    // enable to hide redux devtools in production
    // devTools: false,
});
