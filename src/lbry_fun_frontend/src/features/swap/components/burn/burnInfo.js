import { useAppSelector } from "@/store/hooks/useAppSelector";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightLong } from "@fortawesome/free-solid-svg-icons";
import React from "react";
const BurnInfo = ({ maxBurnAllowed }) => {
    const swap = useAppSelector((state) => state.swap);
    const tokenomics = useAppSelector((state) => state.tokenomics);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: 'ms-0 2xl:ms-3 xl:ms-3 lg:ms-3 md:ms-3 sm:ms-0' },
            React.createElement("div", { className: 'border border-gray-400 dark:border-gray-600 bg-white dark:bg-gray-800 py-5 px-5 rounded-2xl' },
                React.createElement("ul", { className: 'ps-0' },
                    React.createElement("li", { className: 'flex justify-between mb-5' },
                        React.createElement("strong", { className: 'lg:text-lg md:text-base sm:text-sm font-medium me-1 text-black dark:text-gray-200' },
                            "Max  ",
                            swap.activeSwapPool && swap.activeSwapPool[1]?.secondary_token_name,
                            " Burn allowed:"),
                        React.createElement("span", { className: 'lg:text-lg md:text-base sm:text-sm font-medium text-black dark:text-gray-200' },
                            maxBurnAllowed.toFixed(4),
                            "  ",
                            swap.activeSwapPool && swap.activeSwapPool[1]?.secondary_token_name)),
                    React.createElement("li", { className: 'flex justify-between mb-5' },
                        React.createElement("strong", { className: 'lg:text-lg md:text-base sm:text-sm font-medium me-1 text-black dark:text-gray-200' },
                            Number(swap.secondaryRatio).toFixed(4),
                            " Secondary",
                            React.createElement("span", { className: 'mx-2' },
                                React.createElement(FontAwesomeIcon, { icon: faArrowRightLong, className: "dark:text-gray-200" })),
                            "0.5 ICP/")),
                    React.createElement("li", { className: 'flex justify-between mb-5' },
                        React.createElement("strong", { className: 'lg:text-lg md:text-base sm:text-sm font-medium me-1 text-black dark:text-gray-200' },
                            "1  ",
                            swap.activeSwapPool && swap.activeSwapPool[1]?.secondary_token_symbol,
                            React.createElement("span", { className: 'mx-2' },
                                React.createElement(FontAwesomeIcon, { icon: faArrowRightLong, className: "dark:text-gray-200" })),
                            tokenomics.primaryMintRate,
                            "  ",
                            swap.activeSwapPool && swap.activeSwapPool[1]?.primary_token_name)),
                    React.createElement("li", { className: 'flex justify-between' },
                        React.createElement("strong", { className: 'lg:text-lg md:text-base sm:text-sm font-medium me-1 text-black dark:text-gray-200' }, "Network Fees"),
                        React.createElement("span", { className: 'lg:text-lg md:text-base sm:text-sm font-medium text-black dark:text-gray-200' },
                            React.createElement("span", { className: 'text-multycolor dark:text-blue-400' }, swap.secondaryFee),
                            "  ",
                            swap.activeSwapPool && swap.activeSwapPool[1]?.secondary_token_symbol)))))));
};
export default BurnInfo;
