import React, { useEffect } from "react";
import { useAppDispatch } from '../../../../store/hooks/useAppDispatch';
import { useAppSelector } from "../../../../store/hooks/useAppSelector";
import { useTheme } from "@/providers/ThemeProvider";
import claimReward from "../../thunks/claimReward";
import { flagHandler } from "../../swapSlice";
const ClaimReward = ({ setLoadingModalV, setActionType }) => {
    const dispatch = useAppDispatch();
    const swap = useAppSelector((state) => state.swap);
    const { theme } = useTheme();
    const handleClaim = (e) => {
        e.preventDefault();
        dispatch(claimReward({ reward: swap.stakeInfo.rewardIcp }));
        setActionType("Claiming ICP rewards");
        setLoadingModalV(true);
    };
    useEffect(() => {
        if (swap.successClaimReward === true) {
            dispatch(flagHandler());
        }
    }, [swap]);
    return (React.createElement("button", { onClick: (e) => handleClaim(e), className: "lg:text-xl md:text-lg sm:text-base xs:text-xs font-semibold text-white bg-radiocolor dark:bg-gray-700 py-2 px-5 me-3 rounded-full border-2 border-[#000] dark:border-gray-600 hover:bg-opacity-90 dark:hover:bg-opacity-90" }, "Claim"));
};
export default ClaimReward;
