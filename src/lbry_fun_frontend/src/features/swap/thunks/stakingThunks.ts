import { createAsyncThunk } from "@reduxjs/toolkit";
import { Principal } from "@dfinity/principal";
import { TokenConversionService } from "@/utils/TokenConversionService";
import { getActorSwap, getICRCActor, validateActor } from "@/features/auth/utils/authUtils";
import { ErrorMessage, getErrorMessage } from "../utils/errors";
import { StakeInfo } from "../swapSlice";
import { RootState } from "@/store";

// Stake primary tokens
export const stakePrimary = createAsyncThunk<
  string,
  { amount: string; userPrincipal: string },
  { state: RootState; rejectValue: ErrorMessage }
>(
  "icp_swap/stakePrimary",
  async ({ amount, userPrincipal }, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      if (!state.swap.activeSwapPool) {
        throw new Error("No active swap pool found");
      }
      const actor = await getICRCActor(
        state.swap.activeSwapPool?.[1].primary_token_id
      );
      
      // Validate Primary Token ICRC actor before using it
      if (!validateActor(actor, "Primary Token ICRC")) {
        return rejectWithValue({ 
          title: "Unable to connect to primary token canister", 
          message: "Please ensure you are authenticated." 
        });
      }
      
      const icp_swap_canister_id = state.swap.activeSwapPool?.[1].icp_swap_canister_id;
      
      // Convert user input to e8s format for backend operations
      const amountFormat = TokenConversionService.naturalToE8s(amount);

      // Get the primary token fee from state and convert to e8s
      const primaryFee = state.primary.primaryFee;
      const feeInE8s = TokenConversionService.naturalToE8s(primaryFee);
      
      // Add fee buffer to approval amount
      const approvalAmount = amountFormat + feeInE8s;

      const checkApproval = await actor.icrc2_allowance({
        account: {
          owner: Principal.fromText(userPrincipal),
          subaccount: [],
        },
        spender: {
          owner: Principal.fromText(icp_swap_canister_id),
          subaccount: [],
        },
      });

      if (checkApproval.allowance < approvalAmount) {
        const resultPrimaryApprove = await actor.icrc2_approve({
          spender: {
            owner: Principal.fromText(icp_swap_canister_id),
            subaccount: [],
          },
          amount: approvalAmount,
          fee: [],
          memo: [],
          from_subaccount: [],
          created_at_time: [],
          expected_allowance: [],
          expires_at: [],
        });
        if ("Err" in resultPrimaryApprove) {
          const error = resultPrimaryApprove.Err;
          let errorMessage = "Insufficent funds"; // Default error message
          if ("TemporarilyUnavailable" in error) {
            errorMessage = "Service is temporarily unavailable";
          }
          throw new Error(errorMessage);
        }
      }

      const actorSwap = await getActorSwap(icp_swap_canister_id);
      
      // Validate ICP Swap actor before using it
      if (!validateActor(actorSwap, "ICP Swap")) {
        return rejectWithValue({ 
          title: "Unable to connect to ICP swap canister", 
          message: "Please ensure you are authenticated." 
        });
      }
      
      const result = await actorSwap.stake_primary(amountFormat, []);
      if ("Ok" in result) return "success";
      if ("Err" in result) {
        const errorMessage = getErrorMessage(result.Err);
        return rejectWithValue(errorMessage);
      }
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue({ title: error.message, message: "" });
      }
    }
    return rejectWithValue({
      title: "An unknown error occurred while Staking",
      message: "",
    });
  }
);

// Unstake all primary tokens
export const unstake = createAsyncThunk<
  string,
  void,
  {state: RootState, rejectValue: ErrorMessage }
>("icp_swap/unstake", async (_, { getState,rejectWithValue }) => {
  try {
    const state = getState();

    if (!state.swap.activeSwapPool) {
      throw new Error("No active swap pool found");
    }
    const actor = await getActorSwap(state.swap.activeSwapPool?.[1].icp_swap_canister_id);
    
    // Validate ICP Swap actor before using it
    if (!validateActor(actor, "ICP Swap")) {
      return rejectWithValue({ 
        title: "Unable to connect to ICP swap canister", 
        message: "Please ensure you are authenticated." 
      });
    }
    
    const result = await actor.un_stake_all_primary([]);
    if ("Ok" in result) return "success";
    else if ("Err" in result) {
      const errorMessage = getErrorMessage(result.Err);
      return rejectWithValue(errorMessage);
    }
  } catch (error) {
    console.error(error);

    if (error instanceof Error) {
      return rejectWithValue({ title: error.message, message: "" });
    }
  }
  return rejectWithValue({
    title: "An unknown error occurred while unstaking",
    message: "",
  });
});

// Claim ICP rewards
export const claimReward = createAsyncThunk<
  string,
  { reward: string },
  { state: RootState; rejectValue: ErrorMessage }
>("icp_swap/claimReward", async ({ reward }, { getState, rejectWithValue }) => {
  try {
    if (Number(reward) < 0.01) {
      return rejectWithValue({
        title: "Must have at least 0.01 ICP reward to claim!",
        message: "",
      });
    }
    const state = getState();

    if (!state.swap.activeSwapPool) {
      throw new Error("No active swap pool found");
    }
    const actor = await getActorSwap(
      state.swap.activeSwapPool?.[1].icp_swap_canister_id
    );
    
    // Validate ICP Swap actor before using it
    if (!validateActor(actor, "ICP Swap")) {
      return rejectWithValue({ 
        title: "Unable to connect to ICP swap canister", 
        message: "Please ensure you are authenticated." 
      });
    }
    
    const result = await actor.claim_icp_reward([]);
    if ("Ok" in result) return "success";
    else if ("Err" in result) {
      const errorMessage = getErrorMessage(result.Err);
      return rejectWithValue(errorMessage);
    }
  } catch (error) {

    if (error instanceof Error) {
      return rejectWithValue({ title: error.message, message: "" });
    }
  }
  return rejectWithValue({
    title: "An unknown error occurred while claiming reward",
    message: "",
  });
});

// Get individual stake info
export const getStakedInfo = createAsyncThunk<
  StakeInfo,
  string,
  { state: RootState; rejectValue: string }
>("icp_swap/getStakeInfo", async (account, { getState, rejectWithValue }) => {
  try {
    const state = getState();

    if (!state.swap.activeSwapPool) {
      throw new Error("No active swap pool found");
    }
    const actor = await getActorSwap(
      state.swap.activeSwapPool?.[1].icp_swap_canister_id
    );
    const result = await actor.get_stake(Principal.fromText(account));
    if (result.length > 0) {
      // Stake exists
      const formattedStake = result?.[0]?.amount
        ? TokenConversionService.e8sToNatural(result[0].amount).toString()
        : "0";
      const formattedReward = result?.[0]?.reward_icp
        ? TokenConversionService.e8sToNatural(result[0].reward_icp).toString()
        : "0";
      const unix_stake_time = result?.[0]?.time
        ? result?.[0]?.time.toString()
        : "0";

      return {
        stakedPrimary: formattedStake,
        rewardIcp: formattedReward,
        unix_stake_time,
      };
      // Use formattedBal as needed
    } else {
      // No stake found
      return {
        stakedPrimary: "0",
        rewardIcp: "0",
        unix_stake_time: "0",
      };
    }
  } catch (error) {
    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }
  }
  return rejectWithValue(
    "An unknown error occurred while fetching staked info"
  );
});

// Get all stakes info (total staked in canister)
export const getAllStakesInfo = createAsyncThunk<
  string,
  void,
  { state: RootState; rejectValue: string }
>("icp_swap/getALlStakesInfo", async (_, { getState,rejectWithValue }) => {
  try {
    const state = getState();
    if (!state.swap.activeSwapPool) {
      throw new Error("No active swap pool found");
    }
    const icp_swap_canister_id =state.swap.activeSwapPool?.[1].icp_swap_canister_id;
    ;
    const actor =await getICRCActor(
      state.swap.activeSwapPool?.[1].primary_token_id
    );
    const result = await actor.icrc1_balance_of({
      owner: Principal.fromText(icp_swap_canister_id),
      subaccount: [],
    });
    const fromatedBal = (
      Math.floor(TokenConversionService.e8sToNatural(result) * 10 ** 4) /
      10 ** 4
    ).toFixed(4);
    return fromatedBal;
  } catch (error) {
    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }
  }
  return rejectWithValue(
    "An unknown error occurred while fetching  all staked info"
  );
});

// Get stakers count
export const getStakersCount = createAsyncThunk<
  string,
  void,
  {state: RootState, rejectValue: string }
>("icp_swap/getTotalStakerCount", async (_, { getState,rejectWithValue }) => {
  try {
    const state = getState();

    if (!state.swap.activeSwapPool) {
      throw new Error("No active swap pool found");
    }
    const actor = await getActorSwap(state.swap.activeSwapPool?.[1].icp_swap_canister_id);
   
    const result = await actor.get_stakers_count();
    
    return result.toString();
  } catch (error) {
    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }
  }
  return rejectWithValue(
    "An unknown error occurred while fetching  all staked info"
  );
});

// Get average APY
export const getAverageApy = createAsyncThunk<
  number,
  void,
  { state: RootState; rejectValue: string }
>("icp_swap/getAverageApy", async (_, { getState,rejectWithValue }) => {
  try {
    const state = getState();

    if (!state.swap.activeSwapPool) {
      throw new Error("No active swap pool found");
    }
    const actor = await getActorSwap(
      state.swap.activeSwapPool?.[1].icp_swap_canister_id
    );
    const result = await actor.get_all_apy_values();
    const scalingFactor = TokenConversionService.e8sToNatural(
      await actor.get_scaling_factor()
    );
    const sum = result.reduce(
      (acc, record) => acc + BigInt(record[1]),
      BigInt(0)
    );
    const average = TokenConversionService.e8sToNatural(sum) / result.length;

    return average / scalingFactor;
  } catch (error) {
    console.error("Failed to get canister archived balances:", error);

    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }
  }
  return rejectWithValue(
    "An unknown error occurred while fetching canister archived balances"
  );
});

// Export as namespace for better organization
export const stakingThunks = {
  stakePrimary,
  unstake,
  claimReward,
  getStakedInfo,
  getAllStakesInfo,
  getStakersCount,
  getAverageApy
};