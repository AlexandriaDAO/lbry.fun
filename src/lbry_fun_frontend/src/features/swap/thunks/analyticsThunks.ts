import { createAsyncThunk } from "@reduxjs/toolkit";
import { Principal } from "@dfinity/principal";
import { TokenConversionService } from "@/utils/TokenConversionService";
import { getICRCActor, getTokenomicsActor } from "@/features/auth/utils/authUtils";
import { createLogsActor } from "@/actors/createLogsActor";
import { ErrorMessage } from "../utils/errors";
import { RootState } from "@/store";
import { TransactionData, FetchTransactionsParams } from "../types/transactionTypes";

const E8S = 100_000_000;

// Fetch transaction history for both primary and secondary tokens
export const fetchTransactionHistory = createAsyncThunk<
  { transactions: TransactionData[]; hasMore: boolean },
  FetchTransactionsParams,
  { state: RootState; rejectValue: string }
>(
  "swap/fetchTransactionHistory",
  async ({ userPrincipal, pageSize = 25, startIndex = 0 }, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      if (!state.swap.activeSwapPool) {
        throw new Error("No active swap pool found");
      }

      const [primaryTokenId, secondaryTokenId] = [
        state.swap.activeSwapPool[1].primary_token_id,
        state.swap.activeSwapPool[1].secondary_token_id
      ];
      
      // Get token symbols from the active swap pool (used as tickers)
      const primaryTicker = state.swap.activeSwapPool[1].primary_token_symbol;
      const secondaryTicker = state.swap.activeSwapPool[1].secondary_token_symbol;

      // Fetch from both token canisters in parallel
      const [primaryActor, secondaryActor] = await Promise.all([
        getICRCActor(primaryTokenId),
        getICRCActor(secondaryTokenId)
      ]);

      const [primaryResult, secondaryResult] = await Promise.all([
        primaryActor.get_transactions({ start: BigInt(startIndex), length: BigInt(pageSize) }),
        secondaryActor.get_transactions({ start: BigInt(startIndex), length: BigInt(pageSize) })
      ]);

      // Filter transactions for user
      const userPrincipalObj = Principal.fromText(userPrincipal);
      
      const primaryTransactions = primaryResult.transactions
        .filter((tx: ICRCTransaction) => isUserTransaction(tx, userPrincipalObj))
        .map((tx: ICRCTransaction, index: number) => formatTransaction(tx, 'primary', primaryTicker, startIndex + index));
        
      const secondaryTransactions = secondaryResult.transactions
        .filter((tx: ICRCTransaction) => isUserTransaction(tx, userPrincipalObj))
        .map((tx: ICRCTransaction, index: number) => formatTransaction(tx, 'secondary', secondaryTicker, startIndex + index));

      // Combine and sort by timestamp (already in milliseconds)
      const allTransactions = [...primaryTransactions, ...secondaryTransactions]
        .sort((a, b) => b.timestamp - a.timestamp);

      return {
        transactions: allTransactions,
        hasMore: allTransactions.length === pageSize
      };
      
    } catch (error) {
      console.error("Failed to fetch transaction history:", error instanceof Error ? error.message : "Unknown error");
      return rejectWithValue(error instanceof Error ? error.message : "Unknown error");
    }
  }
);

// Get all logs from the logs canister
export const getAllLogs = createAsyncThunk(
  'swap/getAllLogs',
  async (canisterId: string, { rejectWithValue }) => {
    // Add retry logic for certificate errors
    let retries = 3;
    let lastError: Error | null = null;
    
    while (retries > 0) {
      try {
        const actor = await createLogsActor(canisterId);
        const response = await actor.get_all_logs();
        
        if (!response) {
          return rejectWithValue('No logs found.');
        }

        const processedData = {
          time: response.map(log => Number(log[1].time) / 1000000), // convert nanoseconds to milliseconds
          primaryTokenSupply: response.map(log => Number(log[1].primary_token_supply) / E8S),
          secondaryTokenSupply: response.map(log => Number(log[1].secondary_token_supply) / E8S),
          totalSecondaryBurned: response.map(log => Number(log[1].total_secondary_burned)), // This is a u64, probably no decimals
          totalPrimaryStaked: response.map(log => Number(log[1].total_primary_staked) / E8S),
          stakerCount: response.map(log => Number(log[1].staker_count)),
          // APY is stored as a u128 representing the percentage with high precision
          // The value needs to be interpreted as a percentage (same as stake interface display)
          apy: response.map(log => {
            // Convert the raw APY value to a percentage
            // The backend stores this as a scaled integer for precision
            const apyValue = Number(log[1].apy);
            // Return as percentage value (will be displayed with % sign in UI)
            return apyValue;
          }),
          // Calculate placeholder rewards (will need different data source)
          hourlyIcpRewards: response.map(() => 0),
        };
        
        return processedData;
      } catch (error) {
        lastError = error as Error;
        
        // Check if it's a certificate error and we have retries left
        if (error instanceof Error && 
            error.message.includes("Invalid certificate") && 
            retries > 1) {
          retries--;
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
          continue;
        }
        
        // If not a certificate error or no retries left, break
        break;
      }
    }
    
    // If we get here, all retries failed
    console.error('Failed to get logs after retries:', lastError);
    if (lastError instanceof Error) {
      return rejectWithValue(lastError.message);
    }
    return rejectWithValue('An unknown error occurred while fetching logs.');
  }
);

// Get primary token mint rate
export const getPrimaryMintRate = createAsyncThunk<
  string,
  void,
  { state: RootState; rejectValue: string }
>("tokenomics/getPrimaryMintRate", async (_, { getState,rejectWithValue }) => {
  try {
    const state = getState();
    if (!state.swap.activeSwapPool) {
      throw new Error("No active swap pool found");
    }
    const actor = await getTokenomicsActor(
      state.swap.activeSwapPool?.[1].tokenomics_canister_id
    );
    const result = await actor.get_current_primary_rate();
    
    // Handle the Result type - it returns { Ok: bigint } or { Err: string }
    if ('Err' in result) {
      throw new Error(result.Err);
    }
    
    // The backend returns a rate in 4-decimal format (e.g., 1050 = 0.105 tokens)
    // To convert to natural units: rate / 10000
    const ratePerToken = Number(result.Ok) / 10000;
    return ratePerToken.toString();
  } catch (error) {
    if (error instanceof Error) {
      return rejectWithValue(error.message);
    }
  }
  return rejectWithValue(
    "An unknown error occurred while fetching ALEX mint rate"
  );
});

// Interface for tokenomics info
export interface TokenomicsInfo {
  currentPrimaryRate: string;
  currentSecondaryThreshold: string;
  currentThresholdIndex: number;
  totalSecondaryBurned: string;
  maxSecondaryThreshold: string;
}

// Get comprehensive tokenomics information
export const getTokenomicsInfo = createAsyncThunk<
  TokenomicsInfo,
  string, // tokenomics canister ID
  { rejectValue: ErrorMessage }
>(
  "swap/getTokenomicsInfo",
  async (tokenomicsCanisterId, { rejectWithValue }) => {
    try {
      const actor = await getTokenomicsActor(tokenomicsCanisterId);
      
      // Fetch all data in parallel
      const [
        currentPrimaryRate,
        currentSecondaryThreshold,
        currentThresholdIndex,
        totalSecondaryBurn,
        maxStats
      ] = await Promise.all([
        actor.get_current_primary_rate(),
        actor.get_current_secondary_threshold(),
        actor.get_current_threshold_index(),
        actor.get_total_secondary_burn(),
        actor.get_max_stats()
      ]);

      return {
        currentPrimaryRate: currentPrimaryRate.toString(),
        currentSecondaryThreshold: currentSecondaryThreshold.toString(),
        currentThresholdIndex: Number(currentThresholdIndex),
        totalSecondaryBurned: totalSecondaryBurn.toString(),
        maxSecondaryThreshold: maxStats && maxStats.length > 0 ? maxStats[0].toString() : "0"
      };
    } catch (error) {
      console.error("Error fetching tokenomics info:", error instanceof Error ? error.message : "Unknown error");
      return rejectWithValue({
        title: "Failed to fetch tokenomics info",
        message: "Unable to retrieve the tokenomics information",
      });
    }
  }
);

// Get total primary token supply
export const getTotalPrimarySupply = createAsyncThunk<
  string,
  string, // primary token canister ID
  { rejectValue: ErrorMessage }
>(
  "swap/getTotalPrimarySupply",
  async (primaryTokenId, { rejectWithValue }) => {
    try {
      const actor = await getICRCActor(primaryTokenId);
      const totalSupply = await actor.icrc1_total_supply();
      return totalSupply.toString();
    } catch (error) {
      console.error("Error fetching total primary supply:", error instanceof Error ? error.message : "Unknown error");
      return rejectWithValue({
        title: "Failed to fetch total supply",
        message: "Unable to retrieve the total primary token supply",
      });
    }
  }
);

// Helper functions for transaction processing
// Type for ICRC transaction from the canister
interface ICRCTransaction {
  mint?: [{
    to?: { owner: Principal };
    amount?: bigint;
  }];
  transfer?: [{
    to?: { owner: Principal };
    from?: { owner: Principal };
    amount?: bigint;
    fee?: bigint;
  }];
  burn?: [{
    from?: { owner: Principal };
    amount?: bigint;
  }];
  timestamp?: bigint;
  index?: bigint;
}

function isUserTransaction(transaction: ICRCTransaction, userPrincipal: Principal): boolean {
  const checkOwner = (owner: Principal | undefined) => owner?.toString() === userPrincipal.toString();
  
  return (
    checkOwner(transaction.mint?.[0]?.to?.owner) ||
    checkOwner(transaction.transfer?.[0]?.to?.owner) ||
    checkOwner(transaction.transfer?.[0]?.from?.owner) ||
    checkOwner(transaction.burn?.[0]?.from?.owner)
  );
}

function formatTransaction(transaction: ICRCTransaction, tokenType: 'primary' | 'secondary', tokenTicker?: string, txIndex?: number): TransactionData {
  const amount = transaction.mint?.[0]?.amount ||
                transaction.transfer?.[0]?.amount ||
                transaction.burn?.[0]?.amount || 0n;
  
  // Create a truly unique ID using timestamp + transaction index + random component
  const from = transaction.transfer?.[0]?.from?.owner?.toString() || 
               transaction.burn?.[0]?.from?.owner?.toString() || '';
  const to = transaction.transfer?.[0]?.to?.owner?.toString() || 
             transaction.mint?.[0]?.to?.owner?.toString() || '';
  
  // Include from/to addresses and index in the ID to ensure uniqueness
  const randomSuffix = Math.random().toString(36).substring(7);
  const uniqueId = `${tokenType}-${transaction.timestamp}-${transaction.kind}-${amount.toString()}-${txIndex || 0}-${randomSuffix}`;
                
  return {
    id: uniqueId,
    timestamp: Number(transaction.timestamp) / 1_000_000, // Store as milliseconds
    kind: transaction.kind,
    amount: TokenConversionService.formatE8sDisplay(amount, 4),
    from,
    to,
    fee: transaction.transfer?.[0]?.fee?.[0] ? 
         TokenConversionService.formatE8sDisplay(transaction.transfer[0].fee[0], 4) : undefined,
    token: tokenType,
    tokenTicker: tokenTicker || tokenType, // Use ticker if available, fallback to type
    status: 'completed'
  };
}

// Export as namespace for better organization
export const analyticsThunks = {
  // Transaction history
  fetchTransactionHistory,
  
  // Logs and insights
  getAllLogs,
  
  // Tokenomics
  getPrimaryMintRate,
  getTokenomicsInfo,
  getTotalPrimarySupply
};