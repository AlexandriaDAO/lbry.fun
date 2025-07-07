import { createAsyncThunk } from "@reduxjs/toolkit";
import { getLbryFunActor } from "@/features/auth/utils/authUtils";

export interface TokenomicsSchedule {
    epochs: Array<{
        epoch_number: number;
        secondary_burned_this_epoch_e8s: bigint;
        primary_minted_this_epoch_e8s: bigint;
        cumulative_secondary_burned_e8s: bigint;
        cumulative_primary_minted_e8s: bigint;
        cost_per_primary_token_usd: number;
    }>;
    total_epochs: number;
    total_supply_percentage: number;
}

export interface PreviewScheduleArgs {
    primary_per_threshold: number;      // Natural units (e.g., 5 tokens)
    max_primary_supply: bigint;         // E8S (e.g., 21_000_000 * 10^8)
    initial_secondary_burn: number;     // Natural units (e.g., 21000 tokens)
    halving_step: number;               // Percentage (e.g., 50 for 50%)
    tge_allocation: bigint;             // E8S
}

const previewTokenomicsSchedule = createAsyncThunk<TokenomicsSchedule, PreviewScheduleArgs, { rejectValue: { title: string, message: string } }>(
    "lbryfun/previewTokenomicsSchedule",
    async (args, { rejectWithValue }) => {
        try {
            const actor = await getLbryFunActor();
            if (!actor) {
                throw new Error("Failed to initialize Lbry Fun actor");
            }
            
            // Call the backend with the parameters in the expected format
            // Convert natural units to E8S for primary_per_threshold and initial_secondary_burn
            const E8S = 100_000_000;
            const MAX_U64 = BigInt("18446744073709551615"); // 2^64 - 1
            
            // Check for overflow before converting
            const primary_per_threshold_e8s = BigInt(Math.floor(args.primary_per_threshold * E8S));
            const initial_secondary_burn_e8s = BigInt(Math.floor(args.initial_secondary_burn * E8S));
            
            if (primary_per_threshold_e8s > MAX_U64) {
                throw new Error(`Primary reward per burn unit is too large. Maximum allowed is ${MAX_U64 / BigInt(E8S)} tokens.`);
            }
            
            if (initial_secondary_burn_e8s > MAX_U64) {
                throw new Error(`Initial secondary burn is too large. Maximum allowed is ${MAX_U64 / BigInt(E8S)} tokens.`);
            }
            
            const result = await actor.preview_tokenomics_schedule(
                primary_per_threshold_e8s,
                args.max_primary_supply,
                initial_secondary_burn_e8s,
                BigInt(args.halving_step),
                args.tge_allocation
            );

            // Convert BigInt values to serializable format
            const serializableSchedule: TokenomicsSchedule = {
                epochs: result.epochs.map(epoch => ({
                    epoch_number: Number(epoch.epoch_number),
                    secondary_burned_this_epoch_e8s: epoch.secondary_burned_this_epoch_e8s,
                    primary_minted_this_epoch_e8s: epoch.primary_minted_this_epoch_e8s,
                    cumulative_secondary_burned_e8s: epoch.cumulative_secondary_burned_e8s,
                    cumulative_primary_minted_e8s: epoch.cumulative_primary_minted_e8s,
                    cost_per_primary_token_usd: epoch.cost_per_primary_token_usd,
                })),
                total_epochs: Number(result.total_epochs),
                total_supply_percentage: result.total_supply_percentage,
            };

            return serializableSchedule;
        } catch (error: any) {
            let errorMessage = "Failed to fetch tokenomics schedule from the backend.";
            
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

export default previewTokenomicsSchedule;