import React, { useEffect, useState } from "react";

import { useAppSelector } from "@/store/hooks/useAppSelector";
import { _SERVICE as _SERVICESWAP } from "../../../../../../declarations/icp_swap/icp_swap.did";
import { _SERVICE as _SERVICEICPLEDGER } from "../../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did";

import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import getIcpBal from "@/features/icp-ledger/thunks/getIcpBal";
import CopyHelper from "../copyHelper";
import getAccountId from "@/features/icp-ledger/thunks/getAccountId";
import getIcpPrice from "../../../icp-ledger/thunks/getIcpPrice";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/free-solid-svg-icons";
import { TerminalAuthMenu } from "@/features/auth/components/TerminalAuthMenu";
import { toast } from "sonner";
import PoolCard from "./poolCard";
import { RootState } from "@/store";
import getAccountPrimaryBalance from "../../thunks/primaryIcrc/getAccountPrimaryBalance";
import getSecondaryBalance from "../../thunks/secondaryIcrc/getSecondaryBalance";

const ICP_PRICE_STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes (should match thunk)

const AccountCards: React.FC = () => {
    const dispatch = useAppDispatch();
    const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
    const swap = useAppSelector((state: RootState) => state.swap);
    const primary = useAppSelector((state: RootState) => state.primary);
    const { 
        icpPrice, 
        icpPriceTimestamp, 
        accountId: icpLedgerAccountId, // Renamed to avoid conflict
        accountBalance: icpLedgerAccountBalance, // Renamed
        accountBalanceUSD: icpLedgerAccountBalanceUSD, // Renamed
        transferSuccess: icpLedgerTransferSuccess // Renamed
    } = useAppSelector((state: RootState) => state.icpLedger);
    const [formattedPrincipal, setFormattedPrincipal] = useState("");
    const [formattedAccountId, setFormattedAccountId] = useState("");

    const handleRefresh = () => {
        if (!isAuthenticated || !principal) return;
        dispatch(getIcpBal(principal));
        dispatch(getAccountPrimaryBalance(principal));
        dispatch(getSecondaryBalance(principal));
        // ICP price will be refreshed if stale through the thunk's internal caching
        toast.info("Refreshing balances!")
    }

    // icp ledger
    useEffect(() => {
        if (isAuthenticated && principal) {
            // Only fetch user-specific data that's not part of the centralized loader
            dispatch(getAccountId(principal));
            // ICP balance is already fetched by useSwapDataLoader's loadCriticalData
            // ICP price is already fetched by useSwapDataLoader's loadCriticalData
            // ICP balance and price are fetched by centralized data loader
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
            icpLedgerTransferSuccess === true // Used renamed variable
        ) {
            dispatch(getIcpBal(principal));
        }
    }, [isAuthenticated, principal, swap, icpLedgerTransferSuccess, dispatch]); // Used renamed variable

    //style
    useEffect(() => {
        if (!isAuthenticated || !principal || !icpLedgerAccountId) return;
        const handleResize = () => {
            if (window.innerWidth < 1000) {
                setFormattedPrincipal(
                    principal.slice(0, 3) + "..." + principal.slice(-3)
                );
                setFormattedAccountId(
                    icpLedgerAccountId.slice(0, 3) + "..." + icpLedgerAccountId.slice(-3)
                );
            } else {
                setFormattedPrincipal(
                    principal.slice(0, 5) + "..." + principal.slice(-20)
                );
                setFormattedAccountId(
                    icpLedgerAccountId.slice(0, 5) + "..." + icpLedgerAccountId.slice(-20)
                );

            }
        };

        handleResize();
        window.addEventListener("resize", handleResize);

        return () => window.removeEventListener("resize", handleResize);
    }, [isAuthenticated, principal, icpLedgerAccountId, dispatch]);

    return (
        <>
            <div className="grid grid-cols-1 2xl:grid-cols-2 xl:grid-cols-2 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1 mb-3 2xl:mb-12 xl:mb-10 lg:mb-7 md:mb-6 sm:mb-5">
                <div className="terminal-card text-green-50 me-0 2xl:me-3 xl:me-3 lg:me-3 md:me-3 sm:me-0 mb-3 2xl:mb-0 xl:mb-0 lg:mb-0 md:mb-0 sm:mb-3">
                    <h4 className="terminal-header text-lime-400">
                        <span className="terminal-prompt">&gt;</span> PRINCIPAL_ACCOUNT
                    </h4>

                    {isAuthenticated && principal ? (
                        <>
                            <div className="md:mb-20 sm:mb-16 xs:mb-10">
                                <div className="flex justify-between mb-6 pb-4 border-b border-pink-900/30">
                                    <div>
                                        <span className="hex-address text-lg">
                                            0x{formattedPrincipal}
                                        </span>
                                        <span className="cyber-status text-pink-400 ml-2">
                                            [CONNECTED]
                                        </span>
                                    </div>
                                    {principal && <CopyHelper account={principal} />}
                                </div>
                                <div className="data-row mb-6">
                                    <span className="data-label">account_id:</span>
                                    <div className="flex items-center">
                                        <span className="hex-address text-sm mr-2">
                                            0x{formattedAccountId}
                                        </span>
                                        {icpLedgerAccountId && <CopyHelper account={icpLedgerAccountId} />}
                                    </div>
                                </div>
                            </div>
                            <div className="terminal-divider pt-4">
                                <h4 className="section-header text-lime-400">
                                    <span><span className="terminal-prompt">&gt;&gt;</span> BALANCES</span>
                                    <FontAwesomeIcon 
                                        role="button" 
                                        icon={faRotate} 
                                        onClick={handleRefresh} 
                                        className="text-pink-600 hover:text-pink-400 transition-colors cursor-pointer"
                                    />
                                </h4>
                            <div className="space-y-2">
                                <div className="data-row">
                                    <span className="font-mono text-lime-300">ICP:</span>
                                    <div className="text-right">
                                        <span className="data-primary">
                                            {icpLedgerAccountBalance}
                                        </span>
                                        <span className="data-accent ml-2">
                                            [${icpLedgerAccountBalanceUSD}]
                                        </span>
                                    </div>
                                </div>
                                {swap.activeSwapPool && (
                                    <>
                                        <div className="data-row">
                                            <span className="data-label">
                                                {swap.activeSwapPool[1].primary_token_symbol}:
                                            </span>
                                            <div className="text-right">
                                                <span className="data-value">
                                                    {primary.primaryBal}
                                                </span>
                                                <span className="data-accent ml-2">
                                                    [${(parseFloat(primary.primaryBal) * parseFloat(primary.primaryPriceUsd)).toFixed(4)}]
                                                </span>
                                            </div>
                                        </div>
                                        <div className="data-row">
                                            <span className="data-label">
                                                {swap.activeSwapPool[1].secondary_token_symbol}:
                                            </span>
                                            <div className="text-right">
                                                <span className="data-value">
                                                    {swap.secondaryBalance || "0"}
                                                </span>
                                                <span className="data-accent ml-2">
                                                    [${(parseFloat(swap.secondaryBalance || "0") * 0.01).toFixed(4)}]
                                                </span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                            </div>
                        </>
                    ) : (
                        <div className="mb-20 xxl:mb-20">
                            <div className="flex justify-between mb-3 xxl:mb-3 text-white white-auth-btn">
                                <TerminalAuthMenu />
                            </div>
                        </div>
                    )}
                </div>
                <PoolCard/>

            </div>
        </>
    );
};
export default AccountCards;
