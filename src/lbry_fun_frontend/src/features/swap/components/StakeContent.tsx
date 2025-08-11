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
// import { TerminalRow, TerminalInput, TerminalButton, TerminalSection } from '@/components/terminal';

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
            <div className="p-4 space-y-4">
                {/* Stats section */}
                <TerminalSection 
                    title="STAKE_INTERFACE"
                    rightElement={
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
                    }
                >
                    <TerminalRow 
                        label="staked_amount" 
                        value={swap.stakeInfo.stakedPrimary} 
                        unit={swap.activeSwapPool?.[1]?.primary_token_symbol}
                        accent
                    />
                    <TerminalRow 
                        label="reward_interval" 
                        value={swap.distributionInterval ? 
                            `[EVERY ${formatDistributionInterval(swap.distributionInterval)}]` : 
                            '[LOADING...]'
                        }
                    />
                    <TerminalRow 
                        label="current_apy" 
                        value={
                            swap.averageAPY !== null && swap.averageAPY !== undefined ? 
                                swap.averageAPY > 1000000 ? 
                                    `${swap.averageAPY.toExponential(2)}%` : 
                                    `${swap.averageAPY.toFixed(2)}%` : 
                                '0.00%'
                        }
                    />
                    <TerminalRow 
                        label="total_staked" 
                        value={swap.totalStaked} 
                        unit={swap.activeSwapPool?.[1]?.primary_token_symbol}
                        accent
                    />
                    <TerminalRow 
                        label="stakers" 
                        value={swap.totalStakers}
                    />
                </TerminalSection>

                {/* Stake amount input */}
                <TerminalSection title="STAKE_AMOUNT">
                    <TerminalRow label="amount">
                        <TerminalInput
                            type='number'
                            min={0}
                            value={amount}
                            onChange={handleAmountChange}
                            step="any"
                            placeholder="0"
                        />
                    </TerminalRow>
                    <div className="mb-4">
                        <TerminalRow label="available_balance">
                            <div className="flex items-center gap-2">
                                <span className="text-white text-sm">{primary.primaryBal || '0.0000'} {swap.activeSwapPool?.[1]?.primary_token_symbol}</span>
                                <button className='text-gray-600 text-xs hover:text-white' onClick={handleMaxPrimary}>[max]</button>
                            </div>
                        </TerminalRow>
                    </div>

                    {isAuthenticated ? (
                        <TerminalButton
                            primary
                            disabled={parseFloat(amount) === 0 || stakeStatus === 'pending' || !isTokenLive}
                            onClick={handleSubmit}
                            loading={stakeStatus === 'pending'}
                            title={!isTokenLive ? "Staking will be enabled after the launch period" : ""}
                        >
                            {!isTokenLive ? '[STAKING_STARTS_SOON]' : '[STAKE]'}
                        </TerminalButton>
                    ) : (
                        <div className="bg-black border border-white/30 text-white font-mono text-sm px-4 py-2 w-full flex items-center justify-center">
                            <TerminalAuthMenu />
                        </div>
                    )}
                    <div className="text-xs text-gray-600">
                        <span className="text-pink-500">*</span>
                        <span className="ml-1">check redeem page if transaction fails</span>
                    </div>
                </TerminalSection>

                {/* User stake info */}
                <StakedInfo userEstimateReward={userEstimateReward} />
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