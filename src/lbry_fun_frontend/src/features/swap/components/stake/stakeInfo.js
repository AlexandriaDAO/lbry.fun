import React, { useEffect } from "react";
import { useAppDispatch } from '../../../../store/hooks/useAppDispatch';
import { useAppSelector } from "../../../../store/hooks/useAppSelector";
import { useTheme } from "@/providers/ThemeProvider";
import getStakeInfo from "../../thunks/getStakedInfo";
import ClaimReward from "./claimReward";
import Unstake from "./unstake";
import getALlStakesInfo from "../../thunks/getAllStakesInfo";
import getStakersCount from "../../thunks/getStakersCount";
import getAverageApy from "../../thunks/getAverageApy";
const StakedInfo = ({ setLoadingModalV, setActionType, userEstimateReward }) => {
    const dispatch = useAppDispatch();
    const swap = useAppSelector((state) => state.swap);
    const { principal, isAuthenticated } = useAppSelector((state) => state.auth);
    const { theme } = useTheme();
    useEffect(() => {
        if (isAuthenticated && principal)
            dispatch(getStakeInfo(principal));
        dispatch(getStakersCount());
        dispatch(getALlStakesInfo());
        dispatch(getAverageApy());
    }, [isAuthenticated, principal, dispatch]);
    useEffect(() => {
        if (swap.successStake === true || swap.unstakeSuccess === true || swap.successClaimReward === true) {
            if (isAuthenticated && principal)
                dispatch(getStakeInfo(principal));
            dispatch(getALlStakesInfo());
            dispatch(getStakersCount());
        }
    }, [isAuthenticated, principal, swap, dispatch]);
    return (React.createElement("div", null,
        React.createElement("table", { className: "min-w-full border-collapse" },
            React.createElement("thead", null,
                React.createElement("tr", { className: "hidden sm:table-row border-b border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800" },
                    React.createElement("th", { className: "py-3 text-left text-lg font-semibold text-radiocolor dark:text-white whitespace-nowrap" },
                        React.createElement("span", { className: "flex me-7" }, "Date")),
                    React.createElement("th", { className: "py-3 text-left text-lg font-semibold text-radiocolor dark:text-white whitespace-nowrap" },
                        React.createElement("span", { className: "flex me-7" }, "Amount Staked")),
                    React.createElement("th", { className: "py-3 text-left text-lg font-semibold text-radiocolor dark:text-white whitespace-nowrap" },
                        React.createElement("span", { className: "flex me-7" }, "Amount Earned")),
                    React.createElement("th", { className: "py-3 text-left text-lg font-semibold text-radiocolor dark:text-white whitespace-nowrap" },
                        React.createElement("span", { className: "flex me-7" }, "Estimated Reward")))),
            React.createElement("tbody", { className: "text-gray-600 dark:text-gray-300 text-sm font-light" },
                React.createElement("tr", { className: "block sm:table-row border-b border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800" },
                    React.createElement("td", { className: "block sm:table-cell py-3 text-left text-base font-medium text-radiocolor dark:text-white whitespace-nowrap" },
                        React.createElement("span", { className: "block sm:hidden font-semibold dark:text-gray-400" }, "Date:"),
                        new Date(Number(swap.stakeInfo.unix_stake_time) / 1e6).toLocaleString()),
                    React.createElement("td", { className: "block sm:table-cell py-3 sm:px-6 xs:px-2 text-left text-base font-medium text-radiocolor dark:text-white whitespace-nowrap" },
                        React.createElement("span", { className: "block sm:hidden font-semibold dark:text-gray-400" }, "Amount Staked:"),
                        swap.stakeInfo.stakedPrimary,
                        " ",
                        swap.activeSwapPool && swap.activeSwapPool[1]?.primary_token_name),
                    React.createElement("td", { className: "block sm:table-cell py-3 sm:px-6 xs:px-2 text-left text-base font-medium text-radiocolor dark:text-white whitespace-nowrap" },
                        React.createElement("span", { className: "block sm:hidden font-semibold dark:text-gray-400" }, "Amount Earned:"),
                        swap.stakeInfo.rewardIcp,
                        " ICP"),
                    React.createElement("td", { className: "block sm:table-cell py-3 sm:px-6 xs:px-2 text-left text-base font-medium text-radiocolor dark:text-white whitespace-nowrap" },
                        React.createElement("span", { className: "block sm:hidden font-semibold dark:text-gray-400" }, "Estimated Reward:"),
                        userEstimateReward,
                        " ICP"),
                    React.createElement("td", { className: "block sm:table-cell py-3 sm:px-6 xs:px-2 text-left" },
                        React.createElement("span", { className: "block sm:hidden font-semibold dark:text-gray-400" }, "Actions:"),
                        React.createElement("div", { className: "stake-table whitespace-nowrap" },
                            React.createElement(ClaimReward, { setLoadingModalV: setLoadingModalV, setActionType: setActionType }),
                            React.createElement(Unstake, { setLoadingModalV: setLoadingModalV, setActionType: setActionType }))))))));
};
export default StakedInfo;
