import { createAsyncThunk } from "@reduxjs/toolkit";
import { KongswapService } from "@/services/kongswapService";
import type { TokenRecordStringified } from "../getTokenPools.thunk";

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
  Array<[string, TokenRecordStringified]>, // Array of token pools with their records
  { rejectValue: { title: string; message: string } }
>(
  "token/getPoolsTvl",
  async (tokenPools, { rejectWithValue, getState }) => {
    try {
      const tvlMap: TokenTvlMap = {};
      
      // Get ICP price from Redux state
      const state = getState() as any;
      const icpPrice = Number(state.icpLedger.icpPrice) || 10.0; // Default to $10 if not available
      
      // Get all pools from kongswap once
      const poolsReply = await KongswapService.getAllPools(icpPrice);
      
      // For each token, find its corresponding pool
      for (const [poolId, record] of tokenPools) {
        try {
          // Find pool that matches this token's symbol
          // Pool symbols are typically "ICP_TOKEN" format
          const tokenSymbol = record.primary_token_symbol;
          const pool = poolsReply.pools.find(p => 
            p.symbol === `ICP_${tokenSymbol}` || 
            p.symbol === `${tokenSymbol}_ICP` ||
            p.symbol.includes(tokenSymbol)
          );
          
          if (pool) {
            // Store TVL data by the pool ID (matching the frontend's structure)
            tvlMap[poolId] = {
              pool_id: pool.pool_id,
              symbol: pool.symbol,
              balance_0: pool.balance_0,
              balance_1: pool.balance_1,
              tvl: pool.tvl || BigInt(0), // Use calculated TVL or 0
              rolling_24h_volume: pool.rolling_24h_volume || BigInt(0),
              lp_token_supply: pool.lp_token_supply || BigInt(0),
              price: pool.price,
            };
          } else {
            tvlMap[poolId] = null; // No liquidity pool exists yet
          }
        } catch (error) {
          console.warn(`Failed to process TVL for token ${record.primary_token_symbol}:`, error);
          tvlMap[poolId] = null;
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