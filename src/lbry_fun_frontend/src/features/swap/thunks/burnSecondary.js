import { createAsyncThunk } from "@reduxjs/toolkit";
import { Principal } from "@dfinity/principal";
import { getActorSwap, getICRCActor } from "@/features/auth/utils/authUtils";
import getCanisterBal from "@/features/icp-ledger/thunks/getCanisterBal";
import getCanisterArchivedBal from "./getCanisterArchivedBal";
import { getErrorMessage } from "../utlis/erorrs";
// Define the async thunk
const burnSecondary = createAsyncThunk("icp_swap/burnSecondary", async ({ amount, userPrincipal }, { getState, dispatch, rejectWithValue }) => {
    try {
        const state = getState();
        if (!state.swap.activeSwapPool) {
            throw new Error("No active swap pool found");
        }
        const actor = await getICRCActor(state.swap.activeSwapPool?.[1].secondary_token_id);
        const icp_swap_canister_id = state.swap.activeSwapPool?.[1].icp_swap_canister_id;
        let amountFormat = BigInt(Number(amount));
        let amountFormate8s = BigInt(Number(amount) * 10 ** 8);
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
        if (checkApproval.allowance < amountFormate8s) {
            const resultLbryApprove = await actor.icrc2_approve({
                spender: {
                    owner: Principal.fromText(icp_swap_canister_id),
                    subaccount: [],
                },
                amount: amountFormate8s,
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
        const actorSwap = await getActorSwap(state.swap.activeSwapPool?.[1].icp_swap_canister_id);
        const result = await actorSwap.burn_secondary(amountFormat, []);
        if ("Ok" in result) {
            dispatch(getCanisterBal());
            dispatch(getCanisterArchivedBal());
            return "success";
        }
        else if ("Err" in result) {
            console.log(result.Err);
            const errorMessage = getErrorMessage(result.Err);
            return rejectWithValue(errorMessage);
        }
    }
    catch (error) {
        console.error(error);
        if (error instanceof Error) {
            return rejectWithValue({ title: error.message, message: "" });
        }
    }
    return rejectWithValue({
        title: "An unknown error occurred while Burning",
        message: "",
    });
});
export default burnSecondary;
