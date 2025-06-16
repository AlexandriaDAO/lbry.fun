import { useCallback, useEffect } from "react";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import fetchTransactionHistory from "../thunks/fetchTransactionHistory.thunk";
import { resetTransactionHistory } from "../swapSlice";
import { RootState } from "@/store";

export const useTransactionHistory = () => {
  const dispatch = useAppDispatch();
  const { principal } = useAppSelector((state: RootState) => state.auth);
  const transactionHistory = useAppSelector((state: RootState) => state.swap.transactionHistory);

  const fetchTransactions = useCallback(
    (refresh = false) => {
      if (!principal) return;
      
      if (refresh) {
        // Reset pagination for refresh
        dispatch(resetTransactionHistory());
      }
      
      dispatch(fetchTransactionHistory({ 
        userPrincipal: principal,
        startIndex: refresh ? 0 : transactionHistory.transactions.length
      }));
    },
    [dispatch, principal, transactionHistory.transactions.length]
  );

  const loadMoreTransactions = useCallback(() => {
    if (transactionHistory.hasMore && !transactionHistory.loading) {
      fetchTransactions(false);
    }
  }, [fetchTransactions, transactionHistory.hasMore, transactionHistory.loading]);

  // Auto-fetch on mount
  useEffect(() => {
    if (principal && transactionHistory.transactions.length === 0) {
      fetchTransactions(true);
    }
  }, [principal, fetchTransactions, transactionHistory.transactions.length]);

  return {
    transactions: transactionHistory.transactions,
    loading: transactionHistory.loading,
    error: transactionHistory.error,
    hasMore: transactionHistory.hasMore,
    refreshTransactions: () => fetchTransactions(true),
    loadMoreTransactions,
    isEmpty: transactionHistory.transactions.length === 0
  };
};