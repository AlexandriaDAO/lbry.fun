import { createAsyncThunk } from "@reduxjs/toolkit";
import { getTokenomicsActor } from "@/features/auth/utils/authUtils";
import { ErrorMessage } from "@/features/swap/utlis/erorrs";

export interface TokenomicsInfo {
  currentPrimaryRate: string;
  currentSecondaryThreshold: string;
  currentThresholdIndex: number;
  totalSecondaryBurned: string;
  maxSecondaryThreshold: string;
}

const getTokenomicsInfo = createAsyncThunk<
  TokenomicsInfo,
  string, // tokenomics canister ID
  { rejectValue: ErrorMessage }
>(
  "swap/getTokenomicsInfo",
  async (tokenomicsCanisterId, { rejectWithValue }) => {
    try {
      const actor = await getTokenomicsActor(tokenomicsCanisterId);
      
      // Fetch all data in parallel
      const [
        currentPrimaryRate,
        currentSecondaryThreshold,
        currentThresholdIndex,
        totalSecondaryBurn,
        maxStats
      ] = await Promise.all([
        actor.get_current_primary_rate(),
        actor.get_current_secondary_threshold(),
        actor.get_current_threshold_index(),
        actor.get_total_secondary_burn(),
        actor.get_max_stats()
      ]);

      return {
        currentPrimaryRate: currentPrimaryRate.toString(),
        currentSecondaryThreshold: currentSecondaryThreshold.toString(),
        currentThresholdIndex: Number(currentThresholdIndex),
        totalSecondaryBurned: totalSecondaryBurn.toString(),
        maxSecondaryThreshold: maxStats[0].toString()
      };
    } catch (error) {
      console.error("Error fetching tokenomics info:", error);
      return rejectWithValue({
        title: "Failed to fetch tokenomics info",
        message: "Unable to retrieve the tokenomics information",
      });
    }
  }
);

export default getTokenomicsInfo;