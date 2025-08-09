import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/free-solid-svg-icons";

import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import AccessGuard from "./AccessGuard";
import { useAccessState } from "../hooks/useAccessState";
import { useRefreshableData } from "@/hooks/useRefreshableData";

import { balanceThunks } from "../thunks/balanceThunks";
import { stakingThunks } from "../thunks/stakingThunks";
import { resetOperation } from "../store/swapSlice";

// Destructure for easier access
const { getPrimaryBalance, getAccountPrimaryBalance } = balanceThunks;
const { stakePrimary } = stakingThunks;
import StakedInfo from "./StakeInfo";
import { LoaderCircle } from "lucide-react";
import TerminalNotification from "./TerminalNotification";
import { useTerminalNotification } from "../hooks/useTerminalNotification";
import { TerminalAuthMenu } from "@/features/auth/components/TerminalAuthMenu";
import { RootState } from "@/store";
import UnifiedSkeleton from "./UnifiedSkeleton";
import { formatDistributionInterval } from '../utils/distributionUtils';

const StakeContent = () => {
    const dispatch = useAppDispatch();

    const swap = useAppSelector((state: RootState) => state.swap);
    const stakeStatus = useAppSelector((state: RootState) => state.swap.operations.stake);
    const stakeError = useAppSelector((state: RootState) => state.swap.operationErrors.stake);
    const unstakeStatus = useAppSelector((state: RootState) => state.swap.operations.unstake);
    const claimStatus = useAppSelector((state: RootState) => state.swap.operations.claim);
    const burnStatus = useAppSelector((state: RootState) => state.swap.operations.burn);
    const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
    const primary = useAppSelector((state: RootState) => state.primary);
    const icpLedger = useAppSelector((state: RootState) => state.icpLedger);
    const { accessState, countdown, launchTime, isTokenLive } = useAccessState();

    const [amount, setAmount] = useState("0");
    const { notification, showLoading, showSuccess, showError, hide } = useTerminalNotification();
    const [userEstimateReward, setUserEstimatedReward] = useState(0);
    
    // Memoize fetcher for staking info
    const fetchStaking = useCallback(
        async () => {
            // We need to fetch staking info - let me check what thunk to call
            if (!isAuthenticated || !principal) return;
            await Promise.all([
                dispatch(stakingThunks.getStakedInfo(principal)),
                dispatch(stakingThunks.getAllStakesInfo()),
                dispatch(stakingThunks.getStakersCount())
            ]);
        },
        [dispatch, principal, isAuthenticated]
    );
    
    const { isRefreshing: isRefreshingStake } = useRefreshableData(
        'staking-info',
        fetchStaking,
        [principal],
        { autoRefresh: 60000 } // Every minute
    );

    const handleSubmit = useCallback((event: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        if (!isAuthenticated || !principal) return;
        
        // Check if token is live
        if (!isTokenLive) {
            showError(
                "STAKING NOT AVAILABLE",
                "TOKEN IN LAUNCH PERIOD → STAKING STARTS IN 24H"
            );
            return;
        }
        
        dispatch(stakePrimary({ amount, userPrincipal: principal }));
        showLoading("STAKE IN PROGRESS", "PROCESSING TRANSACTION...");
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
        // Calculate estimated user reward based on their stake and APY
        if (swap.averageAPY && swap.stakeInfo.stakedPrimary && swap.distributionInterval) {
            const stakedAmount = Number(swap.stakeInfo.stakedPrimary);
            const apyDecimal = swap.averageAPY / 100; // Convert percentage to decimal
            const distributionsPerYear = (365 * 24 * 3600) / swap.distributionInterval;
            const rewardPerDistribution = (stakedAmount * apyDecimal) / distributionsPerYear;
            setUserEstimatedReward(rewardPerDistribution);
        } else {
            setUserEstimatedReward(0);
        }
    }, [swap.averageAPY, swap.stakeInfo.stakedPrimary, swap.distributionInterval]);


    useEffect(() => {
        if (isAuthenticated && principal) {
            dispatch(getPrimaryBalance(principal))
        }
    }, [isAuthenticated, principal, dispatch])

    // Handle stake operation state changes
    useEffect(() => {
        if (stakeStatus === 'pending') {
            // Loading state is already shown from handleSubmit
        } else if (stakeStatus === 'success') {
            hide();
            showSuccess("SUCCESS", "TRANSACTION SUBMITTED");
            setAmount("0");
            
            // Refresh balance and staking info after successful stake
            if (isAuthenticated && principal) {
                dispatch(getPrimaryBalance(principal));
                dispatch(stakingThunks.getStakedInfo(principal)); // Refresh user's staking info
                dispatch(stakingThunks.getAllStakesInfo()); // Refresh total staked
            }
            
            // Auto-reset is handled by middleware after 3 seconds
        } else if (stakeStatus === 'error' && stakeError) {
            hide();
            showError(stakeError.title, stakeError.message);
            dispatch(resetOperation('stake'));
        }
    }, [stakeStatus, stakeError, dispatch, hide, showSuccess, showError, isAuthenticated, principal]);
    
    // Handle other operations that affect stake view
    useEffect(() => {
        if (unstakeStatus === 'success' || claimStatus === 'success' || burnStatus === 'success') {
            if (isAuthenticated && principal) {
                dispatch(getPrimaryBalance(principal));
            }
        }
    }, [unstakeStatus, claimStatus, burnStatus, isAuthenticated, principal, dispatch])

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
                <div className="terminal-header flex justify-between items-center">
                    <div>
                        <span className="terminal-prompt">&gt;&gt;</span> stake_interface
                    </div>
                    <FontAwesomeIcon 
                        icon={faRotate}
                        className={`cursor-pointer text-xs transition-all ${
                            isRefreshingStake 
                                ? 'animate-spin text-cyan-400' 
                                : 'text-pink-500 hover:text-pink-400 hover:rotate-180'
                        }`}
                        onClick={() => fetchStaking()}
                        title={isRefreshingStake ? 'Refreshing...' : 'Refresh staking info'}
                    />
                </div>

                <div className="terminal-section-minimal">
                    <div className="terminal-row">
                        <span className="terminal-label">staked_amount:</span>
                        <span className="terminal-primary">{swap.stakeInfo.stakedPrimary} {swap.activeSwapPool&& swap.activeSwapPool[1]?.primary_token_symbol}</span>
                    </div>
                    <div className="terminal-row">
                        <span className="terminal-label">reward_interval:</span>
                        <span className="terminal-accent">
                            {swap.distributionInterval ? 
                                `[EVERY ${formatDistributionInterval(swap.distributionInterval)}]` : 
                                '[LOADING...]'
                            }
                        </span>
                    </div>
                    <div className="terminal-row">
                        <span className="terminal-label">current_apy:</span>
                        <span className="terminal-value">
                            {swap.averageAPY !== null && swap.averageAPY !== undefined ? 
                                swap.averageAPY > 1000000 ? 
                                    `${swap.averageAPY.toExponential(2)}%` : 
                                    `${swap.averageAPY.toFixed(2)}%` : 
                                '0.00%'
                            }
                        </span>
                    </div>
                    <div className="terminal-row">
                        <span className="terminal-label">total_staked:</span>
                        <span className={`terminal-value ${isRefreshingStake ? 'opacity-50' : ''}`}>
                            {swap.totalStaked} {swap.activeSwapPool&& swap.activeSwapPool[1]?.primary_token_symbol}
                        </span>
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
                        className={`terminal-button terminal-button-primary w-full mb-2 ${parseFloat(amount) === 0 || stakeStatus === 'pending' || !isTokenLive ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={parseFloat(amount) === 0 || stakeStatus === 'pending' || !isTokenLive}
                        onClick={handleSubmit}
                        title={!isTokenLive ? "Staking will be enabled after the launch period" : ""}
                    >
                        {stakeStatus === 'pending' ? (<>
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
export default StakeContent;