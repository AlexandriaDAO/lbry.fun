import React, { useEffect, useState } from "react";
import { useAppDispatch } from '../../../../store/hooks/useAppDispatch';
import { useAppSelector } from "../../../../store/hooks/useAppSelector";
import { RootState } from "@/store";

import { _SERVICE as _SERVICESWAP } from '../../../../../../declarations/icp_swap/icp_swap.did';
import getStakeInfo from "../../thunks/getStakedInfo";
import ClaimReward from "./claimReward";
import Unstake from "./unstake";
import getALlStakesInfo from "../../thunks/getAllStakesInfo";
import getStakersCount from "../../thunks/getStakersCount";
import getAverageApy from "../../thunks/getAverageApy";

interface StakedInfoProps {
    setLoadingModalV: any;
    setActionType: any;
    userEstimateReward:number;
}
const StakedInfo: React.FC<StakedInfoProps> = ({ setLoadingModalV, setActionType,userEstimateReward }) => {
    const dispatch = useAppDispatch();
    const swap = useAppSelector((state: RootState) => state.swap);
    const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);

    useEffect(() => {
        if(isAuthenticated && principal) dispatch(getStakeInfo(principal));
        dispatch(getStakersCount());
        dispatch(getALlStakesInfo());
        dispatch(getAverageApy());
    }, [isAuthenticated, principal, dispatch])
    useEffect(() => {
        if (swap.successStake === true || swap.unstakeSuccess === true || swap.successClaimReward === true) {
            if(isAuthenticated && principal) dispatch(getStakeInfo(principal))
            dispatch(getALlStakesInfo())
            dispatch(getStakersCount())
        }
    }, [isAuthenticated, principal, swap, dispatch])

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
                        <ClaimReward setLoadingModalV={setLoadingModalV} setActionType={setActionType} />
                        <Unstake setLoadingModalV={setLoadingModalV} setActionType={setActionType} />
                    </div>
                </div>
            </div>
        </div>
    );
};
export default StakedInfo;