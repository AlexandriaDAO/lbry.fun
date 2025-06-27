import React, { useEffect, useState, useCallback } from "react";
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';

import { _SERVICE as _SERVICESWAP } from '../../../../../../declarations/icp_swap/icp_swap.did';
import { stakingThunks } from "../thunks/stakingThunks";
import { flagHandler } from "../swapSlice";
import { useTerminalNotification } from "../hooks/useTerminalNotification";

// Destructure for easier access
const { claimReward } = stakingThunks;

const ClaimReward: React.FC = () => {
    const dispatch = useAppDispatch();
    const swap = useAppSelector((state) => state.swap);
    const { showLoading } = useTerminalNotification();

    const handleClaim = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        dispatch(claimReward({reward:swap.stakeInfo.rewardIcp}));
        showLoading("CLAIMING REWARDS", "Processing ICP reward claim");
    }, [dispatch, swap.stakeInfo.rewardIcp, showLoading]);

    useEffect(() => {
        if (swap.successClaimReward === true) {
            dispatch(flagHandler());
        }
    }, [swap])

    return (
        <button
            onClick={(e) => handleClaim(e)}
            className="terminal-button text-xs"
        >
            [CLAIM]
        </button>
    );
};
export default ClaimReward;