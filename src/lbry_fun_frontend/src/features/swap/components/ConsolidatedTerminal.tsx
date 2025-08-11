import React, { useEffect, useState, useCallback } from "react";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import getIcpBal from "@/features/icp-ledger/thunks/getIcpBal";
import CopyHelper from "./CopyHelper";
import getAccountId from "@/features/icp-ledger/thunks/getAccountId";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/free-solid-svg-icons";
import { TerminalAuthMenu } from "@/features/auth/components/TerminalAuthMenu";
import { toast } from "sonner";
import { RootState } from "@/store";
import { balanceThunks } from "../thunks/balanceThunks";
import { TerminalExpander } from "./TerminalExpander";
import { useRefreshableData } from "@/hooks/useRefreshableData";

// Destructure for easier access
const { getPrimaryBalance, getSecondaryBalance } = balanceThunks;
import { TokenConversionService } from "@/utils/TokenConversionService";

const ConsolidatedTerminal: React.FC = () => {
    const dispatch = useAppDispatch();
    const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
    const swap = useAppSelector((state: RootState) => state.swap);
    const operations = useAppSelector((state: RootState) => state.swap.operations);
    const primary = useAppSelector((state: RootState) => state.primary);
    const tokenomics = useAppSelector((state: RootState) => state.tokenomics);
    const { 
        accountId: icpLedgerAccountId,
        accountBalance: icpLedgerAccountBalance,
        accountBalanceUSD: icpLedgerAccountBalanceUSD,
        transferSuccess: icpLedgerTransferSuccess
    } = useAppSelector((state: RootState) => state.icpLedger);
    
    const [formattedPrincipal, setFormattedPrincipal] = useState("");
    const [formattedAccountId, setFormattedAccountId] = useState("");

    // Memoize the batch fetcher
    const fetchAllBalances = useCallback(async () => {
        if (!isAuthenticated || !principal) return;
        await Promise.all([
            dispatch(getIcpBal(principal)),
            dispatch(getPrimaryBalance(principal)),
            dispatch(getSecondaryBalance(principal))
        ]);
    }, [dispatch, principal, isAuthenticated]);
    
    const { refresh: refreshAll, isRefreshing } = useRefreshableData(
        'wallet-assets',
        fetchAllBalances,
        [principal]
    );

    useEffect(() => {
        if (isAuthenticated && principal) {
            dispatch(getAccountId(principal));
        }
    }, [isAuthenticated, principal, dispatch]);

    useEffect(() => {
        if (!isAuthenticated || !principal) return;
        // Refresh ICP balance when any operation succeeds
        const anyOperationSuccess = Object.values(operations).some(status => status === 'success');
        if (anyOperationSuccess || icpLedgerTransferSuccess === true) {
            dispatch(getIcpBal(principal));
        }
    }, [isAuthenticated, principal, operations, icpLedgerTransferSuccess, dispatch]);

    useEffect(() => {
        if (!isAuthenticated || !principal || !icpLedgerAccountId) return;
        const handleResize = () => {
            if (window.innerWidth < 1000) {
                setFormattedPrincipal(principal.slice(0, 3) + "..." + principal.slice(-3));
                setFormattedAccountId(icpLedgerAccountId.slice(0, 3) + "..." + icpLedgerAccountId.slice(-3));
            } else {
                setFormattedPrincipal(principal.slice(0, 8) + "..." + principal.slice(-8));
                setFormattedAccountId(icpLedgerAccountId.slice(0, 8) + "..." + icpLedgerAccountId.slice(-8));
            }
        };

        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [isAuthenticated, principal, icpLedgerAccountId, dispatch]);

    if (!isAuthenticated || !principal) {
        return (
            <div className="w-full mx-auto max-w-[600px]">
                <div className="bg-black border border-white/30 font-mono text-sm p-3 mb-2">
                    <div className="text-center py-2">
                        <span className="text-red-500 font-bold uppercase animate-pulse">WALLET_NOT_CONNECTED</span>
                        <div className="mt-2">
                            <TerminalAuthMenu />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <TerminalExpander
            title="WALLET_TERMINAL"
            status="[LIVE]"
            terminalId="wallet"
            defaultExpanded={false}
        >
            <div className="p-4 min-h-[400px]">
                <span className="text-gray-600 text-xs">
                    {new Date().toTimeString().slice(0, 8)}
                </span>
                
                <div className="border-t border-dotted border-white/30 mt-2" />
                
                {/* Principal & Account */}
                <div className="flex justify-between items-center py-0.5 mt-1" style={{ animationDelay: '0.1s' }}>
                    <span className="text-gray-400 text-xs">principal:</span>
                    <div className="flex items-center gap-2">
                        <span className="hex-address">{formattedPrincipal}</span>
                        <span className="text-pink-500 text-xs uppercase">[connected]</span>
                        <CopyHelper account={principal} />
                    </div>
                </div>
                
                <div className="flex justify-between items-center py-0.5">
                    <span className="text-gray-400 text-xs">account_id:</span>
                    <div className="flex items-center gap-2">
                        <span className="hex-address text-xs">{formattedAccountId}</span>
                        {icpLedgerAccountId && <CopyHelper account={icpLedgerAccountId} />}
                    </div>
                </div>

                {/* Active Pool Section */}
                {swap.activeSwapPool && (
                    <div className="border-t border-white/30 mt-2 pt-2">
                        <div className="flex justify-between items-center py-0.5">
                            <span className="text-gray-400 text-xs">status:</span>
                            <span className="text-pink-500 text-xs uppercase">
                                {swap.activeSwapPool[1].isLive ? "[live]" : "[launching]"}
                            </span>
                        </div>
                        
                        <div className="flex justify-between items-center py-0.5">
                            <span className="text-gray-400 text-xs">pool_id:</span>
                            <span className="text-white text-sm">{swap.activeSwapPool[0]}</span>
                        </div>
                        
                        <div className="flex justify-between items-center py-0.5">
                            <span className="text-gray-400 text-xs">primary_token:</span>
                            <span className="text-lime-500 font-bold text-sm">{swap.activeSwapPool[1].primary_token_symbol}</span>
                        </div>
                        
                        <div className="flex justify-between items-center py-0.5">
                            <span className="text-gray-400 text-xs">secondary_token:</span>
                            <span className="text-white text-sm">{swap.activeSwapPool[1].secondary_token_symbol}</span>
                        </div>
                    </div>
                )}

                {/* Balances Section */}
                <div className="border-t border-white/30 mt-2 pt-2" style={{ animationDelay: '0.3s' }}>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600 text-xs text-xs">
                            <span className="text-pink-500">&gt;</span> wallet_assets
                        </span>
                        <FontAwesomeIcon 
                            role="button" 
                            icon={faRotate} 
                            onClick={refreshAll} 
                            className={`cursor-pointer text-xs transition-all ${
                                isRefreshing 
                                    ? 'animate-spin text-cyan-400' 
                                    : 'text-pink-500 hover:text-pink-400 hover:rotate-180'
                            }`}
                            title={isRefreshing ? 'Refreshing...' : 'Click to refresh'}
                        />
                    </div>
                    
                    <div className="flex justify-between items-center py-0.5">
                        <span className="text-gray-400 text-xs">icp_balance:</span>
                        <div className="text-right">
                            <span className="text-lime-500 font-bold text-sm cyber-glow">{icpLedgerAccountBalance}</span>
                            <span className="text-gray-600 text-xs ml-2">[${icpLedgerAccountBalanceUSD}]</span>
                        </div>
                    </div>

                    {swap.activeSwapPool && (
                        <>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-gray-400 text-xs">{swap.activeSwapPool[1].primary_token_symbol.toLowerCase()}:</span>
                                <div className="text-right">
                                    <span className="text-white text-sm">{primary.primaryBal}</span>
                                    <span className="text-gray-600 text-xs ml-2">
                                        [${(parseFloat(primary.primaryBal) * parseFloat(primary.primaryPriceUsd)).toFixed(4)}]
                                    </span>
                                </div>
                            </div>
                            
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-gray-400 text-xs">{swap.activeSwapPool[1].secondary_token_symbol.toLowerCase()}:</span>
                                <div className="text-right">
                                    <span className="text-white text-sm">{swap.secondaryBalance || "0"}</span>
                                    <span className="text-gray-600 text-xs ml-2">
                                        [${(parseFloat(swap.secondaryBalance || "0") * 0.01).toFixed(4)}]
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Pool Metrics */}
                {swap.activeSwapPool && (
                    <div className="border-t border-white/30 mt-2 pt-2">
                        
                        <div className="flex justify-between items-center py-0.5">
                            <span className="text-gray-400 text-xs">max_supply:</span>
                            <span className="text-lime-500 font-bold text-sm">
                                {Number(TokenConversionService.formatE8sDisplay(swap.activeSwapPool[1].primary_token_max_supply, 0)).toLocaleString()}
                            </span>
                        </div>
                        
                        {tokenomics.totalPrimarySupply && (
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-gray-400 text-xs">current_supply:</span>
                                <div className="text-right">
                                    <span className="text-white text-sm">
                                        {Number(TokenConversionService.formatE8sDisplay(tokenomics.totalPrimarySupply, 0)).toLocaleString()}
                                    </span>
                                    <span className="text-gray-600 text-xs ml-2">
                                        [{((BigInt(tokenomics.totalPrimarySupply) * BigInt(100)) / BigInt(swap.activeSwapPool[1].primary_token_max_supply)).toString()}%]
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </TerminalExpander>
    );
};

export default React.memo(ConsolidatedTerminal);