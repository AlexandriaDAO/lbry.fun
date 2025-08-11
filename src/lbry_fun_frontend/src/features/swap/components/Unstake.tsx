import React, { useEffect, useCallback } from "react";
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { ActorSubclass } from "@dfinity/agent";

import { _SERVICE as _SERVICESWAP } from '../../../../../../declarations/icp_swap/icp_swap.did';
import { stakingThunks } from "../thunks/stakingThunks";
import { resetOperation } from "../store/swapSlice";
import { useTerminalNotification } from "../hooks/useTerminalNotification";

// Destructure for easier access
const { unstake } = stakingThunks;

const Unstake: React.FC = () => {
    const dispatch = useAppDispatch();
    const unstakeStatus = useAppSelector((state) => state.swap.operations.unstake);
    const unstakeError = useAppSelector((state) => state.swap.operationErrors.unstake);
    const { showLoading, showSuccess, showError, hide } = useTerminalNotification();

    const handleUnstake = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        dispatch(unstake());
        showLoading("UNSTAKING", "Processing unstake request");
    }, [dispatch, showLoading]);

    // Handle unstake operation state changes
    useEffect(() => {
        if (unstakeStatus === 'pending') {
            // Loading state is already shown from handleUnstake
        } else if (unstakeStatus === 'success') {
            hide();
            showSuccess("SUCCESS", "Unstake completed");
            // Auto-reset is handled by middleware after 3 seconds
        } else if (unstakeStatus === 'error' && unstakeError) {
            hide();
            showError(unstakeError.title, unstakeError.message);
            dispatch(resetOperation('unstake'));
        }
    }, [unstakeStatus, unstakeError, dispatch, hide, showSuccess, showError])

    return (
        <button
            className={`bg-black border border-white/30 text-white font-mono text-sm px-4 py-2 hover:bg-white/10 text-xs ${unstakeStatus === 'pending' ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={(e) => handleUnstake(e)}
            disabled={unstakeStatus === 'pending'}
        >
            {unstakeStatus === 'pending' ? '[UNSTAKING...]' : '[UNSTAKE]'}
        </button>
    );
};
export default Unstake;