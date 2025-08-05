import React, { useEffect, useState } from "react";
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

    const handleRefresh = () => {
        if (!isAuthenticated || !principal) return;
        dispatch(getIcpBal(principal));
        dispatch(getPrimaryBalance(principal));
        dispatch(getSecondaryBalance(principal));
        toast.info("[REFRESHING] BALANCE UPDATE IN PROGRESS")
    }

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
            <div className="terminal-container-sm">
                <div className="terminal-pure mb-2 terminal-boot">
                    <div className="text-center py-2">
                        <span className="terminal-status-error terminal-blink">WALLET_NOT_CONNECTED</span>
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
                <span className="terminal-timestamp">
                    {new Date().toTimeString().slice(0, 8)}
                </span>
                
                <div className="terminal-divider-dots mt-2" />
                
                {/* Principal & Account */}
                <div className="terminal-row mt-1 terminal-boot" style={{ animationDelay: '0.1s' }}>
                    <span className="terminal-label">principal:</span>
                    <div className="flex items-center gap-2">
                        <span className="hex-address">{formattedPrincipal}</span>
                        <span className="terminal-status">[connected]</span>
                        <CopyHelper account={principal} />
                    </div>
                </div>
                
                <div className="terminal-row">
                    <span className="terminal-label">account_id:</span>
                    <div className="flex items-center gap-2">
                        <span className="hex-address text-xs">{formattedAccountId}</span>
                        {icpLedgerAccountId && <CopyHelper account={icpLedgerAccountId} />}
                    </div>
                </div>

                {/* Active Pool Section */}
                {swap.activeSwapPool && (
                    <div className="border-t border-white/30 mt-2 pt-2">
                        <div className="terminal-row">
                            <span className="terminal-label">status:</span>
                            <span className="terminal-status">
                                {swap.activeSwapPool[1].isLive ? "[live]" : "[launching]"}
                            </span>
                        </div>
                        
                        <div className="terminal-row">
                            <span className="terminal-label">pool_id:</span>
                            <span className="terminal-value">{swap.activeSwapPool[0]}</span>
                        </div>
                        
                        <div className="terminal-row">
                            <span className="terminal-label">primary_token:</span>
                            <span className="terminal-primary">{swap.activeSwapPool[1].primary_token_symbol}</span>
                        </div>
                        
                        <div className="terminal-row">
                            <span className="terminal-label">secondary_token:</span>
                            <span className="terminal-value">{swap.activeSwapPool[1].secondary_token_symbol}</span>
                        </div>
                    </div>
                )}

                {/* Balances Section */}
                <div className="border-t border-white/30 mt-2 pt-2 terminal-boot" style={{ animationDelay: '0.3s' }}>
                    <div className="flex justify-between items-center mb-2">
                        <span className="terminal-accent text-xs">
                            <span className="terminal-prompt">&gt;</span> wallet_assets
                        </span>
                        <FontAwesomeIcon 
                            role="button" 
                            icon={faRotate} 
                            onClick={handleRefresh} 
                            className="text-pink-500 hover:text-pink-400 cursor-pointer text-xs hover:animate-spin"
                        />
                    </div>
                    
                    <div className="terminal-row">
                        <span className="terminal-label">icp_balance:</span>
                        <div className="text-right">
                            <span className="terminal-primary cyber-glow">{icpLedgerAccountBalance}</span>
                            <span className="terminal-accent ml-2">[${icpLedgerAccountBalanceUSD}]</span>
                        </div>
                    </div>

                    {swap.activeSwapPool && (
                        <>
                            <div className="terminal-row">
                                <span className="terminal-label">{swap.activeSwapPool[1].primary_token_symbol.toLowerCase()}:</span>
                                <div className="text-right">
                                    <span className="terminal-value">{primary.primaryBal}</span>
                                    <span className="terminal-accent ml-2">
                                        [${(parseFloat(primary.primaryBal) * parseFloat(primary.primaryPriceUsd)).toFixed(4)}]
                                    </span>
                                </div>
                            </div>
                            
                            <div className="terminal-row">
                                <span className="terminal-label">{swap.activeSwapPool[1].secondary_token_symbol.toLowerCase()}:</span>
                                <div className="text-right">
                                    <span className="terminal-value">{swap.secondaryBalance || "0"}</span>
                                    <span className="terminal-accent ml-2">
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
                        
                        <div className="terminal-row">
                            <span className="terminal-label">max_supply:</span>
                            <span className="terminal-primary">
                                {Number(TokenConversionService.formatE8sDisplay(swap.activeSwapPool[1].primary_token_max_supply, 0)).toLocaleString()}
                            </span>
                        </div>
                        
                        {tokenomics.totalPrimarySupply && (
                            <div className="terminal-row">
                                <span className="terminal-label">current_supply:</span>
                                <div className="text-right">
                                    <span className="terminal-value">
                                        {Number(TokenConversionService.formatE8sDisplay(tokenomics.totalPrimarySupply, 0)).toLocaleString()}
                                    </span>
                                    <span className="terminal-accent ml-2">
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