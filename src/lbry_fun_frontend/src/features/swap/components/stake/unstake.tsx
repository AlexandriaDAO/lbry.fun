import React, { useEffect } from "react";
import { useAppDispatch } from '../../../../store/hooks/useAppDispatch';
import { useAppSelector } from "../../../../store/hooks/useAppSelector";
import { ActorSubclass } from "@dfinity/agent";
import { useTheme } from "@/providers/ThemeProvider";

import { _SERVICE as _SERVICESWAP } from '../../../../../../declarations/icp_swap/icp_swap.did';
import { flagHandler } from "../../swapSlice";
import unstake from "../../thunks/unstake";

interface UnstakeProps {
    setLoadingModalV: any;
    setActionType: any;
}

const Unstake: React.FC<UnstakeProps> = ({ setLoadingModalV, setActionType}) => {
    const dispatch = useAppDispatch();
    const swap = useAppSelector((state) => state.swap);
    const { theme } = useTheme();

    const handleUnstake = (e: any) => {
        e.preventDefault();
        dispatch(unstake());
        setActionType("UnStake ICP");
        setLoadingModalV(true);
    }

    useEffect(() => {
        if (swap.unstakeSuccess === true) {
            dispatch(flagHandler());
        }
    }, [swap])

    return (
        <button
            className="lg:text-xl md:text-lg sm:text-base xs:text-xs font-semibold text-warning-foreground border-2 border-warning py-2 px-5 me-3 rounded-full hover:bg-warning/10"
            onClick={(e) => handleUnstake(e)}
        >
            Unstake
        </button>
    );
};
export default Unstake;
