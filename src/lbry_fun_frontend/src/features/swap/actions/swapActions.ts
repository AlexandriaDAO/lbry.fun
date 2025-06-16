import { createAction } from '@reduxjs/toolkit';

// Normalized action to reset all success/error flags
export const resetSwapFlags = createAction('swap/resetFlags');

// Action to set active pool
export const setActiveSwapPool = createAction<[string, any] | null>('swap/setActiveSwapPool');

// Actions for UI state management  
export const setSwapLoading = createAction<{ operation: string; loading: boolean }>('swap/setLoading');
export const setSwapSuccess = createAction<{ operation: string; success: boolean }>('swap/setSuccess');
export const setSwapError = createAction<{ message: string; title: string } | null>('swap/setError');