import React, { useEffect, useState } from "react";
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { RootState } from "@/store";

import { _SERVICE as _SERVICESWAP } from '../../../../../../declarations/icp_swap/icp_swap.did';
import { stakingThunks } from "../thunks/stakingThunks";
import ClaimReward from "./ClaimReward";
import Unstake from "./Unstake";
import { TerminalRow, TerminalSection } from '@/components/terminal';

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
    const tvlData = useAppSelector((state: RootState) => state.lbryFun.tvlData);

    useEffect(() => {
        if(isAuthenticated && principal) dispatch(getStakedInfo(principal));
        dispatch(getStakersCount());
        dispatch(getAllStakesInfo());
        dispatch(getAverageApy());
    }, [isAuthenticated, principal, dispatch])
    
    // Recalculate APY when TVL data becomes available
    useEffect(() => {
        if (swap.activeSwapPool && tvlData && Object.keys(tvlData).length > 0) {
            const poolId = swap.activeSwapPool[0];
            if (tvlData[poolId]) {
                // TVL data is now available, recalculate APY
                dispatch(getAverageApy());
            }
        }
    }, [tvlData, swap.activeSwapPool, dispatch])
    useEffect(() => {
        // Refresh staking info when any staking operation succeeds
        if (stakeStatus === 'success' || unstakeStatus === 'success' || claimStatus === 'success') {
            if(isAuthenticated && principal) dispatch(getStakedInfo(principal))
            dispatch(getAllStakesInfo())
            dispatch(getStakersCount())
        }
    }, [isAuthenticated, principal, stakeStatus, unstakeStatus, claimStatus, dispatch])

    return (
        <div className="border-t border-white/30 mt-2 pt-3">
            <TerminalSection title="STAKE_INFO">
                <TerminalRow 
                    label="date" 
                    value={new Date(Number(swap.stakeInfo.unix_stake_time) / 1e6).toLocaleString()}
                />
                <TerminalRow 
                    label="amount_staked" 
                    value={swap.stakeInfo.stakedPrimary} 
                    unit={swap.activeSwapPool?.[1]?.primary_token_symbol}
                    accent
                />
                <TerminalRow 
                    label="amount_earned" 
                    value={swap.stakeInfo.rewardIcp} 
                    unit="ICP"
                    accent
                />
                <TerminalRow 
                    label="estimated_reward" 
                    value={userEstimateReward} 
                    unit="ICP"
                />
                <TerminalRow label="actions">
                    <div className="flex gap-2">
                        <ClaimReward />
                        <Unstake />
                    </div>
                </TerminalRow>
            </TerminalSection>
        </div>
    );
};
export default StakedInfo;