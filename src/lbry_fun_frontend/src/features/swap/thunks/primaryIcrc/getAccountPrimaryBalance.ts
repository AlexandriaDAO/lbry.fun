import { _SERVICE as _SERVICEALEX } from "../../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did";
import { createAsyncThunk } from "@reduxjs/toolkit";
import { Principal } from "@dfinity/principal";
import LedgerService from "@/utils/LedgerService";
import {  getICRCActor } from "@/features/auth/utils/authUtils";
import { RootState } from "@/store";

// Define the asyn thunk
const getAccountPrimaryBalance = createAsyncThunk<
  string, // This is the return type of the thunk's payload
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
    const LedgerServices = LedgerService();
    // const fromatedBal = LedgerServices.e8sToIcp(result).toFixed(4);
    const fromatedBal = (
      Math.floor(LedgerServices.e8sToIcp(result) * 10 ** 4) /
      10 ** 4
    ).toFixed(4);

    return fromatedBal;
  } catch (error) {
    console.error("Failed to get ALEX balance:", error);

    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }
  }
  return rejectWithValue(
    "An unknown error occurred while fetching ALEX balance"
  );
});

export default getAccountPrimaryBalance;
