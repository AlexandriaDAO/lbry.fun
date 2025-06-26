import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { _SERVICE as _SERVICESWAP } from '../../../../../../declarations/icp_swap/icp_swap.did'
import { _SERVICE as _SERVICESECONDARY } from '../../../../../../ICRC/ICRC.did'
import AccessGuard from "./AccessGuard";
import { useAccessState } from "../hooks/useAccessState";

import { Link } from "react-router-dom";
import { tradingThunks } from "../thunks/tradingThunks";
import { balanceThunks } from "../thunks/balanceThunks";
import { analyticsThunks } from "../thunks/analyticsThunks";
import { flagHandler } from "../swapSlice";
import { LoaderCircle } from "lucide-react";
import getCanisterBal from "@/features/icp-ledger/thunks/getCanisterBal";
import Modal from "./Modal";
import { useModal } from "../hooks/useModal";
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
    const icpLedger = useAppSelector((state: RootState) => state.icpLedger);
    const tokenomics = useAppSelector((state: RootState) => state.tokenomics);
    const { accessState, countdown, launchTime, isTokenLive } = useAccessState();

    const [amountSecondary, setAmountSecondary] = useState(0);
    const [tentativeICP, setTentativeICP] = useState(0);
    const [tentativePrimary, setTentativePrimary] = useState(0);
    const { modal, showLoading, showSuccess, showError, hide } = useModal();
    
    // Memoize expensive calculation
    const maxBurnAllowed = useMemo(() => {
        return calculateMaxBurnAllowed(
            swap.secondaryRatio, 
            icpLedger.canisterBalance, 
            swap.canisterArchivedBal?.canisterArchivedBal || 0, 
            swap.canisterArchivedBal?.canisterUnClaimedIcp || 0
        );
    }, [swap.secondaryRatio, icpLedger.canisterBalance, swap.canisterArchivedBal]);

    const handleSubmit = useCallback((event?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => {
        event?.preventDefault();
        if (!isAuthenticated || !principal) return;
        
        // Check if token is live
        if (!isTokenLive) {
            showError(
                "Trading Not Yet Available",
                "This token is still in its launch period. Burning will be enabled after the 24-hour launch window."
            );
            return;
        }
        
        // Add frontend validation to prevent burns exceeding max allowed
        if (maxBurnAllowed === 0) {
            showError(
                "Burning Not Available",
                "The canister has insufficient ICP balance. Someone needs to mint secondary tokens first to add ICP to the pool."
            );
            return;
        }
        
        if (amountSecondary > maxBurnAllowed) {
            showError(
                "Burn Amount Exceeds Maximum",
                `Maximum burn allowed is ${maxBurnAllowed.toFixed(4)} based on available canister balance`
            );
            return;
        }
        
        dispatch(burnSecondary({ amount: amountSecondary.toString(), userPrincipal: principal }));
        showLoading("Burn in Progress", "Burn transaction is being processed. This may take a few moments.");
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

    useEffect(() => {
        if (!isAuthenticated || !principal) return;
        if (swap.burnSuccess === true && swap.activeSwapPool) {
            dispatch(flagHandler())
            dispatch(getSecondaryBalance(principal))
            // Refresh transaction history after successful burn
            dispatch(fetchTransactionHistory({ userPrincipal: principal, startIndex: 0 }));
            hide();
            showSuccess("Success!", "Transaction Submitted!");
            // maxBurnAllowed is now memoized
        }
        if (swap.error && swap.activeSwapPool) {
            dispatch(getSecondaryBalance(principal));
            hide();
            showError(swap.error.title, swap.error.message);
            dispatch(flagHandler());
        }
    }, [isAuthenticated, principal, swap, icpLedger.canisterBalance, tokenomics.primaryMintRate, dispatch]);

    // getCanisterArchivedBal is now loaded as critical data in useSwapDataLoader

    // maxBurnAllowed is now memoized - removed useEffect

    const primaryLogoFromState = swap.activeSwapPool?.[1]?.primary_token_logo_base64;
    const secondaryLogoFromState = swap.activeSwapPool?.[1]?.secondary_token_logo_base64;

    const secondarySymbol = swap.activeSwapPool?.[1]?.secondary_token_symbol || "SECONDARY";
    const primarySymbol = swap.activeSwapPool?.[1]?.primary_token_symbol || "PRIMARY";

    return (
        <AccessGuard accessState={accessState} countdown={countdown} launchTime={launchTime}>
            <div className="terminal-pure">
                {/* Input Section */}
                <div className="mb-4">
                    
                    <div className={`terminal-input-container mb-3 ${amountSecondary > maxBurnAllowed ? 'border-red-500' : ''}`}>
                        <div className="terminal-row">
                            <span className="terminal-label">{secondarySymbol.toLowerCase()}_amount:</span>
                            <input 
                                className="terminal-input text-right" 
                                type="number" 
                                value={amountSecondary} 
                                min={0} 
                                onChange={handleAmountSecondaryChange}
                                placeholder="0"
                            />
                        </div>
                    </div>
                    
                    <div className="terminal-row mb-2">
                        <span className="terminal-label">balance:</span>
                        <span className="terminal-value">{swap.secondaryBalance} {secondarySymbol}</span>
                    </div>
                    
                    <button
                        className="terminal-button text-xs"
                        onClick={handleMaxLbry}
                    >
                        [max]
                    </button>
                </div>

                {/* Output Section */}
                <div className="mb-4">
                    <div className="terminal-info">
                        <div className="terminal-row mb-2">
                            <span className="terminal-label">receive:</span>
                            <span className={`terminal-primary ${amountSecondary > maxBurnAllowed ? 'text-red-500' : ''}`}>
                                {tentativeICP.toFixed(4)} ICP
                            </span>
                        </div>
                        
                        <div className="terminal-row">
                            <span className="terminal-label">receive:</span>
                            <span className="terminal-primary">
                                {tentativePrimary.toFixed(4)} {primarySymbol}
                            </span>
                        </div>
                    </div>

                    {/* Execute Button */}
                    {isAuthenticated ? (
                        <button
                            type="button"
                            className={`terminal-button w-full ${
                                amountSecondary === 0 || swap.loading || amountSecondary > maxBurnAllowed || !isTokenLive
                                    ? ''
                                    : 'terminal-button-primary'
                            }`}
                            disabled={
                                amountSecondary === 0 ||
                                swap.loading === true ||
                                amountSecondary > maxBurnAllowed ||
                                !isTokenLive
                            }
                            onClick={handleSubmit}
                            title={!isTokenLive ? "Trading will be enabled after the launch period" : ""}
                        >
                            {swap.loading ? (
                                <LoaderCircle size={14} className="animate-spin mx-auto" />
                            ) : !isTokenLive ? (
                                <span className="terminal-status">[awaiting_launch]</span>
                            ) : (
                                <span>execute_burn</span>
                            )}
                        </button>
                    ) : (
                        <div className="terminal-button w-full flex items-center justify-center">
                            <TerminalAuthMenu />
                        </div>
                    )}
                </div>

                {/* Transaction Details Section */}
                <div className="border-t border-white/30 mt-4 pt-3">
                    
                    <div className="terminal-row">
                        <span className="terminal-label">network_fee:</span>
                        <span className="terminal-value">{swap.secondaryFee} {secondarySymbol}</span>
                    </div>
                    
                    <div className="terminal-row">
                        <span className="terminal-label">max_burn:</span>
                        <span className="terminal-primary">{maxBurnAllowed.toFixed(4)} {secondarySymbol}</span>
                    </div>
                    
                    <div className="terminal-row">
                        <span className="terminal-label">exchange_rate:</span>
                        <span className="terminal-value">1 {secondarySymbol} = {Number(tokenomics.primaryMintRate).toFixed(4)} {primarySymbol}</span>
                    </div>

                    <div className="terminal-row">
                        <span className="terminal-label">icp_rate:</span>
                        <span className="terminal-value">{Number(swap.secondaryRatio).toFixed(4)} {secondarySymbol} = 0.5 ICP</span>
                    </div>
                </div>

                {/* Status Messages */}
                {amountSecondary > maxBurnAllowed && (
                    <div className="terminal-alert mt-3">
                        <span className="terminal-status">[error]</span> max_allowed: {maxBurnAllowed.toFixed(4)}
                    </div>
                )}

                <div className="mt-3 space-y-1">
                    <span className="terminal-label">* burns are irreversible</span>
                    <br />
                    <span className="terminal-label">* failed transactions can be redeemed below</span>
                </div>

                <Modal 
                    type={modal.type}
                    isOpen={modal.isOpen}
                    onClose={hide}
                    title={modal.title}
                    message={modal.message}
                />
            </div>
        </AccessGuard>
    );
};
export default BurnContent;