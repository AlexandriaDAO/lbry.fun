import { createAsyncThunk } from "@reduxjs/toolkit";
import LedgerService from "@/utils/LedgerService";
import { Principal } from "@dfinity/principal";
import { getIcpLedgerActor } from "@/features/auth/utils/authUtils";
// Define the async thunk
const getCanisterBal = createAsyncThunk("icp_ledger/getCanisterBal", async (_, { getState, rejectWithValue }) => {
    try {
        const state = getState();
        if (!state.swap.activeSwapPool) {
            throw new Error("No active swap pool found");
        }
        const actor = await getIcpLedgerActor();
        const icp_swap_canister_id = state.swap.activeSwapPool?.[1].icp_swap_canister_id;
        let resultAccountBal = await actor.icrc1_balance_of({
            owner: Principal.fromText(icp_swap_canister_id),
            subaccount: []
        });
        const LedgerServices = LedgerService();
        const formatedAccountBal = (Math.floor(LedgerServices.e8sToIcp(resultAccountBal) * 10 ** 4) / 10 ** 4).toFixed(4);
        return ({ formatedAccountBal });
    }
    catch (error) {
        console.error("Failed to get ICP Balance:", error);
        if (error instanceof Error) {
            return rejectWithValue(error.message);
        }
    }
    return rejectWithValue("An unknown error occurred while fetching ICP balance");
});
export default getCanisterBal;
