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

    // List view - individual transaction in a list
    if (view === 'list' && transaction) {
        return (
            <div 
                className="terminal-info cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => onViewDetails?.(transaction)}
            >
                <div className="terminal-row">
                    <span className="terminal-label">tx_id:</span>
                    <span className="hex-address">{shortenAddress(transaction.id)}</span>
                </div>
                <div className="terminal-row">
                    <span className="terminal-label">type:</span>
                    <span className="terminal-value">
                        {getKindSymbol(transaction.kind)} {transaction.kind}
                    </span>
                </div>
                <div className="terminal-row">
                    <span className="terminal-label">status:</span>
                    <span className={transaction.status === 'completed' ? 'terminal-primary' : 
                                    transaction.status === 'failed' ? 'terminal-status' : 
                                    'terminal-value'}>
                        {transaction.status}
                    </span>
                </div>
                <div className="terminal-row">
                    <span className="terminal-label">amount:</span>
                    <span className="terminal-value">{transaction.amount} {transaction.token}</span>
                </div>
                <div className="terminal-row">
                    <span className="terminal-label">time:</span>
                    <span className="terminal-value">{formatTimestamp(transaction.timestamp)}</span>
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