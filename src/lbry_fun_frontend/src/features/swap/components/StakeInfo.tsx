import React, { useEffect, useState } from "react";
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { RootState } from "@/store";

import { _SERVICE as _SERVICESWAP } from '../../../../../../declarations/icp_swap/icp_swap.did';
import { stakingThunks } from "../thunks/stakingThunks";
import ClaimReward from "./ClaimReward";
import Unstake from "./Unstake";

// Destructure for easier access
const { getStakedInfo, getAllStakesInfo, getStakersCount, getAverageApy } = stakingThunks;

interface StakedInfoProps {
    userEstimateReward:number;
}
const StakedInfo: React.FC<StakedInfoProps> = ({ userEstimateReward }) => {
    const dispatch = useAppDispatch();
    const swap = useAppSelector((state: RootState) => state.swap);
    const stakeStatus = useAppSelector((state: RootState) => state.swap.operations.stake);
    const unstakeStatus = useAppSelector((state: RootState) => state.swap.operations.unstake);
    const claimStatus = useAppSelector((state: RootState) => state.swap.operations.claim);
    const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);

    useEffect(() => {
        if(isAuthenticated && principal) dispatch(getStakedInfo(principal));
        dispatch(getStakersCount());
        dispatch(getAllStakesInfo());
        dispatch(getAverageApy());
    }, [isAuthenticated, principal, dispatch])
    useEffect(() => {
        // Refresh staking info when any staking operation succeeds
        if (stakeStatus === 'success' || unstakeStatus === 'success' || claimStatus === 'success') {
            if(isAuthenticated && principal) dispatch(getStakedInfo(principal))
            dispatch(getAllStakesInfo())
            dispatch(getStakersCount())
        }
    }, [isAuthenticated, principal, stakeStatus, unstakeStatus, claimStatus, dispatch])

    return (
        <div>
            <div className="terminal-header mb-2">
                <span className="terminal-prompt">&gt;</span> stake_info
            </div>
            <div className="terminal-info">
                <div className="terminal-row">
                    <span className="terminal-label">date:</span>
                    <span className="terminal-value">{new Date(Number(swap.stakeInfo.unix_stake_time) / 1e6).toLocaleString()}</span>
                </div>
                <div className="terminal-row">
                    <span className="terminal-label">amount_staked:</span>
                    <span className="terminal-value">{swap.stakeInfo.stakedPrimary} {swap.activeSwapPool&& swap.activeSwapPool[1]?.primary_token_name}</span>
                </div>
                <div className="terminal-row">
                    <span className="terminal-label">amount_earned:</span>
                    <span className="terminal-value">{swap.stakeInfo.rewardIcp} ICP</span>
                </div>
                <div className="terminal-row">
                    <span className="terminal-label">estimated_reward:</span>
                    <span className="terminal-value">{userEstimateReward} ICP</span>
                </div>
                <div className="terminal-row mt-2">
                    <span className="terminal-label">actions:</span>
                    <div className="flex gap-2">
                        <ClaimReward />
                        <Unstake />
                    </div>
                </div>
            </div>
        </div>
    );
};
export default StakedInfo;