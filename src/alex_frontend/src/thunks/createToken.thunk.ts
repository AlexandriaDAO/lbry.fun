import { createAsyncThunk } from "@reduxjs/toolkit";
import { getLbryFunActor } from "@/features/auth/utils/authUtils";
import { ErrorMessage } from "@/features/swap/utlis/erorrs";
import { TokenFormValues } from "@/components/createToken";

// Define the thunk
const createToken = createAsyncThunk<
  string, // This is the return type of the thunk's payload
  { formData: TokenFormValues },
  { rejectValue: ErrorMessage }
>("lbry/createToken", async ({ formData }, { rejectWithValue }) => {
  try {
    const actor = await getLbryFunActor();

    const result = await actor.create_token(
      formData.primary_token_symbol,
      formData.primary_token_name,
      formData.primary_token_description,
      formData.secondary_token_symbol,
      formData.secondary_token_name,
      formData.secondary_token_description,
      BigInt(formData.primary_max_supply),
      BigInt(formData.initial_primary_mint),
      BigInt(formData.initial_secondary_burn),
      BigInt(formData.primary_max_phase_mint)
    );

    if ("Ok" in result) {
      return result.Ok;
    } else {
      return rejectWithValue({
        title: "Token creation failed",
        message: result.Err,
      });
    }
  } catch (error) {
    console.error(error);
    return rejectWithValue({
      title: "Unknown Error",
      message:  "An unknown error occurred",
    });
  }
});

export default createToken;
