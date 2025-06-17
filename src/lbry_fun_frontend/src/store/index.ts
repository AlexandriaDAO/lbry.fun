import { configureStore } from '@reduxjs/toolkit';
import rootReducer from './rootReducer';
import { requestDeduplicationMiddleware } from '@/features/swap/middleware/requestDeduplication';

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(requestDeduplicationMiddleware),
  // enable to hide redux devtools in production
  // devTools: false,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;