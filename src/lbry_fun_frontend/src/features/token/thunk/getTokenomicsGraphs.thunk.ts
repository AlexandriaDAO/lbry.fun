import { ActorSubclass } from '@dfinity/agent';
import { createAsyncThunk } from "@reduxjs/toolkit";
import { _SERVICE, GraphData, Result_4 } from "@/declarations/lbry_fun/lbry_fun.did";
import { ErrorMessage } from "@/features/swap/utils/errors";

export interface ProcessedGraphData {
  cumulative_supply_data_x: number[];
  cumulative_supply_data_y: number[];
  minted_per_epoch_data_x: string[];
  minted_per_epoch_data_y: number[];
  cost_to_mint_data_x: number[];
  cost_to_mint_data_y: number[];
  cumulative_usd_cost_data_x: number[];
  cumulative_usd_cost_data_y: number[];
}

const getTokenomicsGraphs = createAsyncThunk<
  ProcessedGraphData,
  { poolId: string; lbryFunActor: ActorSubclass<_SERVICE> },
  { rejectValue: ErrorMessage }
>(
  "lbryFun/getTokenomicsGraphs",
  async ({ poolId, lbryFunActor }, { rejectWithValue }) => {
    try {
      const actor = lbryFunActor;
      const result: Result_4 = await actor.get_tokenomics_graphs(BigInt(poolId));
      
      if ('Err' in result) {
        throw new Error(result.Err);
      }
      
      // Convert BigUint64Array to regular arrays
      const graphData = result.Ok;
      return {
        cumulative_supply_data_x: Array.from(graphData.cumulative_supply_data_x).map(Number),
        cumulative_supply_data_y: Array.from(graphData.cumulative_supply_data_y).map(Number),
        minted_per_epoch_data_x: graphData.minted_per_epoch_data_x,
        minted_per_epoch_data_y: Array.from(graphData.minted_per_epoch_data_y).map(Number),
        cost_to_mint_data_x: Array.from(graphData.cost_to_mint_data_x).map(Number),
        cost_to_mint_data_y: graphData.cost_to_mint_data_y,
        cumulative_usd_cost_data_x: Array.from(graphData.cumulative_usd_cost_data_x).map(Number),
        cumulative_usd_cost_data_y: graphData.cumulative_usd_cost_data_y,
      };
    } catch (error: any) {
      console.error("Failed to fetch tokenomics graphs:", error);
      return rejectWithValue({
        title: "Failed to fetch tokenomics graphs",
        message: error.message || "An unknown error occurred",
      });
    }
  }
);

export default getTokenomicsGraphs;