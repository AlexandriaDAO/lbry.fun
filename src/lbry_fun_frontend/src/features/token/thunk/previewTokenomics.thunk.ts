import { createAsyncThunk } from "@reduxjs/toolkit";
import { getLbryFunActor } from "@/features/auth/utils/authUtils";
import { GraphData } from "../lbryFunSlice";

export interface PreviewArgs {
    primary_max_supply: string;
    tge_allocation: string;
    initial_secondary_burn: string;
    halving_step: string;
    initial_reward_per_burn_unit: string;
}

const previewTokenomics = createAsyncThunk<GraphData, { args: PreviewArgs }, { rejectValue: { title: string, message: string } }>(
    "lbryfun/previewTokenomics",
    async ({ args }, { rejectWithValue }) => {
        try {
            const actor = await getLbryFunActor();
            if (!actor) {
                throw new Error("Failed to initialize Lbry Fun actor");
            }
            
            // Convert string args to BigInt for the actor call
            const actorArgs = {
                primary_max_supply: BigInt(args.primary_max_supply),
                tge_allocation: BigInt(args.tge_allocation),
                initial_secondary_burn: BigInt(args.initial_secondary_burn),
                halving_step: BigInt(args.halving_step),
                initial_reward_per_burn_unit: BigInt(args.initial_reward_per_burn_unit),
            };
            
            const result = await actor.preview_tokenomics_graphs(actorArgs);

            const serializablePayload: GraphData = {
                cumulative_supply_data_x: Array.from(result.cumulative_supply_data_x, (v) => v.toString()),
                cumulative_supply_data_y: Array.from(result.cumulative_supply_data_y, (v) => v.toString()),
                minted_per_epoch_data_x: result.minted_per_epoch_data_x,
                minted_per_epoch_data_y: Array.from(result.minted_per_epoch_data_y, (v) => v.toString()),
                cost_to_mint_data_x: Array.from(result.cost_to_mint_data_x, (v) => v.toString()),
                cost_to_mint_data_y: result.cost_to_mint_data_y,
                cumulative_usd_cost_data_x: Array.from(result.cumulative_usd_cost_data_x, (v) => v.toString()),
                cumulative_usd_cost_data_y: result.cumulative_usd_cost_data_y,
            };

            return serializablePayload;
        } catch (error: any) {
            let errorMessage = "Failed to fetch tokenomics preview data from the backend.";
            
            // Try to extract more specific error information
            if (error?.message) {
                errorMessage = error.message;
            } else if (error?.toString && typeof error.toString === 'function') {
                errorMessage = error.toString();
            }
            
            // Check for specific error patterns
            if (errorMessage.includes('Replica returned an error')) {
                errorMessage = "Unable to connect to the canister. Please check your network connection and try again.";
            } else if (errorMessage.includes('Invalid certificate')) {
                errorMessage = "Authentication error. Please try logging in again.";
            }
            
            return rejectWithValue({
                title: "Preview Error",
                message: errorMessage,
            });
        }
    }
);

export default previewTokenomics; 