import React from "react";
import { useTransactionHistory } from "../../hooks/useTransactionHistory";
import { LoaderCircle } from "lucide-react";
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
            <div className="terminal-pure">
                <div className="terminal-header">
                    <span className="terminal-prompt">&gt;&gt;</span> transaction_error
                </div>
                <div className="terminal-row">
                    <span className="terminal-status">[ERROR]</span>
                    <span className="terminal-accent">{error}</span>
                </div>
                <button 
                    className="terminal-button mt-2" 
                    onClick={refreshTransactions}
                >
                    [RETRY]
                </button>
            </div>
        );
    }

    return (
        <div className="terminal-pure">
            <div className="terminal-header mb-2">
                <span className="terminal-prompt">&gt;&gt;</span> transaction_history
                <button 
                    className="terminal-button text-xs ml-4"
                    onClick={refreshTransactions}
                    disabled={loading}
                >
                    {loading ? (
                        <LoaderCircle size={10} className="animate animate-spin inline" />
                    ) : (
                        "[REFRESH]"
                    )}
                </button>
            </div>

            {isEmpty && !loading ? (
                <div className="terminal-section-minimal">
                    <div className="terminal-row">
                        <span className="terminal-label">status:</span>
                        <span className="terminal-accent">no_transactions_found</span>
                    </div>
                    <div className="terminal-row">
                        <span className="terminal-label">info:</span>
                        <span className="terminal-accent text-xs">transaction history will appear here</span>
                    </div>
                </div>
            ) : (
                <>
                    <div className="space-y-1">
                        {transactions.map((transaction) => (
                            <TransactionItem
                                key={transaction.id}
                                transaction={transaction}
                            />
                        ))}
                    </div>
                    
                    {hasMore && (
                        <div className="terminal-section mt-2">
                            <button 
                                onClick={loadMoreTransactions}
                                disabled={loading}
                                className="terminal-button w-full"
                            >
                                {loading ? (
                                    <LoaderCircle size={12} className="animate animate-spin mx-auto" />
                                ) : (
                                    "[LOAD_MORE]"
                                )}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default TransactionHistory;