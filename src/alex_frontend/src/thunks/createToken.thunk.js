import { createAsyncThunk } from "@reduxjs/toolkit";
import { getLbryActor } from "@/features/auth/utils/authUtils";

interface CreateTokenInput {
  primary_token_symbol: string;
  primary_token_name: string;
  primary_token_description: string;
  secondary_token_symbol: string;
  secondary_token_name: string;
  secondary_token_description: string;
  primary_max_supply: bigint;
  initial_primary_mint: bigint;
  initial_secondary_burn: bigint;
  primary_max_phase_mint: bigint;
}

// Define the thunk
const createToken = createAsyncThunk<
  string, // Return type (success)
  CreateTokenInput, // Argument type (form data)
  { rejectValue: ErrorMessage } // Reject type
>(
  "lbry/createToken",
  async (formData, { rejectWithValue }) => {
    try {
      const actor = await getLbryActor();

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
      } else if ("Err" in result) {
        return rejectWithValue({
          title: "Token creation failed",
          message: result.Err,
        });
      }
    } catch (error) {
      console.error(error);
      return rejectWithValue({
        title: "Unknown Error",
        message: (error as Error)?.message ?? "Something went wrong.",
      });
    }
  }
);

export default createToken;
