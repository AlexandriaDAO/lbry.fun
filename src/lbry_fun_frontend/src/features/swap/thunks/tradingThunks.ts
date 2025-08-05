import { createAsyncThunk } from "@reduxjs/toolkit";
import { Principal } from "@dfinity/principal";
import { Account } from "@dfinity/ledger-icp";
import { ActorSubclass } from "@dfinity/agent";
import { TokenConversionService } from "@/utils/TokenConversionService";
import { TransferArg } from "../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did";
import { _SERVICE as _SERVICESWAP } from "../../../../../declarations/icp_swap/icp_swap.did";
import {
  getActorSwap,
  getICRCActor,
  getIcpLedgerActor,
  validateActor,
} from "@/features/auth/utils/authUtils";
import { ErrorMessage, getErrorMessage } from "../utils/errors";
import getCanisterBal from "@/features/icp-ledger/thunks/getCanisterBal";
import { balanceThunks } from "./balanceThunks";
import { RootState } from "@/store";

// Swap ICP for secondary tokens
export const swapSecondary = createAsyncThunk<
  string,
  { amount: string; userPrincipal: string; canisterId: string },
  { rejectValue: ErrorMessage }
>(
  "icp_swap/swapSecondary",
  async ({ amount, userPrincipal, canisterId }, { rejectWithValue }) => {
    try {
      const actorSwap = await getActorSwap(canisterId);
      
      // Validate ICP Swap actor before using it
      if (!validateActor(actorSwap, "ICP Swap")) {
        return rejectWithValue({ 
          title: "Unable to connect to ICP swap canister", 
          message: "Please ensure you are authenticated." 
        });
      }
      
      const actorIcpLedger = await getIcpLedgerActor();
      
      // Validate ICP Ledger actor before using it
      if (!validateActor(actorIcpLedger, "ICP Ledger")) {
        return rejectWithValue({ 
          title: "Unable to connect to ICP ledger canister", 
          message: "Please ensure you are authenticated." 
        });
      }
      // Convert user input to e8s format for backend operations
      const amountFormat = TokenConversionService.naturalToE8s(amount);
      // Add fee buffer for approval (0.0001 ICP fee)
      const amountFormatApprove = TokenConversionService.naturalToE8s(Number(amount) + 0.0001);

      const checkApproval = await actorIcpLedger.icrc2_allowance({
        account: {
          owner: Principal.fromText(userPrincipal),
          subaccount: [],
        },
        spender: {
          owner: Principal.fromText(canisterId),
          subaccount: [],
        },
      });
      if (checkApproval.allowance < amountFormatApprove) {
        const resultIcpApprove = await actorIcpLedger.icrc2_approve({
          spender: {
            owner: Principal.fromText(canisterId),
            subaccount: [],
          },
          amount: amountFormatApprove,
          fee: [BigInt(10000)],
          memo: [],
          from_subaccount: [],
          created_at_time: [],
          expected_allowance: [],
          expires_at: [],
        });
        if ("Err" in resultIcpApprove) {
          const error = resultIcpApprove.Err;
          let errorMessage = "Unknown error"; // Default error message
          if ("TemporarilyUnavailable" in error) {
            errorMessage = "Service is temporarily unavailable";
          }
          throw new Error(errorMessage);
        }
      }

      const result = await actorSwap.swap(amountFormat, []);
      if ("Ok" in result) return "success";
      if ("Err" in result) {
        const errorMessage = getErrorMessage(result.Err);
        return rejectWithValue(errorMessage);
      }
    } catch (error) {
      console.error(error);

      if (error instanceof Error) {
        return rejectWithValue({title:error.message,message:""});
      }
    }
    return rejectWithValue({title:"An unknown error occurred while Swapping",message:""});
  }
);

// Burn secondary tokens for primary tokens
export const burnSecondary = createAsyncThunk<
  string,
  { amount: string; userPrincipal: string },
  { state: RootState; rejectValue: ErrorMessage }
>(
  "icp_swap/burnSecondary",
  async (
    { amount, userPrincipal },
    { getState, dispatch, rejectWithValue }
  ) => {
    try {
      const state = getState();

      if (!state.swap.activeSwapPool) {
        throw new Error("No active swap pool found");
      }
      const actor = await getICRCActor(
        state.swap.activeSwapPool?.[1].secondary_token_id
      );
      
      // Validate ICRC actor before using it
      if (!validateActor(actor, "Secondary Token ICRC")) {
        return rejectWithValue({ 
          title: "Unable to connect to secondary token canister", 
          message: "Please ensure you are authenticated." 
        });
      }
      
      const icp_swap_canister_id =
        state.swap.activeSwapPool?.[1].icp_swap_canister_id;
      
      // IMPORTANT: Backend burn_secondary expects amount in natural units (e.g., 1 for 1 token)
      // The backend will internally convert to e8s by multiplying by 100_000_000
      const amountNatural = BigInt(amount);

      // Get the secondary token fee from state and convert to e8s
      const secondaryFee = state.swap.secondaryFee || "0";
      const feeInE8s = TokenConversionService.naturalToE8s(secondaryFee);
      
      // Approval amount needs to be in e8s format
      const approvalAmount = TokenConversionService.naturalToE8s(amount) + feeInE8s;

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
        const resultLbryApprove = await actor.icrc2_approve({
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
        if ("Err" in resultLbryApprove) {
          const error = resultLbryApprove.Err;
          let errorMessage = "Unknown error"; // Default error message
          if ("TemporarilyUnavailable" in error) {
            errorMessage = "Service is temporarily unavailable";
          }

          throw new Error(errorMessage);
        }
      }

      const actorSwap = await getActorSwap(
        state.swap.activeSwapPool?.[1].icp_swap_canister_id
      );
      
      // Validate ICP Swap actor before using it
      if (!validateActor(actorSwap, "ICP Swap")) {
        return rejectWithValue({ 
          title: "Unable to connect to ICP swap canister", 
          message: "Please ensure you are authenticated." 
        });
      }
      
      // Debug info removed - burn amount: natural units
      
      // burn_secondary expects natural units, NOT e8s
      const result = await actorSwap.burn_secondary(amountNatural, []);
      if ("Ok" in result) {
        dispatch(getCanisterBal());
        dispatch(balanceThunks.getCanisterArchivedBalance());
        return "success";
      } else if ("Err" in result) {
        const errorMessage = getErrorMessage(result.Err);
        return rejectWithValue(errorMessage);
      }
    } catch (error) {

      if (error instanceof Error) {
        return rejectWithValue({ title: error.message, message: "" });
      }
    }
    return rejectWithValue({
      title: "An unknown error occurred while Burning",
      message: "",
    });
  }
);

// Transfer primary tokens
export const transferPrimary = createAsyncThunk<
  string,
  {
    amount: string;
    destination: string;
  },
  { state: RootState; rejectValue: ErrorMessage }
>(
  "primary/transferPrimary",
  async ({ amount, destination }, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      if (!state.swap.activeSwapPool) {
        throw new Error("No active swap pool found");
      }
      const actor = await getICRCActor(
        state.swap.activeSwapPool?.[1].primary_token_id
      );
      // Convert user input to e8s format for backend operations
      const amountFormat = TokenConversionService.naturalToE8s(amount);
      let recipientAccount: Account;
      recipientAccount = {
        owner: Principal.fromText(destination),
        subaccount: [],
      };

      const transferArg: TransferArg = {
        to: recipientAccount,
        fee: [], //default fee
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        amount: amountFormat,
      };
      const result = await actor.icrc1_transfer(transferArg);
      if ("Ok" in result) return "success";
      else {
        throw result.Err;
      }
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue({ title: "Transfer Failed", message: error.message });
      }
    }
    return rejectWithValue({ title: "Transfer Failed", message: "An unknown error occurred while transferring tokens" });
  }
);

// Transfer secondary tokens
export const transferSecondary = createAsyncThunk<
  string,
  {
    amount: string;
    destination: string;
    subaccount?: number[];
  },
  { state: RootState, rejectValue: string }
>(
  "icp_swap/transferSecondary",
  async (
    { amount, destination, subaccount },
    {getState, rejectWithValue }
  ) => {
    try {
      const state = getState();
      if (!state.swap.activeSwapPool) {
        throw new Error("No active swap pool found");
      }
      const actor = await getICRCActor(state.swap.activeSwapPool?.[1].secondary_token_id);
      // Convert user input to e8s format for backend operations
      const amountFormat = TokenConversionService.naturalToE8s(amount);
      let recipientAccount: Account;
      
      recipientAccount = {
        owner: Principal.fromText(destination),
        subaccount: subaccount ? [subaccount] : [],
      };

      const transferArg: TransferArg = {
        to: recipientAccount,
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        amount: amountFormat
      };
      const result = await actor.icrc1_transfer(transferArg);
      if ("Ok" in result) return "success";
      else {
        throw result.Err;
      }
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
    }
    return rejectWithValue(
      "An unknown error occurred while transfering Secondary"
    );
  }
);

// Transfer ICP from user wallet
export const transferICPFromUserWallet = createAsyncThunk<
  string,
  {
    actorSwap: ActorSubclass<_SERVICESWAP>;
    destination:string;
    amount:string
  },
  { rejectValue: string }
>("icp_swap/transferICPFromUserWalletcanister", async ( {actorSwap,destination,amount} , { rejectWithValue }) => {
  try {
    // Validate ICP Swap actor before using it
    if (!validateActor(actorSwap, "ICP Swap")) {
      return rejectWithValue("Unable to connect to ICP swap canister. Please ensure you are authenticated.");
    }
    
    // Convert user input to e8s format and subtract fee
    const amountInE8s = TokenConversionService.naturalToE8s(amount);
    const fee = BigInt(10000); // 0.0001 ICP fee
    const amountMinusFee = amountInE8s - fee;
    
    if (amountMinusFee <= 0) {
      return rejectWithValue("Amount must be greater than the transaction fee (0.0001 ICP)");
    }
    
    const result = await actorSwap.transfer_from_user_wallet(amountMinusFee, destination);
    if('Ok' in result) return "success";
    if('Err' in result) throw new Error(result.Err)
  } catch (error) {
    console.error( error);
    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }
  }
  return rejectWithValue("An unknown error occurred while transferring ICP");
});

// Get secondary token ratio
export const getSecondaryRatio = createAsyncThunk<
  string,
  void,
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

    const actor = await getActorSwap(state.swap.activeSwapPool[1].icp_swap_canister_id);
    
    // Secondary ratio is public data and should work with default actor
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

// Export as namespace for better organization
export const tradingThunks = {
  swapSecondary,
  burnSecondary,
  transferPrimary,
  transferSecondary,
  transferICPFromUserWallet,
  getSecondaryRatio
};