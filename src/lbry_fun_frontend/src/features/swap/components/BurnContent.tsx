import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { _SERVICE as _SERVICESWAP } from '../../../../../../declarations/icp_swap/icp_swap.did'
import { _SERVICE as _SERVICESECONDARY } from '../../../../../../ICRC/ICRC.did'
import AccessGuard from "./AccessGuard";
import { useAccessState } from "../hooks/useAccessState";
import { useRefreshableData } from "@/hooks/useRefreshableData";

import { Link } from "react-router-dom";
import { tradingThunks } from "../thunks/tradingThunks";
import { balanceThunks } from "../thunks/balanceThunks";
import { analyticsThunks } from "../thunks/analyticsThunks";
import { resetOperation } from "../store/swapSlice";
import { LoaderCircle } from "lucide-react";
import getCanisterBal from "@/features/icp-ledger/thunks/getCanisterBal";
import TerminalNotification from "./TerminalNotification";
import { useTerminalNotification } from "../hooks/useTerminalNotification";
import BurnInfo from "./BurnInfo";
import calculateMaxBurnAllowed from "./calculateMaxBurnAllowed";
import { TerminalAuthMenu } from "@/features/auth/components/TerminalAuthMenu";
import { RootState } from "@/store";

// Destructure for easier access
const { burnSecondary } = tradingThunks;
const { getSecondaryBalance, getCanisterArchivedBalance } = balanceThunks;
const { fetchTransactionHistory } = analyticsThunks;

const BurnContent = () => {
    const dispatch = useAppDispatch();
    const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
    const swap = useAppSelector((state: RootState) => state.swap);
    const burnStatus = useAppSelector((state: RootState) => state.swap.operations.burn);
    const burnError = useAppSelector((state: RootState) => state.swap.operationErrors.burn);
    const icpLedger = useAppSelector((state: RootState) => state.icpLedger);
    const tokenomics = useAppSelector((state: RootState) => state.tokenomics);
    const { accessState, countdown, launchTime, isTokenLive } = useAccessState();

    const [amountSecondary, setAmountSecondary] = useState(0);
    const [tentativeICP, setTentativeICP] = useState(0);
    const [tentativePrimary, setTentativePrimary] = useState(0);
    const { notification, showLoading, showSuccess, showError, hide } = useTerminalNotification();
    
    // Memoize expensive calculation
    const maxBurnAllowed = useMemo(() => {
        return calculateMaxBurnAllowed(
            swap.secondaryRatio, 
            icpLedger.canisterBalance, 
            swap.canisterArchivedBal?.canisterArchivedBal || 0, 
            swap.canisterArchivedBal?.canisterUnClaimedIcp || 0
        );
    }, [swap.secondaryRatio, icpLedger.canisterBalance, swap.canisterArchivedBal]);
    
    // Fetcher to refresh the underlying data
    const fetchBurnData = useCallback(async () => {
        await Promise.all([
            dispatch(getCanisterBal()),
            dispatch(getCanisterArchivedBalance())
        ]);
    }, [dispatch]);
    
    const { isRefreshing: isRefreshingBurn, refresh } = useRefreshableData(
        'max-burn',
        fetchBurnData,
        [swap.secondaryRatio],
        { autoRefresh: 10000 } // Refresh every 10s since it's critical
    );

    const handleSubmit = useCallback((event?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => {
        event?.preventDefault();
        if (!isAuthenticated || !principal) return;
        
        // Check if token is live
        if (!isTokenLive) {
            showError(
                "TRADING NOT AVAILABLE",
                "TOKEN IN LAUNCH PERIOD → BURNING STARTS IN 24H"
            );
            return;
        }
        
        // Add frontend validation to prevent burns exceeding max allowed
        if (maxBurnAllowed === 0) {
            showError(
                "BURNING NOT AVAILABLE",
                "INSUFFICIENT ICP BALANCE → MINT SECONDARY TOKENS FIRST"
            );
            return;
        }
        
        if (amountSecondary > maxBurnAllowed) {
            showError(
                "BURN EXCEEDS MAXIMUM",
                `MAX ALLOWED: ${maxBurnAllowed.toFixed(4)}`
            );
            return;
        }
        
        dispatch(burnSecondary({ amount: amountSecondary.toString(), userPrincipal: principal }));
        showLoading("BURN IN PROGRESS", "PROCESSING TRANSACTION...");
    }, [isAuthenticated, principal, isTokenLive, maxBurnAllowed, amountSecondary, dispatch, showError, showLoading]);
    const handleAmountSecondaryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (Number(e.target.value) >= 0) {
            const amount = Number(e.target.value);
            setAmountSecondary(amount);
            
            const ratio = Number(swap.secondaryRatio) || 0;
            const icpAmount = ratio > 0 ? (amount / ratio) / 2 : 0;
            setTentativeICP(isNaN(icpAmount) ? 0 : icpAmount);
            
            const mintRate = Number(tokenomics.primaryMintRate) || 0;
            const primaryAmount = amount * mintRate;
            setTentativePrimary(isNaN(primaryAmount) ? 0 : primaryAmount);
        }
    }, [swap.secondaryRatio, tokenomics.primaryMintRate]);
    const handleMaxLbry = useCallback(() => {
        const userBal = Math.floor(Math.max(0, Number(swap.secondaryBalance) - Number(swap.secondaryFee))); // Ensure non-negative user balance
        const secondaryRatio = Number(swap.secondaryRatio);
        const primaryMintRate = Number(tokenomics.primaryMintRate);

        setAmountSecondary(userBal);
        
        const icpAmount = secondaryRatio > 0 ? userBal / (secondaryRatio * 2) : 0;
        setTentativeICP(isNaN(icpAmount) ? 0 : icpAmount);
        
        const primaryAmount = userBal * (primaryMintRate || 0);
        setTentativePrimary(isNaN(primaryAmount) ? 0 : primaryAmount);
    }, [swap.secondaryBalance, swap.secondaryFee, swap.secondaryRatio, tokenomics.primaryMintRate]);

    // Handle burn operation state changes
    useEffect(() => {
        if (burnStatus === 'pending') {
            // Loading state is already shown from handleSubmit
        } else if (burnStatus === 'success') {
            hide();
            showSuccess("SUCCESS", "TRANSACTION SUBMITTED");
            setAmountSecondary(0);
            setTentativeICP(0);
            setTentativePrimary(0);
            
            // Refresh balances after successful burn
            if (isAuthenticated && principal) {
                dispatch(getSecondaryBalance(principal));
                dispatch(balanceThunks.getPrimaryBalance(principal)); // Also refresh primary balance
                dispatch(fetchTransactionHistory({ userPrincipal: principal, startIndex: 0 }));
            }
            
            // Auto-reset is handled by middleware after 3 seconds
        } else if (burnStatus === 'error' && burnError) {
            hide();
            showError(burnError.title, burnError.message);
            dispatch(resetOperation('burn'));
            
            // Refresh balance on error too
            if (isAuthenticated && principal) {
                dispatch(getSecondaryBalance(principal));
            }
        }
    }, [burnStatus, burnError, dispatch, hide, showSuccess, showError, isAuthenticated, principal]);

    // getCanisterArchivedBal is now loaded as critical data in useSwapDataLoader

    // maxBurnAllowed is now memoized - removed useEffect

    const primaryLogoFromState = swap.activeSwapPool?.[1]?.primary_token_logo_base64;
    const secondaryLogoFromState = swap.activeSwapPool?.[1]?.secondary_token_logo_base64;

    const secondarySymbol = swap.activeSwapPool?.[1]?.secondary_token_symbol || "SECONDARY";
    const primarySymbol = swap.activeSwapPool?.[1]?.primary_token_symbol || "PRIMARY";

    return (
        <AccessGuard accessState={accessState} countdown={countdown} launchTime={launchTime}>
            <div className="w-full">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column - Burn Form */}
                    <div>
                        {/* Input Section */}
                        <div className="space-y-3 mb-6">
                            <div className={`border ${amountSecondary > maxBurnAllowed ? 'border-red-500' : 'border-white/20'} bg-background-secondary p-4 rounded-lg transition-colors`}>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="terminal-label text-xs">BURN {secondarySymbol}</span>
                                    <button
                                        className="text-xs text-gray-400 hover:text-white transition-colors"
                                        onClick={handleMaxLbry}
                                    >
                                        MAX
                                    </button>
                                </div>
                                <input 
                                    className="bg-transparent text-white font-mono text-lg w-full focus:outline-none caret-lime-500" 
                                    type="number" 
                                    value={amountSecondary} 
                                    min={0} 
                                    onChange={handleAmountSecondaryChange}
                                    placeholder="0"
                                />
                                <div className="flex justify-between items-center mt-2">
                                    <span className="terminal-label text-xs">balance:</span>
                                    <span className="terminal-value text-xs">{swap.secondaryBalance} {secondarySymbol}</span>
                                </div>
                            </div>

                            {/* Output Section */}
                            <div className="space-y-3">
                                <div className="border border-white/20 bg-background-secondary p-4 rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="terminal-label text-xs">RECEIVE ICP</span>
                                    </div>
                                    <div className={`font-mono text-lg mb-2 ${amountSecondary > maxBurnAllowed ? 'text-red-500' : 'text-lime-500'}`}>
                                        {tentativeICP.toFixed(4)}
                                    </div>
                                    <div className="text-xs text-gray-400">50% of original mint value</div>
                                </div>
                                
                                <div className="border border-white/20 bg-background-secondary p-4 rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="terminal-label text-xs">RECEIVE {primarySymbol}</span>
                                    </div>
                                    <div className="text-lime-500 font-mono text-lg">
                                        {tentativePrimary.toFixed(4)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Status Messages */}
                        {amountSecondary > maxBurnAllowed && (
                            <div className="mb-4 p-3 border border-red-500/50 bg-red-500/10 rounded text-sm">
                                <span className="text-red-400">Maximum allowed: {maxBurnAllowed.toFixed(4)} {secondarySymbol}</span>
                            </div>
                        )}

                        {/* Execute Button */}
                        <div className="mt-6">
                            {isAuthenticated ? (
                                <button
                                    type="button"
                                    className={`w-full font-mono text-sm px-4 py-3 rounded transition-all ${
                                        amountSecondary === 0 || burnStatus === 'pending' || amountSecondary > maxBurnAllowed || !isTokenLive
                                            ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                                            : 'bg-lime-500 text-black font-bold hover:bg-lime-400 cursor-pointer'
                                    }`}
                                    disabled={
                                        amountSecondary === 0 ||
                                        burnStatus === 'pending' ||
                                        amountSecondary > maxBurnAllowed ||
                                        !isTokenLive
                                    }
                                    onClick={handleSubmit}
                                    title={!isTokenLive ? "Trading will be enabled after the launch period" : ""}
                                >
                                    {burnStatus === 'pending' ? (
                                        <LoaderCircle size={14} className="animate-spin mx-auto" />
                                    ) : !isTokenLive ? (
                                        <span>AWAITING LAUNCH</span>
                                    ) : (
                                        <span>EXECUTE BURN</span>
                                    )}
                                </button>
                            ) : (
                                <div className="bg-gray-800 text-white font-mono text-sm px-4 py-3 rounded flex items-center justify-center">
                                    <TerminalAuthMenu />
                                </div>
                            )}
                            
                            <div className="mt-3 space-y-1">
                                <span className="text-xs text-gray-400">* Burns are irreversible</span>
                                <br />
                                <span className="text-xs text-gray-400">* Failed transactions can be redeemed in swap tab</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Transaction Details */}
                    <div>
                        <div className="border border-white/20 bg-background-secondary p-4 rounded-lg">
                            <h3 className="text-sm font-semibold mb-4">Burn Details</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="terminal-label text-xs">Network Fee:</span>
                                    <span className="terminal-value text-xs">{swap.secondaryFee} {secondarySymbol}</span>
                                </div>
                                
                                <div className="flex justify-between items-center">
                                    <span className="terminal-label text-xs">Max Burn Allowed:</span>
                                    <span 
                                        className={`terminal-primary text-xs cursor-pointer ${isRefreshingBurn ? 'terminal-blink' : ''}`}
                                        onClick={refresh}
                                        title="Click to refresh"
                                    >
                                        {maxBurnAllowed.toFixed(4)} {secondarySymbol}
                                    </span>
                                </div>
                                
                                <div className="border-t border-white/10 pt-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="terminal-label text-xs">Exchange Rate:</span>
                                        <span className="terminal-value text-xs">1 {secondarySymbol} = {Number(tokenomics.primaryMintRate).toFixed(4)} {primarySymbol}</span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center">
                                        <span className="terminal-label text-xs">ICP Return Rate:</span>
                                        <span className="terminal-value text-xs">{Number(swap.secondaryRatio).toFixed(4)} {secondarySymbol} = 0.5 ICP</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <TerminalNotification 
                    type={notification.type}
                    isOpen={notification.isOpen}
                    onClose={hide}
                    title={notification.title}
                    message={notification.message}
                />
            </div>
        </AccessGuard>
    );
};
export default BurnContent;