import { ActorSubclass } from "@dfinity/agent";
import { _SERVICE as _SERVICESWAP } from "../../../../../declarations/icp_swap/icp_swap.did";

import { createAsyncThunk } from "@reduxjs/toolkit";
import { TokenConversionService } from "@/utils/TokenConversionService";
import { validateActor } from "@/features/auth/utils/authUtils";


// Define the async thunk
const transferICPFromUserWalletcanister = createAsyncThunk<
  string, // This is the return type of the thunk's payload
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

export default transferICPFromUserWalletcanister;

