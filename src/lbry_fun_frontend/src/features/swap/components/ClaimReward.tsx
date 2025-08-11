import React, { useEffect, useState, useCallback } from "react";
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';

import { _SERVICE as _SERVICESWAP } from '../../../../../../declarations/icp_swap/icp_swap.did';
import { stakingThunks } from "../thunks/stakingThunks";
import { resetOperation } from "../store/swapSlice";
import { useTerminalNotification } from "../hooks/useTerminalNotification";

// Destructure for easier access
const { claimReward } = stakingThunks;

const ClaimReward: React.FC = () => {
    const dispatch = useAppDispatch();
    const swap = useAppSelector((state) => state.swap);
    const claimStatus = useAppSelector((state) => state.swap.operations.claim);
    const claimError = useAppSelector((state) => state.swap.operationErrors.claim);
    const { showLoading, showSuccess, showError, hide } = useTerminalNotification();

    const handleClaim = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        dispatch(claimReward({reward:swap.stakeInfo.rewardIcp}));
        showLoading("CLAIMING REWARDS", "Processing ICP reward claim");
    }, [dispatch, swap.stakeInfo.rewardIcp, showLoading]);

    // Handle claim operation state changes
    useEffect(() => {
        if (claimStatus === 'pending') {
            // Loading state is already shown from handleClaim
        } else if (claimStatus === 'success') {
            hide();
            showSuccess("SUCCESS", "Rewards claimed");
            // Auto-reset is handled by middleware after 3 seconds
        } else if (claimStatus === 'error' && claimError) {
            hide();
            showError(claimError.title, claimError.message);
            dispatch(resetOperation('claim'));
        }
    }, [claimStatus, claimError, dispatch, hide, showSuccess, showError])

    return (
        <button
            onClick={(e) => handleClaim(e)}
            className={`bg-black border border-white/30 text-white font-mono text-sm px-4 py-2 hover:bg-white/10 text-xs ${claimStatus === 'pending' ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={claimStatus === 'pending'}
        >
            {claimStatus === 'pending' ? '[CLAIMING...]' : '[CLAIM]'}
        </button>
    );
};
export default ClaimReward;