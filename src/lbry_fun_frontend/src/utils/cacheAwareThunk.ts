/**
 * Helper utility to create cache-aware thunks that check Redux state before making API calls
 */

import { createAsyncThunk } from "@reduxjs/toolkit";
import { RootState } from "@/store";
import { CacheableData, shouldFetchData, recordCacheHit, recordCacheMiss } from "./cacheManager";

export interface CacheAwareThunkConfig {
  name: string;
  cacheDuration: number;
  getCachedData: (state: RootState) => CacheableData;
  fetchData: (state: RootState) => Promise<any>;
  requiresAuth?: boolean;
  requiresActivePool?: boolean;
}

/**
 * Creates a cache-aware async thunk that checks cache before fetching
 */
export function createCacheAwareThunk<T>(config: CacheAwareThunkConfig) {
  return createAsyncThunk<
    T,
    void,
    {
      state: RootState;
      rejectValue: string;
    }
  >(config.name, async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();

      // Check authentication requirements
      if (config.requiresAuth && (!state.auth.isAuthenticated || !state.auth.principal)) {
        return rejectWithValue("Authentication required");
      }

      // Check active pool requirements
      if (config.requiresActivePool && !state.swap.activeSwapPool) {
        return rejectWithValue("No active swap pool found");
      }

      const currentPoolId = state.swap.activeSwapPool?.[0];
      const cachedData = config.getCachedData(state);

      // Check if we should use cached data
      if (!shouldFetchData(cachedData, config.cacheDuration, currentPoolId)) {
        console.log(`Using cached data for ${config.name}`);
        recordCacheHit();
        return cachedData.data;
      }

      console.log(`Fetching fresh data for ${config.name}`);
      recordCacheMiss();

      const result = await config.fetchData(state);
      return result;
    } catch (error) {
      console.error(`Failed to fetch data for ${config.name}:`, error);

      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue(`An unknown error occurred while fetching ${config.name}`);
    }
  });
}

/**
 * Batch update multiple thunks to be cache-aware
 */
export function updateThunkWithCache<T>(
  originalThunk: any,
  cacheConfig: Omit<CacheAwareThunkConfig, 'name' | 'fetchData'> & {
    fetchData: (state: RootState) => Promise<T>;
  }
): any {
  return createCacheAwareThunk<T>({
    name: originalThunk.type,
    ...cacheConfig,
  });
}