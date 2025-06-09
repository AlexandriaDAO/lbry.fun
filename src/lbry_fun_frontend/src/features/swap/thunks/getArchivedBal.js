import { createAsyncThunk } from "@reduxjs/toolkit";
import { Principal } from "@dfinity/principal";
import LedgerService from "@/utils/LedgerService";
import { getActorSwap } from "@/features/auth/utils/authUtils";
const getArchivedBal = createAsyncThunk("icp_swap/getArchivedBal", async (account, { getState, rejectWithValue }) => {
    try {
        const state = getState();
        if (!state.swap.activeSwapPool) {
            throw new Error("No active swap pool found");
        }
        const actor = await getActorSwap(state.swap.activeSwapPool?.[1].icp_swap_canister_id);
        const result = await actor.get_user_archive_balance(Principal.fromText(account));
        const LedgerServices = LedgerService();
        if (result[0] && result.length > 0) {
            // Assuming ArchiveBalance is a bigint-compatible type or can be converted to bigint
            const archiveBalance = BigInt(result[0].icp);
            const formattedBal = LedgerServices.e8sToIcp(archiveBalance).toString();
            return formattedBal;
        }
        else {
            return "0";
        }
    }
    catch (error) {
        if (error instanceof Error) {
            return rejectWithValue(error.message);
        }
        return rejectWithValue("An unknown error occurred while fetching staked info");
    }
});
export default getArchivedBal;
