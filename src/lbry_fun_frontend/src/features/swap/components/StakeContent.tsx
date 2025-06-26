import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";

import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import AccessGuard from "./AccessGuard";
import { useAccessState } from "../hooks/useAccessState";

import { balanceThunks } from "../thunks/balanceThunks";
import { stakingThunks } from "../thunks/stakingThunks";
import { flagHandler } from "../swapSlice";

// Destructure for easier access
const { getPrimaryBalance, getAccountPrimaryBalance } = balanceThunks;
const { stakePrimary } = stakingThunks;
import StakedInfo from "./StakeInfo";
import { LoaderCircle } from "lucide-react";
import Modal from "./Modal";
import { useModal } from "../hooks/useModal";
import { TerminalAuthMenu } from "@/features/auth/components/TerminalAuthMenu";
import { RootState } from "@/store";
import UnifiedSkeleton from "./UnifiedSkeleton";

const StakeContent = () => {
    const dispatch = useAppDispatch();

    const swap = useAppSelector((state: RootState) => state.swap);
    const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
    const primary = useAppSelector((state: RootState) => state.primary);
    const icpLedger = useAppSelector((state: RootState) => state.icpLedger);
    const { accessState, countdown, launchTime, isTokenLive } = useAccessState();

    const [amount, setAmount] = useState("0");
    const { modal, showLoading, showSuccess, showError, hide } = useModal();
    const [userEstimateReward, setUserEstimatedReward] = useState(0);
    const [apr, setApr] = useState("0");
    const [annualizedApr, setAnnualizedApr] = useState("0");

    const handleSubmit = useCallback((event: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        if (!isAuthenticated || !principal) return;
        
        // Check if token is live
        if (!isTokenLive) {
            showError(
                "Staking Not Yet Available",
                "This token is still in its launch period. Staking will be enabled after the 24-hour launch window."
            );
            return;
        }
        
        dispatch(stakePrimary({ amount, userPrincipal: principal }));
        showLoading("Stake in Progress", "Transaction is being processed. This may take a few moments.");
    }, [isAuthenticated, principal, isTokenLive, amount, dispatch, showError, showLoading]);
    const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (Number(e.target.value) < 0) {
            return;
        }
        setAmount(e.target.value);
    }, []);
    const handleMaxPrimary = useCallback(() => {
        const userBal = Math.max(0, Number(primary.primaryBal) - Number(primary.primaryFee)).toFixed(4);
        setAmount(userBal);
    }, [primary.primaryBal, primary.primaryFee]);

    useEffect(() => {
        const estimatedUserRewardIcp = Number(swap.stakeInfo.stakedPrimary) * swap.averageAPY;
        setUserEstimatedReward(estimatedUserRewardIcp);

        const estimatedRewardIcp = Number(swap.totalStaked) * swap.averageAPY;
        const stakedUsd = Number(swap.totalStaked) * Number(primary.primaryPriceUsd);

        // Check if `stakedUsd` is valid before dividing
        if (stakedUsd > 0) {
            const hourlyAprPercentage = ((estimatedRewardIcp * Number(icpLedger.icpPrice)) / stakedUsd) * 100;
            const annualAprPercentage = hourlyAprPercentage * 24 * 365; // Convert hourly to annual
            setApr(hourlyAprPercentage.toFixed(4) + "%");
            setAnnualizedApr(annualAprPercentage.toFixed(2) + "%");
        } else {
            setApr(''); // Fallback value if division by zero
            setAnnualizedApr('');
        }
    }, [primary.primaryPriceUsd, icpLedger.icpPrice, swap.averageAPY, swap.stakeInfo.stakedPrimary]);


    useEffect(() => {
        if (isAuthenticated && principal) {
            dispatch(getPrimaryBalance(principal))
        }
    }, [isAuthenticated, principal, dispatch])

    useEffect(() => {

        if (swap.successStake === true || swap.unstakeSuccess === true || swap.burnSuccess === true || swap.successClaimReward === true) {
            dispatch(flagHandler());
            if (isAuthenticated && principal) dispatch(getAccountPrimaryBalance(principal))
            hide();
            showSuccess("Success!", "Transaction Submitted!");
        }
        if (swap.error) {
            hide();
            showError(swap.error.title, swap.error.message);
            dispatch(flagHandler());
        }
    }, [isAuthenticated, principal, swap, dispatch])

    const primaryTokenLogoFromState = swap.activeSwapPool?.[1]?.primary_token_logo_base64;

    // Show skeleton while critical data is loading
    if (!swap.activeSwapPool || swap.totalStaked === undefined) {
        return <UnifiedSkeleton variant="stake" />;
    }

    return (
        <AccessGuard accessState={accessState} countdown={countdown} launchTime={launchTime}>
            <style>
                {`
                /* Hide number input spinners for Chrome, Safari, Edge, Opera */
                input[type="number"]::-webkit-inner-spin-button,
                input[type="number"]::-webkit-outer-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }

                /* Hide number input spinners for Firefox */
                input[type="number"] {
                    -moz-appearance: textfield;
                }
                `}
            </style>
            <div className="terminal-pure">
                <div className="terminal-header">
                    <span className="terminal-prompt">&gt;&gt;</span> stake_interface
                </div>

                <div className="terminal-section-minimal">
                    <div className="terminal-row">
                        <span className="terminal-label">staked:</span>
                        <span className="terminal-primary">{swap.stakeInfo.stakedPrimary} {swap.activeSwapPool&& swap.activeSwapPool[1]?.primary_token_name}</span>
                    </div>
                    <div className="terminal-row">
                        <span className="terminal-label">estimated_returns:</span>
                        <div className="text-right">
                            <span className="terminal-value">{apr}</span>
                            <span className="terminal-accent ml-1">[hourly]</span>
                        </div>
                    </div>
                    <div className="terminal-row">
                        <span className="terminal-label">annualized_apr:</span>
                        <span className="terminal-accent">{annualizedApr}</span>
                    </div>
                    <div className="terminal-row">
                        <span className="terminal-label">total_staked:</span>
                        <span className="terminal-value">{swap.totalStaked} {swap.activeSwapPool&& swap.activeSwapPool[1]?.primary_token_name}</span>
                    </div>
                    <div className="terminal-row">
                        <span className="terminal-label">stakers:</span>
                        <span className="terminal-value">{swap.totalStakers}</span>
                    </div>
                </div>

                <div className="terminal-section mt-4">
                    <div className="terminal-header mb-2">
                        <span className="terminal-prompt">&gt;</span> stake_amount
                    </div>
                    <div className="terminal-input-container mb-2">
                        <div className="terminal-row">
                            <span className="terminal-label">amount:</span>
                            <input
                                className='terminal-input text-right'
                                type='number'
                                min={0}
                                value={amount}
                                onChange={handleAmountChange}
                                step="any"
                                placeholder="0.0000"
                            />
                        </div>
                    </div>
                    <div className="terminal-row mb-2">
                        <span className="terminal-label">available_balance:</span>
                        <div className="flex items-center">
                            <span className="terminal-value">{primary.primaryBal || '0'} {swap.activeSwapPool&& swap.activeSwapPool[1]?.primary_token_name}</span>
                            <Link to="" role="button" className='terminal-accent ml-2 hover:text-white' onClick={handleMaxPrimary} >[max]</Link>
                        </div>
                    </div>
                </div>

                <div className="terminal-section mt-4">
                    {isAuthenticated ? <button
                        type="button"
                        className={`terminal-button terminal-button-primary w-full mb-2 ${parseFloat(amount) === 0 || swap.loading || !isTokenLive ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={parseFloat(amount) === 0 || swap.loading === true || !isTokenLive}
                        onClick={handleSubmit}
                        title={!isTokenLive ? "Staking will be enabled after the launch period" : ""}
                    >
                        {swap.loading ? (<>
                            <LoaderCircle size={14} className="animate animate-spin mx-auto" /> </>) : !isTokenLive ? (
                            <>[STAKING_STARTS_SOON]</>
                        ) : (
                            <>[STAKE]</>
                        )}
                    </button> : <div
                        className="terminal-button w-full mb-2 flex items-center justify-center"
                    >
                        <TerminalAuthMenu />
                    </div>}
                    <div className="terminal-row">
                        <span className="terminal-status text-xs">*</span>
                        <span className="terminal-accent text-xs">check redeem page if transaction fails</span>
                    </div>
                </div>

                <div className="terminal-section mt-4">
                    <StakedInfo userEstimateReward={userEstimateReward} />
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
export default StakeContent;