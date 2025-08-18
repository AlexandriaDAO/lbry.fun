import { createAsyncThunk } from "@reduxjs/toolkit";
import { Principal } from "@dfinity/principal";
import { TokenConversionService } from "@/utils/TokenConversionService";
import { getActorSwap, getICRCActor, validateActor } from "@/features/auth/utils/authUtils";
import { ErrorMessage, getErrorMessage } from "../utils/errors";
import { CanisterArchived } from "../swapSlice";
import { RootState } from "@/store";

// Get primary token balance for an account
export const getPrimaryBalance = createAsyncThunk<
  string,
  string,
  { state: RootState; rejectValue: string }
>("primary/getAccountPrimaryBalance", async (account, { getState,rejectWithValue }) => {
  try {
    const state = getState();
    if (!state.swap.activeSwapPool) {
      throw new Error("No active swap pool found");
    }
    const actor = await getICRCActor(
      state.swap.activeSwapPool?.[1].primary_token_id
    );
    const result = await actor.icrc1_balance_of({
      owner: Principal.fromText(account),
      subaccount: [],
    });
    
    // Convert e8s to natural units and format for display
    const formattedBal = TokenConversionService.formatE8sDisplay(result, 4);
    return formattedBal;
  } catch (error) {

    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }
  }
  return rejectWithValue(
    "An unknown error occurred while fetching ALEX balance"
  );
});

// Get primary token fee
export const getPrimaryFee = createAsyncThunk<
  string,
  void,
  { state: RootState; rejectValue: string }
>("primary/getPrimaryFee", async (_, { getState, rejectWithValue }) => {
  try {
    const state = getState();
    if (!state.swap.activeSwapPool) {
      return "0";
    //  throw new Error("No active swap pool found");
    }
    const actor = await getICRCActor(
      state.swap.activeSwapPool?.[1].primary_token_id
    );
    const result = await actor.icrc1_fee();
    const fromatedFee = (
      Math.floor(TokenConversionService.e8sToNatural(result) * 10 ** 4) /
      10 ** 4
    ).toFixed(4);

    return fromatedFee;
  } catch (error) {

    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }
  }
  return rejectWithValue("An unknown error occurred while fetching ALEX fee");
});

// Get primary token price from Kongswap pool data
export const getPrimaryPrice = createAsyncThunk<string, void, { state: RootState; rejectValue: string }>(
  "primary/getPrimaryPrice",
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      
      // Need active swap pool to get primary token ID
      if (!state.swap.activeSwapPool) {
        return "0";
      }
      
      // Import KongswapService
      const { KongswapService } = await import("@/services/kongswapService");
      
      // Get ICP price from state (in dollars)
      const icpPrice = state.icpLedger.icpPrice || 10; // Default to $10 if not available
      
      // Get all pools from Kongswap
      const poolsData = await KongswapService.getAllPools(Number(icpPrice));
      
      // Find the pool for our primary token
      const primaryTokenId = state.swap.activeSwapPool[1].primary_token_id.toString();
      const pool = poolsData.pools.find(p => 
        (p.address_0 === primaryTokenId || p.address_1 === primaryTokenId) && !p.is_removed
      );
      
      if (!pool) {
        console.warn("No Kongswap pool found for primary token");
        return "0";
      }
      
      // Calculate price based on pool reserves
      // In a 50/50 AMM, price = (other_token_balance * other_token_price) / primary_token_balance
      let primaryPrice = 0;
      
      if (pool.address_0 === primaryTokenId) {
        // Primary token is token0, ICP/other is token1
        if (pool.symbol_1 === 'ICP' || pool.symbol_1 === 'ksICP') {
          // Price = ICP_balance * ICP_price / Primary_balance
          // Both balances are in E8S, so they cancel out
          primaryPrice = (Number(pool.balance_1) * Number(icpPrice)) / Number(pool.balance_0);
        }
      } else if (pool.address_1 === primaryTokenId) {
        // Primary token is token1, ICP/other is token0
        if (pool.symbol_0 === 'ICP' || pool.symbol_0 === 'ksICP') {
          // Price = ICP_balance * ICP_price / Primary_balance
          primaryPrice = (Number(pool.balance_0) * Number(icpPrice)) / Number(pool.balance_1);
        }
      }
      
      // Format to 4 decimal places
      return primaryPrice.toFixed(4);
    } catch (error) {
      console.error("Failed to get primary price from Kongswap:", error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue(
        "An unknown error occurred while fetching primary token price"
      );
    }
  }
);

// Get secondary token balance for an account
export const getSecondaryBalance = createAsyncThunk<
  string,
  string,
  { state: RootState,rejectValue: string }
>(
  "icp_swap/getSecondaryBalance",
  async (account, {getState, rejectWithValue }) => {
    try {
      const state = getState();
      if (!state.swap.activeSwapPool) {
        // Return 0 balance when no pool is active instead of throwing
        return "0.0000";
      }

      // Fetching secondary balance from canister

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

// Get secondary token fee
export const getSecondaryFee = createAsyncThunk<
  string,
  void,
  {    state: RootState,
   rejectValue: string }
>(
  "icp_swap/getSecondaryFee",
  async (_, {getState, rejectWithValue }) => {
    try {
      const state = getState();
    if (!state.swap.activeSwapPool) {
      return "0";
    //  throw new Error("No active swap pool found");
    }
      const actor = await getICRCActor(state.swap.activeSwapPool?.[1].secondary_token_id);
      const result = await actor.icrc1_fee();
      const fromatedFee = (
        Math.floor(TokenConversionService.e8sToNatural(result) * 10 ** 4) /
        10 ** 4
      ).toFixed(4);

      return fromatedFee;
    } catch (error) {
      console.error("Failed to get Secondary fee:", error);

      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
    }
    return rejectWithValue(
      "An unknown error occurred while fetching Secondary fee"
    );
  }
);

// Get archived balance for a user
export const getArchivedBalance = createAsyncThunk<
  string,
  string,
  { state: RootState; rejectValue: string }
>("icp_swap/getArchivedBal", async (account, { getState, rejectWithValue }) => {
  try {
    const state = getState();

    if (!state.swap.activeSwapPool) {
      throw new Error("No active swap pool found");
    }
    const actor = await getActorSwap(
      state.swap.activeSwapPool?.[1].icp_swap_canister_id
    );
    const result = await actor.get_user_archive_balance(
      Principal.fromText(account)
    );

    if (result[0] && result.length > 0) {
      // Assuming ArchiveBalance is a bigint-compatible type or can be converted to bigint
      const archiveBalance = BigInt(result[0].icp);
      const formattedBal = TokenConversionService.e8sToNatural(archiveBalance).toString();
      return formattedBal;
    } else {
      return "0";
    }
  } catch (error) {
    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }
    return rejectWithValue(
      "An unknown error occurred while fetching staked info"
    );
  }
});

// Get canister's archived balance and unclaimed rewards
export const getCanisterArchivedBalance = createAsyncThunk<
  CanisterArchived,
  void,
  { state: RootState; rejectValue: string }
>(
  "icp_swap/getCanisterArchivedBal",
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();

      if (!state.swap.activeSwapPool) {
        throw new Error("No active swap pool found");
      }
      const actor = await getActorSwap(
        state.swap.activeSwapPool?.[1].icp_swap_canister_id
      );
      const resultArchived = await actor.get_total_archived_balance();
      const resultUnclaimed = await actor.get_total_unclaimed_icp_reward();
      const resultArchivedNumber = TokenConversionService.e8sToNatural(resultArchived);
      const resultUnclaimedNumber = TokenConversionService.e8sToNatural(resultUnclaimed);
      return {
        canisterArchivedBal: resultArchivedNumber,
        canisterUnClaimedIcp: resultUnclaimedNumber,
      };
    } catch (error) {
      console.error("Failed to get canister archived balances:", error);

      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
    }
    return rejectWithValue(
      "An unknown error occurred while fetching canister archived balances"
    );
  }
);

// Redeem archived balance
export const redeemArchivedBalance = createAsyncThunk<
  string,
  void,
  {state: RootState, rejectValue: ErrorMessage }
>("icp_swap/redeemArchivedBalance", async (_, {getState, rejectWithValue }) => {
  try {
    const state = getState();

    if (!state.swap.activeSwapPool) {
      throw new Error("No active swap pool found");
    }
    const actor = await getActorSwap(state.swap.activeSwapPool?.[1].icp_swap_canister_id);
    const result = await actor.redeem([]);
    if ("Ok" in result) return "success";
    else if ("Err" in result) {
      const errorMessage = getErrorMessage(result.Err);
      return rejectWithValue(errorMessage);
    }
  } catch (error) {
    console.error(error);

    if (error instanceof Error) {
      return rejectWithValue({title:error.message,message:""});
    }
  }
  return rejectWithValue({title:"An unknown error occurred while unstaking",message:""});
});

// Export as namespace for better organization
export const balanceThunks = {
  // Primary token
  getPrimaryBalance,
  getPrimaryFee,
  getPrimaryPrice,
  
  // Secondary token
  getSecondaryBalance,
  getSecondaryFee,
  
  // Archived balances
  getArchivedBalance,
  getCanisterArchivedBalance,
  redeemArchivedBalance
};