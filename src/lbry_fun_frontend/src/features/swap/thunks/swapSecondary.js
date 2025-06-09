import { createAsyncThunk } from "@reduxjs/toolkit";
import { Principal } from "@dfinity/principal";
import { getActorSwap, getIcpLedgerActor, } from "@/features/auth/utils/authUtils";
import { getErrorMessage } from "../utlis/erorrs";
// Define the async thunk
const swapSecondary = createAsyncThunk("icp_swap/swapSecondary", async ({ amount, userPrincipal, canisterId }, { rejectWithValue }) => {
    try {
        const actorSwap = await getActorSwap(canisterId);
        const actorIcpLedger = await getIcpLedgerActor();
        let amountFormat = BigInt(Number(Number(amount) * 10 ** 8).toFixed(0));
        let amountFormatApprove = BigInt(Number((Number(amount) + 0.0001) * 10 ** 8).toFixed(0));
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
        if ("Ok" in result)
            return "success";
        if ("Err" in result) {
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
    return rejectWithValue({ title: "An unknown error occurred while Swaping", message: "" });
});
export default swapSecondary;
