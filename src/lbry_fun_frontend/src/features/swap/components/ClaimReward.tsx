import React, { useEffect, useState, useCallback } from "react";
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';

import { _SERVICE as _SERVICESWAP } from '../../../../../../declarations/icp_swap/icp_swap.did';
import { stakingThunks } from "../thunks/stakingThunks";
import { flagHandler } from "../swapSlice";
import { useModal } from "../hooks/useModal";

// Destructure for easier access
const { claimReward } = stakingThunks;

const ClaimReward: React.FC = () => {
    const dispatch = useAppDispatch();
    const swap = useAppSelector((state) => state.swap);
    const { showLoading } = useModal();

    const handleClaim = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        dispatch(claimReward({reward:swap.stakeInfo.rewardIcp}));
        showLoading("Claiming ICP rewards", "Transaction is being processed. This may take a few moments.");
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