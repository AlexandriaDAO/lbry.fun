import React, { useEffect, useState } from "react";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import getIcpBal from "@/features/icp-ledger/thunks/getIcpBal";
import CopyHelper from "../copyHelper";
import getAccountId from "@/features/icp-ledger/thunks/getAccountId";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/free-solid-svg-icons";
import { Entry } from "@/layouts/parts/Header";
import { toast } from "sonner";
import { RootState } from "@/store";
import getAccountPrimaryBalance from "../../thunks/primaryIcrc/getAccountPrimaryBalance";
import getSecondaryBalance from "../../thunks/secondaryIcrc/getSecondaryBalance";
import { TokenConversionService } from "@/utils/TokenConversionService";

const ConsolidatedTerminal: React.FC = () => {
    const dispatch = useAppDispatch();
    const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
    const swap = useAppSelector((state: RootState) => state.swap);
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
        dispatch(getAccountPrimaryBalance(principal));
        dispatch(getSecondaryBalance(principal));
        toast.info("Refreshing balances!")
    }

    useEffect(() => {
        if (isAuthenticated && principal) {
            dispatch(getAccountId(principal));
        }
    }, [isAuthenticated, principal, dispatch]);

    useEffect(() => {
        if (!isAuthenticated || !principal) return;
        if (
            swap.successClaimReward === true ||
            swap.swapSuccess === true ||
            swap.burnSuccess === true ||
            swap.transferSuccess === true ||
            swap.redeeemSuccess === true ||
            icpLedgerTransferSuccess === true
        ) {
            dispatch(getIcpBal(principal));
        }
    }, [isAuthenticated, principal, swap, icpLedgerTransferSuccess, dispatch]);

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
            <div className="terminal-pure mb-2">
                <div className="text-center py-2">
                    <span className="terminal-label">connect wallet to continue</span>
                    <div className="mt-2">
                        <Entry />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="terminal-pure mb-2">
            {/* Principal & Account */}
            <div className="terminal-row mt-1">
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
            <div className="border-t border-white/30 mt-2 pt-2">
                <div className="flex justify-between items-center mb-1">
                    <span className="terminal-accent text-xs">balances</span>
                    <FontAwesomeIcon 
                        role="button" 
                        icon={faRotate} 
                        onClick={handleRefresh} 
                        className="text-pink-500 hover:text-pink-400 cursor-pointer text-xs"
                    />
                </div>
                
                <div className="terminal-row">
                    <span className="terminal-label">icp:</span>
                    <div className="text-right">
                        <span className="terminal-primary">{icpLedgerAccountBalance}</span>
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
    );
};

export default ConsolidatedTerminal;