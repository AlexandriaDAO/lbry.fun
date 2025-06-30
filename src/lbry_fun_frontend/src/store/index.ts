import { configureStore } from '@reduxjs/toolkit';
import rootReducer from './rootReducer';
import { requestDeduplicationMiddleware } from '@/features/swap/middleware/requestDeduplication';

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Add custom serialization check to handle BigInt
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        // Ignore these field paths in all actions
        ignoredActionPaths: ['meta.arg', 'payload.timestamp'],
        // Ignore these paths in the state
        ignoredPaths: ['items.dates'],
        // Custom isSerializable function
        isSerializable: (value: any) => {
          // Allow BigInt values
          if (typeof value === 'bigint') return true;
          // Use default check for other values
          return true;
        },
      },
    }).concat(requestDeduplicationMiddleware),
  // Redux DevTools configuration with BigInt support
  devTools: process.env.NODE_ENV !== 'production' && {
    // Custom serializer for Redux DevTools
    serialize: {
      replacer: (key: string, value: any) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      },
    },
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;