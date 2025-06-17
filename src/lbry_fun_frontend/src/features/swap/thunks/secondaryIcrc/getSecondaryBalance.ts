
import { createAsyncThunk } from "@reduxjs/toolkit";
import { Principal } from "@dfinity/principal";
import { TokenConversionService } from "@/utils/TokenConversionService";
import { getICRCActor, validateActor } from "@/features/auth/utils/authUtils";
import { RootState } from "@/store";
import { shouldFetchData, CACHE_DURATIONS, recordCacheHit, recordCacheMiss } from "@/utils/cacheManager";

// Define the async thunk
const getSecondaryBalance = createAsyncThunk<
  string, // This is the return type of the thunk's payload
  string, // This is the argument type
  { state: RootState,rejectValue: string }
>(
  "icp_swap/getSecondaryBalance",
  async (account, {getState, rejectWithValue }) => {
    try {
      const state = getState();
      if (!state.swap.activeSwapPool) {
        throw new Error("No active swap pool found");
      }

      const currentPoolId = state.swap.activeSwapPool[0];
      const cachedBalance = state.swap.secondaryBalance;

      // Check if we should use cached data (balances change frequently, so shorter cache)
      if (!shouldFetchData(cachedBalance, CACHE_DURATIONS.BALANCES, currentPoolId)) {
        console.log("Using cached secondary balance from Redux store.");
        recordCacheHit();
        return cachedBalance.data;
      }

      console.log("Fetching fresh secondary balance from canister.");
      recordCacheMiss();

      const actor = await getICRCActor(state.swap.activeSwapPool[1].secondary_token_id);
      
      // Validate actor before using it
      if (!validateActor(actor, "Secondary Token ICRC")) {
        return rejectWithValue("Unable to connect to secondary token canister. Please ensure you are authenticated.");
      }

      const result = await actor.icrc1_balance_of({
        owner: Principal.fromText(account),
        subaccount: [],
      });
      
      // Convert e8s to natural units and format for display
      const formattedBal = TokenConversionService.formatE8sDisplay(result, 4);
      return formattedBal;
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
    }
    return rejectWithValue(
      "An unknown error occurred while getting Secondary balance"
    );
  }
);

export default getSecondaryBalance;
