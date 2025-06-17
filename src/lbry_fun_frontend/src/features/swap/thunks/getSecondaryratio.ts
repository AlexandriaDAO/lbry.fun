import { createAsyncThunk } from "@reduxjs/toolkit";
import { getActorSwap, validateActor } from "@/features/auth/utils/authUtils";
import { RootState } from "@/store";
import { shouldFetchData, CACHE_DURATIONS, recordCacheHit, recordCacheMiss } from "@/utils/cacheManager"; 

const getSecondaryratio = createAsyncThunk<
  string, // Return type of the payload
  void,   // Argument type (none)
  {
    state: RootState; 
    rejectValue: string;
  }
>("icp_swap/getSecondaryratio", async (_, { getState, rejectWithValue }) => {
  try {
    const state = getState();
    if (!state.swap.activeSwapPool) {
      return "0";
    }

    const currentPoolId = state.swap.activeSwapPool[0];
    const cachedRatio = state.swap.secondaryRatio;

    // Check if we should use cached data
    const shouldFetch = shouldFetchData(cachedRatio, CACHE_DURATIONS.SECONDARY_RATIO, currentPoolId);
    console.log(`[Cache Debug] Secondary Ratio - Should fetch: ${shouldFetch}`, {
      currentPoolId,
      cachedPoolId: cachedRatio.poolId,
      lastFetch: cachedRatio.lastFetch,
      cacheExpiry: cachedRatio.lastFetch ? new Date(cachedRatio.lastFetch + CACHE_DURATIONS.SECONDARY_RATIO).toISOString() : 'N/A',
      now: new Date().toISOString()
    });
    
    if (!shouldFetch) {
      console.log("✅ [Cache Hit] Using cached secondary ratio from Redux store.");
      recordCacheHit();
      return cachedRatio.data;
    }

    console.log("🔄 [Cache Miss] Fetching fresh secondary ratio from canister.");
    recordCacheMiss();

    const actor = await getActorSwap(state.swap.activeSwapPool[1].icp_swap_canister_id);
    
    // Validate actor before using it
    if (!validateActor(actor, "ICP Swap")) {
      return rejectWithValue("Unable to connect to swap canister. Please ensure you are authenticated.");
    }

    const result = await actor.get_current_secondary_ratio();
    return result.toString();
  } catch (error) {
    console.error("Failed to get Secondary_ratio:", error);

    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }
  }
  return rejectWithValue("An unknown error occurred while fetching Secondary ratio");
});

export default getSecondaryratio;
