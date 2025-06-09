import { createAsyncThunk } from "@reduxjs/toolkit";
import { getLbryFunActor } from "@/features/auth/utils/authUtils";
import { GraphData } from "../lbryFunSlice";

export interface PreviewArgs {
    primary_max_supply: bigint;
    tge_allocation: bigint;
    initial_secondary_burn: bigint;
    halving_step: bigint;
    initial_reward_per_burn_unit: bigint;
}

const previewTokenomics = createAsyncThunk<GraphData, { args: PreviewArgs }, { rejectValue: { title: string, message: string } }>(
    "lbryfun/previewTokenomics",
    async ({ args }, { rejectWithValue }) => {
        try {
            const actor = await getLbryFunActor();
            const result = await actor.preview_tokenomics_graphs({
                primary_max_supply: args.primary_max_supply,
                tge_allocation: args.tge_allocation,
                initial_secondary_burn: args.initial_secondary_burn,
                halving_step: args.halving_step,
                initial_reward_per_burn_unit: args.initial_reward_per_burn_unit,
            });

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
        } catch (error) {
            console.error("Error fetching tokenomics preview:", error);
            return rejectWithValue({
                title: "Preview Error",
                message: "Failed to fetch tokenomics preview data from the backend.",
            });
        }
    }
);

export default previewTokenomics; 