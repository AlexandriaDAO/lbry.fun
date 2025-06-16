import React from "react";
import { useTransactionHistory } from "../../hooks/useTransactionHistory";
import { Button } from "@/lib/components/button";
import RefreshButton from "../../shared/RefreshButton";
import TransactionItem from "./TransactionItem";

const TransactionHistory = () => {
    const {
        transactions,
        loading,
        error,
        hasMore,
        refreshTransactions,
        loadMoreTransactions,
        isEmpty
    } = useTransactionHistory();

    if (error) {
        return (
            <div className="p-4 text-center">
                <p className="text-red-500 mb-4">Error loading transactions: {error}</p>
                <Button onClick={refreshTransactions}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <h3 className="text-xl font-medium text-foreground">Recent Transactions</h3>
                    <RefreshButton 
                        onRefresh={refreshTransactions}
                        loading={loading}
                        toastMessage="Refreshing transactions..."
                    />
                </div>
            </div>

            {isEmpty && !loading ? (
                <div className="text-center py-8 text-muted-foreground">
                    <p>No transactions found</p>
                    <p className="text-sm">Your transaction history will appear here once you start trading</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {transactions.map((transaction) => (
                        <TransactionItem
                            key={transaction.id}
                            transaction={transaction}
                        />
                    ))}
                    
                    {hasMore && (
                        <div className="text-center pt-4">
                            <Button 
                                onClick={loadMoreTransactions}
                                disabled={loading}
                                variant="outline"
                            >
                                {loading ? "Loading..." : "Load More"}
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default TransactionHistory;