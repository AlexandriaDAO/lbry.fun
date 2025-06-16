import { createAsyncThunk } from "@reduxjs/toolkit";
import { Principal } from "@dfinity/principal";
import { TokenConversionService } from "@/utils/TokenConversionService";
import { getICRCActor } from "@/features/auth/utils/authUtils";
import { RootState } from "@/store";
import { TransactionData, FetchTransactionsParams } from "../types/transactionTypes";

const fetchTransactionHistory = createAsyncThunk<
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
        .filter((tx: any) => isUserTransaction(tx, userPrincipalObj))
        .map((tx: any) => formatTransaction(tx, 'primary'));
        
      const secondaryTransactions = secondaryResult.transactions
        .filter((tx: any) => isUserTransaction(tx, userPrincipalObj))
        .map((tx: any) => formatTransaction(tx, 'secondary'));

      // Combine and sort by timestamp
      const allTransactions = [...primaryTransactions, ...secondaryTransactions]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return {
        transactions: allTransactions,
        hasMore: allTransactions.length === pageSize
      };
      
    } catch (error) {
      console.error("Failed to fetch transaction history:", error);
      return rejectWithValue(error instanceof Error ? error.message : "Unknown error");
    }
  }
);

// Helper functions
function isUserTransaction(transaction: any, userPrincipal: Principal): boolean {
  const checkOwner = (owner: any) => owner?.toString() === userPrincipal.toString();
  
  return (
    checkOwner(transaction.mint?.[0]?.to?.owner) ||
    checkOwner(transaction.transfer?.[0]?.to?.owner) ||
    checkOwner(transaction.transfer?.[0]?.from?.owner) ||
    checkOwner(transaction.burn?.[0]?.from?.owner)
  );
}

function formatTransaction(transaction: any, tokenType: 'primary' | 'secondary'): TransactionData {
  const amount = transaction.mint?.[0]?.amount ||
                transaction.transfer?.[0]?.amount ||
                transaction.burn?.[0]?.amount || 0n;
                
  return {
    id: `${tokenType}-${transaction.timestamp}`,
    timestamp: new Date(Number(transaction.timestamp) / 1_000_000),
    kind: transaction.kind,
    amount: TokenConversionService.formatE8sDisplay(amount, 4),
    from: transaction.transfer?.[0]?.from?.owner?.toString(),
    to: transaction.transfer?.[0]?.to?.owner?.toString() || 
         transaction.mint?.[0]?.to?.owner?.toString(),
    fee: transaction.transfer?.[0]?.fee?.[0] ? 
         TokenConversionService.formatE8sDisplay(transaction.transfer[0].fee[0], 4) : undefined,
    token: tokenType,
    status: 'completed'
  };
}

export default fetchTransactionHistory;