import { Actor, HttpAgent } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { getIcHost } from "@/utils/getIcHost";

// Kong Backend Canister ID (same for local and mainnet)
export const KONG_BACKEND_CANISTER_ID = process.env.REACT_APP_KONG_BACKEND_CANISTER_ID || "2ipq2-uqaaa-aaaar-qailq-cai";

// Types matching the kongswap interface
export interface PoolReply {
  pool_id: number;
  name: string;
  symbol: string;
  lp_token_symbol: string;
  address_0: string;
  symbol_0: string;
  balance_0: bigint;
  lp_fee_0: bigint;
  address_1: string;
  symbol_1: string;
  balance_1: bigint;
  lp_fee_1: bigint;
  chain_0: string;
  chain_1: string;
  price: number;
  is_removed: boolean;
  // Optional fields that might not be in basic response
  tvl?: bigint;
  rolling_24h_volume?: bigint;
  rolling_24h_lp_fee?: bigint;
  rolling_24h_num_swaps?: bigint;
  lp_token_supply?: bigint;
}

export interface PoolsReply {
  pools: PoolReply[];
  // These aggregated stats are not in the actual response
  total_tvl?: bigint;
  total_24h_volume?: bigint;
  total_24h_lp_fee?: bigint;
  total_24h_num_swaps?: bigint;
}

// IDL factory for kongswap pools query
const kongswapIdlFactory = ({ IDL }: any) => {
  // PoolReply structure based on actual kongswap response
  const PoolReply = IDL.Record({
    'pool_id': IDL.Nat32,
    'name': IDL.Text,
    'symbol': IDL.Text,
    'lp_token_symbol': IDL.Text,
    'address_0': IDL.Text,
    'symbol_0': IDL.Text,
    'balance_0': IDL.Nat,
    'lp_fee_0': IDL.Nat,
    'address_1': IDL.Text,
    'symbol_1': IDL.Text,
    'balance_1': IDL.Nat,
    'lp_fee_1': IDL.Nat,
    'chain_0': IDL.Text,
    'chain_1': IDL.Text,
    'price': IDL.Float64,
    'is_removed': IDL.Bool,
    // These fields might not be in the basic response
    'tvl': IDL.Opt(IDL.Nat),
    'rolling_24h_volume': IDL.Opt(IDL.Nat),
    'rolling_24h_lp_fee': IDL.Opt(IDL.Nat),
    'rolling_24h_num_swaps': IDL.Opt(IDL.Nat),
    'lp_token_supply': IDL.Opt(IDL.Nat),
  });

  const PoolsResult = IDL.Variant({
    'Ok': IDL.Vec(PoolReply),
    'Err': IDL.Text,
  });

  return IDL.Service({
    'pools': IDL.Func([IDL.Opt(IDL.Text)], [PoolsResult], ['query']),
  });
};

export class KongswapService {
  private static actor: any = null;

  private static async getActor() {
    if (this.actor) return this.actor;

    const agent = new HttpAgent({ host: getIcHost() });

    if (process.env.DFX_NETWORK !== 'ic') {
      await agent.fetchRootKey().catch(err => {
        console.warn("Unable to fetch root key. Swallowing error.", err);
      });
    }

    this.actor = Actor.createActor(kongswapIdlFactory, {
      agent,
      canisterId: Principal.fromText(KONG_BACKEND_CANISTER_ID),
    });

    return this.actor;
  }

  static async getAllPools(icpPriceInDollars: number = 7.50): Promise<PoolsReply> {
    try {
      const actor = await this.getActor();
      
      // For optional parameters in Candid, use [] for None
      const result = await actor.pools([]);
      
      // Handle the Result variant
      if ('Ok' in result) {
        // The response is just an array of pools, not wrapped in a PoolsReply
        const pools = result.Ok;
        
        // Calculate TVL from pool balances and ICP price
        const icpPriceInCents = Math.round(icpPriceInDollars * 100);
        
        // Calculate aggregated stats from individual pools
        let totalTvl = BigInt(0);
        
        for (const pool of pools) {
          if (!pool.is_removed) {
            // Calculate TVL for this pool
            // For ICP pairs, we can use: TVL = 2 * ICP_balance * ICP_price
            // We want TVL in e8s (dollar e8s) for consistency with frontend display
            if (pool.symbol_0 === 'ICP' || pool.symbol_0 === 'ksICP') {
              // ICP balance (e8s) * price (cents) * 2 (for 50/50 pool) / 100 (cents to dollars)
              // Result is in dollar e8s
              const poolTvl = (pool.balance_0 * BigInt(icpPriceInCents) * BigInt(2)) / BigInt(100);
              pool.tvl = poolTvl;
              totalTvl += poolTvl;
            } else if (pool.symbol_1 === 'ICP' || pool.symbol_1 === 'ksICP') {
              const poolTvl = (pool.balance_1 * BigInt(icpPriceInCents) * BigInt(2)) / BigInt(100);
              pool.tvl = poolTvl;
              totalTvl += poolTvl;
            }
          }
        }
        
        return {
          pools: pools,
          total_tvl: totalTvl,
          total_24h_volume: BigInt(0), // Not provided by basic pools query
          total_24h_lp_fee: BigInt(0),
          total_24h_num_swaps: BigInt(0),
        };
      } else {
        throw new Error(`Kongswap error: ${result.Err}`);
      }
    } catch (error) {
      console.error("Failed to fetch pools from kongswap:", error);
      
      // If kongswap call fails, return empty pools as fallback
      console.warn("Kongswap call failed, returning empty pools as fallback");
      return {
        pools: [],
      };
    }
  }

  static async getPoolBySymbol(symbol: string, icpPriceInDollars: number = 7.50): Promise<PoolReply | null> {
    try {
      const poolsReply = await this.getAllPools(icpPriceInDollars);
      const pool = poolsReply.pools.find(p => p.symbol === symbol);
      return pool || null;
    } catch (error) {
      console.error(`Failed to fetch pool for symbol ${symbol}:`, error);
      return null;
    }
  }

  static async getPoolsByTokenSymbol(tokenSymbol: string, icpPriceInDollars: number = 7.50): Promise<PoolReply[]> {
    try {
      const poolsReply = await this.getAllPools(icpPriceInDollars);
      // Filter pools that contain the token symbol (e.g., "ICP_TOKEN" or "TOKEN_ICP")
      return poolsReply.pools.filter(p => 
        p.symbol.includes(tokenSymbol) || p.symbol.includes(`ICP_${tokenSymbol}`)
      );
    } catch (error) {
      console.error(`Failed to fetch pools for token ${tokenSymbol}:`, error);
      return [];
    }
  }
}