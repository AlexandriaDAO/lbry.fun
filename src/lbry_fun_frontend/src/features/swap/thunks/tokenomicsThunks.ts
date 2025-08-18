import { createAsyncThunk } from "@reduxjs/toolkit";
import { getTokenomicsActor } from "@/features/auth/utils/authUtils";
import { ErrorMessage } from "@/features/swap/utils/errors";
import { Principal } from "@dfinity/principal";

export interface TokenomicsCurrentState {
  totalSecondaryBurned: string;
  totalPrimaryMinted: string;
  currentThresholdIndex: number;
  circulatingSupply?: string;
}

export interface TokenomicsConfig {
  maxPrimarySupply: string;
  icpSwapCanisterId: string;
  secondaryTokenLedger: string;
  primaryTokenLedger: string;
}

export const fetchTokenomicsConfig = createAsyncThunk<
  TokenomicsConfig,
  string, // tokenomics_canister_id
  { rejectValue: ErrorMessage }
>("swap/fetchTokenomicsConfig", async (tokenomicsCanisterId, { rejectWithValue }) => {
  try {
    const actor = await getTokenomicsActor(Principal.fromText(tokenomicsCanisterId));
    const config = await actor.get_configs();
    
    return {
      maxPrimarySupply: config.max_primary_supply.toString(),
      icpSwapCanisterId: config.icp_swap_canister_id.toString(),
      secondaryTokenLedger: config.secondary_token_ledger.toString(),
      primaryTokenLedger: config.primary_token_ledger.toString()
    };
  } catch (error) {
    console.error("Failed to fetch tokenomics config:", error instanceof Error ? error.message : "Unknown error");
    return rejectWithValue({
      title: "Failed to Load Config",
      message: "Unable to fetch tokenomics configuration"
    });
  }
});

export const fetchTokenomicsCurrentState = createAsyncThunk<
  TokenomicsCurrentState,
  string, // tokenomics_canister_id
  { rejectValue: ErrorMessage }
>("swap/fetchTokenomicsCurrentState", async (tokenomicsCanisterId, { rejectWithValue, getState }) => {
  try {
    const actor = await getTokenomicsActor(Principal.fromText(tokenomicsCanisterId));
    
    // Get the primary token ID from the active pool
    const state = getState() as any;
    const primaryTokenId = state.swap.activeSwapPool?.[1]?.primary_token_id;
    
    // Fetch all current state data in parallel
    const [totalBurnedResult, totalMintedResult, currentIndex] = await Promise.all([
      actor.get_total_secondary_burn(),
      actor.fetch_total_minted_primary(),
      actor.get_current_threshold_index()
    ]);
    
    // Handle the Result type for total minted
    if (!('Ok' in totalMintedResult)) {
      throw new Error(totalMintedResult.Err || "Failed to fetch total minted primary");
    }
    
    let circulatingSupply: string | undefined;
    
    // If we have the primary token ID, fetch its total supply (circulating supply)
    if (primaryTokenId) {
      try {
        // Import dynamically to avoid circular dependencies
        const { getIcrcActor } = await import("@/features/auth/utils/authUtils");
        const primaryTokenActor = await getIcrcActor(Principal.fromText(primaryTokenId));
        const totalSupply = await primaryTokenActor.icrc1_total_supply();
        circulatingSupply = totalSupply.toString();
      } catch (error) {
        console.warn("Failed to fetch circulating supply:", error instanceof Error ? error.message : "Unknown error");
      }
    }
    
    const result = {
      totalSecondaryBurned: totalBurnedResult.toString(),
      totalPrimaryMinted: totalMintedResult.Ok.toString(),
      currentThresholdIndex: Number(currentIndex),
      circulatingSupply
    };
    
    return result;
  } catch (error) {
    console.error("Failed to fetch tokenomics current state:", error instanceof Error ? error.message : "Unknown error");
    return rejectWithValue({
      title: "Failed to Load Current State",
      message: "Unable to fetch current tokenomics progress"
    });
  }
});