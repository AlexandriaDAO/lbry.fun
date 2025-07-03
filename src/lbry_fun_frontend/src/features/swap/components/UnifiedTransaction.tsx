import React from 'react';
import { TransactionData } from "../types/transactionTypes";
import { format } from "date-fns";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router";
import { LoaderCircle } from "lucide-react";
import { useTransactionHistory } from "../hooks/useTransactionHistory";

interface UnifiedTransactionProps {
    view: 'history' | 'detail' | 'row' | 'list';
    // For history view
    showHistory?: boolean;
    // For detail/list/row views
    transaction?: TransactionData;
    onViewDetails?: (transaction: TransactionData) => void;
    // For row view specific props
    timestamp?: string;
    amount?: string;
    type?: string;
    from?: string;
    to?: string;
    fee?: string;
    index?: number;
}

const UnifiedTransaction: React.FC<UnifiedTransactionProps> = ({
    view,
    showHistory = false,
    transaction,
    onViewDetails,
    timestamp,
    amount,
    type,
    from,
    to,
    fee,
    index
}) => {
    const navigate = useNavigate();

    // Transaction history hook for history view
    const historyData = view === 'history' ? useTransactionHistory() : null;

    const getKindSymbol = (kind: TransactionData['kind']) => {
        switch (kind) {
            case 'transfer': return '→';
            case 'burn': return '🔥';
            case 'mint': return '⚡';
            case 'approve': return '✓';
            default: return '?';
        }
    };

    const formatTimestamp = (timestamp: number) => {
        return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss');
    };

    const shortenAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    const handleRowClick = (id: number) => {
        localStorage.setItem("tab", "trx");
        navigate("transaction?id=" + id);
    };

    // History view - full transaction history component
    if (view === 'history' && historyData) {
        const {
            transactions,
            loading,
            error,
            hasMore,
            refreshTransactions,
            loadMoreTransactions,
            isEmpty
        } = historyData;

        if (error) {
            return (
                <div className="w-full">
                    <div className="border border-red-500/50 bg-red-500/10 p-4 rounded-lg">
                        <div className="text-red-400 mb-3">{error}</div>
                        <button 
                            className="text-xs px-3 py-1 bg-red-500 text-black font-bold rounded hover:bg-red-400 transition-all" 
                            onClick={refreshTransactions}
                        >
                            RETRY
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="w-full">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-semibold">Transaction History</h3>
                    <button 
                        className="text-xs px-3 py-1 bg-transparent text-gray-400 hover:text-white transition-all"
                        onClick={refreshTransactions}
                        disabled={loading}
                    >
                        {loading ? (
                            <LoaderCircle size={12} className="animate-spin inline" />
                        ) : (
                            "REFRESH"
                        )}
                    </button>
                </div>

                {isEmpty && !loading ? (
                    <div className="border border-white/20 bg-background-secondary p-6 rounded-lg text-center">
                        <div className="text-gray-400 mb-2">No transactions found</div>
                        <div className="text-xs text-gray-500">Transaction history will appear here</div>
                    </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            {transactions.map((txn) => (
                                <UnifiedTransaction
                                    key={txn.id}
                                    transaction={txn}
                                    view="list"
                                    onViewDetails={onViewDetails}
                                />
                            ))}
                        </div>
                        
                        {hasMore && (
                            <div className="mt-4">
                                <button 
                                    onClick={loadMoreTransactions}
                                    disabled={loading}
                                    className="w-full font-mono text-sm px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-all disabled:opacity-50"
                                >
                                    {loading ? (
                                        <LoaderCircle size={12} className="animate-spin mx-auto" />
                                    ) : (
                                        "LOAD MORE"
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    }

    // List view - individual transaction in a list
    if (view === 'list' && transaction) {
        return (
            <div 
                className="border border-white/20 bg-background-secondary p-4 rounded-lg cursor-pointer hover:bg-background-secondary/80 transition-all"
                onClick={() => onViewDetails?.(transaction)}
            >
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-400">Type:</span>
                        <span className="text-white">
                            {getKindSymbol(transaction.kind)} {transaction.kind}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Status:</span>
                        <span className={transaction.status === 'completed' ? 'text-lime-500' : 
                                        transaction.status === 'failed' ? 'text-red-500' : 
                                        'text-white'}>
                            {transaction.status}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Amount:</span>
                        <span className="text-white">{transaction.amount} {transaction.token}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">ID:</span>
                        <span className="text-blue-400">{shortenAddress(transaction.id)}</span>
                    </div>
                </div>
                <div className="mt-2 pt-2 border-t border-white/10">
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Time:</span>
                        <span className="text-gray-400">{formatTimestamp(transaction.timestamp)}</span>
                    </div>
                </div>
            </div>
        );
    }

    // Row view - table row format
    if (view === 'row') {
        return (
            <tr className="border-b border-gray-300 hover:bg-gray-100" role="button" onClick={() => handleRowClick(index!)}>
                <td className="py-3 text-left text-base font-medium text-foreground">{timestamp}</td>
                <td className="py-3 px-6 text-left text-base font-medium text-foreground">
                    <button className={`${type === "mint" ? "bg-mintbtnbg" : "bg-sendbtnbg"} bg-opacity-30 px-3 rounded-bordertb`}>{type}</button>
                </td>
                <td className="py-3 px-6 text-left text-base font-medium text-foreground"><span>{amount}</span></td>
                <td className="py-3 px-6 text-left text-base font-medium text-foreground"><span>{fee}</span></td>
                <th className="py-3 px-6 text-left">
                    <div className='text-base font-medium text-foreground items-center flex'>
                        <span className='me-2 flex'>Completed</span>
                        <FontAwesomeIcon icon={faCheck} />
                    </div>
                </th>
            </tr>
        );
    }

    // Detail view
    if (view === 'detail' && transaction) {
        return (
            <div className="terminal-container">
                <div className="terminal-header mb-4">
                    <span className="terminal-prompt">&gt;&gt;</span> transaction_details
                </div>
                <div className="terminal-info">
                    <div className="terminal-row">
                        <span className="terminal-label">tx_id:</span>
                        <span className="hex-address">{transaction.id}</span>
                    </div>
                    <div className="terminal-row">
                        <span className="terminal-label">type:</span>
                        <span className="terminal-value">{transaction.kind}</span>
                    </div>
                    <div className="terminal-row">
                        <span className="terminal-label">status:</span>
                        <span className="terminal-value">{transaction.status}</span>
                    </div>
                    <div className="terminal-row">
                        <span className="terminal-label">amount:</span>
                        <span className="terminal-value">{transaction.amount} {transaction.token}</span>
                    </div>
                    <div className="terminal-row">
                        <span className="terminal-label">timestamp:</span>
                        <span className="terminal-value">{formatTimestamp(transaction.timestamp)}</span>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default React.memo(UnifiedTransaction);