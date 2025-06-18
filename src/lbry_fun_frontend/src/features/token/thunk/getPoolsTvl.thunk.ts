import { createAsyncThunk } from "@reduxjs/toolkit";
import { Principal } from "@dfinity/principal";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../../declarations/icp_swap";
import { _SERVICE } from "../../../../declarations/icp_swap/icp_swap.did";

export interface PoolTvlData {
  pool_id: number;
  symbol: string;
  balance_0: bigint;
  balance_1: bigint;
  tvl: bigint;
  rolling_24h_volume: bigint;
  lp_token_supply: bigint;
  price: number;
}

export interface TokenTvlMap {
  [tokenId: string]: PoolTvlData | null;
}

const getPoolsTvl = createAsyncThunk<
  TokenTvlMap,
  string[], // Array of icp_swap canister IDs
  { rejectValue: { title: string; message: string } }
>(
  "token/getPoolsTvl",
  async (icpSwapCanisterIds, { rejectWithValue }) => {
    try {
      const tvlMap: TokenTvlMap = {};
      
      // For each icp_swap canister, query its TVL
      for (const canisterId of icpSwapCanisterIds) {
        try {
          const network = process.env.DFX_NETWORK || process.env.REACT_APP_DFX_NETWORK;
          const localReplicaHost = network === 'local' ? 'http://localhost:4943' : 'https://ic0.app';

          const agent = new HttpAgent({ host: localReplicaHost });

          if (network === 'local') {
            await agent.fetchRootKey().catch(err => {
              console.warn("Unable to fetch root key. Swallowing error.", err);
            });
          }

          const icpSwapActor = Actor.createActor<_SERVICE>(idlFactory, {
            agent,
            canisterId: Principal.fromText(canisterId),
          });

          const rankedPools = await icpSwapActor.get_pools_ranked_by_tvl();
          
          if ('Ok' in rankedPools && rankedPools.Ok.length > 0) {
            // Find the pool for this token (assuming first pool is the main one)
            const poolData = rankedPools.Ok[0];
            tvlMap[canisterId] = {
              pool_id: poolData.pool_id,
              symbol: poolData.symbol,
              balance_0: poolData.balance_0,
              balance_1: poolData.balance_1,
              tvl: poolData.tvl,
              rolling_24h_volume: poolData.rolling_24h_volume,
              lp_token_supply: poolData.lp_token_supply,
              price: poolData.price,
            };
          } else {
            tvlMap[canisterId] = null; // No liquidity pool exists yet
          }
        } catch (error) {
          console.warn(`Failed to fetch TVL for canister ${canisterId}:`, error);
          tvlMap[canisterId] = null;
        }
      }
      
      return tvlMap;
    } catch (error: any) {
      console.error("Failed to fetch pools TVL:", error);
      return rejectWithValue({
        title: "TVL Fetch Failed",
        message: error?.message || "An unknown error occurred while fetching pool TVL data.",
      });
    }
  }
);

export default getPoolsTvl;