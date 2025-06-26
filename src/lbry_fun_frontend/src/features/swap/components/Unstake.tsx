import React, { useEffect, useCallback } from "react";
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { ActorSubclass } from "@dfinity/agent";

import { _SERVICE as _SERVICESWAP } from '../../../../../../declarations/icp_swap/icp_swap.did';
import { stakingThunks } from "../thunks/stakingThunks";
import { flagHandler } from "../swapSlice";
import { useModal } from "../hooks/useModal";

// Destructure for easier access
const { unstake } = stakingThunks;

const Unstake: React.FC = () => {
    const dispatch = useAppDispatch();
    const swap = useAppSelector((state) => state.swap);
    const { showLoading } = useModal();

    const handleUnstake = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        dispatch(unstake());
        showLoading("UnStake ICP", "Transaction is being processed. This may take a few moments.");
    }, [dispatch, showLoading]);

    useEffect(() => {
        if (swap.unstakeSuccess === true) {
            dispatch(flagHandler());
        }
    }, [swap])

    return (
        <button
            className="terminal-button text-xs"
            onClick={(e) => handleUnstake(e)}
        >
            [UNSTAKE]
        </button>
    );
};
export default Unstake;